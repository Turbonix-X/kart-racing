// ============================================================
//  Simulation complète d'une course, sans aucun rendu :
//  murs, obstacles, cônes, objets, tours, classement, adversaires.
//  Le jeu l'affiche, les tests la font tourner à toute vitesse.
// ============================================================
import { createVehicle, stepVehicle, bounce, spinOut, giveBoost } from './physics.js';
import { aiControl, createBrain } from './ai.js';
import { BIOMES } from './biomes.js';
import { Elevation } from './terrain.js';
import { CHARACTERS, CHARACTER_IDS, MIN_RACERS, MAX_RACERS } from './config.js';

const MAX_LOGICAL_JUMP = 40;
const PICKUP_RESPAWN = 7;
export const PICKUP_HALF = 1.15;     // demi-taille du cube affiché
const PICKUP_HEIGHT = 3.4;

/** Les 10 objets des boîtes mystère. `front` / `back` : chances selon le classement. */
export const ITEMS = {
    turbo:   { name: 'Turbo',          desc: 'Une grosse poussée vers l\'avant',            front: 1, back: 5 },
    shield:  { name: 'Bouclier',       desc: '6 s protégé de tout, et tu bouscules',         front: 4, back: 2 },
    oil:     { name: 'Flaque d\'huile', desc: 'Posée derrière toi : fait déraper une fois',   front: 5, back: 1 },
    missile: { name: 'Missile',        desc: 'Fonce sur la voiture juste devant',            front: 1, back: 4 },
    bomb:    { name: 'Bombe',          desc: 'Lancée devant, elle explose en zone',          front: 3, back: 3 },
    zap:     { name: 'Éclair',         desc: 'Ralentit tous ceux qui sont devant toi',       front: 0, back: 3 },
    magnet:  { name: 'Aimant',         desc: '4 s attiré vers la voiture de devant',         front: 1, back: 4 },
    ghost:   { name: 'Fantôme',        desc: '4 s intouchable : tu traverses tout',          front: 3, back: 2 },
    tornado: { name: 'Tornade',        desc: 'Remonte la piste et renverse tout le monde',   front: 1, back: 3 },
    spring:  { name: 'Ressort',        desc: 'Un énorme saut par-dessus tout obstacle',      front: 3, back: 2 },
};
export const ITEM_IDS = Object.keys(ITEMS);

export function createCar(track, type, opts = {}) {
    const start = gridSlot(track, opts.slot ?? 0);
    const v = createVehicle(type, start.x, start.z, start.heading, { character: opts.character ?? null, wheels: opts.wheels ?? 'route' });
    const brain = opts.human ? null : createBrain(opts.slot ?? 0, opts.difficulty ?? 'normal');
    if (brain) v.perf = brain.perf;
    return {
        v, name: opts.name ?? '?', color: opts.color ?? 0xffffff, human: !!opts.human, playerIndex: opts.playerIndex ?? -1,
        character: opts.character ?? null, skin: opts.skin ?? 'classique', wheels: opts.wheels ?? 'route',
        g: 0, puddles: new Set(), px: start.x, pz: start.z,
        brain,
        nav: { idx: -1, s: 0, d: 0, lat: 0, width: 10, limit: 20, tx: 0, tz: 1, px: 0, pz: 0, inCorridor: false, corridorGrace: 0, mismatch: 0 },
        dist: 0, maxDist: 0, lastS: 0, lapsDone: 0, lapStart: 0, lapTimes: [],
        finished: false, finishTime: 0, position: 1, wrongWay: false, wrongTimer: 0, offTrackTime: 0,
        item: null, stats: { topSpeed: 0, driftBoosts: 0, pads: 0, impacts: 0, hits: 0, items: 0 }, respawnS: 0,
    };
}

/**
 * Liste des pilotes d'une course : les joueurs, puis des adversaires tirés parmi les autres personnages
 * (chacun porte le nom de son personnage, sa voiture et sa couleur). Entre 4 et 8 pilotes ; le chrono se court seul.
 */
