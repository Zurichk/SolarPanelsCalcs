/**
 * AEP Solar Panel Planner — Editor 2D (Canvas)
 *
 * Motor de dibujo 2D a escala con:
 * - Dibujo de terraza poligonal (forma libre)
 * - Obstáculos (columnas, chimeneas)
 * - Vigas de estructura metálica
 * - Colocación de paneles solares a escala
 * - Grid, reglas, zoom, pan, snap
 * - Medidas en pantalla (cm/m)
 */

class AEPEditor2D {
    /**
     * Inicializa el editor 2D.
     * @param {HTMLCanvasElement} canvas — Elemento canvas principal
     * @param {object} options — Opciones de configuración
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Escala: píxeles por centímetro
        this.scale = options.scale || 4; // 4px = 1cm → escala 1:25

        // Estado de la vista (pan/zoom)
        this.offsetX = 50;
        this.offsetY = 50;
        this.zoomLevel = 1;

        // Datos del diseño
        this.terraceVertices = [];   // [{x, y}] en cm
        this.constructionBounds = null; // {minX, maxX, minY, maxY} en cm
        this.panelBounds = null; // {minX, maxX, minY, maxY} en cm
        this.obstacles = [];          // [{x, y, w, h, type}] en cm
        this.beams = [];              // [{x1, y1, x2, y2, profile}] en cm
        this.panels = [];             // [{x, y, w, h, rotation, inclination}] en cm
        this.texts = [];              // [{x, y, text, size}] en cm

        // Estado de la herramienta
        this.currentTool = 'select';
        this.isDrawing = false;
        this.tempPoints = [];
        this.selectedElements = [];  // Cambiado a array para selección múltiple
        this.copiedElements = [];    // Elementos copiados para pegar
        this.dragStart = null;
        this.isPanning = false;
        this.panStart = null;
        this.alignmentGuide = null;
        this.isAreaAdditive = false;

        // Selección en área
        this.selectionRect = null;  // {x, y, w, h} en cm

        // Callback para actualizar UI externa
        this.onUpdate = null;
        this.onSelectionChange = null;

        // Configuración de grid
        this.gridSize = 10; // cm
        this.snapEnabled = true;

        // Configuración de paneles
        this.panelConfig = {
            width: 114,
            height: 228,
            inclination: 0,
            power: 610,
        };

        this.textConfig = {
            content: 'Texto',
            size: 14,
        };

        // Bind de eventos
        this._bindEvents();
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    // ──────────────────────────────────────────
    // Eventos
    // ──────────────────────────────────────────

    /** Enlaza todos los eventos del canvas. */
    _bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this._onDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Ajusta el tamaño del canvas al contenedor.
     */
    _resize() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth - 30;
        this.canvas.height = wrapper.clientHeight - 30;
        this.render();
    }

    /**
     * Convierte coordenadas de pantalla a cm del diseño.
     * @param {number} screenX — Coordenada X en pantalla
     * @param {number} screenY — Coordenada Y en pantalla
     * @returns {{x: number, y: number}} Coordenadas en cm
     */
    screenToCm(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const px = screenX - rect.left;
        const py = screenY - rect.top;
        return {
            x: (px - this.offsetX) / (this.scale * this.zoomLevel),
            y: (py - this.offsetY) / (this.scale * this.zoomLevel),
        };
    }

    /**
     * Convierte cm a coordenadas de pantalla.
     * @param {number} cmX — Coordenada X en cm
     * @param {number} cmY — Coordenada Y en cm
     * @returns {{x: number, y: number}} Coordenadas en pantalla
     */
    cmToScreen(cmX, cmY) {
        return {
            x: cmX * this.scale * this.zoomLevel + this.offsetX,
            y: cmY * this.scale * this.zoomLevel + this.offsetY,
        };
    }

    /**
     * Aplica snap al grid si está habilitado.
     * @param {number} val — Valor en cm
     * @returns {number} Valor ajustado al grid
     */
    snap(val) {
        if (!this.snapEnabled) return val;
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    // ──────────────────────────────────────────
    // Handlers de ratón
    // ──────────────────────────────────────────

    _onMouseDown(e) {
        const cm = this.screenToCm(e.clientX, e.clientY);
        const snapped = { x: this.snap(cm.x), y: this.snap(cm.y) };

        // Click derecho o medio → pan
        if (e.button === 1 || e.button === 2) {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            return;
        }

        switch (this.currentTool) {
            case 'select':
                this.alignmentGuide = null;
                this._handleSelect(cm, e);
                break;
            case 'select-area':
                this.alignmentGuide = null;
                this._startAreaSelect(cm, e);
                break;
            case 'draw-terrace':
                this.tempPoints.push(snapped);
                this.render();
                this.onUpdate && this.onUpdate();
                break;
            case 'add-obstacle':
                this._startObstacle(snapped);
                break;
            case 'add-beam':
                this._startBeam(snapped);
                break;
            case 'place-panel':
                this._placePanel(snapped);
                break;
            case 'add-text':
                this._placeText(snapped);
                break;
        }
    }

    _onMouseMove(e) {
        const cm = this.screenToCm(e.clientX, e.clientY);

        // Actualizar label de coordenadas
        const coordsEl = document.getElementById('mouseCoords');
        if (coordsEl) {
            coordsEl.textContent = `X: ${cm.x.toFixed(1)} cm · Y: ${cm.y.toFixed(1)} cm`;
        }

        // Panning
        if (this.isPanning && this.panStart) {
            this.offsetX += e.clientX - this.panStart.x;
            this.offsetY += e.clientY - this.panStart.y;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        // Dragging un elemento seleccionado
        if (this.selectedElements.length > 0 && this.dragStart) {
            const dx = cm.x - this.dragStart.x;
            const dy = cm.y - this.dragStart.y;
            this._moveSelected(dx, dy);
            this.dragStart = { x: cm.x, y: cm.y };
            this.render();
            return;
        }

        // Dibujando obstáculo
        if (this.isDrawing && this.currentTool === 'add-obstacle') {
            this._updateObstacle(cm);
            this._updateObstacleAlignmentGuide();
            this.render();
        }

        // Dibujando viga
        if (this.isDrawing && this.currentTool === 'add-beam') {
            this._updateBeam(cm);
            this._updateBeamAlignmentGuide();
            this.render();
        }

        if (!this.isDrawing && this.currentTool === 'place-panel') {
            const snapped = { x: this.snap(cm.x), y: this.snap(cm.y) };
            this._updatePanelAlignmentGuide(snapped);
            this.render();
            return;
        }

        if (!this.isDrawing && this.currentTool === 'add-text') {
            this._updateAlignmentGuide({ x: this.snap(cm.x), y: this.snap(cm.y) });
            this.render();
            return;
        }

        if (!this.isDrawing && this.alignmentGuide) {
            this.alignmentGuide = null;
            this.render();
        }

        // Dibujando selección en área
        if (this.isDrawing && this.currentTool === 'select-area') {
            this._updateAreaSelect(cm);
            this.render();
        }

        // Preview de terraza
        if (this.currentTool === 'draw-terrace' && this.tempPoints.length > 0) {
            this.render();
            // Dibujar línea temporal al cursor - DESACTIVADO
            /*
            const last = this.cmToScreen(
                this.tempPoints[this.tempPoints.length - 1].x,
                this.tempPoints[this.tempPoints.length - 1].y
            );
            const screenPos = this.cmToScreen(this.snap(cm.x), this.snap(cm.y));
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.moveTo(last.x, last.y);
            this.ctx.lineTo(screenPos.x, screenPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            */
        }
    }

    _onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.panStart = null;
            return;
        }

        if (this.isDrawing && this.currentTool === 'add-obstacle') {
            this._finishObstacle();
        }

        if (this.isDrawing && this.currentTool === 'add-beam') {
            this._finishBeam();
        }

        if (this.isDrawing && this.currentTool === 'select-area') {
            this._finishAreaSelect();
        }

        this.dragStart = null;
    }

    _onDoubleClick(e) {
        const cm = this.screenToCm(e.clientX, e.clientY);
        const textIndex = this._getTextIndexAt(cm);
        if (textIndex !== -1) {
            const current = this.texts[textIndex].text;
            const updated = prompt('Editar texto:', current);
            if (updated === null) return;
            const trimmed = updated.trim();
            if (!trimmed) {
                this.texts.splice(textIndex, 1);
            } else {
                this.texts[textIndex].text = trimmed;
            }
            this.render();
            this._updateUI();
            return;
        }

        if (this.currentTool === 'draw-terrace' && this.tempPoints.length >= 3) {
            this.terraceVertices = [...this.tempPoints];
            const bounds = this.getTerraceBounds();
            if (bounds) {
                this.constructionBounds = this._calculateConstructionBounds(bounds, 10);
                this.panelBounds = this._calculatePanelBounds(this.constructionBounds, 40);
            }
            this.tempPoints = [];
            this.render();
            this._updateUI();
            this.onUpdate && this.onUpdate();
        }
    }

    /**
     * Confirma el dibujo de la terraza desde tempPoints.
     */
    confirmTerrace() {
        if (this.tempPoints.length >= 3) {
            this.terraceVertices = [...this.tempPoints];
            // Calcular área de construcción: bounds de la terraza + 10 cm
            const bounds = this.getTerraceBounds();
            if (bounds) {
                this.constructionBounds = this._calculateConstructionBounds(bounds, 10);
                this.panelBounds = this._calculatePanelBounds(this.constructionBounds, 40);
            }
            this.tempPoints = [];
            this.render();
            this._updateUI();
            this.onUpdate && this.onUpdate();
            showAlert('Terraza confirmada', 'success');
        } else {
            showAlert('Necesitas al menos 3 vértices para confirmar la terraza', 'warning');
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomLevel = Math.max(0.2, Math.min(5, this.zoomLevel * factor));
        this.render();
    }

    // ──────────────────────────────────────────
    // Herramientas
    // ──────────────────────────────────────────

    /**
     * Establece la herramienta activa.
     * @param {string} tool — Nombre de la herramienta
     */
    setTool(tool) {
        this.currentTool = tool;
        this.tempPoints = [];
        this.isDrawing = false;
        this.selectedElements = [];
        this.alignmentGuide = null;

        // Si es seleccionar estructura, seleccionar todas las vigas automáticas
        if (tool === 'select-structure') {
            this.selectedElements = [];
            for (let i = 0; i < this.beams.length; i++) {
                if (this.beams[i].isAutoStructure) {
                    this.selectedElements.push({ type: 'beam', index: i });
                }
            }
        }

        this.render();
        this.onUpdate && this.onUpdate();
    }

    /**
     * Verifica si un punto está cerca de un segmento de línea (distancia < threshold).
     */
    _pointNearLine(px, py, x1, y1, x2, y2, threshold = 5) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) < threshold;

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
        return dist < threshold;
    }

    /** Selección de elementos existentes. */
    _handleSelect(cm, event = null) {
        const isAdditive = Boolean(event && (event.ctrlKey || event.metaKey));

        // Buscar texto bajo el cursor
        const textIndex = this._getTextIndexAt(cm);
        if (textIndex !== -1) {
            this._applySelection('text', textIndex, isAdditive);
            this.dragStart = { x: cm.x, y: cm.y };
            this.render();
            return;
        }

        // Buscar panel bajo el cursor
        for (let i = this.panels.length - 1; i >= 0; i--) {
            const p = this.panels[i];
            if (cm.x >= p.x && cm.x <= p.x + p.w &&
                cm.y >= p.y && cm.y <= p.y + p.h) {
                this._applySelection('panel', i, isAdditive);
                this.dragStart = { x: cm.x, y: cm.y };
                this.render();
                return;
            }
        }

        // Buscar obstáculo
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            if (cm.x >= o.x && cm.x <= o.x + o.w &&
                cm.y >= o.y && cm.y <= o.y + o.h) {
                this._applySelection('obstacle', i, isAdditive);
                this.dragStart = { x: cm.x, y: cm.y };
                this.render();
                return;
            }
        }

        // Buscar viga
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const b = this.beams[i];
            if (this._pointNearLine(cm.x, cm.y, b.x1, b.y1, b.x2, b.y2, 5)) {
                this._applySelection('beam', i, isAdditive);
                this.dragStart = { x: cm.x, y: cm.y };
                this.render();
                return;
            }
        }

        if (!isAdditive) {
            this.selectedElements = [];
        }
        this.render();
        this._emitSelectionChange();
    }

    _applySelection(type, index, isAdditive) {
        const existingIndex = this.selectedElements.findIndex(
            (sel) => sel.type === type && sel.index === index
        );

        if (!isAdditive) {
            this.selectedElements = [{ type, index }];
            this._emitSelectionChange();
            return;
        }

        if (existingIndex !== -1) {
            this.selectedElements.splice(existingIndex, 1);
            this._emitSelectionChange();
            return;
        }

        this.selectedElements.push({ type, index });
        this._emitSelectionChange();
    }

    _emitSelectionChange() {
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectionBounds());
        }
    }

    _getTextRect(textItem) {
        const size = textItem.size || 14;
        this.ctx.font = `${size}px sans-serif`;
        const textWpx = this.ctx.measureText(textItem.text).width;
        const textHpx = size;
        const pxPerCm = this.scale * this.zoomLevel;
        const textWcm = textWpx / pxPerCm;
        const textHcm = textHpx / pxPerCm;
        return { x: textItem.x, y: textItem.y, w: textWcm, h: textHcm };
    }

    _getTextIndexAt(cm) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const rect = this._getTextRect(this.texts[i]);
            if (cm.x >= rect.x && cm.x <= rect.x + rect.w &&
                cm.y >= rect.y - rect.h && cm.y <= rect.y) {
                return i;
            }
        }
        return -1;
    }

    _normalizeRect(rect) {
        const normalized = { ...rect };
        if (normalized.w < 0) {
            normalized.x += normalized.w;
            normalized.w = Math.abs(normalized.w);
        }
        if (normalized.h < 0) {
            normalized.y += normalized.h;
            normalized.h = Math.abs(normalized.h);
        }
        return normalized;
    }

    _getAlignmentCandidates(exclude = null) {
        const candidates = [];

        for (let i = 0; i < this.panels.length; i++) {
            if (exclude && exclude.type === 'panel' && exclude.index === i) continue;
            const p = this.panels[i];
            candidates.push({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
        }

        for (let i = 0; i < this.obstacles.length; i++) {
            if (exclude && exclude.type === 'obstacle' && exclude.index === i) continue;
            const o = this.obstacles[i];
            candidates.push({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
        }

        for (let i = 0; i < this.texts.length; i++) {
            if (exclude && exclude.type === 'text' && exclude.index === i) continue;
            const t = this.texts[i];
            candidates.push({ x: t.x, y: t.y });
        }

        for (let i = 0; i < this.beams.length; i++) {
            if (exclude && exclude.type === 'beam' && exclude.index === i) continue;
            const b = this.beams[i];
            candidates.push({
                x: (b.x1 + b.x2) / 2,
                y: (b.y1 + b.y2) / 2
            });
        }

        return candidates;
    }

    _updateAlignmentGuide(anchor, exclude = null) {
        const candidates = this._getAlignmentCandidates(exclude);
        if (candidates.length === 0) {
            this.alignmentGuide = null;
            return;
        }

        let closest = null;
        let closestDistance = Infinity;
        for (const candidate of candidates) {
            const dx = candidate.x - anchor.x;
            const dy = candidate.y - anchor.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = candidate;
            }
        }

        if (!closest) {
            this.alignmentGuide = null;
            return;
        }

        this.alignmentGuide = {
            x: closest.x,
            y: closest.y
        };
    }

    _updateObstacleAlignmentGuide() {
        if (!this.obstacles.length) return;
        const o = this.obstacles[this.obstacles.length - 1];
        const rect = this._normalizeRect({ x: o.x, y: o.y, w: o.w, h: o.h });
        const anchor = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        this._updateAlignmentGuide(anchor, { type: 'obstacle', index: this.obstacles.length - 1 });
    }

    _updateBeamAlignmentGuide() {
        if (!this.beams.length) return;
        const b = this.beams[this.beams.length - 1];
        const anchor = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
        this._updateAlignmentGuide(anchor, { type: 'beam', index: this.beams.length - 1 });
    }

    _updatePanelAlignmentGuide(cm) {
        const inclRad = (this.panelConfig.inclination * Math.PI) / 180;
        const projectedHeight = this.panelConfig.height * Math.cos(inclRad);
        const anchor = {
            x: cm.x + this.panelConfig.width / 2,
            y: cm.y + projectedHeight / 2
        };
        this._updateAlignmentGuide(anchor);
    }

    /** Inicia selección en área. */
    _startAreaSelect(cm, event = null) {
        this.isDrawing = true;
        this.selectionRect = { x: cm.x, y: cm.y, w: 0, h: 0 };
        this.isAreaAdditive = Boolean(event && (event.ctrlKey || event.metaKey));
        if (!this.isAreaAdditive) {
            this.selectedElements = [];
        }
    }

    /** Actualiza el rectángulo de selección. */
    _updateAreaSelect(cm) {
        if (!this.selectionRect) return;
        this.selectionRect.w = cm.x - this.selectionRect.x;
        this.selectionRect.h = cm.y - this.selectionRect.y;
    }

    /** Finaliza selección en área y selecciona objetos intersectados. */
    _finishAreaSelect() {
        if (!this.selectionRect) return;
        this.isDrawing = false;

        // Normalizar rectángulo
        const rect = { ...this.selectionRect };
        if (rect.w < 0) { rect.x += rect.w; rect.w = Math.abs(rect.w); }
        if (rect.h < 0) { rect.y += rect.h; rect.h = Math.abs(rect.h); }

        const areaSelection = [];

        // Seleccionar paneles que intersecten
        this.panels.forEach((p, i) => {
            if (this._rectsIntersect(rect, { x: p.x, y: p.y, w: p.w, h: p.h })) {
                areaSelection.push({ type: 'panel', index: i });
            }
        });

        // Seleccionar textos que intersecten
        this.texts.forEach((t, i) => {
            const bounds = this._getTextRect(t);
            const textRect = { x: bounds.x, y: bounds.y - bounds.h, w: bounds.w, h: bounds.h };
            if (this._rectsIntersect(rect, textRect)) {
                areaSelection.push({ type: 'text', index: i });
            }
        });

        // Seleccionar obstáculos que intersecten
        this.obstacles.forEach((o, i) => {
            if (this._rectsIntersect(rect, { x: o.x, y: o.y, w: o.w, h: o.h })) {
                areaSelection.push({ type: 'obstacle', index: i });
            }
        });

        // Seleccionar vigas que intersecten
        this.beams.forEach((b, i) => {
            if (this._lineIntersectsRect(b.x1, b.y1, b.x2, b.y2, rect)) {
                areaSelection.push({ type: 'beam', index: i });
            }
        });

        if (this.isAreaAdditive) {
            for (const item of areaSelection) {
                const exists = this.selectedElements.some(
                    (sel) => sel.type === item.type && sel.index === item.index
                );
                if (!exists) this.selectedElements.push(item);
            }
        } else {
            this.selectedElements = areaSelection;
        }

        this.selectionRect = null;
        this.isAreaAdditive = false;
        this.render();
        this._emitSelectionChange();
    }

    getSelectionBounds() {
        if (this.selectedElements.length === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        const applyRect = (x, y, w, h) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        };

        const applyPoint = (x, y) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        };

        for (const sel of this.selectedElements) {
            const { type, index } = sel;
            if (type === 'panel') {
                const p = this.panels[index];
                applyRect(p.x, p.y, p.w, p.h);
            } else if (type === 'obstacle') {
                const o = this.obstacles[index];
                applyRect(o.x, o.y, o.w, o.h);
            } else if (type === 'beam') {
                const b = this.beams[index];
                applyPoint(b.x1, b.y1);
                applyPoint(b.x2, b.y2);
            } else if (type === 'text') {
                const t = this.texts[index];
                const rect = this._getTextRect(t);
                applyRect(rect.x, rect.y - rect.h, rect.w, rect.h);
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * Verifica si dos rectángulos se intersectan.
     */
    _rectsIntersect(r1, r2) {
        return !(r1.x + r1.w < r2.x || r2.x + r2.w < r1.x ||
            r1.y + r1.h < r2.y || r2.y + r2.h < r1.y);
    }

    /**
     * Verifica si una línea intersecta un rectángulo.
     */
    _lineIntersectsRect(x1, y1, x2, y2, rect) {
        // Líneas del rectángulo
        const lines = [
            [rect.x, rect.y, rect.x + rect.w, rect.y], // top
            [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h], // right
            [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h], // bottom
            [rect.x, rect.y + rect.h, rect.x, rect.y] // left
        ];
        for (const [rx1, ry1, rx2, ry2] of lines) {
            if (this._linesIntersect(x1, y1, x2, y2, rx1, ry1, rx2, ry2)) return true;
        }
        return false;
    }

    /**
     * Verifica si dos líneas se intersectan.
     */
    _linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) return false;
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    _moveSelected(dx, dy) {
        if (this.selectedElements.length === 0) return;
        if (this.constructionBounds) {
            const canMove = this.selectedElements.every((sel) => {
                const { type, index } = sel;
                if (type === 'panel') {
                    const p = this.panels[index];
                    return this._isRectWithinPanelBounds({
                        x: p.x + dx,
                        y: p.y + dy,
                        w: p.w,
                        h: p.h,
                    });
                }
                if (type === 'obstacle') {
                    return true;
                }
                if (type === 'beam') {
                    const b = this.beams[index];
                    return this._isLineWithinConstructionBounds(
                        b.x1 + dx,
                        b.y1 + dy,
                        b.x2 + dx,
                        b.y2 + dy
                    );
                }
                if (type === 'text') {
                    return true;
                }
                return true;
            });

            if (!canMove) {
                showAlert('No se puede mover fuera del margen de seguridad.', 'warning');
                return;
            }
        }

        for (const sel of this.selectedElements) {
            const { type, index } = sel;
            if (type === 'panel') {
                this.panels[index].x += dx;
                this.panels[index].y += dy;
            } else if (type === 'obstacle') {
                this.obstacles[index].x += dx;
                this.obstacles[index].y += dy;
            } else if (type === 'beam') {
                this.beams[index].x1 += dx;
                this.beams[index].y1 += dy;
                this.beams[index].x2 += dx;
                this.beams[index].y2 += dy;
            } else if (type === 'text') {
                this.texts[index].x += dx;
                this.texts[index].y += dy;
            }
        }
    }

    // ── Obstáculos ──

    _startObstacle(cm) {
        this.isDrawing = true;
        this.obstacles.push({
            x: cm.x, y: cm.y, w: 0, h: 0, type: 'column'
        });
    }

    _updateObstacle(cm) {
        const o = this.obstacles[this.obstacles.length - 1];
        const snapped = { x: this.snap(cm.x), y: this.snap(cm.y) };
        o.w = snapped.x - o.x;
        o.h = snapped.y - o.y;
    }

    _finishObstacle() {
        this.isDrawing = false;
        const o = this.obstacles[this.obstacles.length - 1];
        // Normalizar dimensiones negativas
        if (o.w < 0) { o.x += o.w; o.w = Math.abs(o.w); }
        if (o.h < 0) { o.y += o.h; o.h = Math.abs(o.h); }
        // Eliminar si es demasiado pequeño
        if (o.w < 2 && o.h < 2) this.obstacles.pop();
        this.alignmentGuide = null;
        this.render();
        this._updateUI();
    }

    // ── Vigas ──

    _startBeam(cm) {
        if (!this._isWithinConstructionBounds(cm.x, cm.y)) {
            showAlert('No se puede crear fuera del margen de seguridad.', 'warning');
            return;
        }
        this.isDrawing = true;
        this.beams.push({
            x1: cm.x, y1: cm.y, x2: cm.x, y2: cm.y,
            profile: document.getElementById('beamProfile')?.value || 'IPN-80'
        });
    }

    _updateBeam(cm) {
        const b = this.beams[this.beams.length - 1];
        const snapped = { x: this.snap(cm.x), y: this.snap(cm.y) };
        if (!this._isWithinConstructionBounds(snapped.x, snapped.y)) return;
        b.x2 = snapped.x;
        b.y2 = snapped.y;
    }

    _finishBeam() {
        this.isDrawing = false;
        const b = this.beams[this.beams.length - 1];
        const length = Math.sqrt((b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2);
        if (length < 5) {
            this.beams.pop(); // Muy corta
        } else if (!this._isLineWithinConstructionBounds(b.x1, b.y1, b.x2, b.y2)) {
            this.beams.pop();
            showAlert('No se puede crear fuera del margen de seguridad.', 'warning');
        }
        this.alignmentGuide = null;
        this.render();
        this._updateUI();
    }

    // ── Paneles ──

    _placePanel(cm) {
        const inclRad = (this.panelConfig.inclination * Math.PI) / 180;
        const projectedHeight = this.panelConfig.height * Math.cos(inclRad);
        const panelRect = {
            x: cm.x,
            y: cm.y,
            w: this.panelConfig.width,
            h: projectedHeight
        };
        if (!this._isRectWithinPanelBounds(panelRect)) {
            showAlert('No se puede crear fuera del margen de seguridad de paneles.', 'warning');
            return;
        }
        this.panels.push({
            x: cm.x,
            y: cm.y,
            w: this.panelConfig.width,
            h: projectedHeight,
            realHeight: this.panelConfig.height,
            inclination: this.panelConfig.inclination,
            power: this.panelConfig.power,
        });
        this.alignmentGuide = null;
        this.render();
        this._updateUI();
    }

    _placeText(cm) {
        const defaultText = (this.textConfig.content || 'Texto').trim();
        const text = prompt('Texto:', defaultText);
        if (text === null) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        this.texts.push({
            x: cm.x,
            y: cm.y,
            text: trimmed,
            size: this.textConfig.size,
        });
        this.alignmentGuide = null;
        this.render();
        this._updateUI();
    }

    /**
     * Genera terraza rectangular a partir de ancho y alto.
     * @param {number} w — Ancho en cm
     * @param {number} h — Alto en cm
     */
    setRectangularTerrace(w, h) {
        this.terraceVertices = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
        ];
        const bounds = this.getTerraceBounds();
        if (bounds) {
            this.constructionBounds = this._calculateConstructionBounds(bounds, 10);
            this.panelBounds = this._calculatePanelBounds(this.constructionBounds, 40);
        }
        this.render();
        this._updateUI();
    }

    /** Limpia la terraza y todos los elementos. */
    clearAll() {
        this.terraceVertices = [];
        this.constructionBounds = null;
        this.panelBounds = null;
        this.obstacles = [];
        this.beams = [];
        this.panels = [];
        this.texts = [];
        this.tempPoints = [];
        this.selectedElement = null;
        this.render();
        this._updateUI();
    }

    /**
     * Elimina el elemento seleccionado.
     */
    deleteSelected() {
        if (this.selectedElements.length === 0) return;

        // Ordenar por índice descendente para no afectar índices al eliminar
        this.selectedElements.sort((a, b) => b.index - a.index);

        for (const sel of this.selectedElements) {
            const { type, index } = sel;
            if (type === 'panel') {
                this.panels.splice(index, 1);
            } else if (type === 'obstacle') {
                this.obstacles.splice(index, 1);
            } else if (type === 'beam') {
                this.beams.splice(index, 1);
            } else if (type === 'text') {
                this.texts.splice(index, 1);
            }
        }
    }

    /**
     * Copia los elementos seleccionados al portapapeles interno.
     */
    copySelected() {
        if (this.selectedElements.length === 0) return false;

        this.copiedElements = [];
        for (const sel of this.selectedElements) {
            const { type, index } = sel;
            let element;
            if (type === 'panel') {
                element = { ...this.panels[index] };
            } else if (type === 'obstacle') {
                element = { ...this.obstacles[index] };
            } else if (type === 'beam') {
                element = { ...this.beams[index] };
            } else if (type === 'text') {
                element = { ...this.texts[index] };
            }
            if (element) {
                this.copiedElements.push({ type, data: element });
            }
        }
        return true;
    }

    /**
     * Pega los elementos copiados en una nueva posición.
     * @param {number} offsetX - Desplazamiento en X (cm)
     * @param {number} offsetY - Desplazamiento en Y (cm)
     */
    paste(offsetX = 10, offsetY = 10) {
        if (this.copiedElements.length === 0) return;

        // Calcular el centro de los elementos copiados
        let minX = Infinity, minY = Infinity;
        for (const item of this.copiedElements) {
            const data = item.data;
            if (item.type === 'panel' || item.type === 'obstacle') {
                minX = Math.min(minX, data.x);
                minY = Math.min(minY, data.y);
            } else if (item.type === 'beam') {
                minX = Math.min(minX, data.x1, data.x2);
                minY = Math.min(minY, data.y1, data.y2);
            }
        }

        if (this.constructionBounds) {
            const canPaste = this.copiedElements.every((item) => {
                const data = item.data;
                if (item.type === 'panel' || item.type === 'obstacle') {
                    const rect = {
                        x: data.x + offsetX,
                        y: data.y + offsetY,
                        w: data.w,
                        h: data.h
                    };
                    if (item.type === 'panel') {
                        return this._isRectWithinPanelBounds(rect);
                    }
                    return true;
                }
                if (item.type === 'beam') {
                    return this._isLineWithinConstructionBounds(
                        data.x1 + offsetX,
                        data.y1 + offsetY,
                        data.x2 + offsetX,
                        data.y2 + offsetY
                    );
                }
                if (item.type === 'text') {
                    return true;
                }
                return true;
            });
            if (!canPaste) {
                showAlert('No se puede pegar fuera del margen de seguridad de paneles.', 'warning');
                return;
            }
        }

        // Pegar con offset
        const newElements = [];
        for (const item of this.copiedElements) {
            const data = { ...item.data };
            if (item.type === 'panel' || item.type === 'obstacle') {
                data.x += offsetX;
                data.y += offsetY;
                if (item.type === 'panel') {
                    this.panels.push(data);
                    newElements.push({ type: 'panel', index: this.panels.length - 1 });
                } else {
                    this.obstacles.push(data);
                    newElements.push({ type: 'obstacle', index: this.obstacles.length - 1 });
                }
            } else if (item.type === 'beam') {
                data.x1 += offsetX;
                data.y1 += offsetY;
                data.x2 += offsetX;
                data.y2 += offsetY;
                this.beams.push(data);
                newElements.push({ type: 'beam', index: this.beams.length - 1 });
            } else if (item.type === 'text') {
                data.x += offsetX;
                data.y += offsetY;
                this.texts.push(data);
                newElements.push({ type: 'text', index: this.texts.length - 1 });
            }
        }

        // Seleccionar los nuevos elementos
        this.selectedElements = newElements;
        this.render();
        this._updateUI();
    }

    /**
     * Calcula el bounding box de la terraza.
     * @returns {object|null} {minX, maxX, minY, maxY, width, height} o null si no hay terraza
     */
    getTerraceBounds() {
        if (this.terraceVertices.length < 3) return null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const vertex of this.terraceVertices) {
            minX = Math.min(minX, vertex.x);
            maxX = Math.max(maxX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxY = Math.max(maxY, vertex.y);
        }

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    _calculateConstructionBounds(bounds, margin = 10) {
        return {
            minX: bounds.minX - margin,
            maxX: bounds.maxX + margin,
            minY: bounds.minY - margin,
            maxY: bounds.maxY + margin
        };
    }

    _calculatePanelBounds(bounds, margin = 20) {
        return {
            minX: bounds.minX - margin,
            maxX: bounds.maxX + margin,
            minY: bounds.minY - margin,
            maxY: bounds.maxY + margin
        };
    }

    _isWithinConstructionBounds(x, y) {
        if (!this.constructionBounds) return true;
        return x >= this.constructionBounds.minX && x <= this.constructionBounds.maxX &&
            y >= this.constructionBounds.minY && y <= this.constructionBounds.maxY;
    }

    _isRectWithinConstructionBounds(rect) {
        if (!this.constructionBounds) return true;
        const minX = rect.x;
        const minY = rect.y;
        const maxX = rect.x + rect.w;
        const maxY = rect.y + rect.h;
        return this._isWithinConstructionBounds(minX, minY) &&
            this._isWithinConstructionBounds(maxX, maxY);
    }

    _isRectWithinPanelBounds(rect) {
        if (!this.panelBounds) return true;
        return rect.x >= this.panelBounds.minX && rect.y >= this.panelBounds.minY &&
            rect.x + rect.w <= this.panelBounds.maxX &&
            rect.y + rect.h <= this.panelBounds.maxY;
    }

    _isLineWithinConstructionBounds(x1, y1, x2, y2) {
        if (!this.constructionBounds) return true;
        return this._isWithinConstructionBounds(x1, y1) &&
            this._isWithinConstructionBounds(x2, y2);
    }

    /**
     * Crea una estructura automática de vigas basada en la terraza.
     * Calcula automáticamente las dimensiones y valida que las vigas quepan.
     * @param {number} numBeams - Número de vigas
     * @param {number} spacing - Separación entre vigas (cm)
     * @param {string} profile - Perfil de la viga
     * @returns {object} Resultado con {success, message, structure: {width, length}}
     */
    createAutoStructure(numBeams, spacing, profile, width = null, height = null) {
        // Si no hay terraza definida, crearla con las dimensiones proporcionadas o por defecto
        if (!this.getTerraceBounds()) {
            const defaultWidth = width || 585;
            const defaultHeight = height || 388;
            this.setRectangularTerrace(defaultWidth, defaultHeight);
        }

        // Obtener bounds de la terraza
        const terraceBounds = this.getTerraceBounds();
        if (!terraceBounds) {
            return {
                success: false,
                message: 'Error: No se pudo definir la terraza.',
                structure: null
            };
        }

        if (!this.constructionBounds) {
            this.constructionBounds = this._calculateConstructionBounds(terraceBounds, 10);
        }

        if (!this.panelBounds) {
            this.panelBounds = this._calculatePanelBounds(this.constructionBounds, 40);
        }

        // Calcular dimensiones de la estructura (rebajar 5cm en cada extremo)
        const margin = 5; // cm
        const structureWidth = Math.max(50, terraceBounds.width - 2 * margin);
        const structureLength = Math.max(50, terraceBounds.height - 2 * margin);

        // Mantener proporción de la terraza
        const finalWidth = structureWidth;
        const finalLength = structureLength;

        // Validar que las vigas quepan
        const totalBeamLength = numBeams * spacing;
        if (numBeams > 0 && totalBeamLength >= finalLength) {
            return {
                success: false,
                message: `Error: Con ${numBeams} vigas y separación de ${spacing}cm, se necesitan ${totalBeamLength}cm de largo, pero la estructura mide ${finalLength}cm. Reduzca el número de vigas o la separación.`,
                structure: { width: finalWidth, length: finalLength }
            };
        }

        // Limpiar vigas existentes
        this.beams = [];

        // Calcular posiciones centradas en la terraza
        const centerX = (terraceBounds.minX + terraceBounds.maxX) / 2;
        const centerY = (terraceBounds.minY + terraceBounds.maxY) / 2;

        const startX = centerX - finalWidth / 2;
        const startY = centerY - finalLength / 2;
        const endX = startX + finalWidth;
        const endY = startY + finalLength;

        const pushBeam = (x1, y1, x2, y2) => {
            this.beams.push({
                x1,
                y1,
                x2,
                y2,
                profile: profile,
                isAutoStructure: true,
            });
        };

        // Marco perimetral de la estructura
        pushBeam(startX, startY, endX, startY);
        pushBeam(endX, startY, endX, endY);
        pushBeam(endX, endY, startX, endY);
        pushBeam(startX, endY, startX, startY);

        // Crear vigas paralelas distribuidas uniformemente
        for (let i = 0; i < numBeams; i++) {
            // Distribuir uniformemente las vigas en el largo de la estructura
            const y = startY + ((i + 1) * spacing);

            if (y >= endY) break;
            pushBeam(startX, y, endX, y);
        }

        this.render();
        this._updateUI();

        return {
            success: true,
            message: `Estructura creada: ${finalWidth}cm × ${finalLength}cm con ${numBeams} vigas.`,
            structure: { width: finalWidth, length: finalLength }
        };
    }

    // ──────────────────────────────────────────
    // Renderizado
    // ──────────────────────────────────────────

    /** Renderiza todo el canvas. */
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Limpiar
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, w, h);

        // Grid
        if (!this.isDrawing) {
            this._drawGrid();
        }

        // Terraza
        this._drawTerrace();

        // Área de construcción (margen de seguridad)
        this._drawConstructionBounds();

        // Área segura para paneles (margen interior)
        this._drawPanelBounds();

        // Puntos temporales de terraza
        this._drawTempPoints();

        // Obstáculos
        this._drawObstacles();

        // Vigas
        this._drawBeams();

        // Paneles
        this._drawPanels();

        // Textos
        this._drawTexts();

        // Guías de alineación
        this._drawAlignmentGuide();

        // Medidas
        if (!this.isDrawing) {
            this._drawMeasurements();
        }

        // Reglas
        if (!this.isDrawing) {
            this._drawRulers();
        }

        // Rectángulo de selección en área
        if (this.selectionRect) {
            this._drawSelectionRect();
        }
    }

    _drawGrid() {
        const ctx = this.ctx;
        const step = this.gridSize * this.scale * this.zoomLevel;
        const startX = this.offsetX % step;
        const startY = this.offsetY % step;

        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 0.5;

        for (let x = startX; x < this.canvas.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = startY; y < this.canvas.height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        // Grid mayor cada 100cm (1m)
        const stepMajor = 100 * this.scale * this.zoomLevel;
        const startMX = this.offsetX % stepMajor;
        const startMY = this.offsetY % stepMajor;

        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1;

        for (let x = startMX; x < this.canvas.width; x += stepMajor) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = startMY; y < this.canvas.height; y += stepMajor) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }

    _drawTerrace() {
        if (this.terraceVertices.length < 3) return;
        const ctx = this.ctx;
        const pts = this.terraceVertices.map(v => this.cmToScreen(v.x, v.y));

        // Relleno
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.fill();

        // Borde
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Vértices
        for (const pt of pts) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2c3e50';
            ctx.fill();
        }
    }

    _drawConstructionBounds() {
        if (!this.constructionBounds) return;
        const ctx = this.ctx;
        const min = this.cmToScreen(this.constructionBounds.minX, this.constructionBounds.minY);
        const max = this.cmToScreen(this.constructionBounds.maxX, this.constructionBounds.maxY);

        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
        ctx.setLineDash([]);
    }

    _drawPanelBounds() {
        if (!this.panelBounds) return;
        const ctx = this.ctx;
        const min = this.cmToScreen(this.panelBounds.minX, this.panelBounds.minY);
        const max = this.cmToScreen(this.panelBounds.maxX, this.panelBounds.maxY);

        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
        ctx.setLineDash([]);
    }

    _drawAlignmentGuide() {
        if (!this.alignmentGuide) return;
        const ctx = this.ctx;
        const x = this.cmToScreen(this.alignmentGuide.x, 0).x;
        const y = this.cmToScreen(0, this.alignmentGuide.y).y;

        ctx.strokeStyle = 'rgba(52, 73, 94, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    _drawTexts() {
        const ctx = this.ctx;
        for (let i = 0; i < this.texts.length; i++) {
            const t = this.texts[i];
            const pos = this.cmToScreen(t.x, t.y);
            const isSelected = this.selectedElements.some(sel => sel.type === 'text' && sel.index === i);
            const size = t.size || 14;

            ctx.font = `${size}px sans-serif`;
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(t.text, pos.x, pos.y);

            if (isSelected) {
                const textW = ctx.measureText(t.text).width;
                ctx.strokeStyle = '#f39c12';
                ctx.lineWidth = 1;
                ctx.strokeRect(pos.x - 2, pos.y - size, textW + 4, size + 4);
            }
        }
    }

    _drawTempPoints() {
        if (this.tempPoints.length === 0) return;
        const ctx = this.ctx;
        const pts = this.tempPoints.map(v => this.cmToScreen(v.x, v.y));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (const pt of pts) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
        }
    }

    _drawObstacles() {
        const ctx = this.ctx;
        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            const tl = this.cmToScreen(o.x, o.y);
            const w = o.w * this.scale * this.zoomLevel;
            const h = o.h * this.scale * this.zoomLevel;

            ctx.fillStyle = 'rgba(192, 57, 43, 0.5)';
            ctx.fillRect(tl.x, tl.y, w, h);

            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = this.selectedElements.some(sel => sel.type === 'obstacle' && sel.index === i) ? 3 : 1.5;
            ctx.strokeRect(tl.x, tl.y, w, h);

            // Etiqueta
            if (!this.isDrawing) {
                ctx.fillStyle = '#c0392b';
                ctx.font = '10px sans-serif';
                ctx.fillText(
                    `${o.w.toFixed(0)}×${o.h.toFixed(0)} cm`,
                    tl.x + 2, tl.y - 4
                );
            }
        }
    }

    _drawBeams() {
        const ctx = this.ctx;
        for (let i = 0; i < this.beams.length; i++) {
            const b = this.beams[i];
            const p1 = this.cmToScreen(b.x1, b.y1);
            const p2 = this.cmToScreen(b.x2, b.y2);

            const isSelected = this.selectedElements.some(sel => sel.type === 'beam' && sel.index === i);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isSelected ? '#f39c12' : '#e67e22';
            ctx.lineWidth = isSelected ? 6 : 4;
            ctx.stroke();

            // Extremos
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#f39c12' : '#d35400';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Longitud
            if (!this.isDrawing) {
                const length = Math.sqrt((b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx.fillStyle = isSelected ? '#f39c12' : '#d35400';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(`${length.toFixed(0)} cm`, midX + 5, midY - 5);

                // Numero de viga
                const label = `${i}`;
                const textW = ctx.measureText(label).width;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillRect(midX - textW / 2 - 4, midY + 2, textW + 8, 14);
                ctx.fillStyle = '#2c3e50';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(label, midX - textW / 2, midY + 13);
            }
        }
    }

    _drawPanels() {
        const ctx = this.ctx;
        for (let i = 0; i < this.panels.length; i++) {
            const p = this.panels[i];
            const tl = this.cmToScreen(p.x, p.y);
            const w = p.w * this.scale * this.zoomLevel;
            const h = p.h * this.scale * this.zoomLevel;

            // Panel
            ctx.fillStyle = 'rgba(41, 128, 185, 0.6)';
            ctx.fillRect(tl.x, tl.y, w, h);

            // Borde
            const isSelected = this.selectedElements.some(sel => sel.type === 'panel' && sel.index === i);
            ctx.strokeStyle = isSelected ? '#f39c12' : '#2980b9';
            ctx.lineWidth = isSelected ? 3 : 1.5;
            ctx.strokeRect(tl.x, tl.y, w, h);

            // Celdas del panel (efecto visual)
            const cellCols = 6;
            const cellRows = 10;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            for (let c = 1; c < cellCols; c++) {
                const cx = tl.x + (w / cellCols) * c;
                ctx.beginPath();
                ctx.moveTo(cx, tl.y);
                ctx.lineTo(cx, tl.y + h);
                ctx.stroke();
            }
            for (let r = 1; r < cellRows; r++) {
                const ry = tl.y + (h / cellRows) * r;
                ctx.beginPath();
                ctx.moveTo(tl.x, ry);
                ctx.lineTo(tl.x + w, ry);
                ctx.stroke();
            }

            // Etiqueta del panel
            if (!this.isDrawing) {
                ctx.fillStyle = '#2c3e50';
                ctx.font = '9px sans-serif';
                ctx.fillText(
                    `P${i + 1}`,
                    tl.x + w / 2 - 8,
                    tl.y + h / 2 + 3
                );
            }
        }
    }

    _drawMeasurements() {
        if (this.terraceVertices.length < 2) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 11px sans-serif';

        for (let i = 0; i < this.terraceVertices.length; i++) {
            const a = this.terraceVertices[i];
            const b = this.terraceVertices[(i + 1) % this.terraceVertices.length];
            const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

            const midScreen = this.cmToScreen(
                (a.x + b.x) / 2,
                (a.y + b.y) / 2
            );

            const label = len >= 100
                ? `${(len / 100).toFixed(2)} m`
                : `${len.toFixed(0)} cm`;

            // Fondo blanco para legibilidad
            const textW = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(midScreen.x - textW / 2 - 2, midScreen.y - 14, textW + 4, 16);
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(label, midScreen.x - textW / 2, midScreen.y - 2);
        }
    }

    _drawRulers() {
        // Regla horizontal
        const rulerH = document.getElementById('rulerH');
        if (!rulerH) return;
        const rCtx = rulerH.getContext('2d');
        rulerH.width = this.canvas.width;
        rulerH.height = 30;
        rCtx.fillStyle = '#2c3e50';
        rCtx.fillRect(0, 0, rulerH.width, rulerH.height);

        const step = this.scale * this.zoomLevel * 10; // cada 10cm
        rCtx.fillStyle = '#ecf0f1';
        rCtx.font = '9px sans-serif';

        for (let x = this.offsetX % step; x < rulerH.width; x += step) {
            const cm = Math.round((x - this.offsetX) / (this.scale * this.zoomLevel));
            rCtx.beginPath();
            rCtx.moveTo(x, 20);
            rCtx.lineTo(x, 30);
            rCtx.strokeStyle = '#7f8c8d';
            rCtx.stroke();
            if (cm % 50 === 0) {
                rCtx.fillText(`${cm}`, x + 2, 16);
                rCtx.beginPath();
                rCtx.moveTo(x, 10);
                rCtx.lineTo(x, 30);
                rCtx.strokeStyle = '#bdc3c7';
                rCtx.stroke();
            }
        }

        // Regla vertical
        const rulerV = document.getElementById('rulerV');
        if (!rulerV) return;
        const vCtx = rulerV.getContext('2d');
        rulerV.width = 30;
        rulerV.height = this.canvas.height;
        vCtx.fillStyle = '#2c3e50';
        vCtx.fillRect(0, 0, rulerV.width, rulerV.height);

        vCtx.fillStyle = '#ecf0f1';
        vCtx.font = '9px sans-serif';

        for (let y = this.offsetY % step; y < rulerV.height; y += step) {
            const cm = Math.round((y - this.offsetY) / (this.scale * this.zoomLevel));
            vCtx.beginPath();
            vCtx.moveTo(20, y);
            vCtx.lineTo(30, y);
            vCtx.strokeStyle = '#7f8c8d';
            vCtx.stroke();
            if (cm % 50 === 0) {
                vCtx.save();
                vCtx.translate(14, y + 2);
                vCtx.rotate(-Math.PI / 2);
                vCtx.fillText(`${cm}`, 0, 0);
                vCtx.restore();
            }
        }
    }

    _drawSelectionRect() {
        if (!this.selectionRect) return;
        const ctx = this.ctx;
        const p1 = this.cmToScreen(this.selectionRect.x, this.selectionRect.y);
        const p2 = this.cmToScreen(this.selectionRect.x + this.selectionRect.w, this.selectionRect.y + this.selectionRect.h);

        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.setLineDash([]);
    }

    // ──────────────────────────────────────────
    // UI Update
    // ──────────────────────────────────────────

    _updateUI() {
        const el = (id) => document.getElementById(id);

        // Vértices
        const vc = el('vertexCount');
        if (vc) vc.textContent = this.terraceVertices.length;

        // Vigas
        const bc = el('beamCount');
        if (bc) bc.textContent = this.beams.length;

        const bm = el('beamMeters');
        if (bm) {
            const total = this.beams.reduce((sum, b) => {
                return sum + Math.sqrt((b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2);
            }, 0);
            bm.textContent = (total / 100).toFixed(2);
        }

        // Paneles
        const pc = el('panelCount');
        if (pc) pc.textContent = this.panels.length;

        const tp = el('totalPower');
        if (tp) {
            const totalW = this.panels.reduce((s, p) => s + p.power, 0);
            tp.textContent = totalW;
        }

        // Sombra entre filas
        const sg = el('shadowGap');
        if (sg) {
            const inclRad = (this.panelConfig.inclination * Math.PI) / 180;
            const shadow = this.panelConfig.height * Math.sin(inclRad) *
                (Math.tan((45 - this.panelConfig.inclination) * Math.PI / 180));
            sg.textContent = shadow.toFixed(1);
        }
    }

    // ──────────────────────────────────────────
    // Serialización
    // ──────────────────────────────────────────

    /**
     * Exporta el estado completo del editor como JSON.
     * @returns {object} Estado serializado
     */
    exportData() {
        return {
            terraceVertices: this.terraceVertices,
            constructionBounds: this.constructionBounds,
            panelBounds: this.panelBounds,
            obstacles: this.obstacles,
            beams: this.beams,
            panels: this.panels,
            texts: this.texts,
            panelConfig: this.panelConfig,
            textConfig: this.textConfig,
            scale: this.scale,
        };
    }

    /**
     * Importa un estado previamente exportado.
     * @param {object} data — Datos serializados
     */
    importData(data) {
        if (!data) return;
        this.terraceVertices = data.terraceVertices || [];
        this.constructionBounds = data.constructionBounds || null;
        this.panelBounds = data.panelBounds || null;
        this.obstacles = data.obstacles || [];
        this.beams = data.beams || [];
        this.panels = data.panels || [];
        this.texts = data.texts || [];
        if (data.panelConfig) this.panelConfig = { ...this.panelConfig, ...data.panelConfig };
        if (data.textConfig) this.textConfig = { ...this.textConfig, ...data.textConfig };
        if (data.scale) this.scale = data.scale;
        if ((!this.constructionBounds || !this.panelBounds) && this.terraceVertices.length >= 3) {
            const bounds = this.getTerraceBounds();
            if (bounds) {
                this.constructionBounds = this._calculateConstructionBounds(bounds, 10);
                this.panelBounds = this._calculatePanelBounds(this.constructionBounds, 40);
            }
        }
        this.render();
        this._updateUI();
    }

    /**
     * Exporta el estado completo incluyendo configuración del sidebar.
     * @param {object} sidebarConfig - Configuración del sidebar
     * @returns {object} Estado completo serializado
     */
    exportFullData(sidebarConfig = {}) {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            editorData: this.exportData(),
            sidebarConfig: sidebarConfig,
        };
    }

    /**
     * Importa un estado completo previamente exportado.
     * @param {object} data — Datos completos serializados
     */
    importFullData(data) {
        if (!data || !data.editorData) return;
        this.importData(data.editorData);
        // La configuración del sidebar se maneja en editor_main.js
        return data.sidebarConfig || {};
    }

    /**
     * Exporta el canvas como imagen PNG con propiedades.
     * @param {object} properties - Objeto con las propiedades a incluir
     * @returns {string} Data URL de la imagen
     */
    exportImage(properties = {}) {
        // Crear canvas temporal más grande para incluir texto debajo
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const margin = 20;
        const textHeight = 16;
        const lineSpacing = 4;
        const columnSpacing = 50; // Espacio entre columnas

        // Calcular bloques de texto
        const blocks = this._buildPropertiesBlocks(properties);

        // Calcular altura máxima de los bloques
        let maxBlockLines = 0;
        blocks.forEach(block => maxBlockLines = Math.max(maxBlockLines, block.lines.length));
        const textAreaHeight = maxBlockLines * (textHeight + lineSpacing) + margin * 2;

        // Dimensiones
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height + textAreaHeight;

        // Fondo blanco
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Dibujar canvas original arriba
        tempCtx.drawImage(this.canvas, 0, 0);

        // Dibujar texto de propiedades en 3 columnas debajo
        tempCtx.fillStyle = 'black';
        tempCtx.font = '14px Arial';
        tempCtx.textAlign = 'left';

        const columnWidth = (tempCanvas.width - margin * 2 - columnSpacing * 2) / 3;
        blocks.forEach((block, index) => {
            const x = margin + index * (columnWidth + columnSpacing);
            let y = this.canvas.height + margin + textHeight;

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
     * Construye los bloques de texto con las propiedades.
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
            if (props.structure.beamCount !== undefined) structureLines.push(`Vigas: ${props.structure.beamCount}`);
            if (props.structure.beamMeters) structureLines.push(`m lineales: ${props.structure.beamMeters}`);
        }
        blocks.push({ title: 'Estructura', lines: structureLines });

        // Bloque Paneles
        const panelsLines = [];
        if (props.panels) {
            if (props.panels.width) panelsLines.push(`Ancho: ${props.panels.width} cm`);
            if (props.panels.height) panelsLines.push(`Alto: ${props.panels.height} cm`);
            if (props.panels.inclination) panelsLines.push(`Inclinación: ${props.panels.inclination}°`);
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
window.AEPEditor2D = AEPEditor2D;
