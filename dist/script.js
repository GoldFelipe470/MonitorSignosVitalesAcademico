/* ==========================================================================
   SCRIPT PRINCIPAL - MONITOR DE SIGNOS VITALES
   ========================================================================== */

// Estado Global de la Aplicación
const state = {
    // Valores base de signos vitales
    lpm: 95,
    paSys: 117,
    paDia: 75,
    sato2: 95,
    fr: 17,
    temp: 36.5,
    glu: 95,
    
    // Parámetros de control
    isSimulationActive: true,
    isAudioActive: false,
    isSketchMode: false,
    showAnswers: false, // Control académico para mostrar/ocultar respuestas
    
    // Historial para fluctuaciones
    lastFluctuationTime: 0
};

// Valores por defecto para restaurar
const defaults = {
    lpm: 95,
    paSys: 117,
    paDia: 75,
    sato2: 95,
    fr: 17,
    temp: 36.5,
    glu: 95,
    isSimulationActive: true
};

// Contexto de Audio para el Beep
let audioCtx = null;

// Elementos del DOM
const DOM = {
    // Valores en pantalla (Modo Monitor)
    valLpm: document.getElementById('valLpm'),
    valPa: document.getElementById('valPa'),
    valPaSub: document.getElementById('valPaSub'),
    valSato2: document.getElementById('valSato2'),
    valFr: document.getElementById('valFr'),
    valTemp: document.getElementById('valTemp'),
    valTempF: document.getElementById('valTempF'),
    valGlu: document.getElementById('valGlu'),
    
    // Valores en pantalla (Modo Bosquejo)
    sketchLpm: document.getElementById('sketchLpm'),
    sketchPa: document.getElementById('sketchPa'),
    sketchSato2: document.getElementById('sketchSato2'),
    sketchFr: document.getElementById('sketchFr'),
    sketchTemp: document.getElementById('sketchTemp'),
    sketchGlu: document.getElementById('sketchGlu'),
    
    // Controles Académicos
    cambiarCifrasBtn: document.getElementById('cambiarCifrasBtn'),
    mostrarRespuestaBtn: document.getElementById('mostrarRespuestaBtn'),
    btnAnsText: document.getElementById('btnAnsText'),
    patientStatus: document.getElementById('patientStatus'),
    eyeOpen: document.querySelector('#mostrarRespuestaBtn .eye-open'),
    eyeClosed: document.querySelector('#mostrarRespuestaBtn .eye-closed'),
    
    // Controles e Interfaces
    liveClock: document.getElementById('liveClock'),
    modeToggle: document.getElementById('modeToggle'),
    toggleAudioBtn: document.getElementById('toggleAudioBtn'),
    audioStatusText: document.getElementById('audioStatusText'),
    audioIconPath: document.getElementById('audioIconPath'),
    toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
    fullscreenStatusText: document.getElementById('fullscreenStatusText'),
    fullscreenIconPath: document.getElementById('fullscreenIconPath'),
    
    monitorView: document.getElementById('monitorView'),
    sketchView: document.getElementById('sketchView'),
    
    // Drawer de Configuración
    configDrawer: document.getElementById('configDrawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    openConfigBtn: document.getElementById('openConfigBtn'),
    closeConfigBtn: document.getElementById('closeConfigBtn'),
    btnRestaurar: document.getElementById('btnRestaurar'),
    
    // Inputs del Drawer
    simToggle: document.getElementById('simToggle'),
    inputLpm: document.getElementById('inputLpm'),
    inputLpmVal: document.getElementById('inputLpmVal'),
    inputPaSys: document.getElementById('inputPaSys'),
    inputPaSysVal: document.getElementById('inputPaSysVal'),
    inputPaDia: document.getElementById('inputPaDia'),
    inputPaDiaVal: document.getElementById('inputPaDiaVal'),
    inputSato2: document.getElementById('inputSato2'),
    inputSato2Val: document.getElementById('inputSato2Val'),
    inputFr: document.getElementById('inputFr'),
    inputFrVal: document.getElementById('inputFrVal'),
    inputTemp: document.getElementById('inputTemp'),
    inputTempVal: document.getElementById('inputTempVal'),
    inputGlu: document.getElementById('inputGlu'),
    inputGluVal: document.getElementById('inputGluVal')
};

// ==========================================================================
// 1. Inicialización y Eventos de la Interfaz
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Sincronizar UI con el estado inicial
    actualizarUI();
    actualizarBadges(); // Inicializar badges
    
    // Reloj en tiempo real
    setInterval(actualizarReloj, 1000);
    actualizarReloj();
    
    // Toggle de Modo (Monitor / Bosquejo)
    DOM.modeToggle.addEventListener('change', (e) => {
        state.isSketchMode = e.target.checked;
        if (state.isSketchMode) {
            DOM.monitorView.classList.add('hidden');
            DOM.sketchView.classList.remove('hidden');
        } else {
            DOM.monitorView.classList.remove('hidden');
            DOM.sketchView.classList.add('hidden');
            // Ajustar canvas al volver al modo monitor
            setTimeout(resizeCanvases, 50);
        }
    });

    // Control de Audio Beep
    DOM.toggleAudioBtn.addEventListener('click', () => {
        state.isAudioActive = !state.isAudioActive;
        
        // Inicializar y reactivar contexto inmediatamente en el evento de click (requerido por navegadores)
        if (state.isAudioActive) {
            if (!audioCtx) {
                inicializarAudioContext();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }
        
        actualizarBotonAudio();
    });

    // Control de Pantalla Completa
    if (DOM.toggleFullscreenBtn) {
        DOM.toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', actualizarBotonFullscreen);
        document.addEventListener('webkitfullscreenchange', actualizarBotonFullscreen);
    }

    // Botones Académicos
    DOM.cambiarCifrasBtn.addEventListener('click', cargarCasoAleatorio);
    DOM.mostrarRespuestaBtn.addEventListener('click', toggleRespuestas);

    // Abrir/Cerrar Configuración (Drawer)
    DOM.openConfigBtn.addEventListener('click', abrirConfiguracion);
    DOM.closeConfigBtn.addEventListener('click', cerrarConfiguracion);
    DOM.drawerOverlay.addEventListener('click', cerrarConfiguracion);

    // Inputs de Configuración (Eventos de arrastre y cambio)
    sincronizarControlesDrawer();
    
    // Botón restaurar valores
    DOM.btnRestaurar.addEventListener('click', restaurarValoresPorDefecto);
    
    // Waveform setup
    initWaveforms();
    
    // Adaptación a redimensionado
    window.addEventListener('resize', () => {
        if (!state.isSketchMode) {
            resizeCanvases();
        }
    });
});

