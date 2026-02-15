"""
AEP Solar Panel Planner — Modelo de Usuario.

Gestiona la autenticación y la relación con los proyectos.
"""

from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from src.extensions import db, login_manager


class AEPUser(UserMixin, db.Model):
    """Modelo de usuario del sistema.

    Attributes:
        id: Identificador único.
        username: Nombre de usuario (único).
        email: Correo electrónico (único).
        password_hash: Hash de la contraseña.
        created_at: Fecha de creación de la cuenta.
        projects: Relación con los proyectos del usuario.
    """

    __tablename__ = "users"

    id: int = db.Column(db.Integer, primary_key=True)
    username: str = db.Column(
        db.String(64), unique=True, nullable=False, index=True
    )
    email: str = db.Column(
        db.String(120), unique=True, nullable=False, index=True
    )
    password_hash: str = db.Column(db.String(256), nullable=False)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    projects = db.relationship(
        "AEPProject", backref="owner", lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        """Genera y almacena el hash de la contraseña.

        Args:
            password: Contraseña en texto plano.
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Verifica la contraseña contra el hash almacenado.

        Args:
            password: Contraseña en texto plano.

        Returns:
            True si la contraseña es correcta.
        """
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f"<AEPUser {self.username}>"


@login_manager.user_loader
def load_user(user_id: str) -> AEPUser | None:
    """Carga un usuario por su ID para Flask-Login.

    Args:
        user_id: ID del usuario como cadena.

    Returns:
        Instancia del usuario o None.
    """
    return db.session.get(AEPUser, int(user_id))
