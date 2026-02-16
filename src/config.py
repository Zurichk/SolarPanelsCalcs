"""
AEP Solar Panel Planner — Configuración de la aplicación.

Define los ajustes para cada entorno (desarrollo, producción, testing).
"""

import os


class AEPConfig:
    """Configuración base compartida por todos los entornos."""

    SECRET_KEY: str = os.environ.get(
        "SECRET_KEY", "dev-secret-key-cambiar-en-produccion"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    AEP_PANELS_PER_PAGE: int = 20


class AEPDevelopmentConfig(AEPConfig):
    """Configuración para entorno de desarrollo."""

    DEBUG: bool = True
    database_url = os.environ.get("DATABASE_URL", "sqlite:///aep_solar.db")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI: str = database_url


class AEPProductionConfig(AEPConfig):
    """Configuración para entorno de producción."""

    DEBUG: bool = False
    database_url = os.environ.get("DATABASE_URL")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI: str = database_url


class AEPTestingConfig(AEPConfig):
    """Configuración para tests."""

    TESTING: bool = True
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///:memory:"
    WTF_CSRF_ENABLED: bool = False


AEP_CONFIG_MAP: dict[str, type[AEPConfig]] = {
    "development": AEPDevelopmentConfig,
    "production": AEPProductionConfig,
    "testing": AEPTestingConfig,
}