// ==========================================================================
// 2. Controladores de UI y Reloj
// ==========================================================================

function actualizarReloj() {
    const ahora = new Date();
    const hrs = String(ahora.getHours()).padStart(2, '0');
    const mins = String(ahora.getMinutes()).padStart(2, '0');
    const secs = String(ahora.getSeconds()).padStart(2, '0');
    DOM.liveClock.textContent = `${hrs}:${mins}:${secs}`;
}

function abrirConfiguracion() {
    DOM.configDrawer.classList.add('open');
    DOM.drawerOverlay.classList.add('open');
}

function cerrarConfiguracion() {
    DOM.configDrawer.classList.remove('open');
    DOM.drawerOverlay.classList.remove('open');
}

function actualizarBotonAudio() {
    if (state.isAudioActive) {
        if (DOM.audioStatusText) DOM.audioStatusText.textContent = "Sonido Activo";
        DOM.toggleAudioBtn.style.background = "rgba(0, 230, 118, 0.15)";
        DOM.toggleAudioBtn.style.borderColor = "var(--color-lpm)";
        // Icono de volumen alto
        DOM.audioIconPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
    } else {
        if (DOM.audioStatusText) DOM.audioStatusText.textContent = "Silenciado";
        DOM.toggleAudioBtn.style.background = "rgba(39, 39, 42, 0.5)";
        DOM.toggleAudioBtn.style.borderColor = "var(--card-border)";
        // Icono de mute
        DOM.audioIconPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
    }
}

// Restricciones fisiológicas reales para evitar incongruencias médicas
function enforcePhysiologicConstraints() {
    // La presión diastólica debe ser menor que la sistólica por al menos 15 mmHg
    if (state.paDia >= state.paSys - 15) {
        state.paDia = state.paSys - 15;
    }
    // Asegurar límites seguros y estables de presión
    if (state.paDia < 20) state.paDia = 20;
    if (state.paSys > 300) state.paSys = 300;
}

// Actualizar valores en pantalla
function actualizarUI() {
    enforcePhysiologicConstraints();
    // 1. LPM
    DOM.valLpm.textContent = state.lpm;
    DOM.sketchLpm.textContent = state.lpm;
    
    // 2. PA (Presión Arterial)
    const paString = `${state.paSys}/${state.paDia}`;
    DOM.valPa.textContent = paString;
    DOM.sketchPa.textContent = paString;
    
    const pam = Math.round(state.paDia + (state.paSys - state.paDia) / 3);
    DOM.valPaSub.textContent = `PAM: ${pam}`;
    
    // 3. SpO2 (Saturación)
    DOM.valSato2.textContent = state.sato2;
    // Formato SatO2 en bosquejo con el símbolo '%'
    DOM.sketchSato2.textContent = `${state.sato2}%`;
    
    // 4. FR (Frecuencia Respiratoria)
    DOM.valFr.textContent = state.fr;
    DOM.sketchFr.textContent = state.fr;
    
    // 5. Temperatura
    DOM.valTemp.textContent = state.temp.toFixed(1);
    
    // En bosquejo se usa la coma como separador decimal (e.g. 36,5)
    const tempSketchStr = state.temp.toFixed(1).replace('.', ',');
    DOM.sketchTemp.textContent = tempSketchStr;
    
    const tempF = (state.temp * 9/5) + 32;
    DOM.valTempF.textContent = `${tempF.toFixed(1)} °F`;
    
    // 6. Glicemia
    DOM.valGlu.textContent = state.glu;
    DOM.sketchGlu.textContent = state.glu;
    
    // Recalcular diagnósticos académicos en tiempo real
    actualizarBadges();
    
    // Sincronizar de vuelta los sliders en caso de correcciones fisiológicas automáticas
    actualizarValoresDrawer();
}

