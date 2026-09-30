FROM python:3.14.0-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home api \
    && mkdir -p /srv/data/media && chown 10001:10001 /srv/data/media
# Bot UID is 10001. Keep initial volume ownership compatible even if API starts first.
COPY app/__init__.py ./app/__init__.py
COPY app/paths.py ./app/paths.py
COPY app/database/models.py app/database/enums.py app/database/runtime.py app/database/__init__.py ./app/database/
COPY app/database/sample_data.py app/database/camera_data.py app/database/registration_demo.py app/database/demo_issues.py app/database/demo_services.py app/database/demo_contacts.py app/database/requests.py ./app/database/
COPY app/database/repositories ./app/database/repositories
COPY app/services/registration.py app/services/__init__.py ./app/services/
COPY backend/smart_city_api ./smart_city_api
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./alembic.ini
COPY backend/scripts ./scripts
USER api
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "smart_city_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
