/**
 * AEP Solar Panel Planner — Visor 3D (Three.js)
 *
 * Renderiza en 3D la terraza, estructura metálica y paneles solares
 * con inclinación real, sombras y cámara orbital.
 */

class AEPEditor3D {
    /**
     * Inicializa el visor 3D.
     * @param {HTMLCanvasElement} canvas — Canvas WebGL
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
        this.isActive = false;

        // Para selección de vigas
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.beamMeshes = []; // Array para almacenar las mallas de vigas
        this.selectedBeams = new Set(); // Set de índices de vigas seleccionadas
        this.onBeamSelectionChange = null; // Callback cuando cambia la selección
    }

    /**
     * Configura la escena Three.js y arranca el render loop.
     */
    init() {
        if (this.scene) return; // Ya inicializado

        if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined') {
            if (!this.retryCount) this.retryCount = 0;
            this.retryCount++;

            if (this.retryCount > 50) { // Máximo 50 intentos (5 segundos)
                console.error('THREE.js no se pudo cargar después de múltiples intentos');
                alert('Error: No se pudo cargar Three.js. Verifica tu conexión a internet.');
                return;
            }

            console.error('THREE.js u OrbitControls no están cargados. Esperando... (intento ' + this.retryCount + ')');
            setTimeout(() => this.init(), 100);
            return;
        }

