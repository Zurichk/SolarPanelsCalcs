"""
AEP Solar Panel Planner — Modelo de Terraza.

Representa la superficie donde se instalará la estructura,
incluyendo su forma (polígono libre) y obstáculos.
"""

from src.extensions import db


class AEPTerrace(db.Model):
    """Terraza con forma poligonal arbitraria.

    Los vértices se almacenan como JSON: lista de {x, y} en centímetros.
    Los obstáculos (columnas, chimeneas) también se almacenan como JSON.

    Attributes:
        id: Identificador único.
        project_id: FK al proyecto padre.
        name: Nombre descriptivo (ej: "Terraza principal").
        vertices: Lista JSON de puntos [{x, y}, ...] en cm.
        obstacles: Lista JSON de obstáculos con forma y posición.
        width_cm: Ancho de referencia en cm (bounding box).
        height_cm: Alto de referencia en cm (bounding box).
    """

    __tablename__ = "terraces"

    id: int = db.Column(db.Integer, primary_key=True)
    project_id: int = db.Column(
        db.Integer, db.ForeignKey("projects.id"),
        nullable=False, index=True
    )
    name: str = db.Column(db.String(128), default="Terraza principal")
    vertices: str = db.Column(db.JSON, nullable=False, default=list)
    obstacles: str = db.Column(db.JSON, nullable=False, default=list)
    width_cm: float = db.Column(db.Float, default=0.0)
    height_cm: float = db.Column(db.Float, default=0.0)

    structures = db.relationship(
        "AEPStructure", backref="terrace", lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AEPTerrace {self.name!r}>"
