"""
Nornia Enterprise AI PBX — Built-in RFC 1350 + RFC 2348 TFTP Auto-Provisioning Server (UDP 69).

Designed specifically for Cisco Enterprise (CP-78xx / CP-88xx / CP-79xx) and Cisco MPP/SPA
phones where the device UI or DHCP Option 66/150 only accepts a raw IP address (no HTTP URL).

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
from typing import Awaitable, Callable, Optional, Tuple

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


class _TftpTransferProtocol(asyncio.DatagramProtocol):
    """Per-request ephemeral UDP transfer handler (RFC 1350 TID isolation)."""

    def __init__(self, client_addr: Tuple[str, int], payload: bytes, blksize: int, send_oack: bool, oack_opts: dict):
        self.client_addr = client_addr
        self.payload = payload
        self.blksize = max(512, min(1468, int(blksize or 512)))
        self.send_oack = send_oack
        self.oack_opts = oack_opts
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.block_num = 0 if send_oack else 1
        self.done = False
        self.retries = 0
        self._timeout_handle: Optional[asyncio.TimerHandle] = None
        self.total_blocks = (len(payload) // self.blksize) + 1

    def connection_made(self, transport: asyncio.DatagramTransport) -> None:
        self.transport = transport
        self._send_current()

    def _schedule_retry(self) -> None:
        if self._timeout_handle:
            self._timeout_handle.cancel()
        loop = asyncio.get_running_loop()
        self._timeout_handle = loop.call_later(2.0, self._on_timeout)

    def _on_timeout(self) -> None:
        if self.done or not self.transport:
            return
        self.retries += 1
        if self.retries > 5:
            self._close()
            return
        self._send_current()

    def _send_current(self) -> None:
        if not self.transport or self.done:
            return
        if self.block_num == 0 and self.send_oack:
            pkt = struct.pack("!H", OP_OACK)
            for k, v in self.oack_opts.items():
                pkt += k.encode("ascii") + b"\x00" + str(v).encode("ascii") + b"\x00"
            self.transport.sendto(pkt, self.client_addr)
            self._schedule_retry()
            return

        offset = (self.block_num - 1) * self.blksize
        chunk = self.payload[offset:offset + self.blksize]
        pkt = struct.pack("!HH", OP_DATA, self.block_num & 0xFFFF) + chunk
        self.transport.sendto(pkt, self.client_addr)
        self._schedule_retry()

    def datagram_received(self, data: bytes, addr: Tuple[str, int]) -> None:
        if addr != self.client_addr or len(data) < 4 or self.done:
            return
        opcode, ack_blk = struct.unpack("!HH", data[:4])
        if opcode == OP_ERROR:
            self._close()
            return
        if opcode != OP_ACK:
            return
        if ack_blk == (self.block_num & 0xFFFF):
            self.retries = 0
            if self.block_num >= self.total_blocks:
                self._close()
                return
            self.block_num += 1
            self._send_current()

    def _close(self) -> None:
        self.done = True
        if self._timeout_handle:
            self._timeout_handle.cancel()
            self._timeout_handle = None
        if self.transport:
            try:
                self.transport.close()
            except Exception:
                pass


class NorniaTftpServerProtocol(asyncio.DatagramProtocol):
    def __init__(self, resolver: Callable[[str, str], Awaitable[Optional[bytes]]]):
        self.resolver = resolver
        self.transport: Optional[asyncio.DatagramTransport] = None

    def connection_made(self, transport: asyncio.DatagramTransport) -> None:
        self.transport = transport

    def datagram_received(self, data: bytes, addr: Tuple[str, int]) -> None:
        if len(data) < 4:
            return
        opcode = struct.unpack("!H", data[:2])[0]
        if opcode == OP_WRQ:
            if self.transport:
                self.transport.sendto(_build_error_pkt(ERR_ACCESS_VIOLATION, "Read-only provisioning TFTP"), addr)
            return
        if opcode != OP_RRQ:
            return

        raw_name, _mode, opts = _parse_rrq(data)
        safe_name = os.path.basename(raw_name.replace("\\", "/")).strip()
        if not safe_name or ".." in raw_name:
            if self.transport:
                self.transport.sendto(_build_error_pkt(ERR_ACCESS_VIOLATION, "Invalid filename"), addr)
            return

        asyncio.create_task(self._handle_rrq(safe_name, opts, addr))

    async def _handle_rrq(self, filename: str, opts: dict, addr: Tuple[str, int]) -> None:
        client_ip = addr[0]
        try:
            payload = await self.resolver(filename, client_ip)
        except Exception as exc:
            print(f"[TFTP Prov] Resolver error for {filename} ({client_ip}): {exc}", flush=True)
            payload = None

        if payload is None:
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
        print(f"[TFTP Prov] Serving {filename} ({len(payload)} B, blksize={blksize}) -> {client_ip}:{addr[1]}", flush=True)
        loop = asyncio.get_running_loop()
        try:
            await loop.create_datagram_endpoint(
                lambda: _TftpTransferProtocol(addr, payload, blksize, send_oack, oack_opts),
                local_addr=("0.0.0.0", 0),
            )
        except Exception as exc:
            print(f"[TFTP Prov] Transfer socket error: {exc}", flush=True)


async def start_tftp_provisioning_server(
    resolver: Callable[[str, str], Awaitable[Optional[bytes]]],
    host: str = "0.0.0.0",
    port: Optional[int] = None,
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
            lambda: NorniaTftpServerProtocol(resolver),
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
