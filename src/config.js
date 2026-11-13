// ============================================================
//  Réglages du jeu : véhicules, équilibrage, modes.
//  Toutes les valeurs à ajuster se trouvent ici.
// ============================================================

export const VERSION = 'Alpha 1.5';
export const GAME_NAME = 'TurboKart';
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

/** Stats d'affichage (0-100) d'un véhicule, avec les bonus du pilote et des roues. */
export function effectiveStats(type, character = null, wheels = 'route') {
    const base = VEHICLES[type], out = {};
    const ch = CHARACTERS[character]?.stats ?? {}, wh = WHEELS[wheels]?.stats ?? {};
    for (const k of ['speed', 'accel', 'handling', 'offroad', 'drift']) out[k] = Math.max(1, Math.min(100, base[k] + (ch[k] ?? 0) + (wh[k] ?? 0)));
    return out;
}

/**
 * Convertit les stats d'affichage (0-100) en grandeurs physiques réelles.
 * Alpha 1.5 : vitesses de pointe abaissées d'environ 18 % (le jeu allait trop vite).
 */
export function getSpec(type, character = null, wheels = 'route') {
    const s = VEHICLES[type], e = effectiveStats(type, character, wheels);
    const sp = e.speed / 100, ac = e.accel / 100, h = e.handling / 100, off = e.offroad / 100, dr = e.drift / 100;
    const perk = CHARACTERS[character]?.perk ?? null;
    return {
        type, character, wheels, perk,
        topSpeed: 28 + sp * 41,          // u/s : la F1 atteint ~ 240 km/h
        accel: 12 + ac * 22,             // u/s²
        brake: 48 + h * 18,
        reverseAccel: 14,
        offroadTop: (9 + off * 37) * (perk === 'rally' ? 1.12 : 1),
        offroadAccel: 5 + off * 17,
        yaw: 1.25 + h * 1.25,            // rad/s de braquage à vitesse moyenne
        highYaw: 0.42 + h * 0.12,        // part du braquage restante à pleine vitesse
        grip: 5 + h * 7,                 // amortissement de la glisse latérale
        driftGrip: 3.4 - dr * 1.4,       // moins il y a d'adhérence, plus ça glisse
        driftYaw: 1.0 + dr * 0.25,
        driftDrag: 6 - dr * 4.2,         // perte de vitesse pendant le drift
        chargeRate: (0.5 + dr * 0.9) * (perk === 'drifter' ? 1.2 : 1),
        jump: s.canJump ? 13 : 0,
        radius: s.radius ?? 1.6,
        iceGrip: (WHEELS[wheels]?.iceGrip ?? 0) + (perk === 'yeti' ? 0.6 : 0),
        mass: perk === 'heavy' ? 1.6 : s.canJump ? 1.3 : 1,
        boostMult: perk === 'turbo' ? 1.25 : 1,
        itemTime: perk === 'gadgets' ? 1.4 : 1,
        spinTime: perk === 'tough' ? 0.55 : 1,
        hop: perk === 'astro' ? 8.4 : 6.2,
    };
}

/**
 * Les 10 pilotes. Chacun change les stats du véhicule et a un talent.
 * `kart` : véhicule préféré (celui des adversaires) · `color` : peinture fétiche.
 */
