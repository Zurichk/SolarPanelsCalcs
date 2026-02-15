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
        "DATABASE_URL", "postgres://zurichk:6L6tLGZmdRYlZln3UPQJm9ggPVfvAW5N7iCIR5Wlk@78.47.111.58:5433/postgres?sslmode=require"
    )


class AEPProductionConfig(AEPConfig):
    """Configuración para entorno de producción."""

    DEBUG: bool = False
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL", "postgres://zurichk:6L6tLGZmdRYlZln3UPQJm9ggPVfvAW5N7iCIR5Wlk@ucgkoo04kk4w0sg4ow8ckk4k:5432/postgres?sslmode=require"
    )


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
