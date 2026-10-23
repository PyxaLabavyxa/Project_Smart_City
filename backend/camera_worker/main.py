"""No database, mounted secrets or public ports. Run only with the egress firewall."""

import asyncio
import base64
import hashlib
import io
import os
from contextlib import aclosing, asynccontextmanager
from datetime import UTC, datetime
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit
from xml.etree.ElementTree import ParseError
from xml.sax.saxutils import escape

import httpx
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, StreamingResponse
from PIL import Image, UnidentifiedImageError

from smart_city_api.core.camera_source import CameraSource, require_public_address

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
MAX_IMAGE = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000
active = 0


@asynccontextmanager
async def capacity():
    global active
    if active >= 6:
        raise HTTPException(429, "Слишком много подключений к камерам. Повторите позже")
    active += 1
    try:
        yield
    finally:
        active -= 1


def auth(source):
    if not source.username:
        return None
    cls = httpx.DigestAuth if source.auth_type == "digest" else httpx.BasicAuth
    return cls(source.username, source.password.get_secret_value())


async def soap(source, endpoint, action, body):
    await require_public_address(endpoint)
    nonce = os.urandom(20)
    created = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    digest = base64.b64encode(
        hashlib.sha1(
            nonce + created.encode() + source.password.get_secret_value().encode()
        ).digest()
    ).decode()
    security = (
        '<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/'
        'oasis-200401-wss-wssecurity-secext-1.0.xsd" '
        f'xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">'
        f"<wsse:UsernameToken><wsse:Username>{escape(source.username)}</wsse:Username>"
        f'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</wsse:Password>'
        f'<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{base64.b64encode(nonce).decode()}</wsse:Nonce>'
        f"<wsu:Created>{created}</wsu:Created></wsse:UsernameToken></wsse:Security>"
    )
    envelope = f'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Header>{security}</s:Header><s:Body>{body}</s:Body></s:Envelope>'
    async with httpx.AsyncClient(timeout=8, trust_env=False, auth=auth(source)) as client:
        async with client.stream(
            "POST",
            endpoint,
            content=envelope.encode(),
            headers={"Content-Type": f'application/soap+xml; charset=utf-8; action="{action}"'},
        ) as response:
            response.raise_for_status()
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > 1_000_000:
                    raise ValueError("ONVIF response too large")
    return ElementTree.fromstring(bytes(data))


async def onvif_stream(source):
    """ONVIF Media1 Profile S/T: explicit device URL, no LAN discovery."""
    device = source.source_url
    if urlsplit(device).path in ("", "/"):
        device = device.rstrip("/") + "/onvif/device_service"
    capabilities = await soap(
        source,
        device,
        "http://www.onvif.org/ver10/device/wsdl/GetCapabilities",
        '<GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl"><Category>Media</Category></GetCapabilities>',
    )
    media = capabilities.find(
        ".//{http://www.onvif.org/ver10/schema}Media/{http://www.onvif.org/ver10/schema}XAddr"
    )
    if media is None or not media.text:
        raise ValueError("ONVIF Media service unavailable")
    # ONVIF cameras behind NAT advertise LAN URLs. Keep the configured public
    # origin and use only the advertised path, never a private or different host.
    origin = urlsplit(device)
    advertised = urlsplit(media.text)
    if advertised.scheme not in ("http", "https") or not advertised.hostname:
        raise ValueError("Invalid ONVIF media address")
    media_url = urlunsplit(advertised._replace(scheme=origin.scheme, netloc=origin.netloc))
    CameraSource(source_url=media_url)
    profiles = await soap(
        source,
        media_url,
        "http://www.onvif.org/ver10/media/wsdl/GetProfiles",
        '<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>',
    )
    tokens = [
        node.attrib.get("token") for node in profiles.iter() if node.tag.endswith("}Profiles")
    ]
    token = source.profile or (tokens[0] if tokens else None)
    if not token or token not in tokens:
        raise ValueError("ONVIF profile unavailable")
    result = await soap(
        source,
        media_url,
        "http://www.onvif.org/ver10/media/wsdl/GetStreamUri",
        '<GetStreamUri xmlns="http://www.onvif.org/ver10/media/wsdl"><StreamSetup>'
        '<Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>'
        '<Transport xmlns="http://www.onvif.org/ver10/schema"><Protocol>RTSP</Protocol></Transport>'
        f"</StreamSetup><ProfileToken>{escape(token)}</ProfileToken></GetStreamUri>",
    )
    uri = result.find(".//{http://www.onvif.org/ver10/schema}Uri")
    if uri is None or not uri.text:
        raise ValueError("ONVIF stream unavailable")
    stream = urlsplit(uri.text)
    if stream.scheme not in ("rtsp", "rtsps") or not stream.hostname:
        raise ValueError("Invalid ONVIF stream address")
    host = f"[{origin.hostname}]" if ":" in origin.hostname else origin.hostname
    stream_url = urlunsplit(
        stream._replace(netloc=f"{host}:{source.rtsp_port or stream.port or 554}")
    )
    target = CameraSource(
        source_type="rtsp",
        source_url=stream_url,
        username=source.username,
        password=source.password,
    )
    await require_public_address(target.source_url)
    return target


