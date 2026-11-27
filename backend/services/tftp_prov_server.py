"""
Nornia Enterprise AI PBX — Built-in RFC 1350 + RFC 2348 NAT-Friendly TFTP Auto-Provisioning Server (UDP 69).

Designed specifically for Cisco Enterprise (CP-3905 / CP-78xx / CP-79xx / CP-88xx / CP-89xx)
and Cisco MPP/SPA phones where the device UI or DHCP Option 66/150 only accepts a raw IP address.

NAT Traversal Design:
  - Replies with OACK / DATA / ERROR directly from the listening UDP 69 socket (symmetric port 69)
    rather than an ephemeral port. This guarantees stateful NAT routers and cloud firewalls pass
    every block back to remote Cisco phones without requiring a TFTP ALG.

Security:
  - Read-only (RRQ only; WRQ uploads are always rejected with Access Violation).
  - Path traversal strictly blocked (basename only).
  - Only serves config files for MAC addresses explicitly registered in Nornia Autoprovision /
    SystemUser sip_devices (plus static XMLDefault.cnf.xml / dialplan.xml).
  - Supports RFC 2348 blksize & tsize OACK negotiation required by Cisco 78xx/88xx firmware.
"""

from __future__ import annotations

import asyncio
import os
import struct
from typing import Awaitable, Callable, Dict, Optional, Tuple

OP_RRQ = 1
OP_WRQ = 2
OP_DATA = 3
OP_ACK = 4
OP_ERROR = 5
OP_OACK = 6

ERR_NOT_DEFINED = 0
ERR_FILE_NOT_FOUND = 1
ERR_ACCESS_VIOLATION = 2
ERR_ILLEGAL_OP = 4

_tftp_transport: Optional[asyncio.DatagramTransport] = None


def _build_error_pkt(code: int, message: str) -> bytes:
    return struct.pack("!HH", OP_ERROR, code) + message.encode("ascii", errors="ignore") + b"\x00"


def _parse_rrq(data: bytes) -> Tuple[str, str, dict]:
    parts = data[2:].split(b"\x00")
    filename = parts[0].decode("utf-8", errors="ignore").strip() if len(parts) > 0 else ""
    mode = parts[1].decode("ascii", errors="ignore").strip().lower() if len(parts) > 1 else "octet"
    opts = {}
    i = 2
    while i + 1 < len(parts):
        k = parts[i].decode("ascii", errors="ignore").strip().lower()
        v = parts[i + 1].decode("ascii", errors="ignore").strip()
        if k:
            opts[k] = v
        i += 2
    return filename, mode, opts


