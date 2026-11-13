// ============================================================
//  Les circuits, décrits uniquement par des données.
//  points : [x, z, demi-largeur de piste]
//  s des éléments (bonus, boosts...) : fraction du tracé (0 à 1)
//  par : temps de référence pour un tour (médaille d'or en chrono)
// ============================================================
import { Track } from './trackmath.js';

function crater() {
    return Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2;
        const r = 275 + 44 * Math.sin(3 * a) + 12 * Math.cos(5 * a + 0.4);
        return [Math.cos(a) * r, Math.sin(a) * r * 0.86, 12];
    });
}

function zigzagPoints() {
    const pts = [[-540, 55, 12], [-470, 55, 12], [-400, 55, 11]];
    for (let i = 1; i <= 8; i++) pts.push([-400 + i * 95, i % 2 ? -55 : 55, 10]);
    const lastX = -400 + 8 * 95;
    pts.push([lastX + 90, 55, 12], [lastX + 200, 55, 12], [lastX + 330, 55, 12]);
    return pts;
}

export const TRACK_DEFS = {
    ovale: {
        id: 'ovale', name: 'Circuit Ovale', closed: true, biome: 'plaine', unlock: 0, runoff: 16, par: 18, defaultLaps: 3,
        desc: 'Large et rapide : idéal pour débuter',
        points: Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return [Math.cos(a) * 220, Math.sin(a) * 140, 12];
        }),
        pads: [{ s: 0.12, lat: 0 }, { s: 0.62, lat: 0 }],
        pickups: [{ s: 0.3, lats: [-6, 0, 6] }, { s: 0.8, lats: [-6, 0, 6] }],
        obstacles: [{ s: 0.46, lat: -7, r: 2.2, h: 1.3, kind: 'rock' }, { s: 0.7, lat: 7, r: 2.2, h: 1.3, kind: 'rock' }],
    },
    zigzag: {
        id: 'zigzag', name: 'Zig-Zag', closed: false, biome: 'glace', unlock: 0, runoff: 10, par: 35, defaultLaps: 1, startAt: 70, runout: 170,
        desc: 'Un sprint de virages serrés : il faut freiner',
        points: zigzagPoints(),
        pads: [{ s: 0.13, lat: 0 }, { s: 0.82, lat: 0 }],
        pickups: [{ s: 0.25, lats: [-5, 0, 5] }, { s: 0.55, lats: [-5, 0, 5] }],
        oil: [{ s: 0.42, lat: 4 }, { s: 0.68, lat: -4 }],
        obstacles: [{ s: 0.34, lat: -5, r: 1.8, h: 1.3, kind: 'rock' }, { s: 0.76, lat: 5, r: 1.8, h: 1.3, kind: 'rock' }],
    },
    droite: {
        id: 'droite', name: 'Ligne Droite', closed: false, biome: 'desert', unlock: 0, runoff: 0.5, par: 33, defaultLaps: 1, startAt: 50, runout: 220,
        desc: 'Sprint de 2 km : esquive, boosts et score',
        points: [[0, -60, 14], [0, 500, 14], [0, 1100, 14], [0, 1700, 14], [0, 2270, 14]],
        pads: [{ s: 0.1, lat: -7 }, { s: 0.22, lat: 7 }, { s: 0.36, lat: 0 }, { s: 0.5, lat: -7 }, { s: 0.64, lat: 7 }, { s: 0.78, lat: 0 }],
        pickups: [{ s: 0.16, lats: [-8, 0, 8] }, { s: 0.44, lats: [-8, 0, 8] }, { s: 0.7, lats: [-8, 0, 8] }],
        obstacles: [
            { s: 0.14, lat: 6, r: 2.4, h: 1.3, kind: 'rock' }, { s: 0.19, lat: -6, r: 2.4, h: 1.3, kind: 'rock' },
            { s: 0.3, lat: 0, r: 2.8, h: 1.3, kind: 'rock' }, { s: 0.41, lat: 8, r: 2.4, h: 1.3, kind: 'rock' },
            { s: 0.47, lat: -3, r: 2.4, h: 1.3, kind: 'rock' }, { s: 0.58, lat: 6, r: 2.8, h: 1.3, kind: 'rock' },
            { s: 0.68, lat: -8, r: 2.4, h: 1.3, kind: 'rock' }, { s: 0.74, lat: 2, r: 2.8, h: 1.3, kind: 'rock' },
        ],
        ramps: [{ s: 0.54, lat: 0, half: 7 }, { s: 0.86, lat: 0, half: 7 }],
    },
    pins: {
        id: 'pins', name: 'Circuit des Pins', closed: true, biome: 'jungle', unlock: 1, runoff: 10, par: 47, defaultLaps: 3,
        desc: 'Technique, en forêt, avec des largeurs variables',
        points: [
            [0, -220, 13], [140, -220, 13], [250, -170, 12], [270, -60, 10], [180, -10, 9], [120, 60, 9],
            [200, 130, 11], [300, 160, 12], [310, 260, 12], [210, 320, 11], [60, 290, 10], [-30, 210, 9],
            [-120, 250, 10], [-240, 240, 12], [-300, 140, 12], [-260, 30, 11], [-150, 0, 9], [-110, -90, 10],
            [-180, -170, 12], [-110, -225, 13],
        ],
        pads: [{ s: 0.03, lat: 0 }, { s: 0.54, lat: 0 }],
        pickups: [{ s: 0.2, lats: [-4, 0, 4] }, { s: 0.48, lats: [-4, 0, 4] }, { s: 0.8, lats: [-4, 0, 4] }],
        oil: [{ s: 0.34, lat: 3 }, { s: 0.71, lat: -3 }],
        obstacles: [{ s: 0.62, lat: 5, r: 1.8, h: 1.3, kind: 'rock' }],
    },
    canyon: {
        id: 'canyon', name: 'Canyon Rouge', closed: true, biome: 'desert', unlock: 4, runoff: 10, par: 55, defaultLaps: 3,
        desc: 'Tremplin et raccourci barré par des rondins : sautez !',
        points: [
            [-50, -260, 14], [120, -260, 14], [280, -230, 13], [360, -120, 11], [300, -20, 10], [180, -50, 9],
            [90, 0, 10], [160, 90, 11], [320, 110, 12], [380, 220, 11], [290, 320, 11], [130, 300, 10],
            [20, 220, 9], [-60, 290, 10], [-200, 320, 12], [-330, 250, 12], [-360, 110, 10], [-260, 40, 9],
            [-300, -80, 10], [-370, -180, 12], [-260, -260, 13],
        ],
        pads: [{ s: 0.05, lat: 0 }, { s: 0.42, lat: 0 }, { s: 0.68, lat: 0 }],
        pickups: [{ s: 0.14, lats: [-5, 0, 5] }, { s: 0.5, lats: [-4, 0, 4] }, { s: 0.86, lats: [-5, 0, 5] }],
        oil: [{ s: 0.6, lat: 3 }],
        ramps: [{ s: 0.97, lat: 0, half: 8 }],
        shortcuts: [{ points: [[196, -44], [190, 20], [176, 88]], half: 7 }],
        logs: [[189, -18], [196, -18], [184, -18], [201, -18], [179, -18]],
    },
    lagon: {
        id: 'lagon', name: 'Lagon Turquoise', closed: true, biome: 'plage', unlock: 0, runoff: 14, par: 30, defaultLaps: 3,
        desc: 'De longues courbes rapides le long de la mer',
        points: [
            [-300, 0, 13], [-260, -120, 13], [-150, -190, 13], [0, -205, 13], [150, -175, 13], [262, -110, 12], [322, 0, 12],
            [282, 112, 12], [172, 152, 12], [62, 112, 11], [-40, 152, 11], [-150, 212, 12], [-270, 162, 13], [-322, 80, 13],
        ],
        pads: [{ s: 0.08, lat: 0 }, { s: 0.45, lat: 4 }, { s: 0.74, lat: -4 }],
        pickups: [{ s: 0.2, lats: [-6, 0, 6] }, { s: 0.58, lats: [-5, 0, 5] }, { s: 0.88, lats: [-6, 0, 6] }],
        oil: [{ s: 0.33, lat: -4 }, { s: 0.66, lat: 5 }],
        obstacles: [{ s: 0.27, lat: 7, r: 2, h: 1.4, kind: 'rock' }, { s: 0.52, lat: -7, r: 2, h: 1.4, kind: 'rock' }, { s: 0.82, lat: 6, r: 2, h: 1.4, kind: 'rock' }],
    },
    neon: {
        id: 'neon', name: 'Néon City', closed: true, biome: 'ville', unlock: 0, runoff: 9, par: 40, defaultLaps: 3,
        desc: 'Angles droits, chicane et lumières de la ville',
        points: [
            [-250, -180, 12], [0, -182, 12], [200, -180, 12], [252, -150, 11], [262, -60, 11], [200, -18, 10], [120, 0, 10],
            [100, 60, 10], [140, 120, 11], [250, 140, 11], [272, 200, 11], [232, 252, 11], [0, 252, 12], [-200, 252, 12],
            [-252, 220, 12], [-272, 120, 11], [-200, 60, 10], [-272, 0, 11], [-282, -130, 12],
        ],
        pads: [{ s: 0.04, lat: 0 }, { s: 0.6, lat: 0 }],
        pickups: [{ s: 0.14, lats: [-5, 0, 5] }, { s: 0.47, lats: [-4, 0, 4] }, { s: 0.7, lats: [-5, 0, 5] }],
        oil: [{ s: 0.3, lat: 3 }, { s: 0.55, lat: -3 }, { s: 0.85, lat: 2 }],
        obstacles: [{ s: 0.22, lat: -6, r: 1.7, h: 1.3, kind: 'rock' }, { s: 0.65, lat: 6, r: 1.7, h: 1.3, kind: 'rock' }],
    },
    col: {
        id: 'col', name: 'Col des Aigles', closed: true, biome: 'montagne', unlock: 0, runoff: 10, par: 56, defaultLaps: 3,
        desc: 'Une route de montagne : longues montées, descentes et épingles',
        points: [
            [0, -300, 12], [200, -320, 12], [380, -262, 12], [440, -120, 11], [362, -30, 10], [232, -40, 10], [160, 40, 10],
            [240, 130, 11], [400, 170, 11], [460, 290, 11], [362, 380, 11], [182, 352, 10], [60, 262, 10], [-60, 330, 11],
            [-220, 360, 12], [-360, 270, 12], [-400, 120, 11], [-300, 40, 10], [-360, -80, 11], [-300, -220, 12], [-150, -300, 12],
        ],
        pads: [{ s: 0.03, lat: 0 }, { s: 0.36, lat: 0 }, { s: 0.7, lat: 0 }],
        pickups: [{ s: 0.16, lats: [-4, 0, 4] }, { s: 0.5, lats: [-4, 0, 4] }, { s: 0.82, lats: [-4, 0, 4] }],
        oil: [{ s: 0.28, lat: 3 }, { s: 0.62, lat: -3 }],
        obstacles: [{ s: 0.42, lat: 5, r: 1.9, h: 1.4, kind: 'rock' }, { s: 0.9, lat: -5, r: 1.9, h: 1.4, kind: 'rock' }],
    },
    cratere: {
        id: 'cratere', name: 'Cratère Ardent', closed: true, biome: 'volcan', unlock: 2, runoff: 10, par: 31, defaultLaps: 3,
        desc: 'Le tour d’un cratère en fusion, plein de virages ondulés',
        points: crater(),
        pads: [{ s: 0.1, lat: 0 }, { s: 0.43, lat: 0 }, { s: 0.76, lat: 0 }],
        pickups: [{ s: 0.24, lats: [-4, 0, 4] }, { s: 0.57, lats: [-4, 0, 4] }, { s: 0.9, lats: [-4, 0, 4] }],
        oil: [{ s: 0.36, lat: -3 }, { s: 0.69, lat: 3 }],
        obstacles: [{ s: 0.17, lat: 5, r: 1.9, h: 1.4, kind: 'rock' }, { s: 0.5, lat: -5, r: 1.9, h: 1.4, kind: 'rock' }, { s: 0.83, lat: 5, r: 1.9, h: 1.4, kind: 'rock' }],
    },
    descente: {
        id: 'descente', name: 'Descente Folle', closed: false, biome: 'montagne', unlock: 4, runoff: 9, par: 34, defaultLaps: 1, startAt: 60, runout: 170,
        desc: 'Un sprint qui dévale la montagne : 100 m de dénivelé',
        points: [
            [0, -60, 13], [0, 150, 13], [90, 320, 12], [0, 480, 12], [-110, 620, 12], [-30, 780, 12], [100, 900, 12],
            [60, 1060, 12], [-60, 1180, 12], [-20, 1350, 13], [0, 1550, 13], [0, 1760, 13],
        ],
        heights: [[0, 112], [0.06, 112], [0.25, 92], [0.45, 70], [0.6, 58], [0.8, 30], [0.93, 14], [1, 12]],
        pads: [{ s: 0.12, lat: 0 }, { s: 0.48, lat: 0 }, { s: 0.84, lat: 0 }],
        pickups: [{ s: 0.25, lats: [-5, 0, 5] }, { s: 0.62, lats: [-5, 0, 5] }],
        oil: [{ s: 0.36, lat: 4 }, { s: 0.72, lat: -4 }],
        obstacles: [{ s: 0.3, lat: -6, r: 2, h: 1.4, kind: 'rock' }, { s: 0.56, lat: 6, r: 2, h: 1.4, kind: 'rock' }, { s: 0.78, lat: 0, r: 2.2, h: 1.4, kind: 'rock' }],
        ramps: [{ s: 0.92, lat: 0, half: 7 }],
    },
};

