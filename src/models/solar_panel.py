"""
AEP Solar Panel Planner — Modelo de Panel Solar.

Representa un modelo/tipo de panel solar con sus dimensiones físicas.
"""

from src.extensions import db

AEP_DEFAULT_INCLINATION: float = 20.0
AEP_DEFAULT_PANEL_WIDTH: float = 99.2
AEP_DEFAULT_PANEL_HEIGHT: float = 165.6
AEP_DEFAULT_PANEL_POWER: int = 400


class AEPSolarPanel(db.Model):
    """Tipo/modelo de panel solar.

    Attributes:
        id: Identificador único.
        structure_id: FK a la estructura.
        model_name: Nombre comercial del panel.
        width_cm: Ancho del panel en cm.
        height_cm: Alto del panel en cm.
        depth_cm: Grosor del panel en cm.
        weight_kg: Peso del panel en kg.
        power_w: Potencia nominal en vatios.
        inclination_deg: Inclinación en grados (default 20°).
        quantity: Cantidad de paneles de este tipo.
    """

    __tablename__ = "solar_panels"

    id: int = db.Column(db.Integer, primary_key=True)
    structure_id: int = db.Column(
        db.Integer, db.ForeignKey("structures.id"),
        nullable=False, index=True
    )
    model_name: str = db.Column(
        db.String(128), default="Panel genérico 400W"
    )
    width_cm: float = db.Column(
        db.Float, default=AEP_DEFAULT_PANEL_WIDTH
    )
    height_cm: float = db.Column(
        db.Float, default=AEP_DEFAULT_PANEL_HEIGHT
    )
    depth_cm: float = db.Column(db.Float, default=3.5)
    weight_kg: float = db.Column(db.Float, default=21.0)
    power_w: int = db.Column(
        db.Integer, default=AEP_DEFAULT_PANEL_POWER
    )
    inclination_deg: float = db.Column(
        db.Float, default=AEP_DEFAULT_INCLINATION
    )
    quantity: int = db.Column(db.Integer, default=1)

    def __repr__(self) -> str:
        return f"<AEPSolarPanel {self.model_name!r} x{self.quantity}>"