class _TftpTransferState:
    """Tracks one active RRQ transfer sent symmetrically over the main UDP 69 socket."""

    def __init__(
        self,
        parent: "NorniaTftpServerProtocol",
        client_addr: Tuple[str, int],
        filename: str,
        payload: bytes,
        blksize: int,
        send_oack: bool,
        oack_opts: dict,
    ):
        self.parent = parent
        self.client_addr = client_addr
        self.filename = filename
        self.payload = payload
        self.blksize = max(512, min(1468, int(blksize or 512)))
        self.send_oack = send_oack
        self.oack_opts = oack_opts
        self.block_num = 0 if send_oack else 1
        self.done = False
        self.retries = 0
        self._timeout_handle: Optional[asyncio.TimerHandle] = None
        self.total_blocks = (len(payload) // self.blksize) + 1

    def start(self) -> None:
        self._send_current()

    def _schedule_retry(self) -> None:
        if self._timeout_handle:
            self._timeout_handle.cancel()
        loop = asyncio.get_running_loop()
        self._timeout_handle = loop.call_later(2.0, self._on_timeout)

    def _on_timeout(self) -> None:
        if self.done or not self.parent.transport:
            return
        self.retries += 1
        if self.retries > 5:
            self.close()
            return
        self._send_current()

    def _send_current(self) -> None:
        if not self.parent.transport or self.done:
            return
        if self.block_num == 0 and self.send_oack:
            pkt = struct.pack("!H", OP_OACK)
            for k, v in self.oack_opts.items():
                pkt += k.encode("ascii") + b"\x00" + str(v).encode("ascii") + b"\x00"
            self.parent.transport.sendto(pkt, self.client_addr)
            self._schedule_retry()
            return

        offset = (self.block_num - 1) * self.blksize
        chunk = self.payload[offset:offset + self.blksize]
        pkt = struct.pack("!HH", OP_DATA, self.block_num & 0xFFFF) + chunk
        self.parent.transport.sendto(pkt, self.client_addr)
        self._schedule_retry()

    def handle_ack(self, ack_blk: int) -> None:
        if self.done:
            return
        if ack_blk == (self.block_num & 0xFFFF):
            self.retries = 0
            if self.block_num >= self.total_blocks:
                print(
                    f"[TFTP Prov] Completed {self.filename} ({len(self.payload)} B, {self.total_blocks} blk) -> "
                    f"{self.client_addr[0]}:{self.client_addr[1]}",
                    flush=True,
                )
                self.parent._emit_event(
                    event="COMPLETED",
                    filename=self.filename,
                    client_ip=self.client_addr[0],
                    client_port=self.client_addr[1],
                    status_code=200,
                    size_bytes=len(self.payload),
                    blocks=self.total_blocks,
                    detail=f"Transfer tamamlandı ({len(self.payload)} B, {self.total_blocks} blok)",
                )
                self.close()
                return
            self.block_num += 1
            self._send_current()

    def close(self) -> None:
        self.done = True
        if self._timeout_handle:
            self._timeout_handle.cancel()
            self._timeout_handle = None
        if self.parent.transfers.get(self.client_addr) is self:
            self.parent.transfers.pop(self.client_addr, None)


class NorniaTftpServerProtocol(asyncio.DatagramProtocol):
    def __init__(
        self,
        resolver: Callable[[str, str], Awaitable[Optional[bytes]]],
        on_event: Optional[Callable[[dict], None]] = None,
    ):
        self.resolver = resolver
        self.on_event = on_event
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.transfers: Dict[Tuple[str, int], _TftpTransferState] = {}

    def _emit_event(self, **kwargs) -> None:
        if not self.on_event:
            return
        try:
            self.on_event(kwargs)
        except Exception:
            pass

    def connection_made(self, transport: asyncio.DatagramTransport) -> None:
        self.transport = transport

    def datagram_received(self, data: bytes, addr: Tuple[str, int]) -> None:
        if len(data) < 4:
            return
        opcode = struct.unpack("!H", data[:2])[0]
        if opcode == OP_ACK:
            ack_blk = struct.unpack("!H", data[2:4])[0]
            tr = self.transfers.get(addr)
            if tr is not None:
                tr.handle_ack(ack_blk)
            return
        if opcode == OP_ERROR:
            tr = self.transfers.get(addr)
            if tr is not None:
                tr.close()
            return
        if opcode == OP_WRQ:
            if self.transport:
                self.transport.sendto(_build_error_pkt(ERR_ACCESS_VIOLATION, "Read-only provisioning TFTP"), addr)
            return
        if opcode != OP_RRQ:
            return

        raw_name, _mode, opts = _parse_rrq(data)
        safe_name = os.path.basename(raw_name.replace("\\", "/")).strip()
        if not safe_name or ".." in raw_name:
            self._emit_event(
                event="RRQ_ERR",
                filename=raw_name,
                client_ip=addr[0],
                client_port=addr[1],
                status_code=403,
                size_bytes=0,
                blocks=0,
                detail="Geçersiz dosya yolu reddedildi",
            )
            if self.transport:
                self.transport.sendto(_build_error_pkt(ERR_ACCESS_VIOLATION, "Invalid filename"), addr)
            return

        # Deduplicate rapid client retransmissions while transfer is already active for same addr & file
        existing = self.transfers.get(addr)
        if existing is not None and not existing.done and existing.filename == safe_name:
            existing._send_current()
            return

        asyncio.create_task(self._handle_rrq(safe_name, opts, addr))

    async def _handle_rrq(self, filename: str, opts: dict, addr: Tuple[str, int]) -> None:
        client_ip = addr[0]
        try:
            payload = await self.resolver(filename, client_ip)
        except Exception as exc:
            print(f"[TFTP Prov] Resolver error for {filename} ({client_ip}): {exc}", flush=True)
            self._emit_event(
                event="RRQ_ERR",
                filename=filename,
                client_ip=client_ip,
                client_port=addr[1],
                status_code=500,
                size_bytes=0,
                blocks=0,
                detail=f"Çözümleme hatası: {exc}",
            )
            payload = None

        if payload is None:
            print(f"[TFTP Prov] Not found: {filename} -> {client_ip}:{addr[1]}", flush=True)
            self._emit_event(
                event="RRQ_404",
                filename=filename,
                client_ip=client_ip,
                client_port=addr[1],
                status_code=404,
                size_bytes=0,
                blocks=0,
                detail="Dosya TFTP dizininde bulunamadı",
            )
            if self.transport:
                self.transport.sendto(_build_error_pkt(ERR_FILE_NOT_FOUND, f"Not found: {filename}"), addr)
            return

        blksize = 512
        oack_opts = {}
        if "blksize" in opts:
            try:
                blksize = max(512, min(1468, int(opts["blksize"])))
                oack_opts["blksize"] = str(blksize)
            except Exception:
                blksize = 512
        if "tsize" in opts:
            oack_opts["tsize"] = str(len(payload))

        send_oack = bool(oack_opts)
        old_tr = self.transfers.pop(addr, None)
        if old_tr is not None:
            old_tr.close()

        print(f"[TFTP Prov] Serving {filename} ({len(payload)} B, blksize={blksize}) -> {client_ip}:{addr[1]}", flush=True)
        self._emit_event(
            event="RRQ_OK",
            filename=filename,
            client_ip=client_ip,
            client_port=addr[1],
            status_code=200,
            size_bytes=len(payload),
            blocks=(len(payload) // blksize) + 1,
            detail=f"Gönderiliyor ({len(payload)} B, blksize={blksize})",
        )
        tr = _TftpTransferState(
            parent=self,
            client_addr=addr,
            filename=filename,
            payload=payload,
            blksize=blksize,
            send_oack=send_oack,
            oack_opts=oack_opts,
        )
        self.transfers[addr] = tr
        tr.start()


async def start_tftp_provisioning_server(
    resolver: Callable[[str, str], Awaitable[Optional[bytes]]],
    host: str = "0.0.0.0",
    port: Optional[int] = None,
    on_event: Optional[Callable[[dict], None]] = None,
) -> bool:
    """Starts the built-in UDP TFTP server (default port 69). Fails gracefully if port unavailable."""
    global _tftp_transport
    if os.getenv("NORNIA_TFTP_ENABLED", "1") == "0":
        return False
    if _tftp_transport is not None and not _tftp_transport.is_closing():
        return True

    bind_port = int(port or os.getenv("NORNIA_TFTP_PORT", "69"))
    loop = asyncio.get_running_loop()
    try:
        transport, _ = await loop.create_datagram_endpoint(
            lambda: NorniaTftpServerProtocol(resolver, on_event=on_event),
            local_addr=(host, bind_port),
        )
        _tftp_transport = transport
        print(f"[TFTP Prov] Nornia Cisco/IP-Phone TFTP sunucusu başlatıldı: udp://{host}:{bind_port}", flush=True)
        return True
    except PermissionError:
        print(
            f"[TFTP Prov] Bilgi: UDP {bind_port} için root/CAP_NET_BIND_SERVICE gerekir; "
            f"HTTP root (/SEP<MAC>.cnf.xml, /spa<mac>.xml) aktif kalmaya devam eder.",
            flush=True,
        )
        return False
    except OSError as exc:
        print(f"[TFTP Prov] Bilgi: UDP {bind_port} bağlanamadı ({exc}); TFTP atlandı.", flush=True)
        return False
