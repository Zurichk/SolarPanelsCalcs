"""
AEP Solar Panel Planner — Modelo de Distribución (Layout).

Almacena la disposición completa de paneles sobre la estructura,
incluyendo las posiciones exactas calculadas a escala.
"""

from datetime import datetime, timezone

from src.extensions import db


class AEPLayout(db.Model):
    """Distribución/disposición de paneles en un proyecto.

    panel_positions es un JSON con la posición, rotación e
    inclinación de cada panel colocado sobre la estructura.

    Attributes:
        id: Identificador único.
        project_id: FK al proyecto.
        name: Nombre del layout (ej: "Opción A").
        panel_positions: JSON [{x, y, rotation, panel_id}, ...].
        canvas_data: JSON completo del estado del canvas 2D.
        metadata_info: JSON con cálculos (potencia total, peso, etc.).
        created_at: Fecha de creación.
    """

    __tablename__ = "layouts"

    id: int = db.Column(db.Integer, primary_key=True)
    project_id: int = db.Column(
        db.Integer, db.ForeignKey("projects.id"),
        nullable=False, index=True
    )
    name: str = db.Column(db.String(128), default="Layout principal")
    panel_positions: str = db.Column(
        db.JSON, nullable=False, default=list
    )
    canvas_data: str = db.Column(db.JSON, default=dict)
    metadata_info: str = db.Column(db.JSON, default=dict)
    created_at: datetime = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<AEPLayout {self.name!r}>"