// Sincronizar inputs del Drawer con el estado actual
function sincronizarControlesDrawer() {
    // Asignar valores iniciales
    DOM.simToggle.checked = state.isSimulationActive;
    
    DOM.inputLpm.value = state.lpm;
    DOM.inputLpmVal.textContent = state.lpm;
    
    DOM.inputPaSys.value = state.paSys;
    DOM.inputPaSysVal.textContent = state.paSys;
    
    DOM.inputPaDia.value = state.paDia;
    DOM.inputPaDiaVal.textContent = state.paDia;
    
    DOM.inputSato2.value = state.sato2;
    DOM.inputSato2Val.textContent = state.sato2;
    
    DOM.inputFr.value = state.fr;
    DOM.inputFrVal.textContent = state.fr;
    
    DOM.inputTemp.value = state.temp;
    DOM.inputTempVal.textContent = state.temp.toFixed(1);
    
    DOM.inputGlu.value = state.glu;
    DOM.inputGluVal.textContent = state.glu;

    // Escuchadores de eventos para cambios en tiempo real
    DOM.simToggle.addEventListener('change', (e) => {
        state.isSimulationActive = e.target.checked;
    });

    const setupSlider = (slider, output, stateKey, isFloat = false) => {
        slider.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
            state[stateKey] = val;
            output.textContent = isFloat ? val.toFixed(1) : val;
            actualizarUI();
        });
    };

    setupSlider(DOM.inputLpm, DOM.inputLpmVal, 'lpm');
    setupSlider(DOM.inputPaSys, DOM.inputPaSysVal, 'paSys');
    setupSlider(DOM.inputPaDia, DOM.inputPaDiaVal, 'paDia');
    setupSlider(DOM.inputSato2, DOM.inputSato2Val, 'sato2');
    setupSlider(DOM.inputFr, DOM.inputFrVal, 'fr');
    setupSlider(DOM.inputTemp, DOM.inputTempVal, 'temp', true);
    setupSlider(DOM.inputGlu, DOM.inputGluVal, 'glu');
}

// Restaurar los valores por defecto
function restaurarValoresPorDefecto() {
    Object.assign(state, defaults);
    sincronizarControlesDrawer();
    actualizarUI();
}

// ==========================================================================
// 3. Motor de Audio (Sintetizador Web Audio API)
// ==========================================================================

function inicializarAudioContext() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error("Web Audio API no es soportada en este navegador", e);
    }
}

function playHeartBeep() {
    if (!state.isAudioActive) return;
    
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gainNode = audioCtx.createGain();
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Pitch del beep depende de la saturación (SatO2) según estándar Nellcor/Masimo
    // Rango realista: SpO2 100% = ~950Hz (tono agudo y claro), SpO2 70% = ~400Hz (grave, de advertencia)
    let pitch = 400;
    if (state.sato2 >= 70) {
        pitch = 400 + (state.sato2 - 70) * 18.33;
    } else {
        pitch = 400 - (70 - state.sato2) * 10;
        if (pitch < 200) pitch = 200;
    }
    
    const now = audioCtx.currentTime;
    
    // Usamos onda triangular filtrada por un paso de banda resonante
    // Esto imita la acústica física y la resonancia armónica de un altavoz piezoeléctrico de monitor médico real
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(pitch, now);
    filter.Q.setValueAtTime(5.0, now); // Alta resonancia clínica limpia
    
    // Control de volumen y envolvente (Ataque ultra rápido de 5ms, decaimiento exponencial natural de 120ms)
    // Esto imita la caída acústica y la reverberación en la carcasa plástica del monitor sin chasquidos
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.06, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.15);
    
    // Retroalimentación visual del latido
    flashPulseIndicators();
}

// Flash visual en sincronía con el sonido
function flashPulseIndicators() {
    const headerPulse = document.querySelector('.pulse-indicator');
    const heartIcon = document.querySelector('.pulse-heart');
    
    if (headerPulse) {
        headerPulse.style.transform = 'scale(1.5)';
        headerPulse.style.backgroundColor = '#ffffff';
        headerPulse.style.boxShadow = '0 0 20px #ffffff';
    }
    
    if (heartIcon) {
        heartIcon.style.transform = 'scale(1.3)';
    }
    
    setTimeout(() => {
        if (headerPulse) {
            headerPulse.style.transform = 'scale(1)';
            headerPulse.style.backgroundColor = 'var(--color-lpm)';
            headerPulse.style.boxShadow = '0 0 10px var(--color-lpm)';
        }
        if (heartIcon) {
            heartIcon.style.transform = 'scale(1)';
        }
    }, 100);
}

// ==========================================================================
// 4. Algoritmo de Fluctuación y Simulación en Vivo
// ==========================================================================

