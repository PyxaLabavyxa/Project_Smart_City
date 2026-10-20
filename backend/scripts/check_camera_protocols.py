"""Run inside API container with isolated fixtures from tests/camera_protocol_fixture.py.

Fixtures live on a test-only Docker bridge with public-looking addresses so the
real egress firewall remains enabled. Never expose fixture containers to the host.
"""

import os

import httpx

worker = os.environ.get("CAMERA_WORKER_URL", "http://camera-worker:8001")
sources = [
    # DNS regression: Docker rewrites 127.0.0.11:53 to an ephemeral resolver port.
    ("snapshot", "http://dompulse-camera-qa-http:8090/snapshot", {}),
    ("snapshot", "http://11.203.45.10:8090/snapshot", {}),
    ("snapshot", "http://11.203.45.10:8090/basic", {
        "username": "camera", "password": "test-pass", "auth_type": "basic",
    }),
    ("mjpeg", "http://11.203.45.10:8090/mjpeg", {}),
    ("hls", "http://11.203.45.10:8090/stream.m3u8", {}),
    ("http_video", "http://11.203.45.10:8090/video.mp4", {}),
    ("rtsp", "rtsp://11.203.45.11:8554/test", {}),
    ("rtmp", "rtmp://11.203.45.11:1935/rtmp-test", {}),
    ("onvif", "http://11.203.45.11:8090/onvif/device_service", {"rtsp_port": 8554}),
]
failures = []
with httpx.Client(timeout=25, trust_env=False) as client:
    for kind, url, extra in sources:
        payload = {"source_type": kind, "source_url": url, **extra}
        response = client.post(worker + "/frame", json=payload)
        ok = response.status_code == 200 and response.content.startswith(b"\xff\xd8")
        print(f"{kind}: {response.status_code}, JPEG={ok}", flush=True)
        if not ok:
            failures.append(kind)
            continue
        if kind != "snapshot":
            with client.stream("POST", worker + "/live", json=payload) as live:
                data = bytearray()
                for chunk in live.iter_bytes():
                    data.extend(chunk)
                    if b"\xff\xd9" in data or len(data) > 200_000:
                        break
                ok = live.status_code == 200 and b"\xff\xd8" in data
                print(f"  live: {live.status_code}, JPEG={ok}", flush=True)
                if not ok:
                    failures.append(kind + "-live")
    response = client.post(worker + "/frame", json={
        "source_type": "hls", "source_url": "http://11.203.45.10:8090/bad.m3u8",
    })
    assert response.status_code == 503, "Private HLS segment must be blocked"
    print("Private HLS segment: blocked", flush=True)
if failures:
    raise SystemExit("Failed protocols: " + ", ".join(failures))
