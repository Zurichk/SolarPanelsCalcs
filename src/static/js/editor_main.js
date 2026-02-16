/**
 * AEP Solar Panel Planner — Controlador principal del editor.
 *
 * Conecta el Editor 2D, el Visor 3D, la toolbar, el sidebar
 * y la API REST del backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ──────────────────────────────────────────
    // Configuración inicial
    // ──────────────────────────────────────────

    const appEl = document.getElementById('editorApp');
    const projectId = appEl?.dataset.projectId;
    if (!projectId) return;

    const canvas2D = document.getElementById('canvas2D');
    const canvas3D = document.getElementById('canvas3D');

    // Instanciar editores
    const editor2D = new AEPEditor2D(canvas2D);
    const editor3D = new AEPEditor3D(canvas3D);

    const initialTextContent = document.getElementById('textContent')?.value;
    if (initialTextContent !== undefined) {
        editor2D.textConfig.content = initialTextContent;
    }
    const initialTextSize = parseInt(document.getElementById('textSize')?.value, 10);
    if (!Number.isNaN(initialTextSize)) {
        editor2D.textConfig.size = initialTextSize;
    }

    let is3DVisible = false;
    let viewer3DWindow = null;

    function sendDataToViewer3D() {
        if (!viewer3DWindow || viewer3DWindow.closed) return;

        const data = {
            type: 'load3DData',
            data: editor2D.exportData(),
            structConfig: {
                height: parseFloat(document.getElementById('structHeight')?.value || 120),
                beamInclination: {
                    degrees: parseFloat(document.getElementById('beamInclination')?.value || 20),
                    startBeam: parseInt(document.getElementById('inclinationStartBeam')?.value || 0),
                    endBeam: parseInt(document.getElementById('inclinationEndBeam')?.value || -1)
                },
                showPostLabels: document.getElementById('showPostLabels')?.checked !== false
            },
            panelConfig: {
                width: parseFloat(document.getElementById('panelWidth')?.value || 0),
                height: parseFloat(document.getElementById('panelHeight')?.value || 0),
                inclination: parseFloat(document.getElementById('panelInclination')?.value || 0),
                power: parseFloat(document.getElementById('panelPower')?.value || 0)
            }
        };

        try {
            viewer3DWindow.postMessage(data, window.location.origin);
        } catch (error) {
            console.warn('Error enviando datos al visor 3D:', error);
        }
    }

    function getSidebarConfig() {
        return {
            terrace: {
                width: document.getElementById('terraceWidth')?.value,
                height: document.getElementById('terraceHeight')?.value,
            },
            structure: {
                material: document.getElementById('structMaterial')?.value,
                profile: document.getElementById('beamProfile')?.value,
                height: document.getElementById('structHeight')?.value,
                numBeams: document.getElementById('numBeams')?.value,
                spacing: document.getElementById('beamSpacing')?.value,
                beamInclination: {
                    degrees: parseFloat(document.getElementById('beamInclination')?.value || 20),
                    startBeam: parseInt(document.getElementById('inclinationStartBeam')?.value || 0, 10),
                    endBeam: parseInt(document.getElementById('inclinationEndBeam')?.value || -1, 10),
                },
                showPostLabels: document.getElementById('showPostLabels')?.checked !== false,
            },
            panels: {
                width: document.getElementById('panelWidth')?.value,
                height: document.getElementById('panelHeight')?.value,
                inclination: document.getElementById('panelInclination')?.value,
                power: document.getElementById('panelPower')?.value,
            },
            scale: document.getElementById('scaleSelect')?.value,
        };
    }

    let structureSaveTimer = null;

    function scheduleStructureSave() {
        if (!projectId) return;
        if (structureSaveTimer) {
            clearTimeout(structureSaveTimer);
        }

        structureSaveTimer = setTimeout(async () => {
            structureSaveTimer = null;
            const payload = {
                material: document.getElementById('structMaterial')?.value,
                beam_profile: document.getElementById('beamProfile')?.value,
                height_cm: parseFloat(
                    document.getElementById('structHeight')?.value || 120
                ),
                beam_inclination_deg: parseFloat(
                    document.getElementById('beamInclination')?.value || 20
                ),
                inclination_start_beam: parseInt(
                    document.getElementById('inclinationStartBeam')?.value || 0,
                    10
                ),
                inclination_end_beam: parseInt(
                    document.getElementById('inclinationEndBeam')?.value || -1,
                    10
                ),
                show_post_labels: document.getElementById('showPostLabels')?.checked !== false,
            };

            try {
                await fetch(`/api/projects/${projectId}/structure`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } catch (error) {
                console.warn('Error guardando estructura:', error);
            }
        }, 500);
    }

    function applySidebarConfig(sidebarConfig) {
        if (!sidebarConfig) return;

        if (sidebarConfig.terrace) {
            if (sidebarConfig.terrace.width) document.getElementById('terraceWidth').value = sidebarConfig.terrace.width;
            if (sidebarConfig.terrace.height) document.getElementById('terraceHeight').value = sidebarConfig.terrace.height;
        }
        if (sidebarConfig.structure) {
            if (sidebarConfig.structure.material) document.getElementById('structMaterial').value = sidebarConfig.structure.material;
            if (sidebarConfig.structure.profile) document.getElementById('beamProfile').value = sidebarConfig.structure.profile;
            if (sidebarConfig.structure.height) document.getElementById('structHeight').value = sidebarConfig.structure.height;
            if (sidebarConfig.structure.numBeams) document.getElementById('numBeams').value = sidebarConfig.structure.numBeams;
            if (sidebarConfig.structure.spacing) document.getElementById('beamSpacing').value = sidebarConfig.structure.spacing;

            if (sidebarConfig.structure.beamInclination) {
                const beamInclination = sidebarConfig.structure.beamInclination;
                if (beamInclination.degrees !== undefined) {
                    document.getElementById('beamInclination').value = beamInclination.degrees;
                }
                if (beamInclination.startBeam !== undefined) {
                    document.getElementById('inclinationStartBeam').value = beamInclination.startBeam;
                }
                if (beamInclination.endBeam !== undefined) {
                    document.getElementById('inclinationEndBeam').value = beamInclination.endBeam;
                }
            }

            if (sidebarConfig.structure.showPostLabels !== undefined) {
                document.getElementById('showPostLabels').checked = sidebarConfig.structure.showPostLabels;
            }
        }
        if (sidebarConfig.panels) {
            if (sidebarConfig.panels.width) document.getElementById('panelWidth').value = sidebarConfig.panels.width;
            if (sidebarConfig.panels.height) document.getElementById('panelHeight').value = sidebarConfig.panels.height;
            if (sidebarConfig.panels.inclination) document.getElementById('panelInclination').value = sidebarConfig.panels.inclination;
            if (sidebarConfig.panels.power) document.getElementById('panelPower').value = sidebarConfig.panels.power;
        }
        if (sidebarConfig.scale) document.getElementById('scaleSelect').value = sidebarConfig.scale;
    }

    const selectionInspector = document.getElementById('selectionInspector');
    const selectionPosX = document.getElementById('selectionPosX');
    const selectionPosY = document.getElementById('selectionPosY');
    const selectionApply = document.getElementById('selectionApply');

    const updateSelectionInspector = () => {
        if (!selectionInspector || !selectionPosX || !selectionPosY) return;
        const bounds = editor2D.getSelectionBounds();
        if (!bounds) {
            selectionInspector.classList.add('d-none');
            return;
        }

        selectionInspector.classList.remove('d-none');
        selectionPosX.value = bounds.minX.toFixed(1);
        selectionPosY.value = bounds.minY.toFixed(1);
    };

    editor2D.onSelectionChange = () => {
        updateSelectionInspector();
    };

    editor2D.onUpdate = () => {
        updateConfirmButton();
        sendDataToViewer3D();
        updateSelectionInspector();
    };

    const applySelectionPosition = () => {
        if (!selectionPosX || !selectionPosY) return;
        const bounds = editor2D.getSelectionBounds();
        if (!bounds) return;
        const newX = parseFloat(selectionPosX.value);
        const newY = parseFloat(selectionPosY.value);
        if (Number.isNaN(newX) || Number.isNaN(newY)) return;
        const dx = newX - bounds.minX;
        const dy = newY - bounds.minY;
        editor2D._moveSelected(dx, dy);
        editor2D.render();
        editor2D._updateUI();
        updateSelectionInspector();
        sendDataToViewer3D();
    };

    selectionApply?.addEventListener('click', () => applySelectionPosition());
    [selectionPosX, selectionPosY].forEach((input) => {
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                applySelectionPosition();
            }
        });
    });

    // ──────────────────────────────────────────
    // Comunicación con visor 3D
    // ──────────────────────────────────────────

    window.addEventListener('message', (event) => {
        if (event.data.type === 'beamSelectionChanged') {
            // Actualizar campos de inclinación cuando se seleccionan vigas en el visor 3D
            document.getElementById('inclinationStartBeam').value = event.data.startBeam;
            document.getElementById('inclinationEndBeam').value = event.data.endBeam;

            // Actualizar vista 3D con los nuevos valores
            sendDataToViewer3D();
        }
    });

    // ──────────────────────────────────────────
    // Cargar datos del servidor
    // ──────────────────────────────────────────

    async function loadProject() {
        try {
            // Cargar terraza
            const terraceRes = await fetch(`/api/projects/${projectId}/terrace`);
            if (terraceRes.ok) {
                const terrace = await terraceRes.json();
                if (terrace.vertices && terrace.vertices.length > 0) {
                    editor2D.terraceVertices = terrace.vertices;
                    editor2D.obstacles = terrace.obstacles || [];
                    // Calcular área de construcción
                    const bounds = editor2D.getTerraceBounds();
                    if (bounds) {
                        editor2D.constructionBounds = editor2D._calculateConstructionBounds(bounds, 10);
                        editor2D.panelBounds = editor2D._calculatePanelBounds(editor2D.constructionBounds, 40);
                    }
                }
                // Actualizar inputs de sidebar
                document.getElementById('terraceWidth').value = terrace.width_cm || 585;
                document.getElementById('terraceHeight').value = terrace.height_cm || 388;
            }

            // Cargar estructura
            const structRes = await fetch(`/api/projects/${projectId}/structure`);
            if (structRes.ok) {
                const structure = await structRes.json();
                editor2D.beams = structure.beams || [];
                document.getElementById('structMaterial').value = structure.material || 'Acero S275';
                document.getElementById('beamProfile').value = structure.beam_profile || 'IPN-80';
                document.getElementById('structHeight').value = structure.height_cm || 120;
                document.getElementById('beamInclination').value = structure.beam_inclination_deg ?? 20;
                document.getElementById('inclinationStartBeam').value = structure.inclination_start_beam ?? 0;
                document.getElementById('inclinationEndBeam').value = structure.inclination_end_beam ?? -1;
                document.getElementById('showPostLabels').checked = structure.show_post_labels !== false;
            }

            // Cargar layout guardado
            const layoutRes = await fetch(`/api/projects/${projectId}/layout`);
            if (layoutRes.ok) {
                const layout = await layoutRes.json();
                if (layout.canvas_data && Object.keys(layout.canvas_data).length > 0) {
                    editor2D.importData(layout.canvas_data);
                }
                if (layout.metadata_info && layout.metadata_info.sidebarConfig) {
                    applySidebarConfig(layout.metadata_info.sidebarConfig);
                }
            }

            editor2D.render();
            editor2D._updateUI();
        } catch (err) {
            console.error('Error cargando proyecto:', err);
        }
    }

    loadProject();

    // ──────────────────────────────────────────
    // Toolbar: herramientas
    // ──────────────────────────────────────────

    document.querySelectorAll('.tool-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            editor2D.setTool(btn.dataset.tool);
            updateConfirmButton();
        });
    });

    function updateConfirmButton() {
        const btn = document.getElementById('btnConfirmTerrace');
        if (btn) {
            btn.style.display = (editor2D.currentTool === 'draw-terrace' && editor2D.tempPoints.length >= 3) ? 'block' : 'none';
        }
    }

    // ──────────────────────────────────────────
    // Escala
    // ──────────────────────────────────────────

    document.getElementById('scaleSelect')?.addEventListener('change', (e) => {
        editor2D.scale = parseFloat(e.target.value);
        editor2D.render();
    });

    // ──────────────────────────────────────────
    // Sidebar: Terraza
    // ──────────────────────────────────────────

    document.getElementById('btnApplyTerraceSize')?.addEventListener('click', () => {
        const w = parseFloat(document.getElementById('terraceWidth').value) || 585;
        const h = parseFloat(document.getElementById('terraceHeight').value) || 388;
        editor2D.setRectangularTerrace(w, h);
    });

    document.getElementById('btnClearTerrace')?.addEventListener('click', () => {
        if (confirm('¿Limpiar toda la terraza y elementos?')) {
            editor2D.clearAll();
        }
    });

    document.getElementById('btnRotateTerrace90')?.addEventListener('click', () => {
        editor2D.rotateTerrace90();
    });

    document.getElementById('btnConfirmTerrace')?.addEventListener('click', () => {
        editor2D.confirmTerrace();
    });

    // ──────────────────────────────────────────
    // Sidebar: Paneles
    // ──────────────────────────────────────────

    const initialInclination = document.getElementById('panelInclination')?.value;
    if (initialInclination !== undefined) {
        document.getElementById('inclinationValue').textContent = `${initialInclination}°`;
        editor2D.panelConfig.inclination = parseFloat(initialInclination);
    }

    document.getElementById('panelInclination')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('inclinationValue').textContent = `${val}°`;
        editor2D.panelConfig.inclination = parseFloat(val);
        editor2D._updateUI();
        sendDataToViewer3D();
    });

    ['panelWidth', 'panelHeight', 'panelPower'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            const key = id.replace('panel', '').toLowerCase();
            const map = { width: 'width', height: 'height', power: 'power' };
            editor2D.panelConfig[map[key]] = parseFloat(e.target.value);
            sendDataToViewer3D();
        });
    });

    // ──────────────────────────────────────────
    // Sidebar: Textos
    // ──────────────────────────────────────────

    document.getElementById('textContent')?.addEventListener('input', (e) => {
        editor2D.textConfig.content = e.target.value;
    });

    document.getElementById('textSize')?.addEventListener('input', (e) => {
        editor2D.textConfig.size = parseInt(e.target.value, 10) || 14;
    });

    // ──────────────────────────────────────────
    // Sidebar: Inclinación de vigas (actualiza vista 3D)
    // ──────────────────────────────────────────

    const attachRealtime3D = (ids, handler) => {
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
    };

    attachRealtime3D(
        ['beamInclination', 'inclinationStartBeam', 'inclinationEndBeam', 'showPostLabels'],
        () => {
            sendDataToViewer3D();
            scheduleStructureSave();
        }
    );

    attachRealtime3D(
        ['structMaterial', 'beamProfile', 'structHeight'],
        () => {
            sendDataToViewer3D();
            scheduleStructureSave();
        }
    );

    // ──────────────────────────────────────────
    // Sidebar: Crear estructura automática
    // ──────────────────────────────────────────

    document.getElementById('btnCreateStructure')?.addEventListener('click', () => {
        const numBeams = parseInt(document.getElementById('numBeams').value) || 5;
        const spacing = parseFloat(document.getElementById('beamSpacing').value) || 100;
        const profile = document.getElementById('beamProfile').value || 'IPN-80';

        // Obtener dimensiones de la terraza del formulario
        const terraceWidth = parseFloat(document.getElementById('terraceWidth').value) || 585;
        const terraceHeight = parseFloat(document.getElementById('terraceHeight').value) || 388;

        // Crear estructura automática basada en la terraza
        const result = editor2D.createAutoStructure(numBeams, spacing, profile, terraceWidth, terraceHeight);

        if (result.success) {
            // Actualizar campos del formulario con las dimensiones calculadas
            document.getElementById('structWidth').value = Math.round(result.structure.width);
            document.getElementById('structLength').value = Math.round(result.structure.length);

            showAlert(result.message, 'success');
        } else {
            showAlert(result.message, 'warning');

            // Si hay estructura calculada pero no se pudo crear, mostrar las dimensiones
            if (result.structure) {
                document.getElementById('structWidth').value = Math.round(result.structure.width);
                document.getElementById('structLength').value = Math.round(result.structure.length);
            }
        }
    });

    // ──────────────────────────────────────────
    // Botón 3D
    // ──────────────────────────────────────────

    document.getElementById('btnToggle3D')?.addEventListener('click', () => {
        if (viewer3DWindow && !viewer3DWindow.closed) {
            // Si la ventana ya está abierta, enfocarla
            viewer3DWindow.focus();
            // Enviar datos actualizados
            sendDataToViewer3D();
        } else {
            // Abrir nueva ventana con el visor 3D
            const viewerUrl = `/projects/${projectId}/viewer3d`;
            const width = screen.width;
            const height = screen.height;
            viewer3DWindow = window.open(
                viewerUrl,
                'viewer3d',
                `width=${width},height=${height},scrollbars=no,resizable=yes,status=no,toolbar=no,menubar=no`
            );

            // Escuchar cuando la ventana se cierre
            const checkClosed = setInterval(() => {
                if (viewer3DWindow.closed) {
                    clearInterval(checkClosed);
                    viewer3DWindow = null;
                }
            }, 1000);

            // Enviar datos iniciales después de que la ventana se cargue
            setTimeout(() => {
                if (viewer3DWindow && !viewer3DWindow.closed) {
                    sendDataToViewer3D();
                }
            }, 2000);
        }
    });

    // ──────────────────────────────────────────
    // Guardar
    // ──────────────────────────────────────────

    document.getElementById('btnSave')?.addEventListener('click', async () => {
        const data = editor2D.exportData();
        const structHeight = parseFloat(document.getElementById('structHeight')?.value || 120);
        const sidebarConfig = getSidebarConfig();

        try {
            // Guardar terraza
            await fetch(`/api/projects/${projectId}/terrace`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vertices: data.terraceVertices,
                    obstacles: data.obstacles,
                    width_cm: parseFloat(document.getElementById('terraceWidth').value) || 585,
                    height_cm: parseFloat(document.getElementById('terraceHeight').value) || 388,
                }),
            });

            // Guardar estructura
            await fetch(`/api/projects/${projectId}/structure`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    beams: data.beams,
                    material: document.getElementById('structMaterial')?.value,
                    beam_profile: document.getElementById('beamProfile')?.value,
                    height_cm: structHeight,
                    beam_inclination_deg: parseFloat(
                        document.getElementById('beamInclination')?.value || 20
                    ),
                    inclination_start_beam: parseInt(
                        document.getElementById('inclinationStartBeam')?.value || 0,
                        10
                    ),
                    inclination_end_beam: parseInt(
                        document.getElementById('inclinationEndBeam')?.value || -1,
                        10
                    ),
                    show_post_labels: document.getElementById('showPostLabels')?.checked !== false,
                }),
            });

            // Guardar layout completo
            await fetch(`/api/projects/${projectId}/layout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `Diseño ${new Date().toLocaleString('es-ES')}`,
                    panel_positions: data.panels,
                    canvas_data: data,
                    metadata_info: {
                        panel_count: data.panels.length,
                        total_power_w: data.panels.reduce((s, p) => s + (p.power || 0), 0),
                        beam_count: data.beams.length,
                        beam_meters: data.beams.reduce((s, b) => {
                            return s + Math.sqrt((b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2);
                        }, 0) / 100,
                        sidebarConfig: sidebarConfig,
                    },
                }),
            });

            showAlert('Diseño guardado correctamente.', 'success');
        } catch (err) {
            console.error('Error guardando:', err);
            showAlert('Error al guardar el diseño.', 'danger');
        }
    });

    // ──────────────────────────────────────────
    // Exportar imagen
    // ──────────────────────────────────────────

    document.getElementById('btnExport')?.addEventListener('click', () => {
        // Recolectar propiedades actuales
        const properties = {
            terrace: {
                width: document.getElementById('terraceWidth')?.value,
                height: document.getElementById('terraceHeight')?.value,
                vertices: document.getElementById('vertexCount')?.textContent.replace('Vértices: ', ''),
            },
            structure: {
                material: document.getElementById('structMaterial')?.value,
                profile: document.getElementById('beamProfile')?.value,
                height: document.getElementById('structHeight')?.value,
                beamCount: document.getElementById('beamCount')?.textContent,
                beamMeters: document.getElementById('beamMeters')?.textContent,
            },
            panels: {
                width: document.getElementById('panelWidth')?.value,
                height: document.getElementById('panelHeight')?.value,
                inclination: document.getElementById('panelInclination')?.value,
                power: document.getElementById('panelPower')?.value,
                count: document.getElementById('panelCount')?.textContent,
                totalPower: document.getElementById('totalPower')?.textContent,
                shadowGap: document.getElementById('shadowGap')?.textContent,
            },
        };

        const dataUrl = is3DVisible
            ? editor3D.exportImage(properties)
            : editor2D.exportImage(properties);

        const link = document.createElement('a');
        link.download = `aep_solar_plano_${projectId}.png`;
        link.href = dataUrl;
        link.click();
    });

    // ──────────────────────────────────────────
    // Exportar JSON
    // ──────────────────────────────────────────

    document.getElementById('btnExportJSON')?.addEventListener('click', () => {
        // Recolectar configuración del sidebar
        const sidebarConfig = getSidebarConfig();

        const data = editor2D.exportFullData(sidebarConfig);
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `aep_solar_design_${projectId}.json`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
        showAlert('Diseño exportado como JSON.', 'success');
    });

    // ──────────────────────────────────────────
    // Importar JSON
    // ──────────────────────────────────────────

    document.getElementById('btnImportJSON')?.addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const sidebarConfig = editor2D.importFullData(data);

                // Aplicar configuración del sidebar
                applySidebarConfig(sidebarConfig);

                // Actualizar vista 3D si está activa
                if (is3DVisible) {
                    sendDataToViewer3D();
                }

                showAlert('Diseño importado correctamente.', 'success');
            } catch (err) {
                console.error('Error importando JSON:', err);
                showAlert('Error al importar el archivo JSON.', 'danger');
            }
        };
        reader.readAsText(file);

        // Limpiar el input
        e.target.value = '';
    });

    // ──────────────────────────────────────────
    // Teclado: Supr para borrar seleccionado, Ctrl+C para copiar, Ctrl+V para pegar
    // ──────────────────────────────────────────

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
            return;
        }

        if (e.key === 'Delete') {
            editor2D.deleteSelected();
        } else if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            if (editor2D.copySelected()) {
                const count = editor2D.selectedElements.length;
                showAlert(`${count} elemento${count > 1 ? 's' : ''} copiado${count > 1 ? 's' : ''}.`, 'info');
            }
        } else if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            editor2D.paste();
        } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (editor2D.selectedElements.length === 0) return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
            const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
            editor2D._moveSelected(dx, dy);
            editor2D.render();
            editor2D._updateUI();
            updateSelectionInspector();
            sendDataToViewer3D();
        }
    });

    // ──────────────────────────────────────────
    // Helper: Alertas temporales
    // ──────────────────────────────────────────

    function showAlert(message, type = 'info') {
        const container = document.querySelector('.editor-toolbar');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        alert.style.zIndex = '9999';
        alert.innerHTML = `${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    // Resize observer para el visor 3D
    window.addEventListener('resize', () => {
        if (is3DVisible) editor3D.resize();
    });
});
