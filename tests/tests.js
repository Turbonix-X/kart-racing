// Tests de la logique pure (aucun rendu). Ouvrir tests/tests.html via le serveur local.
import { VEHICLES, getSpec, FIXED_DT, MS_TO_KMH } from '../src/config.js';
import { createVehicle, stepVehicle } from '../src/physics.js';
import { getTrack, TRACK_ORDER } from '../src/tracks.js';
import { RaceSim, createCar, gridSlot, ITEM_IDS } from '../src/sim.js';
import { BIOMES } from '../src/biomes.js';
import { Save, medalForTime, medalForPosition, computeScore, formatTime } from '../src/storage.js';

const results = [];
function test(name, fn) {
    try { const info = fn(); results.push({ name, ok: true, info: info ?? '' }); }
    catch (e) { results.push({ name, ok: false, info: e.message }); }
}
function assert(c, msg) { if (!c) throw new Error(msg); }
const INPUT = (o = {}) => ({ throttle: 0, brake: 0, steer: 0, drift: false, jump: false, useItem: false, respawn: false, ...o });
const memStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

function runTop(type, seconds = 25, onRoad = true) {
    const v = createVehicle(type, 0, 0, 0); v.onRoad = onRoad;
    let max = 0;
    for (let i = 0; i < seconds * 60; i++) { stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT); max = Math.max(max, v.speed); }
    return max;
}

function humanSim(trackId, type = 'sport', laps = 1) {
    const track = getTrack(trackId);
    const car = createCar(track, type, { human: true, playerIndex: 0, slot: 0, name: 'J1' });
    return { track, car, sim: new RaceSim({ track, laps, cars: [car] }) };
}

// ---------- Bug 1 : la stat Vitesse pilote la vitesse de pointe ----------
test('1. Vitesse de pointe classée comme la stat Vitesse', () => {
    const list = Object.keys(VEHICLES).map(t => ({ t, stat: VEHICLES[t].speed, top: runTop(t) }));
    const byStat = [...list].sort((a, b) => b.stat - a.stat).map(x => x.t).join();
    const byTop = [...list].sort((a, b) => b.top - a.top).map(x => x.t).join();
    assert(byStat === byTop, `stat ${byStat} / réel ${byTop}`);
    return list.map(x => `${x.t}:${Math.round(x.top * MS_TO_KMH)}`).join(' ');
});
test('1b. La stat Accél. change le temps pour atteindre 100 km/h', () => {
    const time = t => { const v = createVehicle(t, 0, 0, 0); let i = 0; while (v.speed * 3.6 < 100 && i < 3000) { stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT); i++; } return i / 60; };
    assert(time('muscle') < time('truck'), 'la muscle doit démarrer plus fort');
    return `muscle ${time('muscle').toFixed(2)}s, truck ${time('truck').toFixed(2)}s`;
});

// ---------- Bug 2 : indépendance à la fréquence d'écran ----------
test('2. La distance parcourue ne dépend pas de la fréquence d\'affichage', () => {
    // Le jeu accumule le temps réel et avance toujours par pas de 1/60 s
    const run = hz => {
        const v = createVehicle('f1', 0, 0, 0); let acc = 0;
        for (let f = 0; f < hz * 10; f++) {
            acc += 1 / hz;
            while (acc >= FIXED_DT - 1e-9) { stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT); acc -= FIXED_DT; }
        }
        return v.z;
    };
    const a = run(30), b = run(60), c = run(144), d = run(240);
    const spread = Math.max(a, b, c, d) - Math.min(a, b, c, d);
    assert(spread < 2.5, `écart ${spread.toFixed(2)} u`);
    return `30Hz ${a.toFixed(1)} / 60Hz ${b.toFixed(1)} / 144Hz ${c.toFixed(1)} / 240Hz ${d.toFixed(1)}`;
});

