// ============================================================
//  Les 10 pilotes en 3D. Chaque pilote est assis (hanches à y = 0,
//  regard vers +z, mains sur le volant) : le même modèle sert dans
//  la voiture, dans le menu et pour les portraits des fenêtres.
//  Une apparence (classique, nuit, or massif) change les matériaux
//  partout à la fois : Bob en or massif l'est aussi dans les pop-ups.
// ============================================================
import * as THREE from 'three';
import { Builder, mergeGeometries } from './geometry.js';
import { CHARACTERS } from './config.js';

// Couleurs de base de chaque pilote, par « rôle » de matériau
const PALETTES = {
    bob:    { skin: 0xe0ac7e, primary: 0x2d5fa8, secondary: 0xff8c1a, hair: 0x6b3e1f, extra: 0xe9e4da },
    lina:   { skin: 0xf0c4a0, primary: 0xd8322a, secondary: 0xf4f4f4, hair: 0x8b4a2b, extra: 0x1c1c22 },
    volt:   { skin: 0xb8c2cc, primary: 0x8f9aa6, secondary: 0x00bcd4, hair: 0x2b3038, extra: 0x00e5ff },
    rosa:   { skin: 0xf1c6a8, primary: 0xe91e63, secondary: 0xffffff, hair: 0xd9d9de, extra: 0xb07cc6 },
    kiko:   { skin: 0xe8c49a, primary: 0xf39c12, secondary: 0x2ecc71, hair: 0x7a4a26, extra: 0xffe066 },
    frimas: { skin: 0x9fb8d6, primary: 0xf2f6fa, secondary: 0x5aa0e6, hair: 0xf2f6fa, extra: 0xcfc6b0 },
    rex:    { skin: 0x34c46a, primary: 0x2a9d55, secondary: 0xff8c1a, hair: 0x1f7a42, extra: 0xffffff },
    nova:   { skin: 0xf0c4a0, primary: 0xf4f6f8, secondary: 0x3498db, hair: 0x2b2b30, extra: 0xd4a017 },
    zoe:    { skin: 0xc68642, primary: 0xf4f4f0, secondary: 0x9b59b6, hair: 0x8e44ad, extra: 0xc8962e },
    shin:   { skin: 0xe0b090, primary: 0x23262d, secondary: 0xd62828, hair: 0x15161a, extra: 0x3a3f4a },
};

const ROLES = ['skin', 'primary', 'secondary', 'hair', 'extra', 'eye', 'white', 'glass', 'glow'];

// ---------- Silhouettes ----------
/** Torse assis et bras vers le volant (commun à tous). */
function body(b, { wide = 1, mat = 'primary', arm = 'primary', hand = 'skin', belly = 1 } = {}) {
    b.loft(mat, [[0.13 * belly, 0.13 * wide, 0.0, 0.1], [0.06, 0.2 * wide, -0.02, 0.32], [-0.08, 0.2 * wide, 0.0, 0.46], [-0.13, 0.13 * wide, 0.06, 0.5]], { radial: 18, steps: 4, round: 2.4, shoulder: 0.5 });
    b.both(x => {
        b.ball(mat, 0.075 * wide, x * 0.19 * wide, 0.42, -0.03);                                // épaule
        b.tube(arm, [x * 0.2 * wide, 0.4, -0.02], [x * 0.2, 0.26, 0.17], 0.052 * wide);           // bras
        b.tube(arm, [x * 0.2, 0.26, 0.17], [x * 0.15, 0.3, 0.36], 0.046 * wide);                  // avant-bras
        b.ball(hand, 0.05, x * 0.15, 0.3, 0.38);                                                  // main
    }, 1);
}
function eyes(b, y, z, spread = 0.055, r = 0.026, white = true) {
    b.both(x => {
        if (white) b.ball('white', r * 1.35, x * spread, y, z - 0.008, 1, 1, 0.6);
        b.ball('eye', r, x * spread, y, z + 0.004, 1, 1, 0.6);
    }, 1);
}