export const TRACK_ORDER = ['ovale', 'lagon', 'zigzag', 'neon', 'droite', 'pins', 'col', 'canyon', 'cratere', 'descente'];

const cache = new Map();

/** Construit (une seule fois) le tracé et positionne ses éléments dans le monde. */
export function getTrack(id) {
    if (cache.has(id)) return cache.get(id);
    const def = TRACK_DEFS[id];
    const t = new Track(def);
    const span = t.closed ? t.length : t.raceLength;
    const toS = f => (t.startS + f * span) % (t.closed ? t.length : Infinity);
    t.pads = (def.pads ?? []).map(p => ({ s: toS(p.s), lat: p.lat, half: 4.5, len: 9, ...world(t, toS(p.s), p.lat) }));
    t.ramps = (def.ramps ?? []).map(r => ({ s: toS(r.s), lat: r.lat, half: r.half, ...world(t, toS(r.s), r.lat) }));
    t.obstacles = (def.obstacles ?? []).map(o => ({ ...o, ...world(t, toS(o.s), o.lat) }));
    for (const [x, z] of def.logs ?? []) t.obstacles.push({ x, z, r: 2.6, h: 1.0, kind: 'log', heading: 0 });
    t.coneSpots = coneSpots(t);
    t.staticOil = (def.oil ?? []).map(o => ({ ...world(t, toS(o.s), o.lat), r: 3.6, water: true }));
    t.pickupSpots = [];
    for (const row of def.pickups ?? []) for (const lat of row.lats) t.pickupSpots.push(world(t, toS(row.s), lat));
    cache.set(id, t);
    return t;
}

