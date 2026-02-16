# ==============================================================
# AEP Solar Panel Planner — Dockerfile (multi-stage)
# Optimizado para Coolify
# ==============================================================

FROM python:3.14-slim AS base

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=app:create_app \
    FLASK_ENV=production

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python
COPY src/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY src/ ./src/

# Crear directorio de instancia para SQLite
RUN mkdir -p instance

# Exponer puerto
EXPOSE 5031

# Healthcheck para Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5031/')" || exit 1

# Ejecutar con Gunicorn
CMD ["gunicorn", \
    "--static-map", "/static:/app/src/static", \
    "--bind", "0.0.0.0:5031", \
    "--workers", "2", \
    "--threads", "4", \
    "--timeout", "120", \
    "--access-logfile", "-", \
    "src.app:create_app()"]
