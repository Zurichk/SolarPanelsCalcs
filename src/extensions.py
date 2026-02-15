"""
AEP Solar Panel Planner — Extensiones Flask.

Instancias compartidas de extensiones para evitar importaciones circulares.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate

db: SQLAlchemy = SQLAlchemy()
login_manager: LoginManager = LoginManager()
migrate: Migrate = Migrate()

login_manager.login_view = "auth.login"
login_manager.login_message = "Inicia sesión para acceder a esta página."
login_manager.login_message_category = "warning"