const BUILD = {
    /** Bob : le mécano barbu à casquette, salopette bleue. */
    bob(b) {
        body(b, { wide: 1.2, belly: 1.4, arm: 'extra' });
        b.box('secondary', 0.1, 0.07, 0.02, 0, 0.36, 0.17);              // poche de salopette
        b.ball('skin', 0.17, 0, 0.66, 0.01);
        b.ball('hair', 0.15, 0, 0.6, 0.06, 1.08, 0.85, 0.85);          // barbe
        b.ball('skin', 0.042, 0, 0.66, 0.175);                          // nez
        eyes(b, 0.71, 0.15);
        b.box('hair', 0.15, 0.02, 0.02, 0, 0.765, 0.15);               // sourcils
        b.ball('secondary', 0.172, 0, 0.73, 0, 1, 0.6, 1);              // casquette
        b.box('secondary', 0.22, 0.025, 0.16, 0, 0.745, 0.17, -0.1);     // visière
        b.both(x => b.ball('skin', 0.04, x * 0.17, 0.66, 0), 1);        // oreilles
    },
    /** Lina : pilote de rallye, casque intégral et queue de cheval. */
    lina(b) {
        body(b, { wide: 0.95 });
        b.box('secondary', 0.26, 0.04, 0.02, 0, 0.3, 0.2);               // bande de la combinaison
        b.ball('secondary', 0.185, 0, 0.68, 0);                          // casque
        b.loft('primary', [[0.19, 0.03, 0.83, 0.86], [0, 0.07, 0.86, 0.875], [-0.19, 0.03, 0.8, 0.84]], { radial: 10, round: 3 });   // bande du casque
        b.ball('glass', 0.15, 0, 0.68, 0.06, 1.05, 0.55, 0.9);           // visière
        b.tube('hair', [0, 0.7, -0.17], [0, 0.48, -0.3], 0.05);          // queue de cheval
        b.ball('hair', 0.06, 0, 0.47, -0.31);
    },
    /** Volt : robot chromé aux yeux néon. */
    volt(b) {
        body(b, { wide: 1.05, mat: 'primary', arm: 'hair', hand: 'primary' });
        b.box('secondary', 0.16, 0.1, 0.02, 0, 0.32, 0.2);               // écran de poitrine
        b.box('skin', 0.3, 0.26, 0.26, 0, 0.7, 0);                         // tête
        b.box('hair', 0.26, 0.08, 0.02, 0, 0.72, 0.131);                   // bandeau des yeux
        b.both(x => {
            b.box('glow', 0.07, 0.035, 0.01, x * 0.06, 0.72, 0.14);          // yeux
            b.place('secondary', new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateZ(Math.PI / 2), x * 0.17, 0.7, 0);   // oreilles
        }, 1);
        b.tube('hair', [0, 0.83, 0], [0, 0.98, -0.03], 0.012);           // antenne
        b.ball('glow', 0.03, 0, 0.99, -0.03);
        b.box('hair', 0.14, 0.02, 0.01, 0, 0.62, 0.131);                   // bouche
    },
    /** Mamie Rosa : chignon, lunettes rondes et collier de perles. */
    rosa(b) {
        body(b, { wide: 0.95, belly: 1.1 });
        for (let i = -3; i <= 3; i++) b.ball('white', 0.018, i * 0.035, 0.49 - Math.abs(i) * 0.012, 0.12 - Math.abs(i) * 0.01);
        b.ball('skin', 0.16, 0, 0.66, 0.01);
        b.ball('hair', 0.165, 0, 0.7, -0.02, 1, 0.92, 1);                 // cheveux
        b.ball('hair', 0.09, 0, 0.86, -0.06);                             // chignon
        b.ball('skin', 0.035, 0, 0.65, 0.165);
        eyes(b, 0.69, 0.14, 0.055, 0.02, false);
        b.both(x => b.place('extra', new THREE.TorusGeometry(0.042, 0.009, 6, 18), x * 0.058, 0.69, 0.16), 1);   // lunettes
        b.box('extra', 0.03, 0.008, 0.01, 0, 0.69, 0.165);
        b.box('primary', 0.06, 0.014, 0.01, 0, 0.6, 0.155);               // rouge à lèvres
    },
    /** Kiko : le singe, grandes oreilles et visage clair. */
    kiko(b) {
        body(b, { wide: 0.9, mat: 'primary', arm: 'hair', hand: 'skin' });
        b.ball('hair', 0.17, 0, 0.66, 0);                                 // tête
        b.ball('skin', 0.13, 0, 0.62, 0.07, 1.1, 0.9, 0.8);                // museau clair
        b.ball('skin', 0.1, 0, 0.72, 0.08, 1.3, 0.7, 0.6);                 // front clair
        b.both(x => { b.ball('hair', 0.07, x * 0.19, 0.69, 0, 0.5, 1, 1); b.ball('skin', 0.045, x * 0.205, 0.69, 0.01, 0.4, 1, 1); }, 1);   // oreilles
        eyes(b, 0.71, 0.155, 0.05, 0.022);
        b.box('eye', 0.06, 0.01, 0.01, 0, 0.58, 0.17);                    // sourire
        b.tube('hair', [0, 0.1, -0.12], [0, 0.35, -0.32], 0.025);         // queue
        b.ball('secondary', 0.06, 0, 0.83, -0.02, 1.4, 0.5, 1.4);          // petit chapeau
    },
    /** Frimas : le yéti tout blanc, visage bleu et cornes. */
    frimas(b) {
        body(b, { wide: 1.3, mat: 'hair', arm: 'hair', hand: 'skin', belly: 1.3 });
        b.ball('hair', 0.2, 0, 0.67, 0, 1.05, 1, 1);
        b.ball('skin', 0.12, 0, 0.66, 0.1, 1.2, 1, 0.7);                   // visage
        eyes(b, 0.7, 0.18, 0.05, 0.022);
        b.box('eye', 0.09, 0.012, 0.01, 0, 0.61, 0.185);
        b.both(x => b.place('extra', new THREE.ConeGeometry(0.035, 0.14, 10), x * 0.13, 0.84, -0.01, 0, 0, -x * 0.5), 1);   // cornes
        b.both(x => b.ball('secondary', 0.04, x * 0.14, 0.32, 0.17), 1);   // boutons de veste
    },
    /** Rex : le dinosaure, long museau et crête orange. */
    rex(b) {
        body(b, { wide: 1.1, mat: 'skin', arm: 'skin', hand: 'skin', belly: 1.2 });
        b.ball('primary', 0.13, 0, 0.3, 0.1, 1, 1.3, 0.6);                  // ventre
        b.ball('skin', 0.16, 0, 0.7, 0);                                   // crâne
        b.ball('skin', 0.12, 0, 0.64, 0.14, 0.9, 0.75, 1.3);                // museau
        b.both(x => { b.ball('white', 0.04, x * 0.08, 0.77, 0.1); b.ball('eye', 0.022, x * 0.085, 0.775, 0.135); }, 1);
        for (let i = -2; i <= 2; i++) b.place('extra', new THREE.ConeGeometry(0.012, 0.03, 4).rotateX(Math.PI), i * 0.03, 0.585, 0.28);    // dents
        for (let i = 0; i < 5; i++) b.place('secondary', new THREE.ConeGeometry(0.035, 0.08, 6), 0, 0.84 - i * 0.12, -0.08 - i * 0.04, -0.6 - i * 0.15);   // crête
        b.both(x => b.ball('hair', 0.012, x * 0.03, 0.68, 0.29), 1);      // narines
    },
    /** Nova : l'astronaute, casque en bulle à visière dorée. */
    nova(b) {
        body(b, { wide: 1.1, mat: 'primary', arm: 'primary', hand: 'primary' });
        b.box('secondary', 0.08, 0.08, 0.02, 0.09, 0.4, 0.15);            // écusson
        b.box('extra', 0.12, 0.06, 0.02, -0.06, 0.3, 0.19);                 // panneau de commande
        b.box('primary', 0.3, 0.34, 0.12, 0, 0.32, -0.2);                   // sac à dos
        b.place('primary', new THREE.TorusGeometry(0.12, 0.03, 8, 20).rotateX(Math.PI / 2), 0, 0.52, 0);   // col du casque
        b.ball('primary', 0.2, 0, 0.7, 0);                                  // casque
        b.ball('glass', 0.16, 0, 0.71, 0.07, 1.05, 0.85, 0.8);              // visière dorée
        b.ball('secondary', 0.03, 0.16, 0.82, -0.02);
    },
    /** Zoé : l'inventrice, coupe au carré et lunettes de soudeur. */
    zoe(b) {
        body(b, { wide: 0.92, mat: 'primary', arm: 'primary' });
        b.box('secondary', 0.1, 0.12, 0.02, 0, 0.33, 0.19);                // t-shirt sous la blouse
        b.ball('skin', 0.155, 0, 0.66, 0.01);
        b.ball('hair', 0.172, 0, 0.7, -0.02, 1.05, 0.95, 1.05);             // cheveux
        b.box('hair', 0.3, 0.08, 0.05, 0, 0.6, -0.1);                       // carré
        eyes(b, 0.68, 0.145, 0.052, 0.021);
        b.box('eye', 0.05, 0.01, 0.01, 0, 0.6, 0.155);
        b.place('extra', new THREE.TorusGeometry(0.165, 0.016, 6, 24).rotateX(Math.PI / 2), 0, 0.78, 0);   // sangle
        b.both(x => {
            b.place('extra', new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateX(Math.PI / 2), x * 0.065, 0.8, 0.14);
            b.place('glass', new THREE.CylinderGeometry(0.038, 0.038, 0.045, 14).rotateX(Math.PI / 2), x * 0.065, 0.8, 0.145);
        }, 1);
    },
    /** Shin : le ninja, cagoule noire et bandeau rouge. */
    shin(b) {
        body(b, { wide: 0.95, mat: 'primary', arm: 'primary', hand: 'extra' });
        b.box('secondary', 0.3, 0.035, 0.03, 0, 0.12, 0.13);               // ceinture
        b.ball('primary', 0.16, 0, 0.67, 0);                               // cagoule
        b.box('skin', 0.2, 0.06, 0.06, 0, 0.69, 0.13);                      // fente des yeux
        eyes(b, 0.69, 0.165, 0.045, 0.018, false);
        b.place('secondary', new THREE.TorusGeometry(0.158, 0.02, 6, 24).rotateX(Math.PI / 2), 0, 0.75, 0);   // bandeau
        b.tube('secondary', [0.02, 0.75, -0.16], [0.09, 0.66, -0.32], 0.02);
        b.tube('secondary', [-0.02, 0.75, -0.16], [-0.05, 0.6, -0.3], 0.02);
    },
};