        console.log('3D init: initializing Three.js scene');
        console.log('Canvas clientWidth:', this.canvas.clientWidth, 'clientHeight:', this.canvas.clientHeight);

        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Cámara
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
        this.camera.position.set(300, 400, 500);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
        });
        const w = Math.max(this.canvas.clientWidth, 400);
        const h = Math.max(this.canvas.clientHeight, 300);
        this.renderer.setSize(w, h);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controles orbitales
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        // Iluminación
        this._setupLights();

        // Suelo base
        this._addGround();

        // Ejes de referencia
        const axes = new THREE.AxesHelper(200);
        this.scene.add(axes);
    }

    /**
     * Maneja clicks en el canvas para selección de vigas.
     * @param {MouseEvent} event - Evento del mouse
     */
    _onCanvasClick(event) {
        if (!this.scene || !this.camera) return;

        // Calcular posición del mouse en coordenadas normalizadas (-1 a +1)
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast desde la cámara
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.beamMeshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const beamIndex = clickedMesh.userData.beamIndex;

            // Toggle selección
            if (this.selectedBeams.has(beamIndex)) {
                this.selectedBeams.delete(beamIndex);
                clickedMesh.material.color.setHex(0xe67e22); // Color normal
            } else {
                this.selectedBeams.add(beamIndex);
                clickedMesh.material.color.setHex(0xff6b35); // Color seleccionado (naranja más brillante)
            }

            // Actualizar campos de formulario si hay callback
            if (this.onBeamSelectionChange) {
                this.onBeamSelectionChange(this.selectedBeams);
            }
        }
    }

    /**
     * Configura las luces de la escena.
     */
    _setupLights() {
        // Luz ambiental
        const ambient = new THREE.AmbientLight(0x404050, 0.6);
        this.scene.add(ambient);

        // Luz solar (direccional)
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
        sun.position.set(200, 400, 200);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 1500;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -500;
        this.scene.add(sun);

        // Luz de relleno
        const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
        fill.position.set(-100, 200, -100);
        this.scene.add(fill);

        // Event listener para selección de vigas
        this.canvas.addEventListener('click', (event) => this._onCanvasClick(event));
    }

    /**
     * Añade el plano del suelo.
     */
    _addGround() {
        const geometry = new THREE.PlaneGeometry(2000, 2000);
        const material = new THREE.MeshStandardMaterial({
            color: 0x228B22,  // Verde bosque
            roughness: 0.9,
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    /**
     * Actualiza la escena 3D con los datos del editor 2D.
     * @param {object} data — Datos exportados del editor 2D
     * @param {object} structConfig — Configuración de estructura {height, material, beamInclination}
     */
    updateScene(data, structConfig = {}) {
        if (!this.scene) this.init();

        console.log('3D updateScene called');
        console.log('3D updateScene data:', data);
        console.log('3D structConfig:', structConfig);

        // Limpiar objetos anteriores (no luces ni suelo)
        const toRemove = [];
        this.scene.traverse((obj) => {
            if (obj.userData.editorObject) toRemove.push(obj);
        });
        toRemove.forEach((obj) => this.scene.remove(obj));

        const structHeight = structConfig.height || 120;
        const beamInclination = structConfig.beamInclination || { degrees: 20, startBeam: 0, endBeam: -1 };
        const showPostLabels = structConfig.showPostLabels !== false;

        // Calcular centro de la terraza
        this._calculateTerraceCenter(data.terraceVertices || []);

        // Terraza (polígono extruido)
        this._buildTerrace(data.terraceVertices || []);

        // Obstáculos
        this._buildObstacles(data.obstacles || [], structHeight);

        // Vigas con inclinación
        this._buildBeams(data.beams || [], structHeight, beamInclination);

        // Pilares verticales en las esquinas
        this._buildCornerPosts(data.beams || [], data.terraceVertices || [], structHeight, beamInclination, showPostLabels);

        // Paneles solares con inclinación por viga
        this._buildPanels(data.panels || [], data.beams || [], structHeight, beamInclination);
    }

    /**
     * Calcula el centro de la terraza para centrar los objetos.
     * @param {Array} vertices — Vértices [{x, y}]
     */
    _calculateTerraceCenter(vertices) {
        if (vertices.length < 3) {
            this.terraceCenter = { x: 0, y: 0 };
            return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        vertices.forEach(v => {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
        });
        this.terraceCenter = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
        console.log('Terrace center calculated:', this.terraceCenter);
    }

    /**
     * Construye la terraza como un polígono extruido.
     * @param {Array} vertices — Vértices [{x, y}] en cm
     */
    _buildTerrace(vertices) {
        if (vertices.length < 3) {
            console.log('3D _buildTerrace: no vertices or <3');
            return;
        }

        console.log('3D _buildTerrace: building with', vertices.length, 'vertices');

        const shape = new THREE.Shape();
        shape.moveTo(vertices[0].x - this.terraceCenter.x, vertices[0].y - this.terraceCenter.y);
        for (let i = 1; i < vertices.length; i++) {
            shape.lineTo(vertices[i].x - this.terraceCenter.x, vertices[i].y - this.terraceCenter.y);
        }
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 15,  // 15cm de grosor de losa
            bevelEnabled: false,
        });
        const material = new THREE.MeshStandardMaterial({
            color: 0xb0b0b0,
            roughness: 0.7,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.userData.editorObject = true;
        this.scene.add(mesh);
    }

    /**
     * Construye los obstáculos como cajas 3D.
     * @param {Array} obstacles — Obstáculos [{x,y,w,h}]
     * @param {number} height — Altura de la estructura
     */
    _buildObstacles(obstacles, height) {
        console.log('3D _buildObstacles: building', obstacles.length, 'obstacles');
        for (const o of obstacles) {
            const geometry = new THREE.BoxGeometry(o.w, height, o.h);
            const material = new THREE.MeshStandardMaterial({
                color: 0xc0392b,
                roughness: 0.5,
            });
            const mesh = new THREE.Mesh(geometry, material);
            // Centrar las coordenadas respecto a la terraza
            const centerX = o.x - this.terraceCenter.x + o.w / 2;
            const centerZ = o.y - this.terraceCenter.y + o.h / 2;
            mesh.position.set(centerX, height / 2, centerZ);
            mesh.castShadow = true;
            mesh.userData.editorObject = true;
            this.scene.add(mesh);
            console.log('Obstacle added at:', mesh.position);
        }
    }

    /**
     * Construye las vigas como cilindros con posible inclinación.
     * @param {Array} beams — Vigas [{x1,y1,x2,y2}]
     * @param {number} height — Altura de la estructura
     * @param {object} inclination — Configuración de inclinación {degrees, startBeam, endBeam}
     */
    _buildBeams(beams, height, inclination = { degrees: 0, startBeam: 0, endBeam: -1 }) {
        console.log('3D _buildBeams: building', beams.length, 'beams with inclination:', inclination);

        // Limpiar array de mallas de vigas anteriores
        this.beamMeshes = [];

        const beamRadius = 3; // 3cm de radio visual

        // Determinar qué vigas deben tener inclinación (incluyendo conexiones)
        const beamInclinations = this._calculateBeamInclinations(beams, inclination);
        const bounds = this._getStructureBounds(beams, []);
        const rangeInfo = this._getInclinationRange(beams, inclination);
        const zMin = rangeInfo ? rangeInfo.minZ : (bounds ? bounds.minZ : 0);
        const zMax = rangeInfo ? rangeInfo.maxZ : (bounds ? bounds.maxZ : 0);
        const zSpan = (Number.isFinite(zMin) && Number.isFinite(zMax)) ? (zMax - zMin) : 0;

        const getHeightAtZ = (z, radians) => {
            if (!bounds || zSpan === 0 || radians === 0) return height;
            const rise = zSpan * Math.tan(radians);
            let t = (z - zMin) / zSpan;
            if (rangeInfo && rangeInfo.invert) {
                t = 1 - t;
            }
            t = Math.max(0, Math.min(1, t));
            return height + rise * t;
        };

        for (let i = 0; i < beams.length; i++) {
            const b = beams[i];
            const beamIncl = beamInclinations[i];
            const isSelected = this.selectedBeams.has(i);

            const material = new THREE.MeshStandardMaterial({
                color: isSelected ? 0xff6b35 : (beamIncl.hasFullInclination ? 0xe67e22 : 0x95a5a6), // Color diferente para vigas con inclinación parcial
                metalness: 0.6,
                roughness: 0.3,
            });
            const startX = b.x1 - this.terraceCenter.x;
            const startZ = b.y1 - this.terraceCenter.y;
            const endX = b.x2 - this.terraceCenter.x;
            const endZ = b.y2 - this.terraceCenter.y;

            const startY = getHeightAtZ(startZ, beamIncl.radians);
            const endY = getHeightAtZ(endZ, beamIncl.radians);

            const start = new THREE.Vector3(startX, startY, startZ);
            const end = new THREE.Vector3(endX, endY, endZ);
            const direction = new THREE.Vector3().subVectors(end, start);
            const length = direction.length();
            if (length < 1) continue;

            const geometry = new THREE.CylinderGeometry(
                beamRadius, beamRadius, length, 8
            );
            const mesh = new THREE.Mesh(geometry, material);

            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            mesh.position.copy(midpoint);
            mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction.normalize()
            );

            // Almacenar índice de viga para selección
            mesh.userData.beamIndex = i;
            mesh.userData.editorObject = true;

            mesh.castShadow = true;
            this.beamMeshes.push(mesh);
            this.scene.add(mesh);
        }
    }

    _getStructureBounds(beams, terraceVertices) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        const applyPoint = (x, z) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        };

        if (beams.length > 0) {
            for (const b of beams) {
                applyPoint(b.x1 - this.terraceCenter.x, b.y1 - this.terraceCenter.y);
                applyPoint(b.x2 - this.terraceCenter.x, b.y2 - this.terraceCenter.y);
            }
        } else if (terraceVertices.length > 0) {
            for (const v of terraceVertices) {
                applyPoint(v.x - this.terraceCenter.x, v.y - this.terraceCenter.y);
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minZ)) {
            return null;
        }

        return { minX, maxX, minZ, maxZ };
    }

    _buildCornerPosts(beams, terraceVertices, height, inclination, showLabels) {
        const bounds = this._getStructureBounds(beams, terraceVertices);
        if (!bounds) return;

        const rangeInfo = this._getInclinationRange(beams, inclination);
        const zMin = rangeInfo ? rangeInfo.minZ : bounds.minZ;
        const zMax = rangeInfo ? rangeInfo.maxZ : bounds.maxZ;
        const zSpan = zMax - zMin;
        const rise = zSpan * Math.tan((inclination.degrees * Math.PI) / 180);
        const postRadius = 3.5;
        const postMaterial = new THREE.MeshStandardMaterial({
            color: 0x7f8c8d,
            metalness: 0.4,
            roughness: 0.4,
        });

        const corners = [
            { x: bounds.minX, z: bounds.minZ },
            { x: bounds.maxX, z: bounds.minZ },
            { x: bounds.maxX, z: bounds.maxZ },
            { x: bounds.minX, z: bounds.maxZ },
        ];

        for (const corner of corners) {
            const zOffset = corner.z - zMin;
            let t = zSpan === 0 ? 0 : (zOffset / zSpan);
            if (rangeInfo && rangeInfo.invert) {
                t = 1 - t;
            }
            t = Math.max(0, Math.min(1, t));
            const postHeight = height + rise * t;
            const geometry = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 10);
            const post = new THREE.Mesh(geometry, postMaterial);
            post.position.set(corner.x, postHeight / 2, corner.z);
            post.castShadow = true;
            post.userData.editorObject = true;
            this.scene.add(post);

            if (showLabels) {
                const label = this._createTextSprite(`${postHeight.toFixed(0)} cm`);
                label.position.set(corner.x, postHeight + 10, corner.z);
                label.userData.editorObject = true;
                this.scene.add(label);
            }
        }
    }

    _createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 42;
        const padding = 12;
        ctx.font = `bold ${fontSize}px Arial`;
        const textWidth = ctx.measureText(text).width;
        canvas.width = Math.ceil(textWidth + padding * 2);
        canvas.height = Math.ceil(fontSize + padding * 2);

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#2c3e50';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, padding, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        const scaleFactor = 0.35;
        sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);
        return sprite;
    }

    /**
     * Calcula las inclinaciones para cada viga considerando conexiones.
     * @param {Array} beams — Vigas del plano 2D
     * @param {object} inclination — Configuración {degrees, startBeam, endBeam}
     * @returns {Array} Array de objetos {radians, hasFullInclination}
     */
    _calculateBeamInclinations(beams, inclination) {
        const result = [];
        if (!beams || beams.length === 0) return result;

        const totalBeams = beams.length;
        const rangeInfo = this._getInclinationRange(beams, inclination);
        const rangeMinZ = rangeInfo ? rangeInfo.minZ : null;
        const rangeMaxZ = rangeInfo ? rangeInfo.maxZ : null;
        const baseRadians = (inclination.degrees * Math.PI) / 180;

        // Función auxiliar para verificar si dos puntos son iguales (con tolerancia)
        const pointsEqual = (p1, p2, tolerance = 1) => {
            return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
        };

        // Función auxiliar para verificar si una viga conecta con otra
        const beamsConnected = (b1, b2) => {
            return pointsEqual({ x: b1.x1, y: b1.y1 }, { x: b2.x1, y: b2.y1 }) ||
                pointsEqual({ x: b1.x1, y: b1.y1 }, { x: b2.x2, y: b2.y2 }) ||
                pointsEqual({ x: b1.x2, y: b1.y2 }, { x: b2.x1, y: b2.y1 }) ||
                pointsEqual({ x: b1.x2, y: b1.y2 }, { x: b2.x2, y: b2.y2 });
        };

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const b of beams) {
            minX = Math.min(minX, b.x1, b.x2);
            maxX = Math.max(maxX, b.x1, b.x2);
            minY = Math.min(minY, b.y1, b.y2);
            maxY = Math.max(maxY, b.y1, b.y2);
        }

        const isFrameBeam = (b, tolerance = 1) => {
            const isHorizontal = Math.abs(b.y1 - b.y2) <= tolerance &&
                (Math.abs(b.y1 - minY) <= tolerance || Math.abs(b.y1 - maxY) <= tolerance);
            const isVertical = Math.abs(b.x1 - b.x2) <= tolerance &&
                (Math.abs(b.x1 - minX) <= tolerance || Math.abs(b.x1 - maxX) <= tolerance);
            return isHorizontal || isVertical;
        };

        const rangeIndices = new Set();
        if (rangeInfo && Number.isFinite(rangeMinZ) && Number.isFinite(rangeMaxZ)) {
            const minZ = Math.min(rangeMinZ, rangeMaxZ);
            const maxZ = Math.max(rangeMinZ, rangeMaxZ);
            const tolerance = 0.5;
            for (let i = 0; i < beams.length; i++) {
                const b = beams[i];
                const centerZ = ((b.y1 + b.y2) / 2) - this.terraceCenter.y;
                if (centerZ >= minZ - tolerance && centerZ <= maxZ + tolerance) {
                    rangeIndices.add(i);
                }
            }
        }

        for (let i = 0; i < beams.length; i++) {
            let hasFullInclination = false;
            let radians = 0;

            // Verificar si está en el rango principal
            if (rangeIndices.has(i)) {
                hasFullInclination = true;
                radians = baseRadians;
            } else {
                // Verificar si conecta con alguna viga del rango principal
                for (const j of rangeIndices) {
                    if (j < beams.length && beamsConnected(beams[i], beams[j])) {
                        if (isFrameBeam(beams[i])) {
                            hasFullInclination = true;
                            radians = baseRadians;
                        } else {
                            radians = baseRadians * 0.25;
                        }
                        break;
                    }
                }
            }

            result.push({ radians, hasFullInclination });
        }

        return result;
    }

    _getInclinationRange(beams, inclination) {
        if (!beams || beams.length === 0) return null;
        const totalBeams = beams.length;
        const rawStart = Number.isFinite(inclination.startBeam)
            ? inclination.startBeam
            : 0;
        const rawEnd = inclination.endBeam === -1
            ? totalBeams - 1
            : inclination.endBeam;

        const startIndex = Math.max(0, Math.min(rawStart, totalBeams - 1));
        const endIndex = Math.max(0, Math.min(rawEnd, totalBeams - 1));
        const rangeStart = Math.min(startIndex, endIndex);
        const rangeEnd = Math.max(startIndex, endIndex);

        let minZ = Infinity;
        let maxZ = -Infinity;

        if (inclination.endBeam === -1) {
            for (let i = rangeStart; i <= rangeEnd; i++) {
                const b = beams[i];
                if (!b) continue;
                minZ = Math.min(minZ, b.y1 - this.terraceCenter.y, b.y2 - this.terraceCenter.y);
                maxZ = Math.max(maxZ, b.y1 - this.terraceCenter.y, b.y2 - this.terraceCenter.y);
            }
        } else {
            const startBeam = beams[startIndex];
            const endBeam = beams[endIndex];
            if (!startBeam || !endBeam) return null;
            minZ = Math.min(
                startBeam.y1 - this.terraceCenter.y,
                startBeam.y2 - this.terraceCenter.y,
                endBeam.y1 - this.terraceCenter.y,
                endBeam.y2 - this.terraceCenter.y
            );
            maxZ = Math.max(
                startBeam.y1 - this.terraceCenter.y,
                startBeam.y2 - this.terraceCenter.y,
                endBeam.y1 - this.terraceCenter.y,
                endBeam.y2 - this.terraceCenter.y
            );
        }

        if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
            return null;
        }

        return {
            startIndex: rangeStart,
            endIndex: rangeEnd,
            minZ,
            maxZ,
            invert: endIndex < startIndex,
        };
    }

    /**
     * Construye los paneles solares como planos sin inclinación.
     * @param {Array} panels — Paneles [{x,y,w,h,inclination}]
     * @param {number} height — Altura de la estructura
     */
    _buildPanels(panels, beams, height, inclination) {
        console.log('3D _buildPanels: building', panels.length, 'panels');
        const beamInclinations = this._calculateBeamInclinations(beams, inclination);
        const bounds = this._getStructureBounds(beams, []);
        const rangeInfo = this._getInclinationRange(beams, inclination);
        const zMin = rangeInfo ? rangeInfo.minZ : (bounds ? bounds.minZ : 0);
        const zMax = rangeInfo ? rangeInfo.maxZ : (bounds ? bounds.maxZ : 0);
        const zSpan = (Number.isFinite(zMin) && Number.isFinite(zMax)) ? (zMax - zMin) : 0;

        const getHeightAtZ = (z, radians) => {
            if (!bounds || zSpan === 0 || radians === 0) return height;
            const rise = zSpan * Math.tan(radians);
            let t = (z - zMin) / zSpan;
            if (rangeInfo && rangeInfo.invert) {
                t = 1 - t;
            }
            t = Math.max(0, Math.min(1, t));
            return height + rise * t;
        };

        const pointInRect = (x, y, rect) => {
            return x >= rect.minX && x <= rect.maxX &&
                y >= rect.minY && y <= rect.maxY;
        };

        const segmentsIntersect = (p1, p2, p3, p4) => {
            const epsilon = 1e-6;

            const orientation = (a, b, c) => {
                const val = (b.y - a.y) * (c.x - b.x) -
                    (b.x - a.x) * (c.y - b.y);
                if (Math.abs(val) <= epsilon) return 0;
                return val > 0 ? 1 : 2;
            };

            const onSegment = (a, b, c) => {
                return Math.min(a.x, b.x) - epsilon <= c.x &&
                    c.x <= Math.max(a.x, b.x) + epsilon &&
                    Math.min(a.y, b.y) - epsilon <= c.y &&
                    c.y <= Math.max(a.y, b.y) + epsilon;
            };

            const o1 = orientation(p1, p2, p3);
            const o2 = orientation(p1, p2, p4);
            const o3 = orientation(p3, p4, p1);
            const o4 = orientation(p3, p4, p2);

            if (o1 !== o2 && o3 !== o4) return true;

            if (o1 === 0 && onSegment(p1, p2, p3)) return true;
            if (o2 === 0 && onSegment(p1, p2, p4)) return true;
            if (o3 === 0 && onSegment(p3, p4, p1)) return true;
            if (o4 === 0 && onSegment(p3, p4, p2)) return true;

            return false;
        };

        const segmentIntersectsRect = (x1, y1, x2, y2, rect) => {
            if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) {
                return true;
            }

            const p1 = { x: x1, y: y1 };
            const p2 = { x: x2, y: y2 };
            const tl = { x: rect.minX, y: rect.minY };
            const tr = { x: rect.maxX, y: rect.minY };
            const br = { x: rect.maxX, y: rect.maxY };
            const bl = { x: rect.minX, y: rect.maxY };

            return segmentsIntersect(p1, p2, tl, tr) ||
                segmentsIntersect(p1, p2, tr, br) ||
                segmentsIntersect(p1, p2, br, bl) ||
                segmentsIntersect(p1, p2, bl, tl);
        };

        for (const p of panels) {
            const realH = p.realHeight || p.h;
            const panelThickness = 3;
            const panelRect = {
                minX: p.x,
                maxX: p.x + p.w,
                minY: p.y,
                maxY: p.y + realH,
            };
            let inclRad = 0;
            const intersecting = [];

            for (let i = 0; i < beams.length; i++) {
                const b = beams[i];
                if (!segmentIntersectsRect(b.x1, b.y1, b.x2, b.y2, panelRect)) {
                    continue;
                }
                intersecting.push(i);
                const beamRad = beamInclinations[i]
                    ? beamInclinations[i].radians
                    : 0;
                if (beamRad > inclRad) {
                    inclRad = beamRad;
                }
            }

            if (intersecting.length === 0) {
                const beamIndex = this._getNearestBeamIndex(p, beams);
                if (beamIndex !== -1 && beamInclinations[beamIndex]) {
                    inclRad = beamInclinations[beamIndex].radians;
                }
            }

            const signedInclRad = (rangeInfo && rangeInfo.invert)
                ? -inclRad
                : inclRad;

            const zStart = p.y - this.terraceCenter.y;
            const zEnd = zStart + realH * Math.cos(signedInclRad);

            let supportHeightStart = null;
            let supportHeightEnd = null;

            for (const i of intersecting) {
                const beamRad = beamInclinations[i]
                    ? beamInclinations[i].radians
                    : 0;
                const beamHeightStart = getHeightAtZ(zStart, beamRad);
                const beamHeightEnd = getHeightAtZ(zEnd, beamRad);

                supportHeightStart = supportHeightStart === null
                    ? beamHeightStart
                    : Math.max(supportHeightStart, beamHeightStart);
                supportHeightEnd = supportHeightEnd === null
                    ? beamHeightEnd
                    : Math.max(supportHeightEnd, beamHeightEnd);
            }

            if (supportHeightStart === null || supportHeightEnd === null) {
                const fallbackStart = getHeightAtZ(zStart, inclRad);
                const fallbackEnd = getHeightAtZ(zEnd, inclRad);
                supportHeightStart = supportHeightStart ?? fallbackStart;
                supportHeightEnd = supportHeightEnd ?? fallbackEnd;
            }

            const geometry = new THREE.BoxGeometry(p.w, panelThickness, realH);  // 3cm grosor
            const material = new THREE.MeshStandardMaterial({
                color: 0x2980b9,
                metalness: 0.4,
                roughness: 0.3,
            });
            const mesh = new THREE.Mesh(geometry, material);

            // Posicionar sobre la estructura, centrado, 1 cm por encima de la viga
            const centerX = p.x - this.terraceCenter.x + p.w / 2;
            const centerZ = p.y - this.terraceCenter.y + (realH / 2) * Math.cos(signedInclRad);
            const heightStart = supportHeightStart;
            const heightEnd = supportHeightEnd;
            const aRot = -signedInclRad;
            const halfThick = panelThickness / 2;

            const requiredCenterY = (zEdge, heightEdge) => {
                return heightEdge + 1 - (zEdge - centerZ) * Math.tan(aRot) +
                    halfThick * Math.cos(aRot);
            };

            const centerY = Math.max(
                requiredCenterY(zStart, heightStart),
                requiredCenterY(zEnd, heightEnd)
            );

            mesh.position.set(centerX, centerY, centerZ);

            // Inclinación según la viga más cercana
            mesh.rotation.x = -signedInclRad;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.editorObject = true;
            this.scene.add(mesh);

            // Agregar líneas de celdas sobre el panel
            const cellCols = 6;
            const cellRows = 24;
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

            // Líneas verticales
            for (let c = 1; c < cellCols; c++) {
                const x = -p.w / 2 + (p.w / cellCols) * c;
                const points = [
                    new THREE.Vector3(x, panelThickness / 2 + 0.1, -realH / 2),
                    new THREE.Vector3(x, panelThickness / 2 + 0.1, realH / 2)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                line.position.set(centerX, centerY, centerZ);
                line.rotation.x = -signedInclRad;
                this.scene.add(line);
            }

            // Líneas horizontales
            for (let r = 1; r < cellRows; r++) {
                const z = -realH / 2 + (realH / cellRows) * r;
                const points = [
                    new THREE.Vector3(-p.w / 2, panelThickness / 2 + 0.1, z),
                    new THREE.Vector3(p.w / 2, panelThickness / 2 + 0.1, z)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                line.position.set(centerX, centerY, centerZ);
                line.rotation.x = -signedInclRad;
                this.scene.add(line);
            }
        }
    }

    _getNearestBeamIndex(panel, beams) {
        if (!beams || beams.length === 0) return -1;
        const centerX = panel.x + panel.w / 2;
        const centerY = panel.y + panel.h / 2;

        let minDistance = Infinity;
        let closestIndex = -1;

        for (let i = 0; i < beams.length; i++) {
            const b = beams[i];
            const distance = this._distancePointToSegment(
                centerX,
                centerY,
                b.x1,
                b.y1,
                b.x2,
                b.y2
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    _distancePointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        const clamped = Math.max(0, Math.min(1, t));
        const cx = x1 + clamped * dx;
        const cy = y1 + clamped * dy;
        return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    }

    /**
     * Inicia el render loop.
     */
    start() {
        console.log('3D start: starting animation loop');
        this.isActive = true;
        this._animate();
    }

    /**
     * Detiene el render loop.
     */
    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Loop de animación.
     */
    _animate() {
        if (!this.isActive) return;
        this.animationId = requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (!this.hasLoggedRender) {
            console.log('3D rendering first frame');
            this.hasLoggedRender = true;
        }
    }

    /**
     * Ajusta el tamaño del renderer al contenedor.
     */
    resize() {
        if (!this.renderer) return;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        console.log('3D resize: setting size to', w, 'x', h);
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Exporta una captura PNG del visor 3D con propiedades.
     * @param {object} properties - Objeto con las propiedades a incluir
     * @returns {string} Data URL de la imagen
     */
    exportImage(properties = {}) {
        if (!this.renderer) return '';

        this.renderer.render(this.scene, this.camera);

        // Crear canvas temporal para combinar imagen 3D + texto
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const margin = 20;
        const textHeight = 16;
        const lineSpacing = 4;
        const columnSpacing = 50; // Espacio entre columnas

        // Calcular bloques de texto (mismo formato que editor 2D)
        const blocks = this._buildPropertiesBlocks(properties);

        // Calcular altura máxima de los bloques
        let maxBlockLines = 0;
        blocks.forEach(block => maxBlockLines = Math.max(maxBlockLines, block.lines.length));
        const textAreaHeight = maxBlockLines * (textHeight + lineSpacing) + margin * 2;

        // Dimensiones
        tempCanvas.width = this.renderer.domElement.width;
        tempCanvas.height = this.renderer.domElement.height + textAreaHeight;

        // Fondo blanco
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Dibujar imagen 3D arriba
        tempCtx.drawImage(this.renderer.domElement, 0, 0);

        // Dibujar texto de propiedades en 3 columnas debajo
        tempCtx.fillStyle = 'black';
        tempCtx.font = '14px Arial';
        tempCtx.textAlign = 'left';

        const columnWidth = (tempCanvas.width - margin * 2 - columnSpacing * 2) / 3;
        blocks.forEach((block, index) => {
            const x = margin + index * (columnWidth + columnSpacing);
            let y = this.renderer.domElement.height + margin + textHeight;

            // Título del bloque
            tempCtx.font = 'bold 16px Arial';
            tempCtx.fillText(block.title, x, y);
            y += textHeight + lineSpacing * 2;

            // Líneas del bloque
            tempCtx.font = '14px Arial';
            for (const line of block.lines) {
                tempCtx.fillText(line, x, y);
                y += textHeight + lineSpacing;
            }
        });

        return tempCanvas.toDataURL('image/png');
    }

    /**
     * Construye los bloques de texto con las propiedades (formato 3 columnas).
     * @param {object} props - Propiedades
     * @returns {Array} Array de bloques {title, lines}
     */
    _buildPropertiesBlocks(props) {
        const blocks = [];

        // Bloque Terraza
        const terraceLines = [];
        if (props.terrace) {
            if (props.terrace.width) terraceLines.push(`Ancho: ${props.terrace.width} cm`);
            if (props.terrace.height) terraceLines.push(`Alto: ${props.terrace.height} cm`);
            if (props.terrace.vertices) terraceLines.push(`Vértices: ${props.terrace.vertices}`);
        }
        blocks.push({ title: 'Terraza', lines: terraceLines });

        // Bloque Estructura
        const structureLines = [];
        if (props.structure) {
            if (props.structure.material) structureLines.push(`Material: ${props.structure.material}`);
            if (props.structure.profile) structureLines.push(`Perfil: ${props.structure.profile}`);
            if (props.structure.height) structureLines.push(`Altura: ${props.structure.height} cm`);
            if (props.structure.inclination) structureLines.push(`Inclinación vigas: ${props.structure.inclination}°`);
            if (props.structure.startBeam !== undefined && props.structure.endBeam !== undefined) {
                structureLines.push(`Rango: Viga ${props.structure.startBeam + 1} a ${props.structure.endBeam + 1}`);
            }
            if (props.structure.showLabels) structureLines.push(`Etiquetas postes: ${props.structure.showLabels}`);
            if (props.structure.beamCount !== undefined) structureLines.push(`Vigas: ${props.structure.beamCount}`);
            if (props.structure.beamMeters) structureLines.push(`m lineales: ${props.structure.beamMeters}`);
        }
        blocks.push({ title: 'Estructura', lines: structureLines });

        // Bloque Paneles
        const panelsLines = [];
        if (props.panels) {
            if (props.panels.width) panelsLines.push(`Ancho: ${props.panels.width} cm`);
            if (props.panels.height) panelsLines.push(`Alto: ${props.panels.height} cm`);
            if (props.panels.inclination !== undefined) panelsLines.push(`Inclinación: ${props.panels.inclination}°`);
            if (props.panels.power) panelsLines.push(`Potencia: ${props.panels.power} W`);
            if (props.panels.count !== undefined) panelsLines.push(`Colocados: ${props.panels.count}`);
            if (props.panels.totalPower) panelsLines.push(`Total: ${props.panels.totalPower} W`);
            if (props.panels.shadowGap) panelsLines.push(`Sombra: ${props.panels.shadowGap} cm`);
        }
        blocks.push({ title: 'Paneles', lines: panelsLines });

        return blocks;
    }
}

// Exportar globalmente
window.AEPEditor3D = AEPEditor3D;
