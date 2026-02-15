"""
AEP Solar Panel Planner — Blueprint de autenticación.

Registro, login y logout de usuarios.
"""

from flask import Blueprint, flash, redirect, render_template, url_for
from flask_login import current_user, login_user, logout_user

from src.extensions import db
from src.forms.auth_forms import AEPLoginForm, AEPRegistrationForm
from src.models.user import AEPUser

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["GET", "POST"])
def register() -> str:
    """Registro de nuevo usuario.

    Returns:
        HTML del formulario o redirección al login.
    """
    if current_user.is_authenticated:
        return redirect(url_for("projects.list_projects"))

    form = AEPRegistrationForm()
    if form.validate_on_submit():
        user = AEPUser(
            username=form.username.data,
            email=form.email.data,
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash("Cuenta creada correctamente. ¡Inicia sesión!", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/register.html", form=form)


@auth_bp.route("/login", methods=["GET", "POST"])
def login() -> str:
    """Inicio de sesión.

    Returns:
        HTML del formulario o redirección a proyectos.
    """
    if current_user.is_authenticated:
        return redirect(url_for("projects.list_projects"))

    form = AEPLoginForm()
    if form.validate_on_submit():
        user = AEPUser.query.filter_by(
            username=form.username.data
        ).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash("Has iniciado sesión correctamente.", "success")
            return redirect(url_for("projects.list_projects"))
        flash("Usuario o contraseña incorrectos.", "danger")

    return render_template("auth/login.html", form=form)


@auth_bp.route("/logout")
def logout() -> str:
    """Cierra la sesión del usuario.

    Returns:
        Redirección a la página de inicio.
    """
    logout_user()
    flash("Sesión cerrada.", "info")
    return redirect(url_for("main.index"))
