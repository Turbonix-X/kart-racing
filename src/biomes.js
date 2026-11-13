// ============================================================
//  Les 8 biomes : couleurs et règles de conduite (données pures,
//  sans rendu : la simulation et les tests les utilisent aussi).
//  grip : adhérence sur la piste · offroad : vitesse hors-piste
// ============================================================

export const BIOMES = {
    plaine: {
        name: 'Plaine', ground: '#4c9a3c', groundAlt: '#3d8532', road: '#3b3b40',
        skyTop: 0x3a8ee6, skyLow: 0xd4ecf7, fog: 0xcbe6f2, fogNear: 170, fogFar: 950, sun: 0xfff1d6, sunI: 3.0, hemi: 1.1,
        barrier: ['#ececec', '#d83a2a'], kerb: ['#d42020', '#f2f2f2'], hills: { color: 0x5f9a52, height: 70 },
        obstacle: 'rock', grip: 1, offroad: 1, clouds: 1, desc: 'Herbe tendre et adhérence parfaite',
    },
    glace: {
        name: 'Glace', ground: '#eef4fb', groundAlt: '#d3e2f2', road: '#4b5563',
        skyTop: 0x6d9fd8, skyLow: 0xe8f2fb, fog: 0xdde9f5, fogNear: 120, fogFar: 760, sun: 0xffffff, sunI: 2.8, hemi: 1.25,
        barrier: ['#ffffff', '#2f7fd6'], kerb: ['#2f7fd6', '#ffffff'], hills: { color: 0x8aa4c0, cap: 0xffffff, height: 160 },
        obstacle: 'ice', grip: 0.62, offroad: 0.85, clouds: 1.4, desc: 'La piste glisse : freine plus tôt',
    },
    jungle: {
        name: 'Jungle', ground: '#2f7d33', groundAlt: '#22652a', road: '#3a3833',
        skyTop: 0x4fa3d9, skyLow: 0xd9f0dd, fog: 0xa9d6b0, fogNear: 100, fogFar: 650, sun: 0xfff0c8, sunI: 2.7, hemi: 1.0,
        barrier: ['#f2d24a', '#2d6b2a'], kerb: ['#e8a317', '#2b2b2b'], hills: { color: 0x2e6b34, height: 120 },
        obstacle: 'mossy', grip: 0.95, offroad: 0.9, clouds: 1.2, desc: 'Végétation dense et brume humide',
    },
    desert: {
        name: 'Désert', ground: '#d8a25e', groundAlt: '#c48a48', road: '#4a4038',
        skyTop: 0x3f86d8, skyLow: 0xf6dcb6, fog: 0xf0d2a6, fogNear: 180, fogFar: 1000, sun: 0xfff0d0, sunI: 3.4, hemi: 1.0,
        barrier: ['#ffffff', '#ff8c1a'], kerb: ['#ff8c1a', '#ffffff'], hills: { color: 0xc07a45, height: 95, mesa: true },
        obstacle: 'sandstone', grip: 0.97, offroad: 0.8, clouds: 0.4, desc: 'Le sable freine dès que tu sors',
    },
    montagne: {
        name: 'Montagne', ground: '#5e8a4a', groundAlt: '#4b733b', road: '#3c3d42',
        skyTop: 0x2f7fd6, skyLow: 0xcfe4f4, fog: 0xc3d8ea, fogNear: 220, fogFar: 1300, sun: 0xfff4e0, sunI: 3.1, hemi: 1.15,
        barrier: ['#f4f4f4', '#2f7fd6'], kerb: ['#d42020', '#f2f2f2'], hills: { color: 0x7a8794, cap: 0xffffff, height: 260 },
        obstacle: 'boulder', grip: 0.98, offroad: 0.9, clouds: 1.1, elevation: 26, desc: 'Ça monte et ça descend : prends de l’élan en descente',
    },
    volcan: {
        name: 'Volcan', ground: '#2b2422', groundAlt: '#3a2a24', road: '#2c2a2b',
        skyTop: 0x5a2a26, skyLow: 0xe0835a, fog: 0x8a4a3a, fogNear: 110, fogFar: 760, sun: 0xffb27a, sunI: 2.4, hemi: 0.8,
        barrier: ['#2b2b2b', '#ff5a1a'], kerb: ['#ff5a1a', '#1c1c1c'], hills: { color: 0x2a201d, height: 150 },
        obstacle: 'basalt', grip: 1, offroad: 0.82, clouds: 0.8, cloudColor: 0x6b5a58, desc: 'Roche noire et rivières de lave',
    },
    plage: {
        name: 'Plage', ground: '#ecd9a8', groundAlt: '#dcc690', road: '#45464c',
        skyTop: 0x1f8fe0, skyLow: 0xd8f1fb, fog: 0xc8ecf7, fogNear: 200, fogFar: 1150, sun: 0xfff6dc, sunI: 3.3, hemi: 1.15,
        barrier: ['#ffffff', '#1fb5c9'], kerb: ['#1fb5c9', '#ffffff'], hills: { color: 0x3f8f4a, height: 80 },
        obstacle: 'coral', grip: 1, offroad: 0.86, clouds: 0.7, desc: 'Sable fin, lagon turquoise et palmiers',
    },
    ville: {
        name: 'Ville de nuit', ground: '#26262e', groundAlt: '#1f1f26', road: '#2a2a31',
        skyTop: 0x080a1e, skyLow: 0x3a1f5a, fog: 0x1c1430, fogNear: 140, fogFar: 900, sun: 0x9ab0ff, sunI: 1.3, hemi: 0.75,
        barrier: ['#1b1b22', '#ff2fa0'], kerb: ['#ff2fa0', '#20e3ff'], hills: { color: 0x14141c, height: 60 },
        obstacle: 'barrels', grip: 1, offroad: 0.9, clouds: 0, night: true, desc: 'Néons, gratte-ciel et asphalte mouillé',
    },
};
export const BIOME_ORDER = ['plaine', 'glace', 'jungle', 'desert', 'montagne', 'volcan', 'plage', 'ville'];
