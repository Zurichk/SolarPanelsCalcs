"""
AEP Solar Panel Planner — App Factory.

Punto de entrada principal de la aplicación Flask.
"""

import os

from flask import Flask

# Import psycopg2 to ensure PostgreSQL dialect is loaded
import psycopg2

from src.config import AEP_CONFIG_MAP
from src.extensions import db, login_manager, migrate


def create_app(config_name: str | None = None) -> Flask:
    """Crea y configura la instancia de Flask.

    Args:
        config_name: Nombre del entorno ('development', 'production',
                     'testing'). Si es None, se lee de FLASK_ENV.

    Returns:
        Aplicación Flask configurada.
    """
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
        instance_path=os.path.join(os.path.dirname(__file__), '..', 'var', 'app-instance'),
    )

    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(AEP_CONFIG_MAP[config_name])

    _init_extensions(app)
    _register_blueprints(app)

    return app


def _init_extensions(app: Flask) -> None:
    """Inicializa todas las extensiones Flask.

    Args:
        app: Instancia de Flask.
    """
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)

    with app.app_context():
        from src.models import (  # noqa: F401 — registro de modelos
            AEPUser, AEPProject, AEPTerrace,
            AEPStructure, AEPSolarPanel, AEPLayout,
        )
        db.create_all()


def _register_blueprints(app: Flask) -> None:
    """Registra todos los blueprints de la aplicación.

    Args:
        app: Instancia de Flask.
    """
    from src.routes.main import main_bp
    from src.routes.auth import auth_bp
    from src.routes.projects import projects_bp
    from src.routes.api import api_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(projects_bp, url_prefix="/projects")
    app.register_blueprint(api_bp, url_prefix="/api")


if __name__ == "__main__":
    application = create_app()
    application.run(debug=True, host="0.0.0.0", port=5031)
