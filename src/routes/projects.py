"""
AEP Solar Panel Planner — Blueprint de proyectos.

CRUD de proyectos y acceso al editor de diseño.
"""

from flask import (
    Blueprint, flash, redirect, render_template, request, url_for,
)
from flask_login import current_user, login_required

from src.extensions import db
from src.forms.project_forms import AEPProjectForm
from src.models.project import AEPProject
from src.models.terrace import AEPTerrace
from src.models.structure import AEPStructure

projects_bp = Blueprint("projects", __name__)


@projects_bp.route("/")
@login_required
def list_projects() -> str:
    """Lista los proyectos del usuario actual.

    Returns:
        HTML con la lista de proyectos.
    """
    page = request.args.get("page", 1, type=int)
    projects = (
        AEPProject.query
        .filter_by(user_id=current_user.id)
        .order_by(AEPProject.updated_at.desc())
        .paginate(page=page, per_page=12, error_out=False)
    )
    return render_template(
        "projects/list.html", projects=projects
    )


@projects_bp.route("/new", methods=["GET", "POST"])
@login_required
def new_project() -> str:
    """Crea un nuevo proyecto.

    Returns:
        HTML del formulario o redirección al editor.
    """
    form = AEPProjectForm()
    if form.validate_on_submit():
        project = AEPProject(
            user_id=current_user.id,
            name=form.name.data,
            description=form.description.data or "",
        )
        db.session.add(project)
        db.session.flush()

        terrace = AEPTerrace(
            project_id=project.id,
            name="Terraza principal",
            vertices=[],
            obstacles=[],
        )
        db.session.add(terrace)
        db.session.flush()

        structure = AEPStructure(
            terrace_id=terrace.id,
            name="Estructura principal",
            beams=[],
            height_cm=120.0,
        )
        db.session.add(structure)
        db.session.commit()

        flash("Proyecto creado. ¡Diseña tu terraza!", "success")
        return redirect(
            url_for("projects.editor", project_id=project.id)
        )

    return render_template("projects/new.html", form=form)


@projects_bp.route("/<int:project_id>/editor")
@login_required
def editor(project_id: int) -> str:
    """Editor principal del proyecto (Canvas 2D + 3D).

    Args:
        project_id: ID del proyecto.

    Returns:
        HTML del editor de diseño.
    """
    project = AEPProject.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        flash("No tienes acceso a este proyecto.", "danger")
        return redirect(url_for("projects.list_projects"))

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None

    return render_template(
        "projects/editor.html",
        project=project,
        terrace=terrace,
        structure=structure,
    )


@projects_bp.route("/<int:project_id>/viewer3d")
@login_required
def viewer3d(project_id: int) -> str:
    """Visor 3D independiente del proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        HTML del visor 3D.
    """
    project = AEPProject.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        flash("No tienes acceso a este proyecto.", "danger")
        return redirect(url_for("projects.list_projects"))

    terrace = project.terraces.first()
    structure = terrace.structures.first() if terrace else None

    return render_template(
        "projects/viewer3d.html",
        project=project,
        terrace=terrace,
        structure=structure,
    )


@projects_bp.route("/<int:project_id>/delete", methods=["POST"])
@login_required
def delete_project(project_id: int) -> str:
    """Elimina un proyecto.

    Args:
        project_id: ID del proyecto.

    Returns:
        Redirección a la lista de proyectos.
    """
    project = AEPProject.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        flash("No tienes acceso a este proyecto.", "danger")
        return redirect(url_for("projects.list_projects"))

    db.session.delete(project)
    db.session.commit()
    flash("Proyecto eliminado.", "info")
    return redirect(url_for("projects.list_projects"))
