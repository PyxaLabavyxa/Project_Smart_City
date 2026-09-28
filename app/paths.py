from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def project_path(value: str | Path) -> Path:
    """Разрешает относительный путь от корня проекта, независимо от cwd."""
    path = Path(value).expanduser()
    return path if path.is_absolute() else PROJECT_ROOT / path