def input_url(source):
    url = urlsplit(source.source_url)
    if source.username:
        credentials = (
            quote(source.username, safe="")
            + ":"
            + quote(source.password.get_secret_value(), safe="")
        )
        url = url._replace(netloc=credentials + "@" + url.netloc)
    return urlunsplit(url)


def connection_sources(source):
    yield source
    if source.source_type != "rtmp" or not source.username:
        return
    url = urlsplit(source.source_url)
    if {key for key, _ in parse_qsl(url.query)} & {"user", "pass"}:
        return
    # Keep native RTMP authentication first. MediaMTX and similar servers use
    # query credentials instead; retry only if no video was produced.
    query = urlencode({"user": source.username, "pass": source.password.get_secret_value()})
    query_url = urlunsplit(url._replace(query=url.query + ("&" if url.query else "") + query))
    yield CameraSource(
        **{
            **source.private_dict(),
            "source_url": query_url,
            "username": "",
            "password": "",
        }
    )


def ffmpeg_args(source, live=False):
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-threads",
        "1",
        "-protocol_whitelist",
        "http,https,tcp,tls,rtsp,rtmp,rtmps,httpproxy,crypto",
    ]
    if source.source_type == "rtsp":
        args += ["-rtsp_transport", "tcp", "-timeout", "8000000"]
    else:
        args += ["-rw_timeout", "8000000"]
    if urlsplit(source.source_url).scheme in ("https", "rtsps", "rtmps"):
        args += ["-tls_verify", "1", "-ca_file", "/etc/ssl/certs/ca-certificates.crt"]
    if source.source_type == "hls":
        # prepare() already identified the playlist, even when its server uses
        # an opaque URL and application/octet-stream.
        args += ["-f", "hls"]
    args += [
        "-i",
        input_url(source),
        "-an",
        "-sn",
        "-dn",
        "-threads",
        "1",
        "-vf",
        "fps=4,scale=960:540:force_original_aspect_ratio=decrease",
        "-c:v",
        "mjpeg",
        "-q:v",
        "5",
    ]
    return args + (
        ["-t", "40", "-f", "mpjpeg", "-boundary_tag", "camera", "pipe:1"]
        if live
        else ["-frames:v", "1", "-f", "image2pipe", "pipe:1"]
    )


@asynccontextmanager
async def decoder(source, live=False):
    process = await asyncio.create_subprocess_exec(
        *ffmpeg_args(source, live),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        stdin=asyncio.subprocess.DEVNULL,
    )
    try:
        yield process
    finally:
        if process.returncode is None:
            process.kill()
        await process.wait()


