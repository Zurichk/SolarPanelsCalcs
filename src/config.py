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
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL", "sqlite:///aep_solar.db"
    )


class AEPProductionConfig(AEPConfig):
    """Configuración para entorno de producción."""

    DEBUG: bool = False
    SQLALCHEMY_DATABASE_URI: str = os.environ.get("DATABASE_URL")


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
