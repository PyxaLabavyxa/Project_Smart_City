FROM debian:trixie-slim AS ffmpeg-build
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential pkg-config nasm libgnutls28-dev libdav1d-dev zlib1g-dev \
        xz-utils ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# FFmpeg 7 does not expose TLS verification options on the RTSP demuxer.
# Use the official, checksummed release with native RTSPS certificate verification.
WORKDIR /build
RUN curl --fail --location --retry 3 --connect-timeout 15 --max-time 120 \
        https://ffmpeg.org/releases/ffmpeg-8.0.3.tar.xz -o /tmp/ffmpeg.tar.xz \
    && echo '6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818  /tmp/ffmpeg.tar.xz' | sha256sum -c - \
    && tar -xf /tmp/ffmpeg.tar.xz --strip-components=1 \
    && ./configure --disable-doc --disable-debug --disable-ffplay --disable-ffprobe \
        --enable-gnutls --enable-libdav1d \
    && make -j4 ffmpeg \
    && install -m 755 ffmpeg /usr/local/bin/ffmpeg

FROM python:3.14.0-slim-trixie
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgnutls30t64 libdav1d7 zlib1g iptables util-linux \
    && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home camera
COPY --from=ffmpeg-build /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
RUN ffmpeg -hide_banner -h demuxer=rtsp 2>&1 | grep -q tls_verify
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/smart_city_api/__init__.py ./smart_city_api/__init__.py
COPY backend/smart_city_api/core/__init__.py backend/smart_city_api/core/camera_source.py ./smart_city_api/core/
COPY backend/camera_worker ./camera_worker
RUN chmod 755 /srv/camera_worker/entrypoint.sh
ENTRYPOINT ["/srv/camera_worker/entrypoint.sh"]