// ---------- Matériaux selon l'apparence ----------
function makeMaterial(role, color, skin) {
    if (skin === 'or' && role !== 'eye' && role !== 'glow') {
        // Or massif : tout le pilote est en or, seuls les yeux restent sombres
        const tint = role === 'glass' ? 0xffe28a : role === 'white' ? 0xfff2b8 : 0xf5c242;
        // Un peu de lueur propre : l'or reste doré même devant un fond sombre (menus, portraits)
        return new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0.85, roughness: role === 'glass' ? 0.1 : 0.26, clearcoat: 0.6, envMapIntensity: 1.8, emissive: 0x5a3a00, emissiveIntensity: 0.55 });
    }
    switch (role) {
        case 'eye': return new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.2 });
        case 'white': return new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
        case 'glow': return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4, toneMapped: false });
        case 'glass': return new THREE.MeshPhysicalMaterial({ color: skin === 'nuit' ? 0x1a1030 : color, metalness: 0.9, roughness: 0.06, clearcoat: 1, envMapIntensity: 2 });
        default: {
            const metal = role === 'skin' && color === PALETTES.volt.skin;
            return new THREE.MeshPhysicalMaterial({ color, roughness: metal ? 0.25 : 0.55, metalness: metal ? 0.8 : 0.05, clearcoat: role === 'secondary' ? 0.5 : 0.15, sheen: role === 'hair' ? 0.6 : 0 });
        }
    }
}

