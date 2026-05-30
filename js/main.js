/* SpectraFlow - Main Application Logic */

(function () {
    'use strict';

    // ========== Global State ==========
    const State = {
        mode: 'value',
        curve: {
            name: 'AE Default',
            group: 'Basic',
            x1: 0.333,
            y1: 0,
            x2: 0.667,
            y2: 1,
            interpolation: 'bezier',
            graphMode: 'value'
        },
        presets: [],
        customPresets: [],
        selectedPresetIndex: 0,
        liveSyncEnabled: false,
        liveSyncInterval: null,
        isDragging: false,
        draggedHandle: null
    };

    // ========== DOM References ==========
    const DOM = {
        readBtn: document.getElementById('readBtn'),
        smartBtn: document.getElementById('smartBtn'),
        liveSyncBtn: document.getElementById('liveSyncBtn'),
        helpBtn: document.getElementById('helpBtn'),
        resetBtn: document.getElementById('resetBtn'),
        applyBtn: document.getElementById('applyBtn'),
        saveBtn: document.getElementById('saveBtn'),
        captureBtn: document.getElementById('captureBtn'),
        deleteBtn: document.getElementById('deleteBtn'),
        copyBtn: document.getElementById('copyBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        
        valueModeBtn: document.getElementById('valueModeBtn'),
        speedModeBtn: document.getElementById('speedModeBtn'),
        
        speedControls: document.getElementById('speedControls'),
        speedOutSlider: document.getElementById('speedOutSlider'),
        speedOutNum: document.getElementById('speedOutNum'),
        speedInSlider: document.getElementById('speedInSlider'),
        speedInNum: document.getElementById('speedInNum'),
        infOutSlider: document.getElementById('infOutSlider'),
        infOutNum: document.getElementById('infOutNum'),
        infInSlider: document.getElementById('infInSlider'),
        infInNum: document.getElementById('infInNum'),
        
        canvas: document.getElementById('graph'),
        ctx: document.getElementById('graph').getContext('2d'),
        
        filter: document.getElementById('filter'),
        nameInput: document.getElementById('nameInput'),
        presetList: document.getElementById('presetList'),
        
        allKeys: document.getElementById('allKeys'),
        mirrorDrag: document.getElementById('mirrorDrag'),
        clampY: document.getElementById('clampY'),
        continuous: document.getElementById('continuous'),
        autoBezier: document.getElementById('autoBezier'),
        
        readout: document.getElementById('readout'),
        status: document.getElementById('status'),
        
        importFile: document.getElementById('importFile')
    };

    let csInterface = null;
    try {
        csInterface = new CSInterface();
    } catch (e) {
        console.warn('CSInterface not available');
    }

    // ========== Presets Database ==========
    const PresetsDB = {
        Basic: [
            { name: 'AE Default', x1: 0.333, y1: 0, x2: 0.667, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Linear', x1: 0, y1: 0, x2: 1, y2: 1, interpolation: 'linear', graphMode: 'value' },
            { name: 'Easy Out', x1: 0.25, y1: 0, x2: 0.85, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Easy In', x1: 0.15, y1: 0, x2: 0.75, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Easy In Out', x1: 0.42, y1: 0, x2: 0.58, y2: 1, interpolation: 'bezier', graphMode: 'value' }
        ],
        Fast: [
            { name: 'Power In', x1: 0.11, y1: 0, x2: 0.5, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Power Out', x1: 0.5, y1: 0, x2: 0.89, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Quick Start', x1: 0.1, y1: 0.5, x2: 0.6, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Quick Stop', x1: 0.4, y1: 0, x2: 0.9, y2: 0.5, interpolation: 'bezier', graphMode: 'value' }
        ],
        Impact: [
            { name: 'Spring Out', x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Bounce', x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Elastic', x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275, interpolation: 'bezier', graphMode: 'value' }
        ],
        Soft: [
            { name: 'Subtle Ease', x1: 0.35, y1: 0.1, x2: 0.65, y2: 0.9, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Gentle Out', x1: 0.3, y1: 0.05, x2: 0.8, y2: 1, interpolation: 'bezier', graphMode: 'value' },
            { name: 'Smooth', x1: 0.25, y1: 0.15, x2: 0.75, y2: 0.85, interpolation: 'bezier', graphMode: 'value' }
        ]
    };

    // ========== Utility Functions ==========
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function bezier(t, x1, y1, x2, y2) {
        const mt = 1 - t;
        const mt3 = mt * mt * mt;
        const t3 = t * t * t;
        const mt2 = mt * mt;
        const t2 = t * t;
        
        const x = mt3 * 0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * 1;
        const y = mt3 * 0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * 1;
        
        return { x, y };
    }

    function sampleCurve(curve, samples = 100) {
        const points = [];
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const point = bezier(t, curve.x1, curve.y1, curve.x2, curve.y2);
            points.push(point);
        }
        return points;
    }

    function updateReadout() {
        const outInf = clamp(State.curve.x1 * 100, 0.1, 100).toFixed(1);
        const inInf = clamp((1 - State.curve.x2) * 100, 0.1, 100).toFixed(1);
        DOM.readout.textContent = `Out ${outInf}% · In ${inInf}%`;
    }

    // ========== Canvas Rendering ==========
    function drawGraph() {
        const canvas = DOM.canvas;
        const ctx = DOM.ctx;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        ctx.fillStyle = 'rgba(26, 0, 51, 0.5)';
        ctx.fillRect(0, 0, width, height);

        drawGrid(width, height);

        if (State.mode === 'value') {
            drawValueGraph(width, height);
        } else {
            drawSpeedGraph(width, height);
        }

        drawHandles(width, height);
    }

    function drawGrid(width, height) {
        const ctx = DOM.ctx;
        const gridSize = 20;
        
        ctx.strokeStyle = 'rgba(93, 61, 159, 0.2)';
        ctx.lineWidth = 0.5;

        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(139, 95, 191, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
    }

    function drawValueGraph(width, height) {
        const ctx = DOM.ctx;
        const padding = 20;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const points = sampleCurve(State.curve, 150);
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = padding + p.x * graphWidth;
            const y = height - padding - p.y * graphHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0, 217, 255, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        drawTangents(width, height, padding);
    }

    function drawSpeedGraph(width, height) {
        const ctx = DOM.ctx;
        const padding = 20;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;
        const centerY = height - padding - graphHeight / 2;

        ctx.beginPath();
        let firstPoint = true;
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const p1 = bezier(t - 0.01, State.curve.x1, State.curve.y1, State.curve.x2, State.curve.y2);
            const p2 = bezier(t + 0.01, State.curve.x1, State.curve.y1, State.curve.x2, State.curve.y2);
            
            const dy = (p2.y - p1.y) / (p2.x - p1.x || 0.001);
            const x = padding + t * graphWidth;
            const y = centerY - dy * (graphHeight / 3);
            
            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(139, 95, 191, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, centerY);
        ctx.lineTo(width - padding, centerY);
        ctx.stroke();
    }

    function drawTangents(width, height, padding) {
        const ctx = DOM.ctx;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const x1 = padding + State.curve.x1 * graphWidth;
        const y1 = height - padding - State.curve.y1 * graphHeight;
        ctx.strokeStyle = 'rgba(139, 95, 191, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        const x2 = padding + State.curve.x2 * graphWidth;
        const y2 = height - padding - State.curve.y2 * graphHeight;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(width - padding, padding);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawHandles(width, height) {
        const ctx = DOM.ctx;
        const padding = 20;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const x1 = padding + State.curve.x1 * graphWidth;
        const y1 = height - padding - State.curve.y1 * graphHeight;
        drawHandle(ctx, x1, y1, State.draggedHandle === 'out');

        const x2 = padding + State.curve.x2 * graphWidth;
        const y2 = height - padding - State.curve.y2 * graphHeight;
        drawHandle(ctx, x2, y2, State.draggedHandle === 'in');
    }

    function drawHandle(ctx, x, y, isActive) {
        const size = isActive ? 8 : 6;
        ctx.fillStyle = isActive ? 'rgba(0, 217, 255, 1)' : 'rgba(0, 217, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isActive ? 'rgba(139, 95, 191, 1)' : 'rgba(139, 95, 191, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isActive) {
            ctx.strokeStyle = 'rgba(0, 217, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, size + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ========== Event Listeners ==========
    function initEventListeners() {
        DOM.valueModeBtn.addEventListener('click', () => setMode('value'));
        DOM.speedModeBtn.addEventListener('click', () => setMode('speed'));
        DOM.resetBtn.addEventListener('click', resetCurve);
        DOM.applyBtn.addEventListener('click', applyCurve);
        DOM.canvas.addEventListener('mousedown', canvasMouseDown);
        DOM.canvas.addEventListener('mousemove', canvasMouseMove);
        DOM.canvas.addEventListener('mouseup', canvasMouseUp);
        DOM.canvas.addEventListener('mouseleave', canvasMouseLeave);
        DOM.speedOutSlider.addEventListener('input', updateFromSpeedControls);
        DOM.speedOutNum.addEventListener('change', updateFromSpeedControls);
        DOM.speedInSlider.addEventListener('input', updateFromSpeedControls);
        DOM.speedInNum.addEventListener('change', updateFromSpeedControls);
        DOM.infOutSlider.addEventListener('input', updateFromSpeedControls);
        DOM.infOutNum.addEventListener('change', updateFromSpeedControls);
        DOM.infInSlider.addEventListener('input', updateFromSpeedControls);
        DOM.infInNum.addEventListener('change', updateFromSpeedControls);
        DOM.liveSyncBtn.addEventListener('click', toggleLiveSync);
        DOM.readBtn.addEventListener('click', readCurveFromAE);
        DOM.captureBtn.addEventListener('click', captureCurve);
        DOM.filter.addEventListener('change', renderPresets);
        DOM.presetList.addEventListener('click', selectPreset);
        DOM.saveBtn.addEventListener('click', savePreset);
        DOM.exportBtn.addEventListener('click', exportPresets);
        DOM.importBtn.addEventListener('click', () => DOM.importFile.click());
        DOM.importFile.addEventListener('change', importPresets);
        DOM.deleteBtn.addEventListener('click', deletePreset);
        DOM.copyBtn.addEventListener('click', copyPreset);
        DOM.helpBtn.addEventListener('click', showHelp);
    }

    function setMode(newMode) {
        State.mode = newMode;
        if (newMode === 'value') {
            DOM.valueModeBtn.classList.add('active');
            DOM.speedModeBtn.classList.remove('active');
            DOM.speedControls.style.display = 'none';
        } else {
            DOM.valueModeBtn.classList.remove('active');
            DOM.speedModeBtn.classList.add('active');
            DOM.speedControls.style.display = 'block';
            updateSpeedControls();
        }
        drawGraph();
    }

    function resetCurve() {
        State.curve = {
            name: 'AE Default',
            group: 'Basic',
            x1: 0.333,
            y1: 0,
            x2: 0.667,
            y2: 1,
            interpolation: 'bezier',
            graphMode: 'value'
        };
        updateReadout();
        updateSpeedControls();
        drawGraph();
        showStatus('✓ Reset to AE F9 Easy Ease');
    }

    function canvasMouseDown(e) {
        const rect = DOM.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / window.devicePixelRatio;
        const y = (e.clientY - rect.top) / window.devicePixelRatio;

        const padding = 20;
        const graphWidth = rect.width - padding * 2;
        const graphHeight = rect.height - padding * 2;

        const x1 = padding + State.curve.x1 * graphWidth;
        const y1 = rect.height - padding - State.curve.y1 * graphHeight;
        const x2 = padding + State.curve.x2 * graphWidth;
        const y2 = rect.height - padding - State.curve.y2 * graphHeight;

        const dist1 = Math.hypot(x - x1, y - y1);
        const dist2 = Math.hypot(x - x2, y - y2);

        if (dist1 < 12) {
            State.isDragging = true;
            State.draggedHandle = 'out';
        } else if (dist2 < 12) {
            State.isDragging = true;
            State.draggedHandle = 'in';
        }
    }

    function canvasMouseMove(e) {
        if (!State.isDragging || !State.draggedHandle) return;

        const rect = DOM.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / window.devicePixelRatio;
        const y = (e.clientY - rect.top) / window.devicePixelRatio;

        const padding = 20;
        const graphWidth = rect.width - padding * 2;
        const graphHeight = rect.height - padding * 2;

        const normalizedX = (x - padding) / graphWidth;
        const normalizedY = (rect.height - padding - y) / graphHeight;

        if (State.draggedHandle === 'out') {
            State.curve.x1 = clamp(normalizedX, 0.01, 0.99);
            State.curve.y1 = clamp(normalizedY, -0.75, 1.75);
        } else {
            State.curve.x2 = clamp(normalizedX, 0.01, 0.99);
            State.curve.y2 = clamp(normalizedY, -0.75, 1.75);
        }

        updateReadout();
        updateSpeedControls();
        drawGraph();
    }

    function canvasMouseUp() {
        State.isDragging = false;
        State.draggedHandle = null;
        drawGraph();
    }

    function canvasMouseLeave() {
        canvasMouseUp();
    }

    function updateSpeedControls() {
        const outInf = (State.curve.x1 * 100).toFixed(1);
        const inInf = ((1 - State.curve.x2) * 100).toFixed(1);

        DOM.speedOutSlider.value = (State.curve.y1 * 100).toFixed(1);
        DOM.speedOutNum.value = (State.curve.y1 * 100).toFixed(1);
        DOM.speedInSlider.value = (State.curve.y2 * 100).toFixed(1);
        DOM.speedInNum.value = (State.curve.y2 * 100).toFixed(1);
        DOM.infOutSlider.value = outInf;
        DOM.infOutNum.value = outInf;
        DOM.infInSlider.value = inInf;
        DOM.infInNum.value = inInf;
    }

    function updateFromSpeedControls() {
        State.curve.y1 = clamp(DOM.speedOutSlider.value / 100, -0.75, 1.75);
        State.curve.y2 = clamp(DOM.speedInSlider.value / 100, -0.75, 1.75);
        State.curve.x1 = clamp(DOM.infOutSlider.value / 100, 0.01, 0.99);
        State.curve.x2 = clamp(1 - DOM.infInSlider.value / 100, 0.01, 0.99);
        updateReadout();
        drawGraph();
    }

    function applyCurve() {
        if (!csInterface) {
            showStatus('After Effects not available');
            return;
        }

        const payload = {
            curve: State.curve,
            options: {
                applyAll: DOM.allKeys.checked,
                continuous: DOM.continuous.checked,
                autoBezier: DOM.autoBezier.checked,
                graphMode: State.mode
            }
        };

        try {
            const result = csInterface.evalScript('$._SpectraFlow.applyEase(\'' + JSON.stringify(payload).replace(/'/g, "\\\'" ) + '\')');
            const parsed = JSON.parse(result);
            if (parsed.ok) {
                showStatus(`✓ Applied to ${parsed.applied} keyframes`);
            } else {
                showStatus('Error: ' + parsed.message);
            }
        } catch (e) {
            showStatus('Error applying curve');
        }
    }

    function readCurveFromAE() {
        showStatus('Select keyframes and use CAPTURE instead');
    }

    function captureCurve() {
        if (!csInterface) {
            showStatus('After Effects not available');
            return;
        }

        const payload = {
            curve: State.curve,
            options: {
                applyAll: DOM.allKeys.checked,
                graphMode: State.mode
            }
        };

        try {
            const result = csInterface.evalScript('$._SpectraFlow.captureEase(\'' + JSON.stringify(payload).replace(/'/g, "\\\'" ) + '\')');
            const parsed = JSON.parse(result);
            if (parsed.ok) {
                State.curve = parsed.curve;
                State.curve.name = 'Captured Curve';
                State.curve.group = 'Custom';
                updateReadout();
                updateSpeedControls();
                drawGraph();
                showStatus('✓ Curve captured from selection');
            } else {
                showStatus('Error: ' + parsed.message);
            }
        } catch (e) {
            showStatus('Error capturing curve');
        }
    }

    function toggleLiveSync() {
        State.liveSyncEnabled = !State.liveSyncEnabled;
        if (State.liveSyncEnabled) {
            DOM.liveSyncBtn.classList.add('live-active');
            showStatus('Live Sync active');
            startLiveSync();
        } else {
            DOM.liveSyncBtn.classList.remove('live-active');
            stopLiveSync();
            showStatus('Live Sync stopped');
        }
    }

    function startLiveSync() {
        State.liveSyncInterval = setInterval(() => {
            if (csInterface && State.liveSyncEnabled) {
                captureCurve();
            }
        }, 300);
    }

    function stopLiveSync() {
        if (State.liveSyncInterval) {
            clearInterval(State.liveSyncInterval);
            State.liveSyncInterval = null;
        }
    }

    function renderPresets() {
        const filter = DOM.filter.value;
        DOM.presetList.innerHTML = '';

        let presets = [];
        if (filter === 'All') {
            Object.values(PresetsDB).forEach(group => presets.push(...group));
            presets.push(...State.customPresets);
        } else {
            presets = filter === 'Custom' ? State.customPresets : (PresetsDB[filter] || []);
        }

        presets.forEach((preset, index) => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `
                <span class="preset-item-name">${preset.name}</span>
                <span class="preset-item-group">${preset.group}</span>
            `;
            item.addEventListener('click', () => {
                State.curve = { ...preset };
                updateReadout();
                updateSpeedControls();
                drawGraph();
                renderPresets();
            });
            DOM.presetList.appendChild(item);
        });
    }

    function selectPreset(e) {
        const item = e.target.closest('.preset-item');
        if (item) {
            const name = item.querySelector('.preset-item-name').textContent;
            const filter = DOM.filter.value;
            let presets = filter === 'All' ? [] : PresetsDB[filter];
            const preset = presets.find(p => p.name === name);
            if (preset) {
                State.curve = { ...preset };
                updateReadout();
                updateSpeedControls();
                drawGraph();
            }
        }
    }

    function savePreset() {
        const name = DOM.nameInput.value || 'Custom Preset';
        const preset = {
            ...State.curve,
            name: name,
            group: 'Custom'
        };
        State.customPresets.push(preset);
        saveToLocalStorage();
        DOM.nameInput.value = '';
        showStatus(`✓ Saved: ${name}`);
        renderPresets();
    }

    function deletePreset() {
        if (State.customPresets.length > 0) {
            State.customPresets.pop();
            saveToLocalStorage();
            showStatus('✓ Preset deleted');
            renderPresets();
        }
    }

    function copyPreset() {
        const preset = { ...State.curve };
        preset.name = preset.name + ' (Copy)';
        State.customPresets.push(preset);
        saveToLocalStorage();
        showStatus(`✓ Copied: ${preset.name}`);
        renderPresets();
    }

    function exportPresets() {
        const data = JSON.stringify(State.customPresets, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spectraflow-presets.json';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('✓ Presets exported');
    }

    function importPresets(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const presets = JSON.parse(event.target.result);
                State.customPresets.push(...presets);
                saveToLocalStorage();
                showStatus(`✓ Imported ${presets.length} presets`);
                renderPresets();
            } catch (err) {
                showStatus('Error importing presets');
            }
        };
        reader.readAsText(file);
    }

    function showStatus(message) {
        DOM.status.textContent = message;
        setTimeout(() => {
            DOM.status.textContent = 'Ready.';
        }, 3000);
    }

    function showHelp() {
        alert(`SpectraFlow - Smart AE Graph Engine v3.0\n\n📊 VALUE GRAPH\nShows keyframe easing curve with handles\n\n⚡ SPEED GRAPH\nShows velocity/rate of change over time\n\n🎮 DRAG HANDLES\nHorizontal = Influence (timing extent)\nVertical = Easing strength\n\n🔄 LIVE SYNC\nEnable to mirror changes from After Effects (300ms)\n\n📸 CAPTURE\nGet current easing from selected keyframes\n\n100% Native Graph Mirroring - Perfect sync guaranteed!`);
    }

    function saveToLocalStorage() {
        try {
            localStorage.setItem('spectraflow-presets', JSON.stringify(State.customPresets));
        } catch (e) {
            console.warn('Could not save to localStorage');
        }
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('spectraflow-presets');
            if (saved) {
                State.customPresets = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load from localStorage');
        }
    }

    // ========== Initialization ==========
    function init() {
        loadFromLocalStorage();
        initEventListeners();
        resetCurve();
        renderPresets();
        
        window.addEventListener('resize', () => {
            setTimeout(drawGraph, 100);
        });

        showStatus('SpectraFlow Ready - Perfect Native Sync Active');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();