// ============================================
// KART RACING Alpha 1.4 — Main Game Module
// ============================================
import * as THREE from 'three';
import { MAP_LIMIT, COLORS, CAR_STATS, getPhysics } from './constants.js';
import { buildKartModel } from './cars.js';
import { isOnTrack, hasLaps, buildZigzagSegments } from './tracks.js';
import { getBestTime, saveBestTime, formatTime } from './besttime.js';
import { spawnDriftMarks, updateDriftMarks } from './drift.js';
import { addDecorations } from './decorations.js';
import { initAudio, updateEngineSound, suspendAudio, resumeAudio } from './audio.js';

// --- STATE ---
let selectedColor = COLORS[0];
let gameStarted = false, gameEnded = false, isCinematic = false;
let paused = false;
let laps = 0, totalLaps = 3, checkpointReached = false;
let carType = 'f1', trackChoice = 'ovale';
let vel = 0, jumpVel = 0, startTime = 0, pausedTimeAccum = 0, pauseStart = 0;
let driftMarkCounter = 0;

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(50, 100, 50);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
scene.add(sun);
scene.fog = new THREE.Fog(0x87ceeb, 200, 600);

let kart = new THREE.Group();

// --- DOM REFS ---
const menuEl = document.getElementById('menu');
const endScreen = document.getElementById('end-screen');
const countdownEl = document.getElementById('countdown');
const homeBtnEl = document.getElementById('home-btn');
const uiEl = document.getElementById('ui');
const speedVal = document.getElementById('speed-val');
const lapUi = document.getElementById('lap-ui');
const lapVal = document.getElementById('lap-val');
const totalLapsUi = document.getElementById('total-laps-ui');
const offroadWarn = document.getElementById('offroad-warn');
const finalTime = document.getElementById('final-time');
const timerVal = document.getElementById('timer-val');
const bestTimeMenu = document.getElementById('best-time-display');
const endBestTime = document.getElementById('end-best-time');
const pauseOverlay = document.getElementById('pause-overlay');
const confirmOverlay = document.getElementById('confirm-overlay');

// --- COLOR PICKER ---
const picker = document.getElementById('colorPicker');
COLORS.forEach((col, i) => {
    const btn = document.createElement('div');
    btn.className = 'color-btn';
    if (i === 0) btn.classList.add('selected');
    btn.style.backgroundColor = '#' + col.toString(16).padStart(6, '0');
    btn.onclick = () => {
        selectedColor = col;
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateBestTimeDisplay();
    };
    picker.appendChild(btn);
});

// --- CAR STATS DISPLAY ---
window.updateCarStats = function () {
    const type = document.getElementById('carShape').value;
    const s = CAR_STATS[type];
    const statsDiv = document.getElementById('carStatsDisplay');
    const barColor = (val) => val > 70 ? '#2ecc71' : val > 40 ? '#f39c12' : '#e74c3c';
    statsDiv.innerHTML = `
        <span class="label">Vitesse</span><div class="bar-bg"><div class="bar-fill" style="width:${s.speed}%;background:${barColor(s.speed)}"></div></div>
        <span class="label">Accél.</span><div class="bar-bg"><div class="bar-fill" style="width:${s.accel}%;background:${barColor(s.accel)}"></div></div>
        <span class="label">Maniab.</span><div class="bar-bg"><div class="bar-fill" style="width:${s.handling}%;background:${barColor(s.handling)}"></div></div>
        <span class="label">Hors-piste</span><div class="bar-bg"><div class="bar-fill" style="width:${s.offroad}%;background:${barColor(s.offroad)}"></div></div>
        <span class="label">Drift</span><div class="bar-bg"><div class="bar-fill" style="width:${s.drift}%;background:${barColor(s.drift)}"></div></div>
        <div style="grid-column:1/3;color:#888;font-style:italic;margin-top:4px;font-size:11px">${s.desc}${s.canJump ? ' 🦘' : ''}</div>
    `;
    updateBestTimeDisplay();
};

window.toggleLapMenu = (val) => {
    document.getElementById('lapMenu').style.display = val === 'infinie' ? 'none' : (val === 'zigzag' ? 'none' : 'block');
    updateBestTimeDisplay();
};

function updateBestTimeDisplay() {
    const track = document.getElementById('trackType').value;
    const car = document.getElementById('carShape').value;
    const best = getBestTime(track, car);
    if (best !== null) {
        bestTimeMenu.textContent = `Record : ${formatTime(best)}`;
    } else {
        bestTimeMenu.textContent = 'Pas encore de record';
    }
}

