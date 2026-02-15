"""
AEP Solar Panel Planner — Formularios de proyecto.

Formularios para crear y editar proyectos.
"""

from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Length


class AEPProjectForm(FlaskForm):
    """Formulario para crear/editar un proyecto."""

    name = StringField(
        "Nombre del proyecto",
        validators=[
            DataRequired(message="El nombre es obligatorio."),
            Length(max=128),
        ],
    )
    description = TextAreaField(
        "Descripción",
        validators=[Length(max=500)],
    )
    submit = SubmitField("Guardar proyecto")