// ---------- Bug 3 : impossible de quitter le circuit ----------
for (const id of TRACK_ORDER) {
    test(`3. ${id} : on reste dans les limites, marche arrière comprise`, () => {
        const { track, car, sim } = humanSim(id, 'truck');
        let maxOver = 0;
        const inp = INPUT();
        for (let i = 0; i < 60 * 60; i++) {
            const phase = Math.floor(i / 300) % 4;
            inp.throttle = phase === 0 || phase === 2 ? 1 : 0;
            inp.brake = phase === 1 || phase === 3 ? 1 : 0;
            inp.steer = phase < 2 ? 0.8 : -0.5;
            sim.step(FIXED_DT, [inp]);
            const over = car.nav.d - car.nav.limit;
            if (!car.nav.inCorridor && over > maxOver) maxOver = over;
        }
        assert(maxOver < 0.5, `dépasse le mur de ${maxOver.toFixed(2)} u`);
    });
    test(`3b. ${id} : reculer contre le mur puis relâcher arrête le véhicule`, () => {
        const { car, sim } = humanSim(id, 'truck');
        for (let i = 0; i < 60 * 30; i++) sim.step(FIXED_DT, [INPUT({ brake: 1 })]);
        for (let i = 0; i < 60 * 8; i++) sim.step(FIXED_DT, [INPUT()]);
        assert(Math.abs(car.v.speed) < 1, `vitesse résiduelle ${car.v.speed.toFixed(1)}`);
    });
}

// ---------- Bugs 4-5 : zig-zag ----------
test('4. Tous les départs : le kart regarde dans le sens de la course', () => {
    for (const id of TRACK_ORDER) {
        const t = getTrack(id);
        const g = gridSlot(t, 0), p = t.pointAt(g.s, 0);
        const dot = Math.sin(g.heading) * p.tx + Math.cos(g.heading) * p.tz;
        assert(dot > 0.99, `${id} : dot ${dot}`);
        const q = t.locate(g.x, g.z, -1, {});
        assert(q.d < q.width, `${id} : grille hors de la piste`);
    }
});
test('5. Zig-zag : foncer tout droit ne permet pas de finir', () => {
    const { car, sim, track } = humanSim('zigzag', 'f1');
    const h0 = car.v.heading;
    for (let i = 0; i < 60 * 90 && !car.finished; i++) {
        let d = h0 - car.v.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        sim.step(FIXED_DT, [INPUT({ throttle: 1, steer: Math.max(-1, Math.min(1, d * 3)) })]);
    }
    assert(!car.finished, 'arrivée atteinte en ligne droite');
    return `avancement bloqué à ${Math.round(100 * car.maxDist / track.raceLength)} %`;
});

// ---------- Bug 6 : tours ----------
test('6. Demi-tour après la mi-parcours : aucun tour compté', () => {
    const { car, sim, track } = humanSim('ovale', 'sport', 3);
    // Pilote automatique jusqu'à 60 % du tour
    const bot = createCar(track, 'sport', { slot: 0, name: 'x' });
    const s2 = new RaceSim({ track, laps: 3, cars: [bot] });
    let i = 0;
    for (; i < 60 * 120 && bot.maxDist < track.length * 0.6; i++) s2.step(FIXED_DT, []);
    assert(bot.maxDist >= track.length * 0.6, 'n\'atteint pas la mi-parcours');
    // Téléporté dans l'autre sens : on revient vers la ligne à contresens
    bot.v.heading += Math.PI; bot.v.vx = bot.v.vz = 0;
    bot.human = true; bot.playerIndex = 0; bot.brain = null;
    const ctl = INPUT({ throttle: 1 });
    for (i = 0; i < 60 * 60; i++) {
        const n = bot.nav, want = Math.atan2(-n.tx, -n.tz);
        let d = want - bot.v.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctl.steer = Math.max(-1, Math.min(1, d * 2 - n.lat * -0.02));
        s2.step(FIXED_DT, [ctl]);
    }
    assert(bot.lapsDone === 0, `${bot.lapsDone} tour(s) compté(s) à contresens`);
    assert(bot.wrongWay, 'l\'alerte mauvais sens doit être active');
    return 'alerte Mauvais sens active, 0 tour';
});
test('6b. Couper par l\'herbe est impossible (mur)', () => {
    const { car, sim, track } = humanSim('ovale', 'truck', 1);
    const start = createVehicle('truck', 0, 0, 0);
    car.v.x = 220 - 10; car.v.z = 0; car.v.heading = -Math.PI / 2; // vers le centre
    track.locate(car.v.x, car.v.z, -1, car.nav);
    let minX = Infinity;
    for (let i = 0; i < 60 * 20; i++) { sim.step(FIXED_DT, [INPUT({ throttle: 1 })]); minX = Math.min(minX, car.v.x); }
    assert(minX > 220 - 12 - 16 - 3, `est passé à x=${minX.toFixed(1)}`);
    return `bloqué à x=${minX.toFixed(1)}`;
});

