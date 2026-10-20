"""Deterministic HTTP/ONVIF fixture for isolated Docker protocol checks. No public ports."""

import base64
import io
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image

ROOT = Path("/tmp/camera-fixture")
ROOT.mkdir(exist_ok=True)
image = io.BytesIO()
Image.new("RGB", (640, 360), "#23658b").save(image, "JPEG")
JPEG = image.getvalue()
subprocess.run([
    "ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=8",
    "-t", "3", "-an", "-c:v", "libx264", "-threads", "1", "-g", "8", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-y", str(ROOT / "video.mp4"),
], check=True)
subprocess.run([
    "ffmpeg", "-v", "error", "-i", str(ROOT / "video.mp4"), "-c", "copy", "-f", "hls",
    "-hls_time", "1", "-hls_list_size", "0", "-y", str(ROOT / "stream.m3u8"),
], check=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/basic"):
            if self.headers.get("Authorization") != "Basic " + base64.b64encode(b"camera:test-pass").decode():
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="camera"')
                self.end_headers()
                return
        if self.path.startswith("/snapshot") or self.path.startswith("/basic"):
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.end_headers()
            self.wfile.write(JPEG)
        elif self.path == "/mjpeg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                for _ in range(180):
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(JPEG)).encode() + b"\r\n\r\n" + JPEG + b"\r\n")
                    self.wfile.flush()
                    time.sleep(.125)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif self.path == "/bad.m3u8":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nhttp://127.0.0.1:8001/health\n#EXT-X-ENDLIST\n")
        elif self.path.lstrip("/") in ("video.mp4", "stream.m3u8", "stream0.ts", "stream1.ts", "stream2.ts"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write((ROOT / self.path.lstrip("/")).read_bytes())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        if "GetCapabilities" in data:
            result = '<tds:GetCapabilitiesResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:Capabilities><tt:Media><tt:XAddr>http://192.168.1.50/onvif/media</tt:XAddr></tt:Media></tds:Capabilities></tds:GetCapabilitiesResponse>'
        elif "GetProfiles" in data:
            result = '<trt:GetProfilesResponse><trt:Profiles token="main"/></trt:GetProfilesResponse>'
        else:
            result = '<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>rtsp://192.168.1.50:8554/test</tt:Uri></trt:MediaUri></trt:GetStreamUriResponse>'
        envelope = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Body>' + result + '</s:Body></s:Envelope>'
        self.send_response(200)
        self.send_header("Content-Type", "application/soap+xml")
        self.end_headers()
        self.wfile.write(envelope.encode())


ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
