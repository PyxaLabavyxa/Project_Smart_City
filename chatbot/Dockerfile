FROM python:3.14.0-slim AS build
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.14.0-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-index /wheels/*.whl && rm -rf /wheels \
    && useradd --uid 10001 --create-home bot \
    && mkdir -p /srv/data/media && chown -R bot:bot /srv/data
COPY app ./app
COPY chatbot ./chatbot
USER bot
CMD ["python", "-m", "chatbot"]
