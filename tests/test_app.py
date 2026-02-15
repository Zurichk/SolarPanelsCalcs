"""
AEP Solar Panel Planner — Tests de la aplicación.

Tests unitarios para modelos, rutas y API.
"""

import pytest

from src.app import create_app
from src.extensions import db
from src.models.user import AEPUser
from src.models.project import AEPProject
from src.models.terrace import AEPTerrace
from src.models.structure import AEPStructure


@pytest.fixture
def app():
    """Crea una instancia de la app para tests.

    Yields:
        Flask app configurada para testing.
    """
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Cliente de test HTTP.

    Args:
        app: Fixture de la app.

    Returns:
        Flask test client.
    """
    return app.test_client()


@pytest.fixture
def auth_client(app, client):
    """Cliente autenticado para tests.

    Args:
        app: Fixture de la app.
        client: Fixture del cliente.

    Returns:
        Flask test client con sesión activa.
    """
    with app.app_context():
        user = AEPUser(username="testuser", email="test@test.com")
        user.set_password("testpass123")
        db.session.add(user)
        db.session.commit()

    client.post("/auth/login", data={
        "username": "testuser",
        "password": "testpass123",
    }, follow_redirects=True)

    return client


# ──────────────────────────────────────────────
# Tests de Modelos
# ──────────────────────────────────────────────

class TestAEPUser:
    """Tests para el modelo de usuario."""

    def test_create_user(self, app: object) -> None:
        """Verifica la creación de un usuario."""
        with app.app_context():
            user = AEPUser(username="alice", email="alice@test.com")
            user.set_password("secret123")
            db.session.add(user)
            db.session.commit()

            assert user.id is not None
            assert user.username == "alice"
            assert user.check_password("secret123")
            assert not user.check_password("wrong")

    def test_user_repr(self, app: object) -> None:
        """Verifica la representación del usuario."""
        with app.app_context():
            user = AEPUser(username="bob", email="bob@test.com")
            user.set_password("pass")
            assert repr(user) == "<AEPUser bob>"


class TestAEPProject:
    """Tests para el modelo de proyecto."""

    def test_create_project(self, app: object) -> None:
        """Verifica la creación de un proyecto."""
        with app.app_context():
            user = AEPUser(username="proy", email="proy@test.com")
            user.set_password("pass")
            db.session.add(user)
            db.session.flush()

            project = AEPProject(
                user_id=user.id,
                name="Test Terraza",
                description="Terraza de prueba",
            )
            db.session.add(project)
            db.session.commit()

            assert project.id is not None
            assert project.name == "Test Terraza"
            assert project.owner.username == "proy"


# ──────────────────────────────────────────────
# Tests de Rutas
# ──────────────────────────────────────────────

class TestMainRoutes:
    """Tests para las rutas principales."""

    def test_index(self, client: object) -> None:
        """Verifica que la página de inicio carga."""
        response = client.get("/")
        assert response.status_code == 200
        assert "AEP Solar Planner" in response.data.decode()

    def test_about(self, client: object) -> None:
        """Verifica que la página about carga."""
        response = client.get("/about")
        assert response.status_code == 200


class TestAuthRoutes:
    """Tests para autenticación."""

    def test_register_page(self, client: object) -> None:
        """Verifica que la página de registro carga."""
        response = client.get("/auth/register")
        assert response.status_code == 200
        assert "Crear cuenta" in response.data.decode()

    def test_login_page(self, client: object) -> None:
        """Verifica que la página de login carga."""
        response = client.get("/auth/login")
        assert response.status_code == 200

    def test_register_and_login(self, client: object) -> None:
        """Verifica el flujo completo de registro y login."""
        # Registro
        response = client.post("/auth/register", data={
            "username": "newuser",
            "email": "new@test.com",
            "password": "newpass123",
            "password2": "newpass123",
        }, follow_redirects=True)
        assert response.status_code == 200

        # Login
        response = client.post("/auth/login", data={
            "username": "newuser",
            "password": "newpass123",
        }, follow_redirects=True)
        assert response.status_code == 200


class TestProjectRoutes:
    """Tests para rutas de proyectos."""

    def test_projects_redirect_unauthenticated(
        self, client: object
    ) -> None:
        """Verifica redirección si no autenticado."""
        response = client.get("/projects/")
        assert response.status_code == 302

    def test_create_project(self, auth_client: object) -> None:
        """Verifica la creación de un proyecto."""
        response = auth_client.post("/projects/new", data={
            "name": "Mi terraza",
            "description": "Terraza de prueba",
        }, follow_redirects=True)
        assert response.status_code == 200


# ──────────────────────────────────────────────
# Tests de API
# ──────────────────────────────────────────────

class TestAPI:
    """Tests para la API REST."""

    def _create_project(self, app: object) -> int:
        """Helper: crea un proyecto de prueba.

        Args:
            app: Fixture de la app.

        Returns:
            ID del proyecto creado.
        """
        with app.app_context():
            user = AEPUser.query.filter_by(
                username="testuser"
            ).first()
            project = AEPProject(
                user_id=user.id, name="API Test"
            )
            db.session.add(project)
            db.session.flush()

            terrace = AEPTerrace(
                project_id=project.id,
                vertices=[],
                obstacles=[],
            )
            db.session.add(terrace)
            db.session.flush()

            structure = AEPStructure(
                terrace_id=terrace.id, beams=[]
            )
            db.session.add(structure)
            db.session.commit()

            return project.id

    def test_get_terrace(
        self, app: object, auth_client: object
    ) -> None:
        """Verifica GET de terraza vía API."""
        pid = self._create_project(app)
        response = auth_client.get(f"/api/projects/{pid}/terrace")
        assert response.status_code == 200
        data = response.get_json()
        assert "vertices" in data

    def test_update_terrace(
        self, app: object, auth_client: object
    ) -> None:
        """Verifica PUT de terraza vía API."""
        pid = self._create_project(app)
        response = auth_client.put(
            f"/api/projects/{pid}/terrace",
            json={
                "vertices": [
                    {"x": 0, "y": 0},
                    {"x": 585, "y": 0},
                    {"x": 585, "y": 388},
                    {"x": 0, "y": 388},
                ],
                "width_cm": 585,
                "height_cm": 388,
            },
        )
        assert response.status_code == 200

    def test_get_structure(
        self, app: object, auth_client: object
    ) -> None:
        """Verifica GET de estructura vía API."""
        pid = self._create_project(app)
        response = auth_client.get(
            f"/api/projects/{pid}/structure"
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "beams" in data

    def test_save_layout(
        self, app: object, auth_client: object
    ) -> None:
        """Verifica POST de layout vía API."""
        pid = self._create_project(app)
        response = auth_client.post(
            f"/api/projects/{pid}/layout",
            json={
                "name": "Test layout",
                "panel_positions": [],
                "canvas_data": {"terraceVertices": []},
                "metadata_info": {"panel_count": 0},
            },
        )
        assert response.status_code == 201
