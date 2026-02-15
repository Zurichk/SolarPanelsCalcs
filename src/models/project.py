"""
AEP Solar Panel Planner — Modelo de Proyecto.

Un proyecto agrupa una terraza, su estructura y la disposición de paneles.
"""

from datetime import datetime, timezone

from src.extensions import db


class AEPProject(db.Model):
    """Proyecto de instalación solar.

    Attributes:
        id: Identificador único.
        user_id: FK al propietario.
        name: Nombre descriptivo del proyecto.
        description: Descripción opcional.
        created_at: Fecha de creación.
        updated_at: Fecha de última modificación.
    """

    __tablename__ = "projects"

    id: int = db.Column(db.Integer, primary_key=True)
    user_id: int = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    name: str = db.Column(db.String(128), nullable=False)
    description: str = db.Column(db.Text, default="")
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    terraces = db.relationship(
        "AEPTerrace", backref="project", lazy="dynamic",
        cascade="all, delete-orphan"
    )
    layouts = db.relationship(
        "AEPLayout", backref="project", lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AEPProject {self.name!r}>"