// --- WORLD CREATION ---
function createWorld() {
    const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ color: 0x2d5a27 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    const limitGeo = new THREE.CylinderGeometry(MAP_LIMIT, MAP_LIMIT, 50, 64, 1, true);
    const limitMat = new THREE.MeshBasicMaterial({ color: 0x8e44ad, wireframe: true, transparent: true, opacity: 0.15 });
    const limitWall = new THREE.Mesh(limitGeo, limitMat);
    limitWall.position.y = 25;
    scene.add(limitWall);

    const trackPoints = [];
    if (trackChoice === 'ovale') {
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            trackPoints.push(new THREE.Vector3(Math.cos(a) * 180, 0.02, Math.sin(a) * 120));
        }
    } else if (trackChoice === 'zigzag') {
        for (let i = 0; i < 15; i++) {
            trackPoints.push(new THREE.Vector3(i * 50 - 300, 0.02, (i % 2 === 0 ? 60 : -60)));
        }
        buildZigzagSegments();
    } else {
        trackPoints.push(new THREE.Vector3(0, 0.02, -500));
        trackPoints.push(new THREE.Vector3(0, 0.02, 5000));
    }

    const trackCurve = new THREE.CatmullRomCurve3(trackPoints);
    const trackGeo = new THREE.TubeGeometry(trackCurve, 200, 20, 8, trackChoice === 'ovale');
    const trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    trackMesh.scale.y = 0.01;
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    if (trackChoice === 'infinie') {
        const wallL = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 6000), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
        wallL.position.set(-22, 2.5, 2500); scene.add(wallL);
        const wallR = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 6000), new THREE.MeshStandardMaterial({ color: 0x8e44ad }));
        wallR.position.set(22, 2.5, 2500); scene.add(wallR);
    }

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.5), lineMat);
    startLine.rotation.x = -Math.PI / 2;

    if (trackChoice === 'ovale') {
        startLine.position.set(180, 0.05, 0); scene.add(startLine);
    } else if (trackChoice === 'zigzag') {
        startLine.position.set(-300, 0.05, 60); scene.add(startLine);
        const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(40, 2), new THREE.MeshBasicMaterial({ color: 0xf1c40f }));
        finishLine.rotation.x = -Math.PI / 2;
        finishLine.position.set(400, 0.05, (14 % 2 === 0 ? 60 : -60)); scene.add(finishLine);
    } else {
        startLine.position.set(0, 0.05, -20); scene.add(startLine);
    }

    // Grass decorations
    addDecorations(scene);
}

function buildKart() {
    scene.remove(kart);
    kart = buildKartModel(carType, selectedColor);

    if (trackChoice === 'ovale') kart.position.set(180, 0, -20);
    else if (trackChoice === 'zigzag') kart.position.set(-300, 0, 40);
    else kart.position.set(0, 0, -40);

    scene.add(kart);
}

// --- CONTROLS ---
const keys = {};
window.onkeydown = (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && carType === 'truck' && kart.position.y < 0.1 && gameStarted && !paused) {
        jumpVel = 0.3;
    }
    if (e.code === 'Escape' && gameStarted && !gameEnded) {
        togglePause();
    }
};
window.onkeyup = (e) => keys[e.code] = false;

// --- PAUSE ---
function togglePause() {
    if (confirmOverlay.style.display === 'flex') return; // don't toggle during confirm
    paused = !paused;
    if (paused) {
        pauseStart = Date.now();
        pauseOverlay.style.display = 'flex';
        suspendAudio();
    } else {
        pausedTimeAccum += Date.now() - pauseStart;
        pauseOverlay.style.display = 'none';
        resumeAudio();
    }
}

window.resumeGame = function () {
    if (paused) togglePause();
};

window.pauseToMenu = function () {
    showConfirm('Abandonner la course ?', () => {
        window.location.reload();
    }, () => {
        // stay paused, close confirm
    });
};

// --- CONFIRM DIALOG ---
let confirmYesCb = null, confirmNoCb = null;

function showConfirm(message, onYes, onNo) {
    document.getElementById('confirm-message').textContent = message;
    confirmOverlay.style.display = 'flex';
    confirmYesCb = onYes;
    confirmNoCb = onNo;
}

window.confirmYes = function () {
    confirmOverlay.style.display = 'none';
    if (confirmYesCb) confirmYesCb();
};

window.confirmNo = function () {
    confirmOverlay.style.display = 'none';
    if (confirmNoCb) confirmNoCb();
};

// Home button with confirmation
homeBtnEl.onclick = () => {
    if (gameStarted && !gameEnded) {
        if (!paused) togglePause();
        showConfirm('Abandonner la course ?', () => {
            window.location.reload();
        }, () => {
            // stay paused
        });
    } else {
        window.location.reload();
    }
};

