"""
AEP Solar Panel Planner — Modelo de Estructura Metálica.

Representa la estructura de hierro (vigas, soportes) sobre la terraza.
"""

from src.extensions import db

AEP_DEFAULT_BEAM_PROFILE: str = "IPN-80"
AEP_DEFAULT_MATERIAL: str = "Acero S275"


class AEPStructure(db.Model):
    """Estructura metálica de soporte para paneles solares.

    Las vigas se almacenan como JSON: lista de objetos con
    coordenadas de inicio/fin, perfil y orientación.

    Attributes:
        id: Identificador único.
        terrace_id: FK a la terraza.
        name: Nombre descriptivo.
        material: Tipo de material (ej: "Acero S275").
        beam_profile: Perfil de las vigas (ej: "IPN-80").
        beams: Lista JSON de vigas [{x1,y1,x2,y2,profile}, ...].
        height_cm: Altura de la estructura sobre la terraza en cm.
        beam_inclination_deg: Inclinacion de la estructura en grados.
        inclination_start_beam: Indice inicial de viga inclinada.
        inclination_end_beam: Indice final de viga inclinada.
        show_post_labels: Mostrar etiquetas de pilares en 3D.
    """

    __tablename__ = "structures"

    id: int = db.Column(db.Integer, primary_key=True)
    terrace_id: int = db.Column(
        db.Integer, db.ForeignKey("terraces.id"),
        nullable=False, index=True
    )
    name: str = db.Column(db.String(128), default="Estructura principal")
    material: str = db.Column(
        db.String(64), default=AEP_DEFAULT_MATERIAL
    )
    beam_profile: str = db.Column(
        db.String(64), default=AEP_DEFAULT_BEAM_PROFILE
    )
    beams: str = db.Column(db.JSON, nullable=False, default=list)
    height_cm: float = db.Column(db.Float, default=120.0)
    beam_inclination_deg: float = db.Column(db.Float, default=20.0)
    inclination_start_beam: int = db.Column(db.Integer, default=0)
    inclination_end_beam: int = db.Column(db.Integer, default=-1)
    show_post_labels: bool = db.Column(db.Boolean, default=True)

    panels = db.relationship(
        "AEPSolarPanel", backref="structure", lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AEPStructure {self.name!r}>"
