"""
AEP Solar Panel Planner — Formularios de autenticación.

Formularios para registro e inicio de sesión.
"""

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import (
    DataRequired, Email, EqualTo, Length, ValidationError,
)

from src.models.user import AEPUser


class AEPRegistrationForm(FlaskForm):
    """Formulario de registro de nuevo usuario."""

    username = StringField(
        "Nombre de usuario",
        validators=[
            DataRequired(message="El nombre de usuario es obligatorio."),
            Length(min=3, max=64),
        ],
    )
    email = StringField(
        "Correo electrónico",
        validators=[
            DataRequired(message="El email es obligatorio."),
            Email(message="Introduce un email válido."),
        ],
    )
    password = PasswordField(
        "Contraseña",
        validators=[
            DataRequired(message="La contraseña es obligatoria."),
            Length(min=6, message="Mínimo 6 caracteres."),
        ],
    )
    password2 = PasswordField(
        "Repetir contraseña",
        validators=[
            DataRequired(),
            EqualTo("password", message="Las contraseñas no coinciden."),
        ],
    )
    submit = SubmitField("Registrarse")

    def validate_username(self, field: StringField) -> None:
        """Comprueba que el nombre de usuario no esté en uso.

        Args:
            field: Campo del formulario.

        Raises:
            ValidationError: Si el username ya existe.
        """
        if AEPUser.query.filter_by(username=field.data).first():
            raise ValidationError("Este nombre de usuario ya está en uso.")

    def validate_email(self, field: StringField) -> None:
        """Comprueba que el email no esté registrado.

        Args:
            field: Campo del formulario.

        Raises:
            ValidationError: Si el email ya existe.
        """
        if AEPUser.query.filter_by(email=field.data).first():
            raise ValidationError("Este email ya está registrado.")


class AEPLoginForm(FlaskForm):
    """Formulario de inicio de sesión."""

    username = StringField(
        "Nombre de usuario",
        validators=[DataRequired(message="Introduce tu usuario.")],
    )
    password = PasswordField(
        "Contraseña",
        validators=[DataRequired(message="Introduce tu contraseña.")],
    )
    submit = SubmitField("Iniciar sesión")
