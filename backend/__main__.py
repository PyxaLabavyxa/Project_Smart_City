import uvicorn

from app.config_data.config import load_webapp_config


if __name__ == "__main__":
    config = load_webapp_config()
    uvicorn.run("backend.main:app", host=config.host, port=config.port)
