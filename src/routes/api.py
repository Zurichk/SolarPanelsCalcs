"""
AEP Solar Panel Planner — Blueprint API REST.

Endpoints JSON para el frontend (Canvas/Three.js).
"""

import json
import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from src.extensions import db
from src.models.project import AEPProject
from src.models.terrace import AEPTerrace
from src.models.structure import AEPStructure
from src.models.solar_panel import AEPSolarPanel
from src.models.layout import AEPLayout

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)


def _check_project_access(project_id: int) -> AEPProject | None:
    """Verifica que el proyecto exista y pertenezca al usuario.

    Args:
        project_id: ID del proyecto.

    Returns:
        Proyecto si es accesible, None si no.
    """
    project = db.session.get(AEPProject, project_id)
    if not project or project.user_id != current_user.id:
        return None
    return project


# ──────────────────────────────────────────────
# Terraza
# ──────────────────────────────────────────────

@api_bp.route("/projects/<int:project_id>/terrace", methods=["GET"])
@login_required
def get_terrace(project_id: int) -> tuple:
    """Obtiene los datos de la terraza del proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON con los datos de la terraza.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    if not terrace:
        return jsonify({"error": "Terraza no encontrada"}), 404

    return jsonify({
        "id": terrace.id,
        "name": terrace.name,
        "vertices": terrace.vertices or [],
        "obstacles": terrace.obstacles or [],
        "width_cm": terrace.width_cm,
        "height_cm": terrace.height_cm,
    })


@api_bp.route("/projects/<int:project_id>/terrace", methods=["PUT"])
@login_required
def update_terrace(project_id: int) -> tuple:
    """Actualiza la terraza (vértices, obstáculos, dimensiones).

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON de confirmación.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    if not terrace:
        return jsonify({"error": "Terraza no encontrada"}), 404

    data = request.get_json(silent=True) or {}
    if "vertices" in data:
        terrace.vertices = data["vertices"]
    if "obstacles" in data:
        terrace.obstacles = data["obstacles"]
    if "width_cm" in data:
        terrace.width_cm = float(data["width_cm"])
    if "height_cm" in data:
        terrace.height_cm = float(data["height_cm"])
    if "name" in data:
        terrace.name = data["name"]

    db.session.commit()
    logger.info("Terraza %d actualizada.", terrace.id)
    return jsonify({"status": "ok", "id": terrace.id})


# ──────────────────────────────────────────────
# Estructura (vigas)
# ──────────────────────────────────────────────

@api_bp.route("/projects/<int:project_id>/structure", methods=["GET"])
@login_required
def get_structure(project_id: int) -> tuple:
    """Obtiene la estructura metálica del proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON con vigas, material y perfil.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None
    if not structure:
        return jsonify({"error": "Estructura no encontrada"}), 404

    return jsonify({
        "id": structure.id,
        "name": structure.name,
        "material": structure.material,
        "beam_profile": structure.beam_profile,
        "beams": structure.beams or [],
        "height_cm": structure.height_cm,
        "beam_inclination_deg": structure.beam_inclination_deg,
        "inclination_start_beam": structure.inclination_start_beam,
        "inclination_end_beam": structure.inclination_end_beam,
        "show_post_labels": structure.show_post_labels,
    })


@api_bp.route("/projects/<int:project_id>/structure", methods=["PUT"])
@login_required
def update_structure(project_id: int) -> tuple:
    """Actualiza la estructura metálica (vigas).

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON de confirmación.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None
    if not structure:
        return jsonify({"error": "Estructura no encontrada"}), 404

    data = request.get_json(silent=True) or {}
    if "beams" in data:
        structure.beams = data["beams"]
    if "material" in data:
        structure.material = data["material"]
    if "beam_profile" in data:
        structure.beam_profile = data["beam_profile"]
    if "height_cm" in data:
        structure.height_cm = float(data["height_cm"])
    if "beam_inclination_deg" in data:
        structure.beam_inclination_deg = float(
            data["beam_inclination_deg"]
        )
    if "inclination_start_beam" in data:
        structure.inclination_start_beam = int(
            data["inclination_start_beam"]
        )
    if "inclination_end_beam" in data:
        structure.inclination_end_beam = int(
            data["inclination_end_beam"]
        )
    if "show_post_labels" in data:
        structure.show_post_labels = bool(
            data["show_post_labels"]
        )

    db.session.commit()
    logger.info("Estructura %d actualizada.", structure.id)
    return jsonify({"status": "ok", "id": structure.id})


