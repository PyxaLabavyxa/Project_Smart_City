FROM python:3.14.0-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg iptables util-linux \
    && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home camera
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/smart_city_api/__init__.py ./smart_city_api/__init__.py
COPY backend/smart_city_api/core/__init__.py backend/smart_city_api/core/camera_source.py ./smart_city_api/core/
COPY backend/camera_worker ./camera_worker
RUN chmod 755 /srv/camera_worker/entrypoint.sh
ENTRYPOINT ["/srv/camera_worker/entrypoint.sh"]
