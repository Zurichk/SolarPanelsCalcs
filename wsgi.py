"""
AEP Solar Panel Planner — WSGI entry point.

Punto de entrada para Gunicorn y servidores WSGI compatibles.
"""

from src.app import create_app

application = create_app()