export const CHARACTERS = {
    bob:    { name: 'Bob',        title: 'Le mécano',           color: 0xff8c1a, kart: 'truck',  stats: { accel: -5, offroad: 10 },             perk: 'heavy',   perkName: 'Costaud',         perkDesc: 'Pousse fort dans les chocs et ne se laisse pas bousculer' },
    lina:   { name: 'Lina',       title: 'La pilote de rallye', color: 0xe74c3c, kart: 'sport',  stats: { handling: 8, offroad: 6, speed: -4 },  perk: 'rally',   perkName: 'Rallye',          perkDesc: 'Va 12 % plus vite hors de la piste' },
    volt:   { name: 'Volt',       title: 'Le robot',            color: 0x00bcd4, kart: 'proto',  stats: { speed: 8, handling: -6 },             perk: 'turbo',   perkName: 'Surcharge',       perkDesc: 'Tous ses boosts durent 25 % plus longtemps' },
    rosa:   { name: 'Mamie Rosa', title: 'La reine du drift',   color: 0xe91e63, kart: 'muscle', stats: { drift: 12, accel: -4 },              perk: 'drifter', perkName: 'Vieille école',   perkDesc: 'Charge ses boosts de drift 20 % plus vite' },
    kiko:   { name: 'Kiko',       title: 'Le singe farceur',    color: 0xf39c12, kart: 'kart',   stats: { accel: 8, speed: -4 },                perk: 'lucky',   perkName: 'Chanceux',        perkDesc: 'Tire de meilleurs objets dans les boîtes mystère' },
    frimas: { name: 'Frimas',     title: 'Le yéti',             color: 0xdfe9f3, kart: 'truck',  stats: { offroad: 8, accel: -6, handling: 2 }, perk: 'yeti',    perkName: 'Pattes de neige', perkDesc: 'Ne glisse presque pas sur la glace' },
    rex:    { name: 'Rex',        title: 'Le dinosaure',        color: 0x2ecc71, kart: 'muscle', stats: { speed: 6, handling: -4 },             perk: 'tough',   perkName: 'Cuir épais',      perkDesc: 'Ses tête-à-queue durent moitié moins longtemps' },
    nova:   { name: 'Nova',       title: 'L\'astronaute',       color: 0x3498db, kart: 'f1',     stats: { handling: 4, accel: 2 },              perk: 'astro',   perkName: 'Apesanteur',      perkDesc: 'Saut synchro et ressort beaucoup plus hauts' },
    zoe:    { name: 'Zoé',        title: 'L\'inventrice',       color: 0x9b59b6, kart: 'drift',  stats: { accel: 4, drift: 4 },                 perk: 'gadgets', perkName: 'Bricoleuse',      perkDesc: 'Bouclier, fantôme, aimant et turbo durent 40 % plus longtemps' },
    shin:   { name: 'Shin',       title: 'Le ninja',            color: 0x2c3e50, kart: 'sport',  stats: { handling: 6, drift: 4, speed: -2 },   perk: 'dodge',   perkName: 'Esquive',         perkDesc: '1 chance sur 4 d\'éviter un objet ou une flaque' },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Apparences : identiques partout (course, menu, fenêtres), car tout est rendu depuis le même modèle 3D. */
export const SKINS = {
    classique: { name: 'Classique' },
    nuit:      { name: 'Nuit' },
    or:        { name: 'Or massif' },
};
export const SKIN_IDS = Object.keys(SKINS);

/** Les 3 types de roues. */
export const WHEELS = {
    route:    { name: 'Route',        desc: 'Les pneus d\'origine : équilibrés partout', stats: {} },
    slick:    { name: 'Slicks',       desc: 'Plus rapides sur le bitume, perdus hors-piste', stats: { speed: 5, accel: 2, offroad: -14, handling: -2 } },
    crampons: { name: 'Tout-terrain', desc: 'Crampons : à l\'aise hors-piste et sur la glace, mais moins rapides', stats: { speed: -5, offroad: 16, handling: 2 }, iceGrip: 0.35 },
};
export const WHEEL_IDS = Object.keys(WHEELS);

/** Chaque course compte entre 4 et 8 pilotes. */
export const MIN_RACERS = 4;
export const MAX_RACERS = 8;

export const DIFFICULTIES = {
    easy:   { name: 'Facile',    perf: 0.86, corner: 30 },
    normal: { name: 'Normal',    perf: 0.94, corner: 38 },
    hard:   { name: 'Difficile', perf: 1.00, corner: 46 },
};


export const CHAMP_POINTS = [12, 9, 7, 5, 4, 3, 2, 1];
export const CHAMP_TRACKS = ['ovale', 'lagon', 'zigzag', 'neon', 'pins', 'col', 'canyon', 'cratere'];

export const MEDALS = { gold: 3, silver: 2, bronze: 1 };
export const MEDAL_LABEL = { gold: '🥇 Or', silver: '🥈 Argent', bronze: '🥉 Bronze' };
export const CUP_POINTS = 3;           // points bonus pour une coupe gagnée