# ──────────────────────────────────────────────
# Paneles solares
# ──────────────────────────────────────────────

@api_bp.route("/projects/<int:project_id>/panels", methods=["GET"])
@login_required
def get_panels(project_id: int) -> tuple:
    """Obtiene los paneles asociados al proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON con la lista de paneles.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None
    if not structure:
        return jsonify({"panels": []})

    panels = AEPSolarPanel.query.filter_by(
        structure_id=structure.id
    ).all()

    return jsonify({
        "panels": [
            {
                "id": p.id,
                "model_name": p.model_name,
                "width_cm": p.width_cm,
                "height_cm": p.height_cm,
                "power_w": p.power_w,
                "inclination_deg": p.inclination_deg,
                "quantity": p.quantity,
                "weight_kg": p.weight_kg,
            }
            for p in panels
        ]
    })


@api_bp.route("/projects/<int:project_id>/panels", methods=["POST"])
@login_required
def add_panel(project_id: int) -> tuple:
    """Añade un tipo de panel al proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON con el panel creado.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None
    if not structure:
        return jsonify({"error": "Estructura no encontrada"}), 404

    data = request.get_json(silent=True) or {}
    panel = AEPSolarPanel(
        structure_id=structure.id,
        model_name=data.get("model_name", "Panel genérico 400W"),
        width_cm=float(data.get("width_cm", 99.2)),
        height_cm=float(data.get("height_cm", 165.6)),
        power_w=int(data.get("power_w", 400)),
        inclination_deg=float(data.get("inclination_deg", 20.0)),
        quantity=int(data.get("quantity", 1)),
        weight_kg=float(data.get("weight_kg", 21.0)),
    )
    db.session.add(panel)
    db.session.commit()

    return jsonify({"status": "ok", "id": panel.id}), 201


# ──────────────────────────────────────────────
# Layout (guardar/cargar diseño completo)
# ──────────────────────────────────────────────

@api_bp.route("/projects/<int:project_id>/layout", methods=["GET"])
@login_required
def get_layout(project_id: int) -> tuple:
    """Obtiene el layout guardado del proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON con posiciones de paneles y datos del canvas.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    layout = project.layouts.order_by(
        AEPLayout.created_at.desc()
    ).first()

    if not layout:
        return jsonify({
            "panel_positions": [],
            "canvas_data": {},
            "metadata_info": {},
        })

    return jsonify({
        "id": layout.id,
        "name": layout.name,
        "panel_positions": layout.panel_positions or [],
        "canvas_data": layout.canvas_data or {},
        "metadata_info": layout.metadata_info or {},
    })


@api_bp.route("/projects/<int:project_id>/layout", methods=["POST"])
@login_required
def save_layout(project_id: int) -> tuple:
    """Guarda un nuevo layout (snapshot del diseño actual).

    Args:
        project_id: ID del proyecto.

    Returns:
        JSON de confirmación.
    """
    project = _check_project_access(project_id)
    if not project:
        return jsonify({"error": "Proyecto no encontrado"}), 404

    data = request.get_json(silent=True) or {}
    layout = AEPLayout(
        project_id=project.id,
        name=data.get("name", "Layout guardado"),
        panel_positions=data.get("panel_positions", []),
        canvas_data=data.get("canvas_data", {}),
        metadata_info=data.get("metadata_info", {}),
    )
    db.session.add(layout)
    db.session.commit()

    logger.info("Layout %d guardado para proyecto %d.", layout.id, project.id)
    return jsonify({"status": "ok", "id": layout.id}), 201