export function buildRoster(cfg, rng = Math.random) {
    const total = cfg.mode === 'tt' ? cfg.players.length : Math.max(MIN_RACERS, Math.min(MAX_RACERS, cfg.racers ?? 6));
    const taken = new Set(cfg.players.map(p => p.character));
    const pool = CHARACTER_IDS.filter(id => !taken.has(id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const bots = [];
    for (let i = 0; i < Math.max(0, total - cfg.players.length); i++) {
        const id = pool[i % pool.length], ch = CHARACTERS[id];
        bots.push({ vehicle: ch.kart, name: ch.name, color: ch.color, character: id, skin: 'classique', wheels: 'route' });
    }
    return bots;
}

/** Place sur la grille de départ : deux colonnes derrière la ligne. */
export function gridSlot(track, slot) {
    const row = Math.floor(slot / 2), col = slot % 2 ? 1 : -1;
    const s = track.startS - 10 - row * 8;
    const wrapped = track.closed ? ((s % track.length) + track.length) % track.length : Math.max(2, s);
    const w = track.pointAt(wrapped, 0).width;
    const p = track.pointAt(wrapped, col * Math.min(4, w * 0.4));
    return { x: p.x, z: p.z, heading: p.heading, s: wrapped };
}

export class RaceSim {
    /**
     * @param {object} cfg track, laps, cars (liste créée avec createCar), mode, biome
     */
    constructor({ track, laps, cars, mode = 'race', biome = 'plaine' }) {
        this.track = track;
        this.laps = track.closed ? laps : 1;
        this.cars = cars;
        this.mode = mode;
        this.biome = BIOMES[biome] ?? BIOMES.plaine;
        this.elev = new Elevation(track, this.biome);
        this.time = 0;
        this.finished = false;
        this.events = [];
        // En contre-la-montre, seul le pilotage compte : pas de boîtes mystère
        this.pickups = mode === 'tt' ? [] : track.pickupSpots.map(p => ({ x: p.x, z: p.z, timer: 0 }));
        this.oils = track.staticOil.map(o => ({ x: o.x, z: o.z, r: o.r, age: -1, owner: null, water: true }));
        this.props = (track.coneSpots ?? []).map(c => ({ hx: c.x, hz: c.z, x: c.x, z: c.z, y: 0, vx: 0, vz: 0, vy: 0, rx: 0, rz: 0, timer: 0 }));
        this.projectiles = [];
        this.lapLen = track.closed ? track.length : track.raceLength;
        this.totalLen = this.lapLen * this.laps;
        this.autoInput = { throttle: 0, brake: 0, steer: 0, drift: false, hop: false, jump: false, useItem: false, respawn: false };

        for (const car of cars) {
            // Crampons et pattes de yéti : la glace glisse beaucoup moins
            car.v.gripMult = 1 - (1 - this.biome.grip) * (1 - Math.min(0.95, car.v.spec.iceGrip ?? 0));
            car.v.offMult = this.biome.offroad;
            track.locate(car.v.x, car.v.z, -1, car.nav);
            car.lastS = car.nav.s;
            car.respawnS = car.nav.s;
            // distance signée jusqu'à la ligne : négative tant qu'on est derrière
            car.dist = track.closed ? track.deltaS(track.startS, car.nav.s) : car.nav.s - track.startS;
            car.maxDist = car.dist;
            car.lapStart = 0;
            car.g = this.elev.at(car.nav);
        }
        this.updatePositions();
    }

    emit(type, car, extra) { this.events.push({ type, car, ...extra }); }

    /** Un pas de simulation. `inputs[playerIndex]` donne les commandes des humains. */
    step(dt, inputs) {
        if (this.finished) return;
        this.time += dt;

        for (const car of this.cars) {
            let inp;
            if (car.human && !car.finished) {
                inp = inputs[car.playerIndex];
            } else {
                inp = this.autoInput;
                if (!car.brain) car.brain = createBrain(0, 'normal');
                aiControl(car, this, inp, dt);
            }
            this.stepCar(car, inp, dt);
        }

        this.collideCars();
        this.updatePositions();
        this.updateRubberBand();
        this.updateWorld(dt);
        this.updateProjectiles(dt);

        const humans = this.cars.filter(c => c.human);
        if (humans.length && humans.every(c => c.finished)) this.finishRace();
    }

    stepCar(car, inp, dt) {
        const v = car.v, nav = car.nav;

        if (inp.respawn && !car.finished) this.respawn(car);
        this.applyMagnet(car, dt);
        car.px = v.x; car.pz = v.z;
        // Pente sous les roues, mesurée dans le sens où regarde la voiture
        v.slope = this.elev.flat ? 0 : this.elev.slopeAtS(nav.s) * (Math.sin(v.heading) * nav.tx + Math.cos(v.heading) * nav.tz);
        stepVehicle(v, inp, dt);
        if (v.driftBoostTier > 0) { car.stats.driftBoosts++; this.emit('driftBoost', car, { tier: v.driftBoostTier }); }
        if (v.jumped || v.hopped) this.emit(v.hopped ? 'hop' : 'jump', car);

        this.resolveBounds(car);
        this.followGround(car);
        if (v.landed > 6) this.emit('land', car, { power: v.landed });
        if (v.ghost <= 0) this.resolveObstacles(car);

        // Surface : même mesure que le bitume dessiné
        v.onRoad = !nav.inCorridor && nav.d <= nav.width;
        car.offTrackTime = v.onRoad ? 0 : car.offTrackTime + dt;

        this.checkPads(car);
        this.checkOil(car);
        this.checkProps(car);
        this.checkPickups(car);
        if (inp.useItem && car.item) this.useItem(car);

        this.updateRace(car, dt);
        if (v.speed > car.stats.topSpeed) car.stats.topSpeed = v.speed;
    }

    /** Relief : la voiture suit la route ; en l'air, elle garde sa hauteur réelle pendant que le sol défile. */
    followGround(car) {
        if (this.elev.flat) return;
        const v = car.v, g = this.elev.at(car.nav), dG = g - car.g;
        car.g = g;
        if (v.y > 0 || v.vy > 0) {
            v.y -= dG;
            if (v.y <= 0) { v.landed = Math.max(v.landed, 0.01, -v.vy); v.y = 0; v.vy = 0; }
        }
    }

    /** Murs : impossible de quitter la zone de course, quelle que soit la façon de s'y prendre. */
    resolveBounds(car) {
        const v = car.v, nav = car.nav, t = this.track;
        t.locate(v.x, v.z, nav.idx, nav);
        const margin = v.spec.radius * 0.8;
        const c = t.corridors.length ? t.corridorInfo(v.x, v.z) : null;
        const wasIn = nav.inCorridor;
        const inCorr = !!c && c.d <= c.half;
        nav.inCorridor = inCorr && nav.d > nav.width;

        if (nav.d + margin > nav.limit && !inCorr) {
            let nx, nz;
            if (wasIn && c) {
                // Sortie latérale d'un raccourci : on reste dans le couloir
                const f = c.d || 1;
                nx = (c.qx - v.x) / f; nz = (c.qz - v.z) / f;
                v.x = c.qx - nx * (c.half - 0.05);
                v.z = c.qz - nz * (c.half - 0.05);
            } else {
                const f = nav.d || 1;
                nx = (nav.px - v.x) / f; nz = (nav.pz - v.z) / f;
                const target = nav.limit - margin;
                v.x = nav.px - nx * target;
                v.z = nav.pz - nz * target;
            }
            const power = bounce(v, nx, nz, 0.35, 0.86);
            if (power > 3) { v.impact = Math.max(v.impact, power); car.stats.impacts++; this.emit('crash', car, { power }); }
            if (v.drifting && power > 12) { v.drifting = false; v.driftCharge = 0; }
            t.locate(v.x, v.z, nav.idx, nav);
        }
    }

    resolveObstacles(car) {
        const v = car.v;
        for (const o of this.track.obstacles) {
            if (v.y >= o.h) continue;
            const dx = v.x - o.x, dz = v.z - o.z, min = o.r + v.spec.radius * 0.7;
            const d2 = dx * dx + dz * dz;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
            v.x = o.x + nx * min; v.z = o.z + nz * min;
            const power = bounce(v, nx, nz, 0.4, 0.8);
            if (power > 3) { v.impact = Math.max(v.impact, power); car.stats.impacts++; this.emit('crash', car, { power }); }
        }
    }

    checkPads(car) {
        const v = car.v, nav = car.nav, t = this.track;
        if (v.y > 0) return;
        for (const p of t.pads) {
            if (Math.abs(t.deltaS(p.s, nav.s)) < p.len && Math.abs(nav.lat - p.lat) < p.half && v.boost < 0.9 && v.speed > 2) {
                giveBoost(v, 1.2); car.stats.pads++;
                this.emit('pad', car);
            }
        }
        for (const r of t.ramps) {
            if (Math.abs(t.deltaS(r.s, nav.s)) < 3 && Math.abs(nav.lat - r.lat) < r.half && v.speed > 12) {
                v.vy = Math.min(13, 4 + v.speed * 0.11);
                v.y = 0.01;
                this.emit('ramp', car);
            }
        }
    }

    /**
     * Flaques (eau sur la piste, huile lancée) : on glisse en y entrant, une seule fois.
     * Tant qu'on reste dedans, elle ne refait pas glisser ; il faut en sortir pour qu'elle recompte.
     */
    checkOil(car) {
        const v = car.v;
        for (const o of this.oils) {
            const dx = v.x - o.x, dz = v.z - o.z, inside = dx * dx + dz * dz < o.r * o.r;
            if (!inside) { car.puddles.delete(o); continue; }
            if (car.puddles.has(o)) continue;
            if (v.y > 0.6) continue;                        // saut synchro : on passe au-dessus
            if (o.owner === car && o.age < 1.5) continue;
            car.puddles.add(o);
            if (Math.abs(v.speed) <= 6 || v.ghost > 0) continue;
            if (this.dodges(car)) { this.emit('dodge', car); continue; }
            if (spinOut(v)) this.emit('spin', car, { water: !!o.water });
        }
    }

    /** Talent du ninja : une chance sur quatre d'esquiver. */
    dodges(car) { return car.v.spec.perk === 'dodge' && Math.random() < 0.25; }

    /** Cônes : ils volent quand on les touche, et la voiture perd un peu de vitesse. */
    checkProps(car) {
        const v = car.v;
        if (v.y > 1) return;
        for (const c of this.props) {
            if (c.timer > 0) continue;
            const dx = c.x - v.x, dz = c.z - v.z;
            if (dx * dx + dz * dz > (v.spec.radius + 0.5) ** 2) continue;
            const sp = Math.hypot(v.vx, v.vz);
            if (sp < 3) continue;
            c.timer = 6;
            c.vx = v.vx * 0.9 + dx * 3; c.vz = v.vz * 0.9 + dz * 3; c.vy = 6 + sp * 0.12;
            if (v.ghost <= 0) { v.vx *= 0.93; v.vz *= 0.93; }
            this.emit('cone', car, { x: c.x, z: c.z });
        }
    }

    /**
     * Boîtes mystère : on teste tout le trajet parcouru pendant le pas (pas seulement le point d'arrivée),
     * avec la taille réelle du cube et de la voiture. Une boîte touchée se casse toujours,
     * même si l'on a déjà un objet (on n'en reçoit simplement pas de nouveau).
     */
    checkPickups(car) {
        const v = car.v;
        if (v.y > PICKUP_HEIGHT) return;
        const r = PICKUP_HALF + v.spec.radius * 0.85;
        const ax = car.px, az = car.pz, ux = v.x - ax, uz = v.z - az, l2 = ux * ux + uz * uz;
        for (const p of this.pickups) {
            if (p.timer > 0) continue;
            const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((p.x - ax) * ux + (p.z - az) * uz) / l2)) : 0;
            const dx = ax + ux * t - p.x, dz = az + uz * t - p.z;
            if (dx * dx + dz * dz > r * r) continue;
            p.timer = PICKUP_RESPAWN;
            if (car.item) { this.emit('boxBreak', car, { x: p.x, z: p.z }); continue; }
            car.item = this.rollItem(car);
            this.emit('pickup', car, { item: car.item, x: p.x, z: p.z });
        }
    }

    /** Tirage pondéré : les derniers reçoivent des objets pour remonter, les premiers pour se défendre. */
    rollItem(car, r = Math.random()) {
        let back = this.cars.length > 1 ? (car.position - 1) / (this.cars.length - 1) : 0.5;
        if (car.v.spec.perk === 'lucky') back = Math.min(1, back + 0.35);     // Kiko tire mieux
        const weights = ITEM_IDS.map(id => {
            const it = ITEMS[id];
            let w = it.front * (1 - back) + it.back * back;
            if (id === 'zap' && car.position === 1) w = 0;               // inutile en tête
            if ((id === 'missile' || id === 'magnet') && car.position === 1) w *= 0.2;
            return w;
        });
        const total = weights.reduce((a, b) => a + b, 0);
        let x = r * total;
        for (let i = 0; i < ITEM_IDS.length; i++) { x -= weights[i]; if (x <= 0) return ITEM_IDS[i]; }
        return 'turbo';
    }

    carAhead(car) {
        return this.order[car.position - 2] ?? null;
    }

    useItem(car) {
        const v = car.v, item = car.item;
        car.item = null;
        car.stats.items++;
        const sinH = Math.sin(v.heading), cosH = Math.cos(v.heading), k = v.spec.itemTime ?? 1;
        switch (item) {
            case 'turbo': giveBoost(v, 1.8 * k); break;
            case 'shield': v.shield = 6 * k; break;
            case 'oil':
                this.oils.push({ x: v.x - sinH * 5, z: v.z - cosH * 5, r: 3.2, age: 0, owner: car });
                if (this.oils.length > 24) {
                    const i = this.oils.findIndex(o => o.age >= 0);
                    if (i >= 0) this.oils.splice(i, 1);
                }
                break;
            case 'missile': {
                const target = this.carAhead(car);
                this.projectiles.push({ kind: 'missile', owner: car, target, x: v.x + sinH * 3, z: v.z + cosH * 3, y: 0.8, heading: v.heading, speed: Math.max(60, v.speed + 30), life: 6, idx: car.nav.idx, id: Math.random() });
                break;
            }
            case 'bomb': {
                const sp = Math.max(30, v.speed + 18);
                this.projectiles.push({ kind: 'bomb', owner: car, x: v.x + sinH * 3, z: v.z + cosH * 3, y: 1.2, vx: sinH * sp, vz: cosH * sp, vy: 9, life: 2.2, id: Math.random() });
                break;
            }
            case 'zap': {
                const hit = [];
                for (const c of this.cars) {
                    if (c === car || c.position >= car.position || c.finished) continue;
                    if (c.v.shield > 0 || c.v.ghost > 0) { this.emit('blocked', c); continue; }
                    if (this.dodges(c)) { this.emit('dodge', c); continue; }
                    c.v.zap = 3; c.v.vx *= 0.6; c.v.vz *= 0.6;
                    hit.push(c);
                    this.emit('zapped', c, { by: car });
                }
                car.stats.hits += hit.length;
                this.emit('zap', car, { targets: hit });
                break;
            }
            case 'magnet': v.magnet = 4 * k; break;
            case 'ghost': v.ghost = 4 * k; break;
            case 'tornado':
                this.projectiles.push({ kind: 'tornado', owner: car, s: car.nav.s, lat: car.nav.lat, x: v.x, z: v.z, y: 0, life: 6, travel: 0, id: Math.random() });
                break;
            case 'spring':
                v.vy = v.spec.perk === 'astro' ? 20 : 16; v.y = 0.01;
                giveBoost(v, 0.8);
                break;
        }
        this.emit('useItem', car, { item });
    }

    /** Aimant : la voiture est tirée vers celle de devant tant qu'elle est à portée. */
    applyMagnet(car, dt) {
        const v = car.v;
        if (v.magnet <= 0) return;
        const target = this.carAhead(car);
        if (!target) return;
        const dx = target.v.x - v.x, dz = target.v.z - v.z, d = Math.hypot(dx, dz);
        if (d > 90 || d < 4) return;
        const pull = 22 * dt;
        v.vx += (dx / d) * pull; v.vz += (dz / d) * pull;
        car.magnetTarget = target;
    }

    /** Missiles, bombes, tornades : déplacement, impacts, explosions. */
    updateProjectiles(dt) {
        const t = this.track;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            let dead = p.life <= 0;
            if (p.kind === 'missile') {
                // Vise la voiture ciblée, sinon suit la piste
                let tx, tz;
                if (p.target && !p.target.finished) { tx = p.target.v.x; tz = p.target.v.z; }
                else { p.idx = t.wrap(p.idx + 6); tx = t.x[p.idx]; tz = t.z[p.idx]; }
                const want = Math.atan2(tx - p.x, tz - p.z);
                let d = want - p.heading;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                p.heading += Math.max(-4 * dt, Math.min(4 * dt, d));
                p.x += Math.sin(p.heading) * p.speed * dt;
                p.z += Math.cos(p.heading) * p.speed * dt;
                const q = t.locate(p.x, p.z, p.idx, {});
                p.idx = q.idx;
                if (q.d > q.limit + 2) dead = true;
                for (const c of this.cars) {
                    if (c === p.owner || c.v.y > 2.5) continue;
                    if ((c.v.x - p.x) ** 2 + (c.v.z - p.z) ** 2 < 7) {
                        this.hit(c, p.owner, 'missile');
                        dead = true;
                        break;
                    }
                }
                if (dead) this.emit('explode', null, { x: p.x, z: p.z, small: true });
            } else if (p.kind === 'bomb') {
                p.vy -= 26 * dt;
                p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
                if (p.y <= 0.5) { p.y = 0.5; p.vx *= 0.6; p.vz *= 0.6; p.vy = Math.abs(p.vy) * 0.35; }
                const q = t.locate(p.x, p.z, -1, {});
                if (q.d > q.limit) { p.vx = -p.vx * 0.4; p.vz = -p.vz * 0.4; }
                for (const c of this.cars) {
                    if (c !== p.owner && (c.v.x - p.x) ** 2 + (c.v.z - p.z) ** 2 < 6) dead = true;
                }
                if (dead) {
                    for (const c of this.cars) {
                        const d2 = (c.v.x - p.x) ** 2 + (c.v.z - p.z) ** 2;
                        // Le lanceur n'est jamais pris dans sa propre explosion
                        if (c !== p.owner && d2 < 100) { if (this.hit(c, p.owner, 'bomb')) { c.v.vy = 7; c.v.y = 0.01; } }
                    }
                    this.emit('explode', null, { x: p.x, z: p.z });
                }
            } else if (p.kind === 'tornado') {
                // Remonte la piste à grande vitesse
                const step = 62 * dt;
                p.travel += step;
                p.s = t.closed ? (p.s + step) % t.length : Math.min(t.length, p.s + step);
                const q = t.pointAt(p.s, p.lat * Math.cos(p.travel * 0.03));
                p.x = q.x; p.z = q.z;
                for (const c of this.cars) {
                    if (c === p.owner || c.tornadoHit === p.id) continue;
                    if ((c.v.x - p.x) ** 2 + (c.v.z - p.z) ** 2 < 18) {
                        c.tornadoHit = p.id;
                        if (this.hit(c, p.owner, 'tornado')) { c.v.vy = 8; c.v.y = 0.01; }
                    }
                }
            }
            if (dead) this.projectiles.splice(i, 1);
        }
    }

    /** Touché par un objet : le bouclier encaisse, sinon on part en tête-à-queue. Renvoie vrai si touché. */
    hit(target, by, kind) {
        const v = target.v;
        if (v.ghost > 0) return false;
        if (v.shield > 0) { v.shield = 0; this.emit('blocked', target); return false; }
        if (this.dodges(target)) { this.emit('dodge', target); return false; }
        v.spin = 0; // force un nouveau tête-à-queue
        spinOut(v);
        v.vx *= 0.5; v.vz *= 0.5;
        if (by) by.stats.hits++;
        this.emit('hit', target, { by, kind });
        return true;
    }

    /** Avancement : un compteur continu qu'on ne peut gonfler ni en demi-tour ni en coupant. */
    updateRace(car, dt) {
        const t = this.track, nav = car.nav, v = car.v;
        let delta = t.deltaS(car.lastS, nav.s);
        if (nav.inCorridor) nav.corridorGrace = 1.5;
        else if (nav.corridorGrace > 0) nav.corridorGrace -= dt;
        const allowed = nav.corridorGrace > 0 ? 170 : MAX_LOGICAL_JUMP;
        if (Math.abs(delta) > allowed) {
            // Saut incohérent : l'avancement n'en profite jamais
            nav.mismatch += dt;
            if (nav.mismatch < 0.5) return;
            delta = 0;
        }
        nav.mismatch = 0;
        car.dist += delta;
        car.lastS = nav.s;
        if (car.dist > car.maxDist) car.maxDist = car.dist;
        if (delta > 0 && nav.d <= nav.limit) car.respawnS = nav.s;

        // Mauvais sens
        const along = v.vx * nav.tx + v.vz * nav.tz;
        car.wrongTimer = along < -4 ? car.wrongTimer + dt : Math.max(0, car.wrongTimer - dt * 2);
        const wrong = car.wrongTimer > 1;
        if (wrong !== car.wrongWay) { car.wrongWay = wrong; if (wrong) this.emit('wrongWay', car); }

        // Tours
        while (!car.finished && car.maxDist >= (car.lapsDone + 1) * this.lapLen) {
            const lapTime = this.time - car.lapStart;
            car.lapTimes.push(lapTime);
            car.lapStart = this.time;
            car.lapsDone++;
            if (car.lapsDone >= this.laps) {
                car.finished = true;
                car.finishTime = this.time;
                this.emit('finish', car, { lapTime });
            } else this.emit('lap', car, { lapTime, lap: car.lapsDone + 1 });
        }
    }

    respawn(car) {
        const p = this.track.pointAt(car.respawnS, 0), v = car.v;
        v.x = p.x; v.z = p.z; v.y = 0; v.vy = 0; v.vx = 0; v.vz = 0; v.speed = 0; v.heading = p.heading;
        v.drifting = false; v.driftCharge = 0; v.spin = 0; v.boost = 0;
        car.puddles.clear();
        car.nav.idx = this.track.indexAt(car.respawnS);
        car.lastS = car.respawnS;
        this.track.locate(v.x, v.z, car.nav.idx, car.nav);
        car.g = this.elev.at(car.nav);
        car.px = v.x; car.pz = v.z;
        this.emit('respawn', car);
    }

    collideCars() {
        const cars = this.cars;
        for (let i = 0; i < cars.length; i++) {
            const a = cars[i].v;
            if (a.ghost > 0) continue;
            for (let j = i + 1; j < cars.length; j++) {
                const b = cars[j].v;
                if (b.ghost > 0 || Math.abs(a.y - b.y) > 1.5) continue;
                const dx = b.x - a.x, dz = b.z - a.z, min = a.spec.radius + b.spec.radius;
                const d2 = dx * dx + dz * dz;
                if (d2 >= min * min || d2 < 1e-6) continue;
                const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = (min - d) / 2;
                a.x -= nx * push; a.z -= nz * push;
                b.x += nx * push; b.z += nz * push;
                const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
                if (rel > 0) {
                    // Un bouclier renvoie l'autre voiture deux fois plus fort ; les lourds (Bob, Monster Truck) bousculent les légers
                    const ma = a.spec.mass ?? 1, mb = b.spec.mass ?? 1;
                    const ka = (b.shield > 0 ? 1.2 : 0.6) * (2 * mb / (ma + mb)), kb = (a.shield > 0 ? 1.2 : 0.6) * (2 * ma / (ma + mb));
                    a.vx -= nx * rel * ka; a.vz -= nz * rel * ka;
                    b.vx += nx * rel * kb; b.vz += nz * rel * kb;
                    if (rel > 6) {
                        a.impact = Math.max(a.impact, rel * 0.5);
                        b.impact = Math.max(b.impact, rel * 0.5);
                        this.emit('bump', cars[i], { power: rel });
                    }
                }
            }
        }
    }

    updatePositions() {
        const order = [...this.cars].sort((a, b) => {
            if (a.finished && b.finished) return a.finishTime - b.finishTime;
            if (a.finished) return -1;
            if (b.finished) return 1;
            return b.dist - a.dist;
        });
        order.forEach((c, i) => { c.position = i + 1; });
        this.order = order;
    }

    /** Rattrapage léger : les adversaires restent au contact, sans jamais tricher franchement. */
    updateRubberBand() {
        const humans = this.cars.filter(c => c.human);
        if (!humans.length) return;
        const ref = Math.max(...humans.map(c => c.dist));
        for (const c of this.cars) {
            if (c.human) continue;
            const gap = ref - c.dist;
            const rubber = Math.max(-0.05, Math.min(0.07, gap / 1200));
            c.v.perf = c.brain.perf + rubber;
        }
    }

    updateWorld(dt) {
        for (const p of this.pickups) if (p.timer > 0) p.timer -= dt;
        for (let i = this.oils.length - 1; i >= 0; i--) {
            const o = this.oils[i];
            if (o.age < 0) continue;
            o.age += dt;
            if (o.age > 14) this.oils.splice(i, 1);
        }
        for (const c of this.props) {
            if (c.timer <= 0) continue;
            c.timer -= dt;
            if (c.timer > 4.5) {
                c.vy -= 26 * dt;
                c.x += c.vx * dt; c.z += c.vz * dt; c.y = Math.max(0, c.y + c.vy * dt);
                c.rx += c.vz * dt * 0.6; c.rz -= c.vx * dt * 0.6;
                if (c.y === 0) { c.vx *= 0.9; c.vz *= 0.9; c.vy = Math.abs(c.vy) * 0.3; }
            } else if (c.timer <= 0) {
                // Le cône revient à sa place
                Object.assign(c, { x: c.hx, z: c.hz, y: 0, rx: 0, rz: 0, timer: 0 });
            }
        }
    }

    finishRace() {
        this.finished = true;
        this.updatePositions();
        this.emit('raceEnd', null);
    }
}
