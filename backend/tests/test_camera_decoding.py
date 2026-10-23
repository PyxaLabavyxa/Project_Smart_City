import asyncio
from contextlib import aclosing, asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

import pytest

from camera_worker import main as worker
from smart_city_api.core.camera_source import CameraSource


def rtmp_source(**changes):
    return CameraSource(
        **{
            "source_type": "rtmp",
            "source_url": "rtmps://camera.example/live?signature=a%2Bb&token=x&token=y",
            "username": "camera user",
            "password": "x+@#:$&",
            **changes,
        }
    )


def fake_decoders(monkeypatch, outcomes):
    calls, closed = [], []

    @asynccontextmanager
    async def decoder(source, live=False):
        calls.append(source)
        code, chunks = outcomes[len(calls) - 1]
        process = SimpleNamespace(
            returncode=code,
            stdout=SimpleNamespace(read=AsyncMock(side_effect=chunks)),
            wait=AsyncMock(return_value=code),
        )
        try:
            yield process
        finally:
            closed.append(source)

    monkeypatch.setattr(worker, "decoder", decoder)
    return calls, closed


def test_native_rtmp_auth_success_does_not_retry_or_change_signed_url(monkeypatch):
    source = rtmp_source()
    original = source.private_dict()
    calls, closed = fake_decoders(monkeypatch, [(0, [b"frame", b""])])

    async def run():
        return [chunk async for chunk in worker.video_chunks(source)]

    assert asyncio.run(run()) == [b"frame"]
    assert calls == closed == [source]
    assert source.private_dict() == original


@pytest.mark.parametrize("live", [False, True])
@pytest.mark.parametrize("first_code", [0, 1])
def test_rtmp_query_auth_retry_preserves_existing_query_and_escapes_credentials(
    monkeypatch, live, first_code
):
    source = rtmp_source()
    original = source.private_dict()
    calls, closed = fake_decoders(
        monkeypatch, [(first_code, [b""]), (0, [b"frame-1", b"frame-2", b""])]
    )

    async def run():
        return [chunk async for chunk in worker.video_chunks(source, live)]

    assert asyncio.run(run()) == [b"frame-1", b"frame-2"]
    assert len(calls) == len(closed) == 2
    retry = calls[1]
    assert retry.source_url.startswith(source.source_url + "&user=")
    query = parse_qs(urlsplit(retry.source_url).query)
    assert query == {
        "signature": ["a+b"],
        "token": ["x", "y"],
        "user": ["camera user"],
        "pass": ["x+@#:$&"],
    }
    assert retry.username == retry.password.get_secret_value() == ""
    assert source.private_dict() == original


def test_failed_partial_video_is_not_concatenated_with_a_retry(monkeypatch):
    calls, closed = fake_decoders(monkeypatch, [(1, [b"partial JPEG", b""])])

    async def run():
        with pytest.raises(ValueError, match="Video decoding failed"):
            return [chunk async for chunk in worker.video_chunks(rtmp_source())]

    asyncio.run(run())
    assert len(calls) == len(closed) == 1


def test_both_rtmp_auth_methods_failing_do_not_loop(monkeypatch):
    calls, closed = fake_decoders(monkeypatch, [(1, [b""]), (1, [b""])])

    async def run():
        with pytest.raises(ValueError, match="No video frame"):
            return [chunk async for chunk in worker.video_chunks(rtmp_source())]

    asyncio.run(run())
    assert len(calls) == len(closed) == 2


def test_closing_video_consumer_closes_decoder_without_starting_a_retry(monkeypatch):
    calls, closed = fake_decoders(monkeypatch, [(0, [b"first frame"])])

    async def run():
        async with aclosing(worker.video_chunks(rtmp_source(), live=True)) as chunks:
            assert await anext(chunks) == b"first frame"

    asyncio.run(run())
    assert len(calls) == len(closed) == 1


def test_video_timeout_closes_the_connection_and_does_not_retry(monkeypatch):
    closed = []

    async def stalled_read(*args):
        await asyncio.Event().wait()

    @asynccontextmanager
    async def stalled_decoder(source, live=False):
        try:
            yield SimpleNamespace(stdout=SimpleNamespace(read=stalled_read))
        finally:
            closed.append(source)

    monkeypatch.setattr(worker, "decoder", stalled_decoder)

    async def run():
        with pytest.raises(TimeoutError):
            async with (
                asyncio.timeout(0.01),
                aclosing(worker.video_chunks(rtmp_source())) as chunks,
            ):
                await anext(chunks)

    asyncio.run(run())
    assert len(closed) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"username": "", "password": ""},
        {"source_url": "rtmp://camera.example/live?user=explicit&pass=explicit"},
        {"source_type": "rtsp", "source_url": "rtsp://camera.example/live"},
    ],
)
def test_query_auth_fallback_does_not_override_explicit_or_other_protocol_auth(changes):
    source = rtmp_source(**changes)
    assert list(worker.connection_sources(source)) == [source]


def test_identified_hls_uses_its_demuxer_for_opaque_and_signed_urls():
    source = CameraSource(
        source_type="hls", source_url="https://camera.example/opaque?signature=a%2Bb"
    )
    args = worker.ffmpeg_args(source)
    input_index = args.index("-i")
    assert args[input_index - 2:input_index] == ["-f", "hls"]
    assert args[input_index + 1] == source.source_url


def test_secure_streams_keep_tls_verification_and_public_protocol_restrictions():
    source = CameraSource(source_type="rtsp", source_url="rtsps://camera.example/live")
    args = worker.ffmpeg_args(source)
    assert args[args.index("-tls_verify") + 1] == "1"
    assert args[args.index("-ca_file") + 1] == "/etc/ssl/certs/ca-certificates.crt"
    assert "file" not in args[args.index("-protocol_whitelist") + 1].split(",")
