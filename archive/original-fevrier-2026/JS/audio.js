// ============================================
// KART RACING Alpha 1.4 — Audio (Engine + Music)
// ============================================

let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let musicGain = null;
let audioStarted = false;
let nextLoopTime = 0;
let schedulerInterval = null;

export function initAudio() {
    if (audioStarted) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioStarted = true;

    // --- ENGINE SOUND ---
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();

    // --- BACKGROUND MUSIC ---
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.08;
    musicGain.connect(audioCtx.destination);

    nextLoopTime = audioCtx.currentTime + 0.1;
    // Schedule a few loops ahead, then keep scheduling
    scheduleAhead();
    schedulerInterval = setInterval(scheduleAhead, 2000);
}

const LOOP_LEN = 4; // 16 notes * 0.25s = 4s per loop
const SCHEDULE_AHEAD = 8; // schedule 8 seconds ahead

function scheduleAhead() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
        const horizon = audioCtx.currentTime + SCHEDULE_AHEAD;
        while (nextLoopTime < horizon) {
            scheduleBassLoop(nextLoopTime);
            scheduleMelodyLoop(nextLoopTime);
            scheduleKickLoop(nextLoopTime);
            nextLoopTime += LOOP_LEN;
        }
    } catch { /* audio scheduling failed, ignore */ }
}

// Bass line
const bassNotes = [55, 55, 73.4, 65.4, 55, 55, 82.4, 73.4];
const noteLen = 0.25;

function scheduleBassLoop(startTime) {
    bassNotes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(musicGain);
        const t = startTime + i * noteLen;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + noteLen * 0.9);
        osc.start(t);
        osc.stop(t + noteLen);
    });
}

// Lead melody
const melodyNotes = [220, 0, 261.6, 293.7, 220, 0, 329.6, 293.7,
                     220, 0, 261.6, 293.7, 349.2, 329.6, 293.7, 261.6];

function scheduleMelodyLoop(startTime) {
    melodyNotes.forEach((freq, i) => {
        if (freq === 0) return;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(musicGain);
        const t = startTime + i * noteLen;
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.005, t + noteLen * 0.85);
        osc.start(t);
        osc.stop(t + noteLen);
    });
}

// Kick drum pattern
const kickPattern = [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0];

function scheduleKickLoop(startTime) {
    kickPattern.forEach((hit, i) => {
        if (!hit) return;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(g);
        g.connect(musicGain);
        const t = startTime + i * noteLen;
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.15);
    });
}

export function updateEngineSound(speed) {
    if (!audioCtx || !engineOsc) return;
    const absSpeed = Math.abs(speed);
    const freq = 60 + absSpeed * 220;
    const vol = Math.min(0.12, absSpeed * 0.15);
    engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.05);
}

export function suspendAudio() {
    if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend();
    }
}

export function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => scheduleAhead()).catch(() => {});
    }
}
