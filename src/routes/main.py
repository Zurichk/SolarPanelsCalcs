"""
AEP Solar Panel Planner — Blueprint principal (main).

Páginas públicas: inicio, about, etc.
"""

from flask import Blueprint, render_template

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index() -> str:
    """Página de inicio.

    Returns:
        HTML renderizado de la landing page.
    """
    return render_template("main/index.html")


@main_bp.route("/about")
def about() -> str:
    """Página 'Acerca de'.

    Returns:
        HTML renderizado.
    """
    return render_template("main/about.html")
