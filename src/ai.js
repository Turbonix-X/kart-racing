// ============================================================
//  Pilote automatique : il utilise exactement les mêmes commandes
//  et la même physique qu'un joueur. Il anticipe les virages,
//  évite les obstacles, utilise ses bonus et se sort des murs.
// ============================================================
import { DIFFICULTIES } from './config.js';

export function createBrain(slot, difficulty) {
    const d = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
    return {
        lane: ((slot * 0.37) % 1) * 1.1 - 0.55,   // couloir préféré, propre à chaque pilote
        perf: d.perf,
        corner: d.corner,
        stuck: 0, reversing: 0, unstuck: 0, itemDelay: 2 + (slot % 4),
    };
}

function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
}

export function aiControl(car, sim, out, dt) {
    const v = car.v, nav = car.nav, t = sim.track, b = car.brain;
    out.drift = false; out.hop = false; out.jump = false; out.useItem = false; out.respawn = false;

    // Après l'arrivée : ralentit tranquillement dans l'axe
    const cruising = car.finished;

    // Coincé contre un mur : recule, puis réapparaît sur la piste en dernier recours
    if (!cruising && Math.abs(v.speed) < 2.5 && sim.time > 1 && v.spin <= 0) b.stuck += dt;
    else if (b.reversing <= 0) b.stuck = 0;
    if (b.stuck > 1.2 && b.reversing <= 0) { b.reversing = 1; b.unstuck++; b.stuck = 0; }
    if (b.unstuck >= 3) { out.respawn = true; b.unstuck = 0; }

    const speed = Math.max(0, v.speed);
    const look = 10 + speed * 0.42;
    const tIdx = nav.idx + Math.round(look / t.spacing);
    const i = t.wrap(tIdx);

    // Couloir de course, en évitant ce qui est sur la route devant
    let lane = b.lane * Math.max(0, t.w[i] - 3);
    if (!t.closed && nav.s > t.finishS) lane = 0;
    for (const o of t.obstacles) {
        const dx = o.x - v.x, dz = o.z - v.z, ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
        if (ahead > 0 && ahead < 55 + speed * 0.4 && Math.hypot(o.x - t.x[i], o.z - t.z[i]) < 40) {
            const oLat = (o.x - nav.px) * nav.tz - (o.z - nav.pz) * nav.tx;
            if (Math.abs(oLat - lane) < o.r + 5) {
                const side = oLat >= 0 ? -1 : 1;
                const candidate = oLat + side * (o.r + 5);
                lane = Math.abs(candidate) > t.w[i] - 2 ? oLat - side * (o.r + 5) : candidate;
            }
        }
    }
    for (const o of sim.oils) {
        const dx = o.x - v.x, dz = o.z - v.z, ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
        if (ahead > 0 && ahead < 45 && Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading)) < 8) {
            const oLat = (o.x - nav.px) * nav.tz - (o.z - nav.pz) * nav.tx;
            if (Math.abs(oLat - lane) < o.r + 3) lane = oLat + (oLat >= 0 ? -1 : 1) * (o.r + 3.5);
        }
    }
    if (nav.d > nav.width) lane *= 0.3;

    const tx = t.x[i] + t.tz[i] * lane, tz = t.z[i] - t.tx[i] * lane;
    const want = Math.atan2(tx - v.x, tz - v.z);
    const err = angleDiff(v.heading, want);

    // Vitesse visée : on regarde loin devant pour freiner à temps
    let target = cruising ? 22 : (v.onRoad ? v.spec.topSpeed : v.spec.offroadTop) * v.perf * 1.3;
    if (!cruising) {
        const brakePower = v.spec.brake * 0.55;
        const corner = b.corner * (0.7 + v.spec.grip / 24);
        const horizon = Math.round((35 + speed * 1.7) / t.spacing);
        for (let k = 0; k < horizon; k += 2) {
            const ci = t.wrap(nav.idx + k);
            const c = t.curv[ci];
            if (c > 0.0015) {
                const vc = Math.sqrt(corner / c);
                const allowed = Math.sqrt(vc * vc + 2 * brakePower * k * t.spacing);
                if (allowed < target) target = allowed;
            }
        }
    }

    if (b.reversing > 0) {
        b.reversing -= dt;
        out.throttle = 0; out.brake = 1;
        out.steer = Math.max(-1, Math.min(1, -err * 2));
        return;
    }

    out.steer = Math.max(-1, Math.min(1, err * (1.8 + speed * 0.015)));
    const absErr = Math.abs(err);
    if (absErr > 1.5 && speed < 12) target = 12;      // face au mur : on repart doucement
    if (speed > target + 2) { out.throttle = 0; out.brake = Math.min(1, (speed - target) / 10 + 0.3); }
    else { out.throttle = speed < target - 1 ? 1 : 0.4; out.brake = 0; }

    // Bonus : utilisation différée pour rester imprévisible
    if (car.item && !cruising) {
        b.itemDelay -= dt;
        if (b.itemDelay <= 0 && wantsToUse(car, sim, t, nav)) { out.useItem = true; b.itemDelay = 2 + Math.random() * 3; }
        else if (b.itemDelay < -8) { out.useItem = true; b.itemDelay = 3; }    // ne garde jamais un objet indéfiniment
    }

    // Saut du Monster Truck pour franchir un obstacle tout proche ou une flaque
    if (v.spec.jump > 0 && !cruising && v.y === 0) {
        for (const o of t.obstacles) {
            const dx = o.x - v.x, dz = o.z - v.z, ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
            if (ahead > 0 && ahead < 8 + speed * 0.25 && Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading)) < o.r + 1) out.jump = true;
        }
    }
}

/** Chaque objet a son bon moment : l'IA attend une situation où il sert vraiment. */
function wantsToUse(car, sim, t, nav) {
    const v = car.v, ahead = sim.order[car.position - 2], behind = sim.order[car.position];
    const gap = c => (c ? Math.hypot(c.v.x - v.x, c.v.z - v.z) : Infinity);
    const straight = t.curv[t.wrap(nav.idx + 25)] < 0.004;
    switch (car.item) {
        case 'turbo': return straight;
        case 'shield': return gap(behind) < 30 || Math.random() < 0.3;
        case 'oil': return gap(behind) < 35;
        case 'missile': return !!ahead && gap(ahead) < 160;
        case 'bomb': return !!ahead && gap(ahead) < 45;
        case 'zap': return car.position > 1;
        case 'magnet': return !!ahead && gap(ahead) < 80;
        case 'ghost': return gap(behind) < 25 || sim.oils.some(o => Math.hypot(o.x - v.x, o.z - v.z) < 30);
        case 'tornado': return !!ahead && gap(ahead) < 120;
        case 'spring': return straight || t.obstacles.some(o => Math.hypot(o.x - v.x, o.z - v.z) < 25);
        default: return true;
    }
}