// --- LAUNCH ---
document.getElementById('start-btn').onclick = () => {
    trackChoice = document.getElementById('trackType').value;
    carType = document.getElementById('carShape').value;
    totalLaps = parseInt(document.getElementById('lapCount').value);
    totalLapsUi.innerText = totalLaps;

    createWorld();
    buildKart();
    menuEl.style.display = 'none';
    homeBtnEl.style.display = 'block';
    uiEl.style.display = 'block';

    // Hide lap UI for non-lap tracks
    if (!hasLaps(trackChoice)) {
        lapUi.style.display = 'none';
    } else {
        lapUi.style.display = 'block';
    }

    isCinematic = true;

    // Init audio on first user interaction
    initAudio();

    countdownEl.style.display = 'block';
    let c = 3;
    const timer = setInterval(() => {
        c--;
        countdownEl.innerText = c > 0 ? c : "GO!";
        if (c < 0) {
            clearInterval(timer);
            countdownEl.style.display = 'none';
            isCinematic = false;
            gameStarted = true;
            startTime = Date.now();
            pausedTimeAccum = 0;
        }
    }, 1000);
};

// --- GAME LOOP ---
function getElapsedMs() {
    if (!gameStarted) return 0;
    const now = paused ? pauseStart : Date.now();
    return now - startTime - pausedTimeAccum;
}

function update() {
    if (isCinematic) {
        const t = Date.now() * 0.001;
        camera.position.set(kart.position.x + Math.cos(t) * 15, 8, kart.position.z + Math.sin(t) * 15);
        camera.lookAt(kart.position);
    }
    if (!gameStarted || gameEnded || paused) return;

    // Track detection
    const onTrack = isOnTrack(trackChoice, kart.position);
    offroadWarn.style.display = onTrack ? 'none' : 'block';

    // Physics from carStats (FIX: no more hardcoded values)
    const physics = getPhysics(carType, onTrack);
    const maxS = physics.maxSpeed;
    const acc = physics.acceleration;
    const turnRate = physics.turnRate;

    if (keys['KeyW'] || keys['ArrowUp'] || keys['ControlLeft']) vel += acc;
    if (keys['KeyS'] || keys['ArrowDown']) vel -= acc;

    // Braking / drift
    const isDrifting = keys['ShiftLeft'] && (keys['KeyA'] || keys['ArrowLeft'] || keys['KeyD'] || keys['ArrowRight']);
    if (keys['ShiftLeft']) {
        vel *= carType === 'drift' ? 0.92 : 0.85;
    } else {
        vel *= 0.98;
    }
    vel = Math.max(-maxS / 2, Math.min(maxS, vel));

    if (Math.abs(vel) > 0.02) {
        const t = (keys['KeyA'] || keys['ArrowLeft']) ? turnRate : (keys['KeyD'] || keys['ArrowRight']) ? -turnRate : 0;
        kart.rotation.y += t;
    }
    kart.translateZ(vel);

    // Drift tire marks (only for Drift King while drifting)
    if (carType === 'drift' && isDrifting && Math.abs(vel) > 0.15) {
        driftMarkCounter++;
        if (driftMarkCounter % 3 === 0) { // spawn every 3 frames for performance
            spawnDriftMarks(scene, kart);
        }
    }
    updateDriftMarks(scene);

    // Gravity & Jump (Truck)
    kart.position.y += jumpVel;
    if (kart.position.y > 0) jumpVel -= 0.015;
    else { kart.position.y = 0; jumpVel = 0; }

    // World limits
    if (kart.position.length() > MAP_LIMIT) { vel = -0.1; kart.translateZ(-5); }

    // Laps / Victory
    if (trackChoice === 'ovale') {
        if (kart.position.x < -100) checkpointReached = true;
        if (checkpointReached && Math.abs(kart.position.x - 180) < 20 && Math.abs(kart.position.z) < 10) {
            laps++;
            lapVal.innerText = laps;
            checkpointReached = false;
            if (laps >= totalLaps) finish();
        }
    } else if (trackChoice === 'zigzag') {
        if (kart.position.x > 380) finish();
    }

    // Camera
    if (!isCinematic) {
        const offset = new THREE.Vector3(0, 5, -12).applyQuaternion(kart.quaternion);
        camera.position.lerp(kart.position.clone().add(offset), 0.1);
        camera.lookAt(kart.position);
    }

    // UI
    speedVal.innerText = Math.round(Math.abs(vel) * 450);
    timerVal.innerText = formatTime(getElapsedMs());

    // Engine sound
    updateEngineSound(vel);
}

function finish() {
    gameEnded = true;
    const elapsed = getElapsedMs();
    finalTime.innerText = formatTime(elapsed);

    // Best time
    const isRecord = saveBestTime(trackChoice, carType, elapsed);
    if (isRecord) {
        endBestTime.innerHTML = '<span class="new-record">NOUVEAU RECORD !</span>';
    } else {
        const best = getBestTime(trackChoice, carType);
        endBestTime.innerHTML = `Record : ${formatTime(best)}`;
    }

    endScreen.style.display = 'flex';
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}
animate();

// Init display
updateCarStats();
updateBestTimeDisplay();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
