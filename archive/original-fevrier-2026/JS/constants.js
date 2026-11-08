// ============================================
// KART RACING Alpha 1.4 — Constants & Config
// ============================================

export const MAP_LIMIT = 500;

export const COLORS = [
    0xe74c3c, // Rouge vif
    0x2ecc71, // Vert émeraude
    0x3498db, // Bleu ciel
    0xf39c12, // Orange doré
    0x9b59b6, // Violet
    0x1abc9c, // Turquoise
    0xecf0f1, // Blanc cassé
    0x2c3e50, // Bleu nuit
    0xe91e63, // Rose fuchsia
    0x00bcd4, // Cyan
    0xff5722, // Orange brûlé
    0x8bc34a, // Vert lime
];

// Stats des voitures : speed/accel/handling normalisés 0-100
// Utilisés pour la physique réelle ET l'affichage
export const CAR_STATS = {
    f1:     { name: 'FORMULE 1',     speed: 95, accel: 80, handling: 60, offroad: 5,  drift: 30, canJump: false, desc: 'Ultra rapide sur piste, inutile hors-piste' },
    truck:  { name: 'MONSTER TRUCK', speed: 45, accel: 40, handling: 35, offroad: 95, drift: 20, canJump: true,  desc: 'Tout-terrain, peut sauter avec ESPACE' },
    sport:  { name: 'GT SPORT',      speed: 70, accel: 60, handling: 70, offroad: 40, drift: 50, canJump: false, desc: 'Équilibré et polyvalent' },
    muscle: { name: 'MUSCLE CAR',    speed: 85, accel: 90, handling: 40, offroad: 30, drift: 40, canJump: false, desc: 'Accélération brutale, tenue de route moyenne' },
    drift:  { name: 'DRIFT KING',    speed: 65, accel: 55, handling: 90, offroad: 25, drift: 95, canJump: false, desc: 'Conçu pour le drift, très agile' },
};

// Mapping stats (0-100) vers valeurs physiques réelles
// maxSpeed on-track : lerp(0.5, 1.4, speed/100)
// maxSpeed off-track: lerp(0.05, 0.7, offroad/100)
// acceleration on-track: lerp(0.005, 0.025, accel/100)
// acceleration off-track: lerp(0.001, 0.01, offroad/100)
// turnRate: lerp(0.025, 0.07, handling/100)
export function getPhysics(carType, onTrack) {
    const s = CAR_STATS[carType];
    const maxSpeed = onTrack
        ? 0.5 + (s.speed / 100) * 0.9
        : 0.05 + (s.offroad / 100) * 0.65;
    const acceleration = onTrack
        ? 0.005 + (s.accel / 100) * 0.020
        : 0.001 + (s.offroad / 100) * 0.009;
    const turnRate = 0.025 + (s.handling / 100) * 0.045;
    return { maxSpeed, acceleration, turnRate };
}