/** Couleur d'un rôle pour une apparence donnée. */
function roleColor(id, role, skin) {
    const p = PALETTES[id];
    const base = { ...p, eye: 0x111116, white: 0xf5f5f5, glass: role === 'glass' ? (id === 'nova' ? 0xd4a017 : 0x182030) : 0, glow: p.extra };
    if (skin === 'nuit') {
        // Nuit : tenue sombre, détails aux néons de la couleur fétiche
        const neon = CHARACTERS[id].color === 0x2c3e50 ? 0x20e3ff : CHARACTERS[id].color;
        if (role === 'primary') return 0x1b1b26;
        if (role === 'secondary') return neon;
        if (role === 'extra') return 0x2b2b38;
        if (role === 'glow') return neon;
    }
    return base[role];
}

const geoCache = new Map();
function geometries(id) {
    if (geoCache.has(id)) return geoCache.get(id);
    const b = new Builder();
    BUILD[id](b);
    const groups = {};
    for (const [mat, list] of Object.entries(b.parts)) groups[mat] = mergeGeometries(list.map(g => (g.attributes.normal ? g : (g.computeVertexNormals(), g))));
    geoCache.set(id, groups);
    return groups;
}

/**
 * Construit un pilote. Renvoie { root, dispose(), materials }.
 * `skin` : classique | nuit | or.
 */
export function buildCharacterModel(id, skin = 'classique') {
    if (!BUILD[id]) id = 'bob';
    const root = new THREE.Group();
    const mats = {};
    for (const [role, geo] of Object.entries(geometries(id))) {
        mats[role] ??= makeMaterial(role, roleColor(id, role, skin), skin);
        const m = new THREE.Mesh(geo, mats[role]);
        m.castShadow = true;
        root.add(m);
    }
    root.userData.character = id;
    return { root, materials: mats, dispose() { Object.values(mats).forEach(m => m.dispose()); } };
}

/** Peinture du kart selon l'apparence : l'or massif dore aussi la carrosserie. */
export function paintForSkin(skin, color) {
    if (skin === 'or') return { color: 0xf2b92e, metalness: 0.9, roughness: 0.2, emissive: 0x3a2400 };
    return { color, metalness: 0.55, roughness: 0.34 };
}

export { ROLES };