// ---------- Bug 7 : records ----------
test('7. Un temps sur 1 tour ne bat pas le record sur 3 tours', () => {
    const s = new Save(memStorage());
    s.saveRun({ track: 'ovale', car: 'f1', laps: 1, time: 20, lapTimes: [20] });
    const r = s.saveRun({ track: 'ovale', car: 'f1', laps: 3, time: 70, lapTimes: [24, 23, 23] });
    assert(r.newRecord && s.getRecord('ovale', 'f1', 3) === 70 && s.getRecord('ovale', 'f1', 1) === 20, 'clés confondues');
    assert(s.getBestLap('ovale', 'f1') === 20, 'meilleur tour');
});

// ---------- Bug 9 : drift ----------
test('9. Le drift fait glisser, conserve la vitesse et donne un boost', () => {
    const v = createVehicle('drift', 0, 0, 0);
    for (let i = 0; i < 300; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    const before = v.speed; let maxSlip = 0;
    for (let i = 0; i < 90; i++) { stepVehicle(v, INPUT({ throttle: 1, steer: 1, drift: true }), FIXED_DT); maxSlip = Math.max(maxSlip, Math.abs(v.lateral)); }
    const during = v.speed;
    assert(v.drifting, 'pas de drift');
    assert(maxSlip > 5, `glisse trop faible : ${maxSlip.toFixed(1)}`);
    assert(during > before * 0.5, `perd trop de vitesse : ${before.toFixed(0)} -> ${during.toFixed(0)}`);
    stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    assert(v.boost > 0, 'pas de boost à la sortie');
    return `glisse ${maxSlip.toFixed(0)} u/s, ${Math.round(before * 3.6)} → ${Math.round(during * 3.6)} km/h`;
});
test('9b. La stat Drift charge le boost plus vite', () => {
    assert(getSpec('drift').chargeRate > getSpec('truck').chargeRate * 1.5, 'stat sans effet');
});

// ---------- Bug 10 : Ligne Droite ----------
test('10. Ligne Droite : une arrivée existe, atteignable sans sortir', () => {
    const t = getTrack('droite');
    assert(t.finishS < t.length && t.raceLength > 1800, 'longueur');
    const bot = createCar(t, 'sport', { slot: 0, name: 'x' });
    const human = createCar(t, 'sport', { slot: 1, human: true, playerIndex: 0, name: 'J' });
    human.finished = false;
    const sim = new RaceSim({ track: t, laps: 1, cars: [bot] });
    for (let i = 0; i < 60 * 120 && !bot.finished; i++) sim.step(FIXED_DT, []);
    assert(bot.finished, `pas d'arrivée, ${Math.round(bot.maxDist)}/${Math.round(t.raceLength)}`);
    return `${bot.finishTime.toFixed(1)} s`;
});
test('10b. Les murs de la Ligne Droite sont solides', () => {
    const { car, sim } = humanSim('droite', 'f1');
    let maxLat = 0;
    for (let i = 0; i < 60 * 15; i++) { sim.step(FIXED_DT, [INPUT({ throttle: 1, steer: i % 300 < 150 ? 1 : -1 })]); maxLat = Math.max(maxLat, Math.abs(car.v.x)); }
    assert(maxLat <= 14.5 + 0.5, `x=${maxLat.toFixed(1)}`);
});

// ---------- Bug 14-15 : détection = dessin ----------
test('14-15. La détection de piste suit exactement la largeur dessinée', () => {
    for (const id of TRACK_ORDER) {
        const t = getTrack(id);
        for (let i = 3; i < t.n - 3; i += 13) {
            const nx = t.tz[i], nz = -t.tx[i], w = t.w[i];
            // On évite les points où l'autre bord du virage serré est plus proche
            if (t.curv[i] > 1 / (w + 3)) continue;
            assert(t.isOnRoad(t.x[i] + nx * (w - 0.4), t.z[i] + nz * (w - 0.4)), `${id}#${i} intérieur`);
            assert(!t.isOnRoad(t.x[i] + nx * (w + 0.8), t.z[i] + nz * (w + 0.8)), `${id}#${i} extérieur`);
        }
    }
});
test('16. Sortie de piste : la vitesse baisse progressivement', () => {
    const v = createVehicle('f1', 0, 0, 0);
    for (let i = 0; i < 900; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    const before = v.speed; v.onRoad = false;
    stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    assert(before - v.speed < 2, `chute de ${(before - v.speed).toFixed(1)} en une image`);
    for (let i = 0; i < 120; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    assert(v.speed < getSpec('f1').offroadTop + 1, 'doit finir à la vitesse hors-piste');
});
test('25. À l\'arrêt on ne pivote pas ; en marche arrière la direction s\'inverse', () => {
    const a = createVehicle('sport', 0, 0, 0);
    for (let i = 0; i < 60; i++) stepVehicle(a, INPUT({ steer: 1 }), FIXED_DT);
    assert(a.heading === 0, 'pivote à l\'arrêt');
    const b = createVehicle('sport', 0, 0, 0);
    for (let i = 0; i < 120; i++) stepVehicle(b, INPUT({ brake: 1 }), FIXED_DT);
    assert(b.speed < -3, 'pas de marche arrière');
    const h = b.heading;
    for (let i = 0; i < 30; i++) stepVehicle(b, INPUT({ brake: 1, steer: 1 }), FIXED_DT);
    assert(b.heading < h, 'direction non inversée');
});
test('27-28. Le rayon de braquage augmente avec la vitesse', () => {
    const radius = target => {
        const v = createVehicle('f1', 0, 0, 0);
        for (let i = 0; i < 2000 && v.speed < target; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
        const h = v.heading; const sp = v.speed;
        for (let i = 0; i < 30; i++) stepVehicle(v, INPUT({ throttle: 1, steer: 1 }), FIXED_DT);
        return sp / ((v.heading - h) * 2);
    };
    const r30 = radius(30), r75 = radius(75);
    assert(r75 > r30 * 1.5, `${r30.toFixed(0)} / ${r75.toFixed(0)}`);
    return `R à 30 u/s ≈ ${r30.toFixed(0)}, à 75 u/s ≈ ${r75.toFixed(0)}`;
});
test('30. Frein et marche arrière sont distincts', () => {
    const v = createVehicle('sport', 0, 0, 0);
    for (let i = 0; i < 240; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    let frames = 0;
    while (v.speed > 0.5 && frames < 600) { stepVehicle(v, INPUT({ brake: 1 }), FIXED_DT); frames++; }
    assert(v.speed >= 0, 'recule en plein freinage');
    for (let i = 0; i < 10; i++) stepVehicle(v, INPUT({ brake: 1 }), FIXED_DT);
    assert(v.speed >= -0.01, 'recule sans pause');
});
test('31. Saut : le Monster Truck franchit les rondins, pas les autres', () => {
    const go = type => {
        const t = getTrack('canyon'), car = createCar(t, type, { human: true, playerIndex: 0, slot: 0 });
        const sim = new RaceSim({ track: t, laps: 1, cars: [car] });
        car.v.x = 189; car.v.z = -44; car.v.heading = 0; t.locate(189, -44, -1, car.nav); car.lastS = car.nav.s;
        for (let i = 0; i < 60 * 8; i++) {
            const needJump = car.v.z > -30 && car.v.z < -24;
            sim.step(FIXED_DT, [INPUT({ throttle: 1, jump: needJump, steer: (189 - car.v.x) * 0.1 })]);
        }
        return car.v.z;
    };
    const truck = go('truck'), sport = go('sport');
    assert(truck > -10, `truck bloqué z=${truck.toFixed(0)}`);
    assert(sport < -15, `sport passe z=${sport.toFixed(0)}`);
    return `truck z=${truck.toFixed(0)}, sport z=${sport.toFixed(0)}`;
});

// ---------- IA : tous les véhicules bouclent tous les circuits ----------
const parTimes = {};
for (const id of TRACK_ORDER) {
    test(`33. IA : ${id}, une course complète avec 6 voitures`, () => {
        const t = getTrack(id);
        const types = ['f1', 'truck', 'sport', 'muscle', 'drift', 'kart'];
        const cars = types.map((type, i) => createCar(t, type, { slot: i, name: type, difficulty: 'hard' }));
        const sim = new RaceSim({ track: t, laps: t.closed ? 2 : 1, cars });
        for (let i = 0; i < 60 * 300 && !cars.every(c => c.finished); i++) sim.step(FIXED_DT, []);
        const missing = cars.filter(c => !c.finished);
        assert(!missing.length, `non arrivés : ${missing.map(c => `${c.name} (${Math.round(100 * c.maxDist / sim.totalLen)} %)`).join(', ')}`);
        const crash = cars.map(c => c.stats.impacts).reduce((a, b) => a + b, 0);
        const bestLap = Math.min(...cars.flatMap(c => c.lapTimes));
        parTimes[id] = bestLap;
        return cars.map(c => `${c.name} ${c.finishTime.toFixed(0)}s`).join(' · ') + ` | chocs ${crash} | meilleur tour ${bestLap.toFixed(1)}`;
    });
}
test('33b. Les difficultés changent vraiment le rythme', () => {
    const t = getTrack('ovale');
    const run = d => {
        const c = createCar(t, 'sport', { slot: 0, difficulty: d });
        const s = new RaceSim({ track: t, laps: 1, cars: [c] });
        for (let i = 0; i < 60 * 200 && !c.finished; i++) s.step(FIXED_DT, []);
        return c.finishTime;
    };
    const e = run('easy'), h = run('hard');
    assert(e > h, `facile ${e} / difficile ${h}`);
    return `facile ${e.toFixed(1)} s, difficile ${h.toFixed(1)} s`;
});
test('34. Géométrie : les portions de circuit ne se chevauchent pas', () => {
    for (const id of TRACK_ORDER) {
        const t = getTrack(id);
        for (let i = 0; i < t.n; i += 4) for (let j = i + 40; j < t.n; j += 4) {
            if (t.closed && t.n - (j - i) < 40) continue;
            const d = Math.hypot(t.x[i] - t.x[j], t.z[i] - t.z[j]);
            const gap = t.w[i] + t.w[j];
            // Deux bouts éloignés le long du tracé ne doivent pas se toucher
            assert(d > gap, `${id} : ${i}/${j} trop proches (${d.toFixed(1)} < ${gap.toFixed(1)})`);
        }
    }
});

// ---------- Bonus, plaques, tremplins ----------
test('37. Boîte bonus : ramassage, turbo, bouclier, flaque, réapparition', () => {
    const { car, sim, track } = humanSim('ovale', 'sport');
    const spot = sim.pickups[0];
    car.v.x = spot.x; car.v.z = spot.z; car.nav.idx = -1; track.locate(car.v.x, car.v.z, -1, car.nav); car.lastS = car.nav.s;
    sim.step(FIXED_DT, [INPUT()]);
    assert(car.item, 'bonus non ramassé');
    assert(spot.timer > 0, 'la boîte doit disparaître');
    car.item = 'turbo';
    sim.step(FIXED_DT, [INPUT({ useItem: true })]);
    assert(car.v.boost > 1 && !car.item, 'turbo');
    car.item = 'shield';
    sim.step(FIXED_DT, [INPUT({ useItem: true })]);
    assert(car.v.shield > 4, 'bouclier');
    car.item = 'oil';
    const n = sim.oils.length;
    sim.step(FIXED_DT, [INPUT({ useItem: true })]);
    assert(sim.oils.length === n + 1, 'flaque');
    car.item = 'shield';      // garde un bonus : ne reprend pas la boîte en restant dessus
    for (let i = 0; i < 60 * 8; i++) sim.step(FIXED_DT, [INPUT()]);
    assert(spot.timer <= 0, 'la boîte doit revenir');
});
test('37b. Flaque : fait déraper, sauf avec un bouclier ou en sautant', () => {
    const run = opts => {
        const { car, sim, track } = humanSim('droite', 'truck');
        for (let i = 0; i < 180; i++) sim.step(FIXED_DT, [INPUT({ throttle: 1 })]);
        const v = car.v;
        sim.oils.push({ x: v.x + Math.sin(v.heading) * 6, z: v.z + Math.cos(v.heading) * 6, r: 3.2, age: -1, owner: null });
        if (opts.shield) v.shield = 5;
        let spun = false;
        for (let i = 0; i < 60; i++) { sim.step(FIXED_DT, [INPUT({ throttle: 1, jump: opts.jump && i === 0 })]); if (v.spin > 0) spun = true; }
        return spun;
    };
    assert(run({}), 'doit déraper');
    assert(!run({ shield: true }), 'le bouclier protège');
    assert(!run({ jump: true }), 'le saut passe au-dessus');
});
test('37c. Plaque de boost et tremplin', () => {
    const { car, sim, track } = humanSim('droite', 'f1');
    const pad = track.pads[0];
    car.v.x = pad.x; car.v.z = pad.z; car.v.vz = 30; car.v.heading = 0;
    car.nav.idx = -1; track.locate(car.v.x, car.v.z, -1, car.nav); car.lastS = car.nav.s;
    sim.step(FIXED_DT, [INPUT({ throttle: 1 })]);
    assert(car.v.boost > 0, 'pas de boost');
    const r = track.ramps[0];
    car.v.x = r.x; car.v.z = r.z; car.v.vz = 50;
    track.locate(car.v.x, car.v.z, -1, car.nav); car.lastS = car.nav.s;
    sim.step(FIXED_DT, [INPUT({ throttle: 1 })]);
    assert(car.v.y > 0, 'pas d\'envol');
});
test('33c. Les plus lents ne restent pas loin derrière (rattrapage borné)', () => {
    const t = getTrack('ovale');
    const human = createCar(t, 'f1', { human: true, playerIndex: 0, slot: 1 });
    const bot = createCar(t, 'sport', { slot: 0, difficulty: 'normal' });
    const sim = new RaceSim({ track: t, laps: 3, cars: [bot, human] });
    human.dist = 2000;
    sim.step(FIXED_DT, [INPUT()]);
    const behind = bot.v.perf;
    human.dist = -2000;
    sim.step(FIXED_DT, [INPUT()]);
    assert(behind > bot.brain.perf && behind <= bot.brain.perf + 0.07, `retard ${behind}`);
    assert(bot.v.perf < bot.brain.perf && bot.v.perf >= bot.brain.perf - 0.05, `avance ${bot.v.perf}`);
});

// ---------- Alpha 1.4 : objets, saut synchro, biomes ----------
function duelSim(trackId = 'droite') {
    const t = getTrack(trackId);
    const me = createCar(t, 'sport', { human: true, playerIndex: 0, slot: 1, name: 'Toi' });
    const bot = createCar(t, 'sport', { slot: 0, name: 'Bot' });
    const sim = new RaceSim({ track: t, laps: 1, cars: [bot, me] });
    for (let i = 0; i < 60 * 3; i++) sim.step(FIXED_DT, [INPUT({ throttle: 1 })]);
    return { t, me, bot, sim };
}
test('Objets : il y en a exactement 10, tous tirables', () => {
    assert(ITEM_IDS.length === 10, `${ITEM_IDS.length} objets`);
    const { sim, me } = duelSim();
    const seen = new Set();
    for (let k = 0; k < 400; k++) { me.position = 2; seen.add(sim.rollItem(me, k / 400)); me.position = 1; seen.add(sim.rollItem(me, k / 400)); }
    assert(seen.size === 10, `jamais tirés : ${ITEM_IDS.filter(i => !seen.has(i))}`);
});
test('Objets : chacun a un effet réel en course', () => {
    const fire = (item, prep) => {
        const ctx = duelSim();
        prep?.(ctx);
        ctx.me.item = item;
        ctx.sim.step(FIXED_DT, [INPUT({ throttle: 1, useItem: true })]);
        return ctx;
    };
    let c = fire('turbo'); assert(c.me.v.boost > 1.5, 'turbo');
    c = fire('shield'); assert(c.me.v.shield > 5, 'bouclier');
    c = fire('oil'); assert(c.sim.oils.some(o => o.owner === c.me), 'huile');
    c = fire('ghost'); assert(c.me.v.ghost > 3, 'fantôme');
    c = fire('magnet'); assert(c.me.v.magnet > 3, 'aimant');
    c = fire('spring'); assert(c.me.v.vy > 10, 'ressort');
    // Missile : touche la voiture de devant
    c = fire('missile', ({ me, bot, sim }) => { bot.v.x = me.v.x; bot.v.z = me.v.z + 25; bot.v.vx = bot.v.vz = 0; bot.dist = me.dist + 25; sim.updatePositions(); });
    for (let i = 0; i < 120 && c.bot.v.spin <= 0; i++) c.sim.step(FIXED_DT, [INPUT()]);
    assert(c.bot.v.spin > 0, 'missile');
    // Bombe : explose sur la voiture proche, épargne le lanceur
    c = fire('bomb', ({ me, bot }) => { bot.v.x = me.v.x; bot.v.z = me.v.z + 14; bot.v.vx = bot.v.vz = 0; });
    let spun = false;
    for (let i = 0; i < 150; i++) { c.sim.step(FIXED_DT, [INPUT()]); if (c.bot.v.spin > 0) spun = true; }
    assert(spun, 'bombe');
    assert(c.me.stats.hits >= 1, 'bombe comptée');
    // Éclair : ralentit la voiture de devant
    c = fire('zap', ({ me, bot, sim }) => { bot.dist = me.dist + 50; sim.updatePositions(); });
    assert(c.bot.v.zap > 0, 'éclair');
    // Tornade : remonte la piste et renverse
    c = fire('tornado', ({ me, bot }) => { bot.v.x = me.v.x; bot.v.z = me.v.z + 40; bot.v.vx = bot.v.vz = 0; });
    spun = false;
    for (let i = 0; i < 120; i++) { c.sim.step(FIXED_DT, [INPUT()]); if (c.bot.v.spin > 0) spun = true; }
    assert(spun, 'tornade');
});
test('Objets : le bouclier encaisse un missile, le fantôme l’évite', () => {
    for (const prot of ['shield', 'ghost']) {
        const c = duelSim();
        c.bot.v.x = c.me.v.x; c.bot.v.z = c.me.v.z + 25; c.bot.v.vx = c.bot.v.vz = 0; c.bot.dist = c.me.dist + 25; c.sim.updatePositions();
        c.bot.v[prot] = 5;
        c.me.item = 'missile';
        c.sim.step(FIXED_DT, [INPUT({ useItem: true })]);
        for (let i = 0; i < 120; i++) c.sim.step(FIXED_DT, [INPUT()]);
        assert(c.bot.v.spin <= 0, `${prot} n'a pas protégé`);
    }
});
test('Saut synchro : Maj fait décoller, puis le drift s’enclenche à l’atterrissage', () => {
    const v = createVehicle('drift', 0, 0, 0);
    for (let i = 0; i < 240; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
    stepVehicle(v, INPUT({ throttle: 1, drift: true, hop: true }), FIXED_DT);
    assert(v.y > 0, 'pas de bond');
    let maxY = 0, landed = false;
    for (let i = 0; i < 60; i++) { stepVehicle(v, INPUT({ throttle: 1, drift: true, steer: 1 }), FIXED_DT); maxY = Math.max(maxY, v.y); if (v.y === 0) landed = true; }
    assert(maxY > 0.6 && maxY < 1.2, `hauteur ${maxY.toFixed(2)}`);
    assert(landed && v.drifting, 'drift après le saut');
});
test('Biomes : la glace glisse plus, le sable freine plus', () => {
    const slide = biome => {
        const t = getTrack('ovale'), car = createCar(t, 'sport', { human: true, playerIndex: 0 });
        new RaceSim({ track: t, laps: 1, cars: [car], biome });
        const v = car.v;
        for (let i = 0; i < 300; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
        let m = 0; for (let i = 0; i < 40; i++) { stepVehicle(v, INPUT({ throttle: 1, steer: 1 }), FIXED_DT); m = Math.max(m, Math.abs(v.lateral)); }
        v.onRoad = false; for (let i = 0; i < 600; i++) stepVehicle(v, INPUT({ throttle: 1 }), FIXED_DT);
        return { slip: m, off: v.speed };
    };
    const p = slide('plaine'), g = slide('glace'), d = slide('desert');
    assert(g.slip > p.slip * 1.2, `glisse plaine ${p.slip.toFixed(1)} / glace ${g.slip.toFixed(1)}`);
    assert(d.off < p.off * 0.9, `hors-piste plaine ${p.off.toFixed(1)} / désert ${d.off.toFixed(1)}`);
    assert(Object.keys(BIOMES).length === 4, 'quatre biomes');
});
for (const biome of Object.keys(BIOMES)) {
    test(`IA : course complète avec objets en biome ${biome}`, () => {
        const t = getTrack('pins');
        const cars = ['f1', 'sport', 'muscle', 'drift', 'kart', 'truck'].map((type, i) => createCar(t, type, { slot: i, name: type, difficulty: 'normal' }));
        const sim = new RaceSim({ track: t, laps: 1, cars, biome });
        let items = 0;
        for (let i = 0; i < 60 * 240 && !cars.every(c => c.finished); i++) { sim.step(FIXED_DT, []); items += sim.events.filter(e => e.type === 'useItem').length; sim.events.length = 0; }
        assert(cars.every(c => c.finished), 'non arrivés : ' + cars.filter(c => !c.finished).map(c => c.name));
        return `${items} objets lancés, vainqueur ${sim.order[0].name}`;
    });
}
test('Cônes : placés dans les virages, ils volent puis reviennent', () => {
    const t = getTrack('pins');
    assert(t.coneSpots.length >= 9, `${t.coneSpots.length} cônes`);
    for (const c of t.coneSpots) { const q = t.locate(c.x, c.z, -1, {}); assert(q.d < q.width, 'cône hors piste'); }
    const car = createCar(t, 'sport', { human: true, playerIndex: 0 });
    const sim = new RaceSim({ track: t, laps: 1, cars: [car] });
    const cone = sim.props[0];
    car.v.x = cone.x; car.v.z = cone.z - 2; car.v.vz = 30; car.v.vx = 0; car.v.heading = 0;
    t.locate(car.v.x, car.v.z, -1, car.nav); car.lastS = car.nav.s;
    sim.step(FIXED_DT, [INPUT({ throttle: 1 })]);
    assert(cone.timer > 0, 'pas renversé');
    for (let i = 0; i < 60 * 7; i++) sim.step(FIXED_DT, [INPUT()]);
    assert(cone.timer === 0 && cone.x === cone.hx, 'pas revenu');
});

// ---------- Règles ----------
test('38. Médailles et déblocages', () => {
    assert(medalForTime(70, 25, 3) === 'gold', 'or');
    assert(medalForTime(80, 25, 3) === 'silver', 'argent');
    assert(medalForTime(100, 25, 3) === 'bronze', 'bronze');
    assert(medalForTime(200, 25, 3) === null, 'rien');
    assert(medalForPosition(1, 0) === null, 'pas de médaille sans adversaire');
    const s = new Save(memStorage());
    assert(!s.isVehicleUnlocked('kart') && !s.isTrackUnlocked('pins'), 'bloqués au départ');
    const u = s.awardMedal('ovale', 'gold');
    assert(s.isVehicleUnlocked('kart') && s.isTrackUnlocked('pins'), 'débloqués');
    assert(u.length === 2, `annonces ${u}`);
    s.awardMedal('ovale', 'bronze');
    assert(s.data.medals.ovale === 'gold', 'une médaille ne doit jamais baisser');
});
test('36. Score : plus rapide = meilleur score', () => {
    const st = { pads: 0, driftBoosts: 0, impacts: 0 };
    assert(computeScore(40, 80, st) > computeScore(60, 80, st), 'score');
});
test('Format du temps', () => {
    assert(formatTime(83.456) === '01:23.45', formatTime(83.456));
    assert(formatTime(null) === '--:--.--', 'null');
});
test('Sauvegarde : stockage absent ou corrompu sans plantage', () => {
    const bad = { getItem: () => '{pas du json', setItem: () => { throw new Error('plein'); } };
    const s = new Save(bad);
    s.saveRun({ track: 'ovale', car: 'f1', laps: 1, time: 10, lapTimes: [10] });
    assert(new Save(null).getRecord('ovale', 'f1', 1) === null, 'null');
});

// ---------- Rendu du rapport ----------
const ok = results.filter(r => r.ok).length;
const el = document.getElementById('out');
el.innerHTML = `<h1>${ok} / ${results.length} tests réussis</h1>` + results.map(r =>
    `<div class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✓' : '✗'} ${r.name}${r.info ? ` <small>— ${r.info}</small>` : ''}</div>`).join('');
window.__results = results;
window.__parTimes = parTimes;
