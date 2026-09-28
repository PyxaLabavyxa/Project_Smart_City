FROM python:3.14.0-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home api
COPY app/__init__.py ./app/__init__.py
COPY app/database/models.py app/database/enums.py app/database/runtime.py app/database/__init__.py ./app/database/
COPY app/database/sample_data.py ./app/database/sample_data.py
COPY backend/smart_city_api ./smart_city_api
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./alembic.ini
COPY backend/scripts ./scripts
USER api
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "smart_city_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