function simularFluctuaciones(tiempoActual) {
    if (!state.isSimulationActive) return;
    
    // Fluctuar cada 4 segundos aproximadamente
    if (tiempoActual - state.lastFluctuationTime < 4000) return;
    state.lastFluctuationTime = tiempoActual;
    
    // 1. LPM (Frecuencia cardíaca fluctúa de a poco -1, 0, 1)
    const deltaLpm = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    state.lpm = Math.max(defaults.lpm - 10, Math.min(defaults.lpm + 15, state.lpm + deltaLpm));
    
    // 2. Presión Arterial (sistólica/diastólica fluctúan independientemente de a ratos)
    if (Math.random() > 0.5) {
        const deltaSys = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        state.paSys = Math.max(defaults.paSys - 8, Math.min(defaults.paSys + 12, state.paSys + deltaSys));
    }
    if (Math.random() > 0.5) {
        const deltaDia = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        state.paDia = Math.max(defaults.paDia - 5, Math.min(defaults.paDia + 8, state.paDia + deltaDia));
    }
    
    // 3. SatO2 (Oxígeno se mantiene entre 94% y 100%)
    if (Math.random() > 0.6) {
        const deltaO2 = Math.floor(Math.random() * 3) - 1;
        state.sato2 = Math.max(94, Math.min(100, state.sato2 + deltaO2));
    }
    
    // 4. FR (Respiración fluctúa entre 14 y 20)
    if (Math.random() > 0.7) {
        const deltaFr = Math.floor(Math.random() * 3) - 1;
        state.fr = Math.max(defaults.fr - 3, Math.min(defaults.fr + 3, state.fr + deltaFr));
    }
    
    // 5. Temperatura (cambia muy lento, centésimas de grado)
    if (Math.random() > 0.5) {
        const deltaTemp = (Math.random() * 0.2 - 0.1); // -0.1 a +0.1
        state.temp = Math.max(defaults.temp - 0.5, Math.min(defaults.temp + 0.8, state.temp + deltaTemp));
    }
    
    // 6. Glicemia (fluctúa muy poco, +/- 1)
    if (Math.random() > 0.8) {
        const deltaGlu = Math.floor(Math.random() * 3) - 1;
        state.glu = Math.max(defaults.glu - 8, Math.min(defaults.glu + 15, state.glu + deltaGlu));
    }
    
    // Actualizar UI e inputs del drawer para reflejar el cambio
    actualizarUI();
    actualizarValoresDrawer();
}

function actualizarValoresDrawer() {
    if (document.activeElement !== DOM.inputLpm) {
        DOM.inputLpm.value = state.lpm;
    }
    DOM.inputLpmVal.textContent = state.lpm;
    
    if (document.activeElement !== DOM.inputPaSys) {
        DOM.inputPaSys.value = state.paSys;
    }
    DOM.inputPaSysVal.textContent = state.paSys;
    
    if (document.activeElement !== DOM.inputPaDia) {
        DOM.inputPaDia.value = state.paDia;
    }
    DOM.inputPaDiaVal.textContent = state.paDia;
    
    if (document.activeElement !== DOM.inputSato2) {
        DOM.inputSato2.value = state.sato2;
    }
    DOM.inputSato2Val.textContent = state.sato2;
    
    if (document.activeElement !== DOM.inputFr) {
        DOM.inputFr.value = state.fr;
    }
    DOM.inputFrVal.textContent = state.fr;
    
    if (document.activeElement !== DOM.inputTemp) {
        DOM.inputTemp.value = state.temp;
    }
    DOM.inputTempVal.textContent = state.temp.toFixed(1);
    
    if (document.activeElement !== DOM.inputGlu) {
        DOM.inputGlu.value = state.glu;
    }
    DOM.inputGluVal.textContent = state.glu;
}

// ==========================================================================
// 5. Animación de Ondas en Tiempo Real (Canvases)
// ==========================================================================

// Modelos matemáticos de las ondas
const Waveforms = {
    // 1. ECG (Electrocardiograma)
    getEcgValue(phase) {
        if (phase < 0.08) {
            // Onda P
            const p = phase / 0.08;
            return 0.12 * Math.sin(p * Math.PI);
        } else if (phase < 0.16) {
            // Segmento PR (línea plana)
            return 0;
        } else if (phase < 0.19) {
            // Deflexión Q (pequeño pico negativo)
            const q = (phase - 0.16) / 0.03;
            return -0.15 * q;
        } else if (phase < 0.23) {
            // Complejo R (pico alto positivo)
            const r = (phase - 0.19) / 0.04;
            if (r < 0.5) {
                return -0.15 + (1.15 * (r / 0.5));
            } else {
                return 1.0 - (1.30 * ((r - 0.5) / 0.5));
            }
        } else if (phase < 0.26) {
            // Deflexión S (pico negativo profundo)
            const s = (phase - 0.23) / 0.03;
            return -0.30 + (0.30 * s);
        } else if (phase < 0.35) {
            // Segmento ST (línea plana)
            return 0;
        } else if (phase < 0.48) {
            // Onda T (curva positiva suave)
            const t = (phase - 0.35) / 0.13;
            return 0.25 * Math.sin(t * Math.PI);
        } else {
            // Segmento TP (reposo)
            return 0;
        }
    },
    
    // 2. PPG (Fotopletismografía - Pulso de Oxígeno)
    getPpgValue(phase) {
        if (phase < 0.25) {
            // Ascenso sistólico rápido
            const p = phase / 0.25;
            return Math.sin(p * Math.PI / 2);
        } else if (phase < 0.45) {
            // Caída inicial
            const p = (phase - 0.25) / 0.20;
            return 1.0 - 0.45 * p;
        } else if (phase < 0.55) {
            // Muesca dicrótica y pico secundario
            const p = (phase - 0.45) / 0.10;
            return 0.55 + 0.08 * Math.sin(p * Math.PI);
        } else {
            // Caída diastólica lenta
            const p = (phase - 0.55) / 0.45;
            return 0.55 - 0.55 * p;
        }
    },
    
    // 3. Respiración (Curva senoidal suave)
    getRespValue(phase) {
        // Onda sinusoidal pura y lenta
        return 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI);
    }
};