/** Trois cônes à l'intérieur des virages les plus serrés : on peut les renverser. */
function coneSpots(t) {
    const h = 4, picks = [];
    const signed = new Float32Array(t.n);
    for (let i = 0; i < t.n; i++) {
        const a = t.wrap(i - h), b = t.wrap(i + h);
        // côté vers lequel tourne la piste
        signed[i] = t.tz[i] * (t.tx[b] - t.tx[a]) - t.tx[i] * (t.tz[b] - t.tz[a]);
    }
    const order = [...Array(t.n).keys()].filter(i => t.closed || (i * t.spacing > t.startS + 40 && i * t.spacing < t.finishS - 40))
        .sort((a, b) => t.curv[b] - t.curv[a]);
    for (const i of order) {
        if (picks.length >= 6 || t.curv[i] < 0.012) break;
        if (picks.some(p => Math.min(Math.abs(p - i), t.n - Math.abs(p - i)) < 40)) continue;
        picks.push(i);
    }
    const spots = [];
    for (const i of picks) {
        const side = Math.sign(signed[i]) || 1;
        for (const k of [-3, 0, 3]) {
            const j = t.wrap(i + k), lat = side * (t.w[j] - 1.2);
            spots.push({ x: t.x[j] + t.tz[j] * lat, z: t.z[j] - t.tx[j] * lat });
        }
    }
    return spots;
}

function world(t, s, lat) {
    const p = t.pointAt(s, lat);
    return { x: p.x, z: p.z, heading: p.heading };
}
