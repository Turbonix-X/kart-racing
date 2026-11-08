// ============================================================
//  Physique d'un véhicule. Aucun lien avec le rendu : ce fichier
//  peut tourner sans écran (c'est ce que font les tests).
//  Conventions : cap 0 = vers +z ; steer > 0 = cap qui augmente.
// ============================================================
import { getSpec } from './config.js';

const GRAVITY = 28;
export const HOP = 6.2;              // petit bond du saut synchro (environ 0,45 s en l'air)
const STOP_BEFORE_REVERSE = 0.25;      // pause avant de passer en marche arrière
const DRIFT_MIN_SPEED = 18;
export const DRIFT_TIER1 = 0.7;
export const DRIFT_TIER2 = 1.5;

export function createVehicle(type, x, z, heading) {
    return {
        type, spec: getSpec(type), x, z, y: 0, vy: 0, heading, vx: 0, vz: 0,
        speed: 0, lateral: 0, steer: 0, accelG: 0, throttle: 0,
        zap: 0, ghost: 0, magnet: 0, gripMult: 1, offMult: 1, hopped: false,
        drifting: false, driftDir: 0, driftCharge: 0, driftBoostTier: 0,
        boost: 0, shield: 0, spin: 0, reverseTimer: 0, perf: 1,
        onRoad: true, impact: 0, landed: 0, braking: false, wheelAngle: 0, jumped: false,
    };
}

export function giveBoost(v, seconds) { v.boost = Math.max(v.boost, seconds); }

export function spinOut(v) {
    if (v.shield > 0 || v.spin > 0 || v.ghost > 0) return false;
    v.spin = 0.9;
    v.vx *= 0.55; v.vz *= 0.55;
    if (v.drifting) { v.drifting = false; v.driftCharge = 0; }
    return true;
}

