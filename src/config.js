// ============================================================
//  Réglages du jeu : véhicules, équilibrage, modes.
//  Toutes les valeurs à ajuster se trouvent ici.
// ============================================================

export const VERSION = 'Alpha 1.4';
export const FIXED_DT = 1 / 60;        // pas de simulation (indépendant de l'écran)
export const MS_TO_KMH = 3.6;          // 1 unité = 1 mètre

export const COLORS = [
    0xe74c3c, 0x2ecc71, 0x3498db, 0xf39c12, 0x9b59b6, 0x1abc9c,
    0xecf0f1, 0x2c3e50, 0xe91e63, 0x00bcd4, 0xff5722, 0x8bc34a,
];

// Stats de 0 à 100 : ce sont elles qui pilotent la physique (voir getSpec).
// `unlock` = points de médailles nécessaires pour débloquer le véhicule.
export const VEHICLES = {
    f1:     { name: 'FORMULE 1',     icon: '🏎️', speed: 95,  accel: 80, handling: 60, offroad: 5,  drift: 30, canJump: false, unlock: 0, desc: 'La plus rapide en ligne droite, perdue hors-piste' },
    truck:  { name: 'MONSTER TRUCK', icon: '🛻', speed: 45,  accel: 45, handling: 40, offroad: 95, drift: 25, canJump: true,  unlock: 0, desc: 'Roi du hors-piste. Saute (ESPACE) obstacles et raccourcis', radius: 1.9 },
    sport:  { name: 'GT SPORT',      icon: '🚗', speed: 72,  accel: 62, handling: 72, offroad: 40, drift: 50, canJump: false, unlock: 0, desc: 'Équilibrée et facile à conduire' },
    muscle: { name: 'MUSCLE CAR',    icon: '💪', speed: 84,  accel: 92, handling: 38, offroad: 30, drift: 42, canJump: false, unlock: 0, desc: 'Accélération brutale, mais lourde en virage', radius: 1.8 },
    drift:  { name: 'DRIFT KING',    icon: '🌀', speed: 66,  accel: 56, handling: 86, offroad: 25, drift: 98, canJump: false, unlock: 0, desc: 'Charge ses boosts de drift deux fois plus vite' },
    kart:   { name: 'KART ÉCLAIR',   icon: '⚡', speed: 60,  accel: 98, handling: 98, offroad: 35, drift: 80, canJump: false, unlock: 3, desc: 'Minuscule, nerveux, colle à la route', radius: 1.3 },
    proto:  { name: 'PROTOTYPE X',   icon: '🚀', speed: 100, accel: 88, handling: 76, offroad: 12, drift: 48, canJump: false, unlock: 8, desc: 'Le sommet de la technologie Turbonix' },
};

/** Convertit les stats d'affichage (0-100) en grandeurs physiques réelles. */
export function getSpec(type) {
    const s = VEHICLES[type];
    const sp = s.speed / 100, ac = s.accel / 100, h = s.handling / 100, off = s.offroad / 100, dr = s.drift / 100;
    return {
        type,
        topSpeed: 34 + sp * 50,          // u/s : la F1 atteint ~ 293 km/h
        accel: 14 + ac * 26,             // u/s²
        brake: 52 + h * 20,
        reverseAccel: 16,
        offroadTop: 10 + off * 45,
        offroadAccel: 6 + off * 20,
        yaw: 1.25 + h * 1.25,            // rad/s de braquage à vitesse moyenne
        highYaw: 0.42 + h * 0.12,        // part du braquage restante à pleine vitesse
        grip: 5 + h * 7,                 // amortissement de la glisse latérale
        driftGrip: 3.4 - dr * 1.4,       // moins il y a d'adhérence, plus ça glisse
        driftYaw: 1.0 + dr * 0.25,
        driftDrag: 7 - dr * 5,           // perte de vitesse pendant le drift
        chargeRate: 0.5 + dr * 0.9,      // vitesse de charge du boost de drift
        jump: s.canJump ? 13 : 0,
        radius: s.radius ?? 1.6,
    };
}

export const DIFFICULTIES = {
    easy:   { name: 'Facile',    perf: 0.86, corner: 30 },
    normal: { name: 'Normal',    perf: 0.94, corner: 38 },
    hard:   { name: 'Difficile', perf: 1.00, corner: 46 },
};

export const BOT_NAMES = ['Foudre', 'Nitro', 'Comète', 'Rouille', 'Piston', 'Vega', 'Orage'];
export const BOT_COLORS = [0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe91e63, 0xecf0f1];

export const CHAMP_POINTS = [10, 7, 5, 3, 2, 1];
export const CHAMP_TRACKS = ['ovale', 'zigzag', 'pins', 'canyon'];

export const MEDALS = { gold: 3, silver: 2, bronze: 1 };
export const MEDAL_LABEL = { gold: '🥇 Or', silver: '🥈 Argent', bronze: '🥉 Bronze' };
export const CUP_POINTS = 3;           // points bonus pour une coupe gagnée