// Configuraciones de renderizado de las ondas
const waveConfig = {
    ecg: {
        canvasId: 'canvasEcg',
        color: '#00e676',
        glowColor: 'rgba(0, 230, 118, 0.4)',
        lineWidth: 2,
        getValue: Waveforms.getEcgValue,
        phase: 0,
        x: 0,
        lastX: 0,
        lastY: 0,
        hasBeeped: false,
        yMultiplier: 0.8 // Amplificación de la señal
    },
    ppg: {
        canvasId: 'canvasPpg',
        color: '#00e5ff',
        glowColor: 'rgba(0, 229, 255, 0.4)',
        lineWidth: 2,
        getValue: Waveforms.getPpgValue,
        phase: 0.15, // Desfase respecto al latido (lag fisiológico del pulso periférico)
        x: 0,
        lastX: 0,
        lastY: 0,
        yMultiplier: 0.7
    },
    resp: {
        canvasId: 'canvasResp',
        color: '#ffea00',
        glowColor: 'rgba(255, 234, 0, 0.4)',
        lineWidth: 1.5,
        getValue: Waveforms.getRespValue,
        phase: 0,
        x: 0,
        lastX: 0,
        lastY: 0,
        yMultiplier: 0.7
    }
};

let lastFrameTime = 0;

function initWaveforms() {
    resizeCanvases();
    
    // Inicializar posiciones Y de partida
    Object.keys(waveConfig).forEach(key => {
        const config = waveConfig[key];
        const canvas = document.getElementById(config.canvasId);
        if (!canvas) return;
        
        config.canvas = canvas;
        config.ctx = canvas.getContext('2d');
        
        const rect = canvas.getBoundingClientRect();
        const yVal = config.getValue(config.phase);
        config.lastY = scaleY(yVal, rect.height, config.yMultiplier);
    });
    
    // Arrancar el ciclo de renderizado
    requestAnimationFrame(renderLoop);
}

function resizeCanvases() {
    Object.keys(waveConfig).forEach(key => {
        const config = waveConfig[key];
        const canvas = document.getElementById(config.canvasId);
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // Reiniciar barra de barrido (sweep) y coordenadas Y iniciales para evitar líneas diagonales raras
        config.x = 0;
        config.lastX = 0;
        const yVal = config.getValue(config.phase);
        config.lastY = scaleY(yVal, rect.height, config.yMultiplier);
    });
}

function scaleY(val, height, multiplier) {
    // Escala y centra la señal y-axis
    const center = height / 2;
    const maxAmplitude = height * 0.45 * multiplier;
    return center - (val * maxAmplitude);
}

// Ciclo de animación principal
function renderLoop(time) {
    if (lastFrameTime === 0) {
        lastFrameTime = time;
        requestAnimationFrame(renderLoop);
        return;
    }
    
    const dt = time - lastFrameTime;
    lastFrameTime = time;
    
    // Simular variaciones en los signos vitales
    simularFluctuaciones(time);
    
    if (!state.isSketchMode) {
        // Actualizar y dibujar cada onda
        dibujarOndaEcg(dt);
        dibujarOndaPpg(dt);
        dibujarOndaResp(dt);
    }
    
    requestAnimationFrame(renderLoop);
}

// 1. Dibujar ECG (Verde) + Activación del Beep Sincronizado
function dibujarOndaEcg(dt) {
    const config = waveConfig.ecg;
    const ctx = config.ctx;
    if (!ctx) return;
    
    const width = config.canvas.clientWidth;
    const height = config.canvas.clientHeight;
    
    // Incrementar fase basada en LPM (Frecuencia Cardíaca)
    // phaseDelta = latidos por segundo * dt en segundos
    const prevPhase = config.phase;
    config.phase = (config.phase + (state.lpm / 60) * (dt / 1000)) % 1.0;
    
    // Resetear flag de beep al completar el ciclo
    if (config.phase < prevPhase) {
        config.hasBeeped = false;
    }
    
    // Disparar beep en el pico R (fase ~0.20)
    if (config.phase >= 0.20 && !config.hasBeeped) {
        playHeartBeep();
        config.hasBeeped = true;
    }
    
    // Avanzar barra de barrido
    // Velocidad de barrido: ~180px por segundo en desktop
    const sweepSpeed = 160 * (dt / 1000);
    config.x = (config.x + sweepSpeed) % width;
    
    const yVal = config.getValue(config.phase);
    const newY = scaleY(yVal, height, config.yMultiplier);
    
    dibujarTrazoSweep(ctx, config, width, height, newY);
}

// 2. Dibujar SpO2 (Cian)
function dibujarOndaPpg(dt) {
    const config = waveConfig.ppg;
    const ctx = config.ctx;
    if (!ctx) return;
    
    const width = config.canvas.clientWidth;
    const height = config.canvas.clientHeight;
    
    // Sincronizada con LPM (con un desfase constante)
    config.phase = (config.phase + (state.lpm / 60) * (dt / 1000)) % 1.0;
    
    const sweepSpeed = 160 * (dt / 1000);
    config.x = (config.x + sweepSpeed) % width;
    
    // Obtener valor y desplazar ligeramente hacia arriba para centrar estéticamente
    const yVal = config.getValue(config.phase) - 0.4;
    const newY = scaleY(yVal, height, config.yMultiplier);
    
    dibujarTrazoSweep(ctx, config, width, height, newY);
}