async def video_chunks(source, live=False):
    for connection in connection_sources(source):
        emitted = False
        async with decoder(connection, live) as process:
            while chunk := await process.stdout.read(65536):
                emitted = True
                yield chunk
            await process.wait()
            if process.returncode == 0 and emitted:
                return
            if emitted:
                # Never concatenate a failed partial JPEG/stream with a retry.
                raise ValueError("Video decoding failed")
    raise ValueError("No video frame")


async def snapshot(source):
    async with httpx.AsyncClient(timeout=8, trust_env=False, auth=auth(source)) as client:
        async with client.stream("GET", source.source_url) as response:
            response.raise_for_status()
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > MAX_IMAGE:
                    raise ValueError("Image too large")
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ValueError("Unsupported image")
        image.thumbnail((1280, 720))
        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=85)
        return output.getvalue()


async def prepare(source):
    await require_public_address(source.source_url)
    if source.source_type == "auto":
        # Runs only inside the isolated worker with its egress firewall.
        async with httpx.AsyncClient(timeout=8, trust_env=False, auth=auth(source)) as client:
            async with client.stream("GET", source.source_url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if content_type.startswith("image/"):
                    kind = "snapshot"
                elif "multipart/x-mixed-replace" in content_type:
                    kind = "mjpeg"
                elif "mpegurl" in content_type:
                    kind = "hls"
                elif content_type.startswith("video/"):
                    kind = "http_video"
                else:
                    prefix = bytearray()
                    async for chunk in response.aiter_bytes(512):
                        prefix.extend(chunk)
                        break
                    if prefix.startswith((b"\xff\xd8", b"\x89PNG", b"RIFF")):
                        kind = "snapshot"
                    elif prefix.lstrip().startswith(b"#EXTM3U"):
                        kind = "hls"
                    else:
                        kind = "http_video"
        source.source_type = kind
    return await onvif_stream(source) if source.source_type == "onvif" else source


@app.post("/frame")
async def frame(source: CameraSource):
    async with capacity():
        try:
            async with asyncio.timeout(18):
                requested_type = source.source_type
                source = await prepare(source)
                if source.source_type == "snapshot":
                    data = await snapshot(source)
                else:
                    data = bytearray()
                    async with aclosing(video_chunks(source)) as chunks:
                        async for chunk in chunks:
                            data.extend(chunk)
                            if len(data) > MAX_IMAGE:
                                raise ValueError("Frame too large")
                    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
                        raise ValueError("No video frame")
                    data = bytes(data)
            return Response(
                data,
                media_type="image/jpeg",
                headers={
                    "X-Camera-Source-Type": "onvif"
                    if requested_type == "onvif"
                    else source.source_type
                },
            )
        except (
            ValueError,
            OSError,
            TimeoutError,
            httpx.HTTPError,
            UnidentifiedImageError,
            Image.DecompressionBombError,
            ParseError,
            DefusedXmlException,
        ) as error:
            raise HTTPException(
                503, "Не удалось получить кадр. Проверьте адрес, доступ с сервера, логин и пароль"
            ) from error


@app.post("/live")
async def live(source: CameraSource):
    if source.source_type == "snapshot":
        raise HTTPException(422, "Источник предоставляет только снимки")
    lease = capacity()
    await lease.__aenter__()
    try:
        async with asyncio.timeout(18):
            source = await prepare(source)
    except (
        ValueError,
        OSError,
        TimeoutError,
        httpx.HTTPError,
        ParseError,
        DefusedXmlException,
    ) as error:
        await lease.__aexit__(None, None, None)
        raise HTTPException(503, "Не удалось подключиться к камере") from error

    # Acquire before returning a streaming response, so overload returns a real HTTP status.

    async def chunks():
        try:
            async with asyncio.timeout(45), aclosing(video_chunks(source, live=True)) as video:
                async for chunk in video:
                    yield chunk
        except (OSError, TimeoutError, ValueError):
            return
        finally:
            await lease.__aexit__(None, None, None)

    return StreamingResponse(
        chunks(),
        media_type="multipart/x-mixed-replace; boundary=camera",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
