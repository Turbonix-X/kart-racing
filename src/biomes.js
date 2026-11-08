// ============================================================
//  Les 4 biomes : couleurs et règles de conduite (données pures,
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
};
export const BIOME_ORDER = ['plaine', 'glace', 'jungle', 'desert'];