// 3. Dibujar Respiración (Amarillo)
function dibujarOndaResp(dt) {
    const config = waveConfig.resp;
    const ctx = config.ctx;
    if (!ctx) return;
    
    const width = config.canvas.clientWidth;
    const height = config.canvas.clientHeight;
    
    // Incrementar fase basada en FR (Frecuencia Respiratoria)
    config.phase = (config.phase + (state.fr / 60) * (dt / 1000)) % 1.0;
    
    // Barrido ligeramente más lento para la respiración (onda lenta)
    const sweepSpeed = 160 * (dt / 1000);
    config.x = (config.x + sweepSpeed) % width;
    
    const yVal = config.getValue(config.phase) - 0.5;
    const newY = scaleY(yVal, height, config.yMultiplier);
    
    dibujarTrazoSweep(ctx, config, width, height, newY);
}

// Dibuja el trazo con efecto de barrido (sweep bar) e iluminación neón
function dibujarTrazoSweep(ctx, config, width, height, newY) {
    const eraseWidth = 20; // Ancho de la franja que borra lo viejo adelante del trazo
    
    ctx.save();
    
    // 1. Borrar la franja justo adelante del punto de dibujo actual
    ctx.clearRect(config.x, 0, eraseWidth, height);
    
    // Si la barra dio la vuelta completa
    if (config.x < config.lastX) {
        // Borrar el borde inicial para evitar artefactos visuales
        ctx.clearRect(0, 0, eraseWidth, height);
        config.lastX = 0;
    }
    
    // 2. Dibujar línea (En blanco si las respuestas están ocultas, o verde/rojo si están visibles)
    const isHidden = document.body.classList.contains('hide-answers');
    let drawColor = isHidden ? '#ffffff' : config.color;
    
    if (!isHidden) {
        let isNormal = true;
        if (config.canvasId === 'canvasEcg') {
            isNormal = (state.lpm >= 60 && state.lpm <= 100);
        } else if (config.canvasId === 'canvasPpg') {
            isNormal = (state.sato2 >= 95);
        } else if (config.canvasId === 'canvasResp') {
            isNormal = (state.fr >= 12 && state.fr <= 20);
        }
        drawColor = isNormal ? '#00e676' : '#ff1744';
    }
    
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = config.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Efecto Neon Glow
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = isHidden ? 4 : 8;
    
    ctx.beginPath();
    ctx.moveTo(config.lastX, config.lastY);
    ctx.lineTo(config.x, newY);
    ctx.stroke();
    
    ctx.restore();
    
    // Almacenar coordenadas para el siguiente frame
    config.lastX = config.x;
    config.lastY = newY;
}

// ==========================================================================
// 6. Características Académicas (Casos Clínicos y Respuestas)
// ==========================================================================

const casosClinicos = [
    {
        nombre: "Normal / Saludable",
        lpm: 72, paSys: 118, paDia: 76, sato2: 98, fr: 14, temp: 36.6, glu: 85
    },
    {
        nombre: "Fiebre y Taquicardia (Infección)",
        lpm: 115, paSys: 110, paDia: 68, sato2: 96, fr: 22, temp: 38.9, glu: 105
    },
    {
        nombre: "Shock Hipovolémico (Sangrado / Deshidratación)",
        lpm: 130, paSys: 85, paDia: 48, sato2: 91, fr: 25, temp: 35.6, glu: 90
    },
    {
        nombre: "Cetoacidosis Diabética (Diabetes descompensada)",
        lpm: 108, paSys: 115, paDia: 72, sato2: 97, fr: 28, temp: 36.9, glu: 310
    },
    {
        nombre: "Hipoglicemia Severa (Baja de azúcar)",
        lpm: 96, paSys: 108, paDia: 64, sato2: 99, fr: 15, temp: 36.1, glu: 42
    },
    {
        nombre: "Insuficiencia Respiratoria Aguda",
        lpm: 112, paSys: 135, paDia: 85, sato2: 86, fr: 29, temp: 36.7, glu: 115
    },
    {
        nombre: "Bradicardia Severa (Bloqueo cardíaco)",
        lpm: 38, paSys: 92, paDia: 55, sato2: 95, fr: 12, temp: 35.8, glu: 80
    }
];

let currentCaseIndex = -1;

// Cargar un caso clínico aleatorio
function cargarCasoAleatorio() {
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * casosClinicos.length);
    } while (casosClinicos.length > 1 && newIndex === currentCaseIndex);

    currentCaseIndex = newIndex;
    const nuevoCaso = casosClinicos[newIndex];

    // Actualizar estado
    state.lpm = nuevoCaso.lpm;
    state.paSys = nuevoCaso.paSys;
    state.paDia = nuevoCaso.paDia;
    state.sato2 = nuevoCaso.sato2;
    state.fr = nuevoCaso.fr;
    state.temp = nuevoCaso.temp;
    state.glu = nuevoCaso.glu;
    
    // Forzar el ocultamiento de respuestas al cambiar cifras
    state.showAnswers = false;
    document.body.classList.add('hide-answers');
    if (DOM.btnAnsText) DOM.btnAnsText.textContent = "Mostrar Respuesta";
    if (DOM.eyeOpen) DOM.eyeOpen.classList.remove('hidden');
    if (DOM.eyeClosed) DOM.eyeClosed.classList.add('hidden');
    
    // Sincronizar UI
    actualizarUI();
    actualizarValoresDrawer();
    actualizarBadges();
}