/** Avance le véhicule de `dt` secondes. Le temps de `dt` est fixe : le rendu n'a aucune influence. */
export function stepVehicle(v, inp, dt) {
    const s = v.spec;
    v.landed = 0; v.jumped = false; v.driftBoostTier = 0; v.impact = 0; v.braking = false; v.hopped = false;
    for (const k of ['boost', 'shield', 'zap', 'ghost', 'magnet']) if (v[k] > 0) v[k] = Math.max(0, v[k] - dt);

    let throttle = inp.throttle, brake = inp.brake, steerIn = inp.steer;
    const spinning = v.spin > 0;
    if (spinning) { v.spin -= dt; throttle = 0; brake = 0; steerIn = 0; }
    v.throttle = throttle;

    v.steer += (steerIn - v.steer) * Math.min(1, dt * (Math.abs(steerIn) > Math.abs(v.steer) ? 7 : 12));

    // --- En l'air : pas d'adhérence, seule la gravité agit ---
    if (v.y > 0 || v.vy > 0) {
        v.heading += v.steer * 0.6 * dt;
        v.vy -= GRAVITY * dt;
        v.y += v.vy * dt;
        if (v.y <= 0) {
            v.landed = Math.max(0.01, -v.vy);
            v.y = 0; v.vy = 0;
        }
        v.x += v.vx * dt; v.z += v.vz * dt;
        const sinA = Math.sin(v.heading), cosA = Math.cos(v.heading);
        v.speed = v.vx * sinA + v.vz * cosA;
        v.lateral = v.vx * cosA - v.vz * sinA;
        v.wheelAngle += v.speed * dt * 0.8;
        return;
    }

    if (inp.jump && s.jump > 0 && !spinning) { v.vy = s.jump; v.y = 0.001; v.jumped = true; }
    // Saut synchro : un petit bond au moment où l'on appuie sur le bouton de drift
    else if (inp.hop && !spinning) { v.vy = HOP; v.y = 0.001; v.hopped = true; }

    const sin0 = Math.sin(v.heading), cos0 = Math.cos(v.heading);
    let vF = v.vx * sin0 + v.vz * cos0;
    const prevF = vF;

    // --- Moteur : la vitesse de pointe dépend de la stat Vitesse, le temps pour l'atteindre de la stat Accél. ---
    const slow = v.zap > 0 ? 0.6 : 1;
    let top = (v.onRoad ? s.topSpeed : s.offroadTop * v.offMult) * v.perf * slow;
    let acc = (v.onRoad ? s.accel : s.offroadAccel) * v.perf * slow;
    if (v.boost > 0) { top = Math.max(top, s.topSpeed * v.perf * (v.onRoad ? 1 : 0.75)) * 1.25; acc = acc * 1.8 + 8; }

    if (throttle > 0) {
        if (vF < 0) vF = Math.min(0, vF + s.brake * throttle * dt);
        else if (vF < top) vF += acc * throttle * (1 - (vF / top) * (vF / top)) * dt;
    }

    // --- Frein puis marche arrière, deux actions bien distinctes ---
    if (brake > 0) {
        if (vF > 0.5) {
            vF = Math.max(0, vF - s.brake * brake * dt);
            v.reverseTimer = 0;
            v.braking = true;
        } else {
            v.reverseTimer += dt;
            if (v.reverseTimer >= STOP_BEFORE_REVERSE) vF = Math.max(-top * 0.3, vF - s.reverseAccel * brake * dt);
        }
    } else v.reverseTimer = 0;

    // --- Trop vite pour la surface (ex. sortie dans l'herbe) : on ralentit progressivement ---
    if (vF > top) vF = Math.max(top, vF - (v.onRoad ? 18 : 55) * dt);
    if (vF < -top * 0.3) vF = Math.min(-top * 0.3, vF + 40 * dt);

    // --- Roue libre ---
    if (throttle === 0 && brake === 0) {
        const drag = (v.onRoad ? 3 : 12) * dt;
        vF = Math.abs(vF) <= drag ? 0 : vF - Math.sign(vF) * drag;
    }

    // --- Drift : déclenché avec le bouton + une direction, il charge un boost ---
    if (!v.drifting && inp.drift && Math.abs(v.steer) > 0.25 && vF > DRIFT_MIN_SPEED && !spinning) {
        v.drifting = true;
        v.driftDir = Math.sign(v.steer);
        v.driftCharge = 0;
    }
    if (v.drifting) {
        if (!inp.drift || vF < 10 || spinning) {
            v.drifting = false;
            if (v.driftCharge >= DRIFT_TIER2) { giveBoost(v, 1.1); v.driftBoostTier = 2; }
            else if (v.driftCharge >= DRIFT_TIER1) { giveBoost(v, 0.6); v.driftBoostTier = 1; }
            v.driftCharge = 0;
        } else {
            if (v.onRoad) v.driftCharge += s.chargeRate * dt;
            vF -= s.driftDrag * dt;
        }
    }

    // --- Direction : aucune rotation à l'arrêt, moins de braquage à haute vitesse, inversée en marche arrière ---
    const absF = Math.abs(vF);
    const lowFactor = Math.min(1, absF / 14);
    const ratio = Math.min(1, absF / s.topSpeed);
    const highFactor = 1 - (1 - s.highYaw) * ratio * ratio;
    let yaw;
    if (v.drifting) {
        yaw = (v.driftDir * 0.45 + v.steer * 0.4) * s.yaw * s.driftYaw * (0.4 + 0.6 * highFactor);
    } else {
        yaw = v.steer * s.yaw * lowFactor * highFactor * (vF >= 0 ? 1 : -1) * (v.onRoad ? 1 : 0.85);
    }
    if (v.spin > 0) yaw = 7;
    v.heading += yaw * dt;

    // --- La vitesse reste celle d'avant le virage : la voiture glisse, puis l'adhérence la ramène ---
    const sinH = Math.sin(v.heading), cosH = Math.cos(v.heading);
    const worldX = v.vx - sin0 * (v.vx * sin0 + v.vz * cos0) + sin0 * vF;
    const worldZ = v.vz - cos0 * (v.vx * sin0 + v.vz * cos0) + cos0 * vF;
    let newF = worldX * sinH + worldZ * cosH;
    let newL = worldX * cosH - worldZ * sinH;
    const grip = (v.spin > 0 ? 1.5 : v.drifting ? s.driftGrip : (v.onRoad ? s.grip : s.grip * 0.7)) * v.gripMult;
    const dampedL = newL * Math.exp(-grip * dt);
    // L'élan latéral absorbé revient en partie vers l'avant : un drift garde sa vitesse
    if (newF > 0) newF += Math.abs(newL - dampedL) * (v.drifting ? 0.85 : 0.25);
    newL = dampedL;

    v.vx = sinH * newF + cosH * newL;
    v.vz = cosH * newF - sinH * newL;
    v.x += v.vx * dt;
    v.z += v.vz * dt;
    v.speed = newF;
    v.lateral = newL;
    v.accelG = (newF - prevF) / dt;
    v.wheelAngle += newF * dt * 0.8;
}

/** Choc latéral d'un mur / obstacle : renvoie le véhicule et conserve une partie de sa vitesse. */
export function bounce(v, nx, nz, restitution, keep) {
    const vn = v.vx * nx + v.vz * nz;
    if (vn >= 0) return 0;              // on s'éloigne déjà du mur
    const tx = v.vx - vn * nx, tz = v.vz - vn * nz;
    v.vx = tx * keep - vn * restitution * nx;
    v.vz = tz * keep - vn * restitution * nz;
    return -vn;
}