// Mostrar / Ocultar Diagnósticos
function toggleRespuestas() {
    state.showAnswers = !state.showAnswers;
    if (state.showAnswers) {
        document.body.classList.remove('hide-answers');
        if (DOM.btnAnsText) DOM.btnAnsText.textContent = "Ocultar Respuesta";
        if (DOM.eyeOpen) DOM.eyeOpen.classList.add('hidden');
        if (DOM.eyeClosed) DOM.eyeClosed.classList.remove('hidden');
        actualizarBadges();
    } else {
        document.body.classList.add('hide-answers');
        if (DOM.btnAnsText) DOM.btnAnsText.textContent = "Mostrar Respuesta";
        if (DOM.eyeOpen) DOM.eyeOpen.classList.remove('hidden');
        if (DOM.eyeClosed) DOM.eyeClosed.classList.add('hidden');
        actualizarBadges();
    }
}

// Evaluar los signos y actualizar el texto y clases de los badges basados en guías internacionales
function actualizarBadges() {
    // 1. Frecuencia Cardíaca (Guía AHA: Normal 60-100 LPM, Bradicardia < 60 LPM, Taquicardia > 100 LPM)
    let lpmStatus = 'normal';
    let lpmText = 'Normal';
    if (state.lpm < 60) {
        lpmStatus = 'bajo';
        lpmText = 'Bradicardia';
    } else if (state.lpm > 100) {
        lpmStatus = 'elevado';
        lpmText = 'Taquicardia';
    }
    actualizarElementoBadge('badgeLpm', 'sketchBadgeLpm', lpmStatus, lpmText);
    
    // 2. Presión Arterial (Guías ESC/ESH - Sociedad Europea de Cardiología)
    // - PA Óptima: PAS < 120 y PAD < 80 mmHg
    // - PA Normal: PAS 120-129 y/o PAD 80-84 mmHg
    // - PA Normal Alta: PAS 130-139 y/o PAD 85-89 mmHg
    // - Hipertensión Grado 1 (E1): PAS 140-159 y/o PAD 90-99 mmHg
    // - Hipertensión Grado 2 (E2): PAS 160-179 y/o PAD 100-109 mmHg
    // - Hipertensión Grado 3 (E3): PAS >= 180 y/o PAD >= 110 mmHg
    // - Hipotensión: PAS < 90 o PAD < 60 mmHg
    let paStatus = 'normal';
    let paText = 'PA Normal';
    if (state.paSys < 90 || state.paDia < 60) {
        paStatus = 'bajo';
        paText = 'Hipotensión';
    } else if (state.paSys >= 180 || state.paDia >= 110) {
        paStatus = 'elevado';
        paText = 'Hipertensión G3';
    } else if ((state.paSys >= 160 && state.paSys <= 179) || (state.paDia >= 100 && state.paDia <= 109)) {
        paStatus = 'elevado';
        paText = 'Hipertensión G2';
    } else if ((state.paSys >= 140 && state.paSys <= 159) || (state.paDia >= 90 && state.paDia <= 99)) {
        paStatus = 'elevado';
        paText = 'Hipertensión G1';
    } else if ((state.paSys >= 130 && state.paSys <= 139) || (state.paDia >= 85 && state.paDia <= 89)) {
        paStatus = 'normal';
        paText = 'PA Normal Alta';
    } else if ((state.paSys >= 120 && state.paSys <= 129) || (state.paDia >= 80 && state.paDia <= 84)) {
        paStatus = 'normal';
        paText = 'PA Normal';
    } else {
        paStatus = 'normal';
        paText = 'PA Óptima';
    }
    actualizarElementoBadge('badgePa', 'sketchBadgePa', paStatus, paText);

    // 3. Saturación SpO2 (Guías OMS y Oxigenoterapia clínica)
    // - Normal: 95% - 100%
    // - Hipoxia Leve: 90% - 94%
    // - Hipoxia Grave: < 90%
    let sato2Status = 'normal';
    let sato2Text = 'Normal';
    if (state.sato2 < 90) {
        sato2Status = 'bajo';
        sato2Text = 'Hipoxia Grave';
    } else if (state.sato2 < 95) {
        sato2Status = 'bajo';
        sato2Text = 'Hipoxia Leve';
    }
    actualizarElementoBadge('badgeSato2', 'sketchBadgeSato2', sato2Status, sato2Text);

    // 4. Frecuencia Respiratoria (Rango clínico estándar adultos)
    // - Normal: 12 - 20 rpm
    // - Bradipnea: < 12 rpm
    // - Taquipnea: > 20 rpm
    let frStatus = 'normal';
    let frText = 'Normal';
    if (state.fr < 12) {
        frStatus = 'bajo';
        frText = 'Bradipnea';
    } else if (state.fr > 20) {
        frStatus = 'elevado';
        frText = 'Taquipnea';
    }
    actualizarElementoBadge('badgeFr', 'sketchBadgeFr', frStatus, frText);

    // 5. Temperatura (Criterio OMS / Consenso Clínico Simplificado)
    // - Normal: 36.0 °C - 37.2 °C
    // - Hipotermia: < 36.0 °C (Hipotermia Grave: < 35.0 °C)
    // - Fiebre: >= 37.3 °C
    let tempStatus = 'normal';
    let tempText = 'Normal';
    if (state.temp < 35.0) {
        tempStatus = 'bajo';
        tempText = 'Hipotermia G.';
    } else if (state.temp < 36.0) {
        tempStatus = 'bajo';
        tempText = 'Hipotermia';
    } else if (state.temp >= 37.3) {
        tempStatus = 'elevado';
        tempText = 'Fiebre';
    }
    actualizarElementoBadge('badgeTemp', 'sketchBadgeTemp', tempStatus, tempText);

    // 6. Glicemia (Consenso Clínico Simplificado)
    // - Normal: 70 - 99 mg/dL
    // - Hipoglicemia: < 70 mg/dL
    // - Hiperglicemia: >= 100 mg/dL
    let gluStatus = 'normal';
    let gluText = 'Normal';
    if (state.glu < 70) {
        gluStatus = 'bajo';
        gluText = 'Hipoglicemia';
    } else if (state.glu >= 100) {
        gluStatus = 'elevado';
        gluText = 'Hiperglicemia';
    }
    actualizarElementoBadge('badgeGlu', 'sketchBadgeGlu', gluStatus, gluText);
    
    // Evaluar y actualizar el estado general del paciente
    actualizarEstadoGeneral();
}

// Auxiliar para inyectar clases y texto en los DOM de badges
function actualizarElementoBadge(monitorId, sketchId, status, labelText) {
    const monitorBadge = document.getElementById(monitorId);
    const sketchBadge = document.getElementById(sketchId);
    
    // Clases correspondientes
    const classSuffix = status === 'normal' ? 'badge-normal' : (status === 'bajo' ? 'badge-bajo' : 'badge-elevado');
    
    if (monitorBadge) {
        monitorBadge.className = `answer-badge ${classSuffix}`;
        monitorBadge.textContent = labelText;
        
        // Agregar clases de estado al contenedor principal (.vital-card)
        const vitalCard = monitorBadge.closest('.vital-card');
        if (vitalCard) {
            vitalCard.classList.remove('status-card-normal', 'status-card-altered');
            if (status === 'normal') {
                vitalCard.classList.add('status-card-normal');
            } else {
                vitalCard.classList.add('status-card-altered');
            }
        }
    }
    
    if (sketchBadge) {
        sketchBadge.className = `sketch-badge ${classSuffix}`;
        // En modo sketch se ve manuscrito como "[NORMAL]" o "[FIEBRE]"
        sketchBadge.textContent = `[${labelText}]`;
        
        // Agregar clases de estado al contenedor principal de bosquejo (.sketch-item o .sketch-vertical-value-container)
        const sketchParent = sketchBadge.closest('.sketch-item') || sketchBadge.closest('.sketch-vertical-value-container');
        if (sketchParent) {
            sketchParent.classList.remove('status-sketch-normal', 'status-sketch-altered');
            if (status === 'normal') {
                sketchParent.classList.add('status-sketch-normal');
            } else {
                sketchParent.classList.add('status-sketch-altered');
            }
        }
    }
}

// Evaluar estabilidad general del paciente
function actualizarEstadoGeneral() {
    if (!DOM.patientStatus) return;
    
    if (!state.showAnswers) {
        DOM.patientStatus.textContent = "EVALUACIÓN PENDIENTE";
        DOM.patientStatus.className = "patient-status-badge status-pending";
        return;
    }
    
    // Evaluar si está estable o inestable según rangos clínicos normales internacionales
    const isUnstable = 
        (state.lpm < 60 || state.lpm > 100) ||
        (state.paSys < 90 || state.paDia < 60 || state.paSys >= 140 || state.paDia >= 90) ||
        (state.sato2 < 95) ||
        (state.fr < 12 || state.fr > 20) ||
        (state.temp < 36.0 || state.temp >= 37.3) ||
        (state.glu < 70 || state.glu >= 100);
        
    if (isUnstable) {
        DOM.patientStatus.textContent = "PACIENTE CON SIGNOS ALTERADOS";
        DOM.patientStatus.className = "patient-status-badge status-critical";
    } else {
        DOM.patientStatus.textContent = "PACIENTE ESTABLE";
        DOM.patientStatus.className = "patient-status-badge status-stable";
    }
}

// Alternar el modo de pantalla completa
function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// Actualizar visualmente el botón de pantalla completa
function actualizarBotonFullscreen() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFullscreen) {
        if (DOM.fullscreenStatusText) DOM.fullscreenStatusText.textContent = "Salir";
        if (DOM.fullscreenIconPath) {
            // Ícono de salir de pantalla completa
            DOM.fullscreenIconPath.setAttribute('d', 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z');
        }
    } else {
        if (DOM.fullscreenStatusText) DOM.fullscreenStatusText.textContent = "Pantalla Completa";
        if (DOM.fullscreenIconPath) {
            // Ícono de entrar a pantalla completa
            DOM.fullscreenIconPath.setAttribute('d', 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z');
        }
    }
}
