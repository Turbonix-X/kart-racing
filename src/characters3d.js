// ============================================================
//  Les 10 pilotes en 3D. Chaque pilote est assis (hanches à y = 0,
//  regard vers +z, mains sur le volant) : le même modèle sert dans
//  la voiture, dans le menu et pour les portraits des fenêtres.
//  Les humains sont sculptés : crâne et mâchoire, yeux avec iris et
//  paupières, nez, lèvres, oreilles, cou, épaules, bras, mains à
//  doigts, jambes et chaussures. Une apparence (classique, nuit,
//  or massif) change les matériaux partout à la fois.
// ============================================================
import * as THREE from 'three';
import { Builder, mergeGeometries } from './geometry.js';
import { CHARACTERS } from './config.js';

// Couleurs de base de chaque pilote, par « rôle » de matériau
const PALETTES = {
    bougadi:  { skin: 0xc08a64, primary: 0x6b452b, secondary: 0x4f3220, tertiary: 0x8a5a3c, brow: 0x2a1a10, iris: 0x3fae4a, lip: 0x9a5e48, pants: 0x4f3220, shoe: 0x2e1d12, line: 0x9a6a4c },
    bob:      { shell: 0x3a3546, rim: 0x9b6dff, apron: 0xf6f2ea, kerchief: 0xd81b3c, heart: 0xff85ac, glow: 0xe6dcff, jet: 0xffb020, cheek: 0xff6b9a },
    mamie:    { skin: 0xf0c9ae, primary: 0xb85c8e, secondary: 0xf2e6d8, tertiary: 0x7a4a8a, hair: 0xdcdce2, brow: 0xb9b9c2, iris: 0x5a7fa8, lip: 0xc0506a, pants: 0x5a5560, shoe: 0x3a2a2a, line: 0xd3a488, extra: 0xc8a24a, patch: 0x4f8f6a },
    dino:     { body: 0x9fdc8f, head: 0xb6e8a6, belly: 0xf4f0e6, spike: 0x6f6670, line: 0x7fbf72 },
    ninjacon: { skin: 0xe0b090, primary: 0x23262d, secondary: 0xd62828, tertiary: 0x3a3f4a, brow: 0x15161a, iris: 0x6a4a2a, pants: 0x1b1d23, shoe: 0x111216, extra: 0xb8bcc4, line: 0xc09070 },
    doc:      { skin: 0xe8c4a2, primary: 0xf4f4f0, secondary: 0x2f9e96, tertiary: 0x5a4a3a, hair: 0xe9edf2, brow: 0xc9ced6, iris: 0x4a6a3a, lip: 0xb0705a, pants: 0x4a4038, shoe: 0x2a2420, extra: 0x7dff6a, line: 0xc79f7e, metal: 0xb08a4a },
    lina:     { skin: 0xf0c4a0, primary: 0xd8322a, secondary: 0xf4f4f4, tertiary: 0x1c1c22, hair: 0x8b4a2b, brow: 0x6b3a22, iris: 0x4a7a4a, lip: 0xc9605a, pants: 0xd8322a, shoe: 0x1c1c22, extra: 0xffd23f },
    nova:     { skin: 0xb9805a, primary: 0xf2f4f7, secondary: 0x3498db, tertiary: 0xc9ced6, hair: 0x1f1a18, brow: 0x1f1a18, iris: 0x3a2a1a, lip: 0x8a5040, pants: 0xf2f4f7, shoe: 0xaab2bc, extra: 0xff8c1a },
    corail:   { skin: 0xd9a078, primary: 0xa8242a, secondary: 0xf2c94c, tertiary: 0x2a2a30, hair: 0x2a1c14, brow: 0x2a1c14, iris: 0x2f6f8a, lip: 0xa8604a, pants: 0x2a2a30, shoe: 0x1a1512, extra: 0xf4f1e8, line: 0xb07f5c },
    sven:     { skin: 0xf2cdb0, primary: 0x1f7fc4, secondary: 0xff8c1a, tertiary: 0xf2f4f7, hair: 0xe0b866, brow: 0xc99a4a, iris: 0x4a90c9, lip: 0xc27a6a, pants: 0x2b3a4a, shoe: 0x3a2a1e, extra: 0xd62828 },
};

// ---------- Outils de sculpture ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
const cat = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3); };

/** Volume vertical lissé : anneaux [y, demi-largeur, demi-profondeur, décalage z]. Sert aux torses, cous, chapeaux. */
function column(rings, { radial = 20, round = 2.5, steps = 4 } = {}) {
    const all = [], n = rings.length;
    for (let i = 0; i < n - 1; i++) {
        const a = rings[Math.max(0, i - 1)], b = rings[i], c = rings[i + 1], d = rings[Math.min(n - 1, i + 2)];
        for (let k = 0; k < steps; k++) all.push(b.map((_, m) => cat(a[m] ?? 0, b[m] ?? 0, c[m] ?? 0, d[m] ?? 0, k / steps)));
    }
    all.push(rings[n - 1]);
    const pos = [], idx = [], e = 2 / round, R = all.length;
    for (const [y, hw, hd, zc = 0] of all) for (let j = 0; j < radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        pos.push(spow(Math.cos(th), e) * Math.max(0.001, hw), y, zc + spow(Math.sin(th), e) * Math.max(0.001, hd));
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
        idx.push(a, c, b, b, c, d);
    }
    for (const [ring, flip] of [[0, true], [R - 1, false]]) {
        const center = pos.length / 3;
        pos.push(0, all[ring][0], all[ring][3] ?? 0);
        for (let j = 0; j < radial; j++) { const a = ring * radial + j, b = ring * radial + (j + 1) % radial; if (flip) idx.push(center, a, b); else idx.push(center, b, a); }
    }
    // Volume signé : garantit que les faces regardent vers l'extérieur
    let vol = 0;
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
    }
    if (vol < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** Membre effilé entre deux points, avec ses articulations arrondies. */
function limb(b, role, p, q, r1, r2, seg = 10) {
    _d.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const len = _d.length();
    const g = new THREE.CylinderGeometry(r2, r1, len, seg);
    _q.setFromUnitVectors(UP, _d.normalize());
    g.applyMatrix4(_m.compose(_p.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), _q, ONE));
    b.add(role, g);
    b.ball(role, r1, p[0], p[1], p[2]);
    b.ball(role, r2, q[0], q[1], q[2]);
}

/** Forme du crâne : largeur selon la hauteur (mâchoire, pommettes, haut du crâne). */
function headShape({ jaw = 0.32, tall = 1.18, chin = 0.1, cheeks = 0.05, crown = 0 } = {}) {
    const wf = y => (y < 0 ? 1 - jaw * Math.pow(-y, 1.4) : 1 + crown * y) + cheeks * Math.exp(-((y + 0.15) ** 2) / 0.06);
    const depth = (z, y) => {
        let zz = z * (z > 0 ? 0.92 : 1.04);
        if (y < -0.45 && z > 0) zz += chin * (-y - 0.45) * 1.6;
        if (zz > 0.55) zz = 0.55 + (zz - 0.55) * 0.75;
        return zz * 0.95;
    };
    return {
        tall,
        geo() {
            const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
                p.setXYZ(i, x * wf(y) * 0.86, y * tall, depth(z, y));
            }
            g.computeVertexNormals();
            return g;
        },
        /** Profondeur de la surface du visage au point (x, y), en rayons de tête. */
        surf(xr, yr) {
            const y = Math.max(-0.98, Math.min(0.98, yr / tall));
            const x = Math.max(-0.98, Math.min(0.98, xr / (wf(y) * 0.86)));
            return depth(Math.sqrt(Math.max(0, 1 - x * x - y * y)), y);
        },
    };
}

const HY = 0.69, HZ = 0.012;      // centre de la tête

/**
 * Corps humain assis. Renvoie de quoi poser des accessoires sur le visage :
 * at(x, y, relief) → position absolue d'un point du visage (x, y en rayons de tête).
 */
function human(b, o = {}) {
    const R = o.R ?? 0.15, w = o.w ?? 1, belly = o.belly ?? 0;
    const torso = o.torso ?? 'primary', sleeve = o.sleeve ?? torso, glove = o.glove ?? 'skin';
    const hs = headShape(o.head);
    const at = (xr, yr, lift = 0) => [xr * R, HY + yr * R, HZ + (hs.surf(xr, yr) + lift) * R];

    // --- Torse : hanches, taille, poitrine, épaules ---
    b.add(torso, column([
        [-0.02, 0.15 * w, 0.115, 0], [0.08, 0.16 * w + belly * 0.02, 0.118 + belly * 0.05, belly * 0.03], [0.2, 0.15 * w + belly * 0.02, 0.1 + belly * 0.06, belly * 0.035],
        [0.32, 0.18 * w, 0.105 + (o.bust ?? 0) * 0.03, -0.008 + (o.bust ?? 0) * 0.02], [0.405, 0.2 * w, 0.092, -0.02], [0.45, 0.13 * w, 0.07, -0.02], [0.475, 0.07, 0.055, -0.02],
    ], { radial: 22, round: 2.6 }));
    // --- Cou ---
    limb(b, o.neck ?? 'skin', [0, 0.46, -0.02], [0, 0.58, 0], 0.056, 0.05);

    // --- Bras et mains sur le volant ---
    for (const s of [1, -1]) {
        const sh = [s * 0.205 * w, 0.405, -0.02], el = [s * (0.235 * w), 0.235, 0.13], wr = [s * 0.155, 0.285, 0.33];
        limb(b, sleeve, sh, el, 0.06 * (0.9 + w * 0.1), 0.047);
        limb(b, o.forearm ?? sleeve, el, wr, 0.046, 0.034);
        if (o.cuff) b.place(o.cuff, new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateX(1.2), wr[0], wr[1], wr[2] - 0.01);
        // Main : paume, quatre doigts repliés, pouce
        b.ball(glove, 0.04, wr[0], wr[1] + 0.005, wr[2] + 0.035, 1, 0.72, 1.1);
        for (let f = 0; f < 4; f++) {
            const fx = wr[0] + (f - 1.5) * 0.019;
            b.place(glove, new THREE.CapsuleGeometry(0.0105, 0.03, 3, 6), fx, wr[1] + 0.012, wr[2] + 0.078, 1.15);
            b.place(glove, new THREE.CapsuleGeometry(0.0095, 0.022, 3, 6), fx, wr[1] - 0.012, wr[2] + 0.092, 2.5);
        }
        b.place(glove, new THREE.CapsuleGeometry(0.012, 0.03, 3, 6), wr[0] - s * 0.04, wr[1] + 0.02, wr[2] + 0.05, 0.7, 0, s * 0.7);
    }

    // --- Jambes et chaussures ---
    const pants = o.legs ?? 'pants', shoe = o.shoe ?? 'shoe';
    for (const s of [1, -1]) {
        const hip = [s * 0.085, 0.03, 0.02], knee = [s * 0.105, 0.085, 0.36], ank = [s * 0.1, -0.13, 0.55];
        limb(b, pants, hip, knee, 0.078, 0.058);
        limb(b, o.shin ?? pants, knee, ank, 0.056, 0.04);
        b.ball(shoe, 0.05, ank[0], ank[1] - 0.035, ank[2] + 0.05, 0.95, 0.68, 1.9);
        b.box(o.sole ?? 'eye', 0.085, 0.014, 0.17, ank[0], ank[1] - 0.07, ank[2] + 0.05);
    }

    // --- Tête ---
    b.place(o.headRole ?? 'skin', hs.geo(), 0, HY, HZ, 0, 0, 0, R, R, R);
    if (o.ears !== false) for (const s of [1, -1]) {
        b.ball('skin', 0.17 * R, s * 0.83 * R, HY + 0.02 * R, HZ - 0.06 * R, 0.4, 1, 0.72);
        b.ball(o.line ? 'line' : 'lip', 0.09 * R, s * 0.86 * R, HY + 0.02 * R, HZ - 0.03 * R, 0.25, 0.75, 0.5);
    }
    if (o.face !== false) face(b, at, R, o);
    return { R, at, hs };
}

/** Visage : yeux (blanc, iris, pupille, reflet, paupières), sourcils, nez, lèvres, rides. */
function face(b, at, R, o) {
    const ey = o.eyeY ?? 0.08, ex = o.eyeX ?? 0.34;
    for (const s of [1, -1]) {
        const e = at(s * ex, ey, -0.05);
        b.ball('white', 0.15 * R, e[0], e[1], e[2], 1.22, 0.86, 0.55);
        b.ball('iris', 0.082 * R, e[0] + s * 0.004, e[1], e[2] + 0.062 * R, 1, 1, 0.42);
        b.ball('eye', 0.045 * R, e[0] + s * 0.004, e[1], e[2] + 0.09 * R, 1, 1, 0.42);
        b.ball('white', 0.018 * R, e[0] + 0.03 * R, e[1] + 0.03 * R, e[2] + 0.108 * R);                 // reflet
        b.ball(o.lidRole ?? 'skin', 0.165 * R, e[0], e[1] + (o.old ? 0.05 : 0.075) * R, e[2] - 0.01 * R, 1.2, 0.52, 0.62);   // paupière
        if (o.lashes) b.box('eye', 0.3 * R, 0.022 * R, 0.03 * R, e[0], e[1] + 0.085 * R, e[2] + 0.075 * R, 0.25, 0, -s * 0.12);
        if (o.old) b.ball('line', 0.13 * R, e[0], e[1] - 0.12 * R, e[2] + 0.005, 1.1, 0.3, 0.5);          // poche sous l'œil
    }
    // Sourcils : deux, ou un seul qui traverse le front
    const br = o.brow ?? {};
    if (br.mono) {
        const c = at(0, ey + 0.25, 0.02);
        b.box('brow', 0.62 * R, (br.thick ?? 0.075) * R, 0.09 * R, c[0], c[1], c[2] - 0.01 * R);
        for (const s of [1, -1]) { const p = at(s * 0.4, ey + 0.24, 0); b.box('brow', 0.42 * R, (br.thick ?? 0.075) * R, 0.09 * R, p[0], p[1], p[2], 0, s * 0.55, -s * 0.06); }
    } else if (br.none !== true) {
        for (const s of [1, -1]) {
            const p = at(s * ex, ey + (br.high ?? 0.22), 0.015);
            b.box('brow', 0.3 * R, (br.thick ?? 0.05) * R, 0.06 * R, p[0], p[1], p[2], 0, s * 0.35, s * (br.tilt ?? -0.12));
        }
    }
    // Nez : arête, bout et ailes
    const n = o.nose ?? 1;
    if (n > 0) {
        const t = at(0, -0.2, 0);
        b.ball('skin', 0.1 * R * n, 0, t[1] + 0.13 * R, t[2] + 0.02 * R, 0.7, 1.35, 0.9);
        b.ball('skin', 0.105 * R * n, 0, t[1] - (o.noseDrop ?? 0) * R, t[2] + 0.085 * R * n, 1, 0.9 + (o.noseDrop ?? 0) * 2, 1);
        for (const s of [1, -1]) b.ball('skin', 0.07 * R * n, s * 0.085 * R * n, t[1] - 0.045 * R, t[2] + 0.03 * R, 1, 0.8, 1);
    }
    // Lèvres
    if (o.lips !== false) {
        const m = at(0, -0.52, 0);
        b.ball(o.lipRole ?? 'lip', 0.15 * R, 0, m[1] + 0.022 * R, m[2] - 0.01 * R, 1.25, 0.22, 0.5);
        b.ball(o.lipRole ?? 'lip', 0.14 * R, 0, m[1] - 0.03 * R, m[2] - 0.015 * R, 1.1, 0.26, 0.5);
        for (const s of [1, -1]) b.ball('line', 0.03 * R, s * 0.2 * R, m[1] + (o.smile ?? 0.02) * R, m[2] - 0.05 * R);   // commissures
    }
    // Rides : front et pattes d'oie
    if (o.wrinkles) {
        for (const yy of [0.5, 0.62]) { const p = at(0, yy, 0); b.box('line', 0.6 * R, 0.014 * R, 0.02 * R, 0, p[1], p[2] - 0.004); }
        for (const s of [1, -1]) {
            for (const k of [-1, 0, 1]) { const p = at(s * 0.6, ey + k * 0.07, 0); b.box('line', 0.1 * R, 0.012 * R, 0.02 * R, p[0], p[1], p[2], 0, s * 0.9, s * k * 0.35); }
            const c = at(s * 0.3, -0.36, 0); b.box('line', 0.014 * R, 0.2 * R, 0.02 * R, c[0], c[1], c[2], 0, 0, s * 0.35);   // sillon de la joue
        }
    }
}

/** Calotte de cheveux posée sur le crâne. `down` : jusqu'où elle descend (0.5 = à mi-crâne). */
function hairCap(b, role, R, tall, { down = 0.5, tilt = -0.28, puff = 1.05, back = 0 } = {}) {
    const g = new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, 0, Math.PI * down);
    b.place(role, g, 0, HY + 0.02 * R, HZ - (0.03 + back) * R, tilt, 0, 0, R * 0.9 * puff, R * tall * puff, R * 1.02 * puff);
}

const BUILD = {
    /** Bougadi Bougida : villageois chauve, front immense, mono-sourcil, tunique entièrement marron. */
    bougadi(b) {
        const h = human(b, {
            w: 1.08, belly: 0.5, torso: 'primary', sleeve: 'primary', legs: 'pants', line: true,
            head: { jaw: 0.2, tall: 1.5, crown: 0.1, chin: 0.06, cheeks: 0.03 }, eyeY: -0.32, eyeX: 0.32,
            brow: { mono: true, thick: 0.1 }, nose: 1.45, noseDrop: 0.2, lipRole: 'lip', smile: -0.01,
        });
        // Longue tunique : col montant, pan central plus sombre, ourlets et ceinture
        b.add('secondary', column([[0.4, 0.105, 0.075, -0.02], [0.47, 0.085, 0.066, -0.02], [0.5, 0.08, 0.062, -0.018]], { radial: 16 }));
        b.box('secondary', 0.05, 0.36, 0.012, 0, 0.21, 0.122, -0.06);
        b.place('tertiary', new THREE.TorusGeometry(0.158, 0.014, 6, 24).rotateX(Math.PI / 2), 0, 0.1, 0.002, 0, 0, 0, 1.06, 1, 0.78);
        for (const s of [1, -1]) b.place('secondary', new THREE.TorusGeometry(0.047, 0.012, 6, 14).rotateX(1.2), s * 0.158, 0.283, 0.318);   // ourlet des manches
        // Plis du front au-dessus du sourcil
        for (const yy of [0.18, 0.36, 0.54]) { const p = h.at(0, yy, 0); b.box('line', 0.5 * h.R, 0.014 * h.R, 0.02 * h.R, 0, p[1], p[2] - 0.004); }
    },

    /** Bob : le robot mauve de Pâtisserie 2D Simulator. Il flotte au-dessus du siège sur son réacteur. */
    bob(b) {
        b.add('shell', column([[0.06, 0.07, 0.06, 0], [0.12, 0.15, 0.115, 0], [0.26, 0.17, 0.125, 0], [0.4, 0.15, 0.11, -0.005], [0.47, 0.1, 0.08, -0.01]], { radial: 22, round: 2.8 }));
        b.place('rim', new THREE.TorusGeometry(0.168, 0.012, 8, 28).rotateX(Math.PI / 2), 0, 0.27, 0, 0, 0, 0, 1, 1, 0.75);
        b.place('rim', new THREE.TorusGeometry(0.075, 0.012, 8, 20).rotateX(Math.PI / 2), 0, 0.07, 0, 0, 0, 0, 1, 1, 0.85);
        // Tablier de chef avec sa poche et son cœur
        b.add('apron', column([[0.13, 0.085, 0.02, 0.112], [0.24, 0.105, 0.022, 0.118], [0.38, 0.1, 0.02, 0.102]], { radial: 14, round: 4 }));
        b.box('apron', 0.09, 0.05, 0.012, 0, 0.19, 0.142);
        for (const s of [1, -1]) b.ball('heart', 0.02, s * 0.014, 0.305, 0.128, 1, 1, 0.5);
        b.place('heart', new THREE.ConeGeometry(0.03, 0.035, 4).rotateX(Math.PI).rotateY(Math.PI / 4), 0, 0.283, 0.126, 0, 0, 0, 1, 1, 0.4);
        // Foulard rouge
        b.place('kerchief', new THREE.TorusGeometry(0.105, 0.026, 8, 24).rotateX(Math.PI / 2), 0, 0.47, -0.005, 0.12, 0, 0, 1, 1, 0.8);
        b.place('kerchief', new THREE.ConeGeometry(0.045, 0.09, 4), 0.05, 0.42, 0.085, 2.9, 0, 0.3, 1, 1, 0.4);
        // Tête : grand boîtier arrondi, visière sombre, yeux lumineux, joues roses, oreilles mauves
        b.loft('shell', [[0.135, 0.15, 0.585, 0.795], [0.115, 0.215, 0.555, 0.825], [-0.1, 0.215, 0.555, 0.825], [-0.135, 0.15, 0.585, 0.795]], { radial: 26, steps: 4, round: 4.4, shoulder: 0.5, tumble: 0 });
        b.loft('rim', [[0.13, 0.205, 0.565, 0.815], [0.118, 0.222, 0.548, 0.832], [0.1, 0.222, 0.548, 0.832]], { radial: 26, steps: 2, round: 4.4, shoulder: 0.5, tumble: 0 });
        b.loft('glass', [[0.15, 0.13, 0.615, 0.775], [0.142, 0.178, 0.59, 0.795], [0.12, 0.178, 0.59, 0.795]], { radial: 24, steps: 3, round: 4.2, shoulder: 0.5, tumble: 0 });
        for (const s of [1, -1]) {
            b.ball('glow', 0.034, s * 0.075, 0.705, 0.15, 0.85, 1.1, 0.4);
            b.ball('shell', 0.011, s * 0.075 + 0.012, 0.722, 0.164);
            b.ball('cheek', 0.02, s * 0.135, 0.648, 0.147, 1, 0.8, 0.3);
            b.place('rim', new THREE.CapsuleGeometry(0.03, 0.07, 4, 10), s * 0.235, 0.69, 0);
            // Bras fins et grosses mains rondes
            limb(b, 'rim', [s * 0.17, 0.36, 0], [s * 0.225, 0.25, 0.14], 0.022, 0.02, 8);
            limb(b, 'rim', [s * 0.225, 0.25, 0.14], [s * 0.155, 0.29, 0.33], 0.02, 0.02, 8);
            b.ball('shell', 0.05, s * 0.155, 0.292, 0.37);
            b.place('rim', new THREE.TorusGeometry(0.038, 0.01, 6, 16).rotateX(1.2), s * 0.155, 0.288, 0.335);
        }
        b.box('glow', 0.07, 0.012, 0.01, 0, 0.635, 0.152);          // sourire
        b.ball('white', 0.03, -0.11, 0.8, 0.09, 2.2, 0.5, 0.5);      // reflet sur le boîtier
        // Réacteur : il flotte
        b.place('jet', new THREE.ConeGeometry(0.06, 0.2, 14).rotateX(Math.PI), 0, -0.05, 0);
        b.place('glow', new THREE.ConeGeometry(0.03, 0.12, 10).rotateX(Math.PI), 0, -0.02, 0);
    },

    /** Mamie Endettée : chignon gris, lunettes, collier de perles, gilet rapiécé et porte-monnaie vide. */
    mamie(b) {
        const h = human(b, {
            w: 0.92, belly: 0.35, bust: 1, torso: 'primary', sleeve: 'primary', legs: 'pants', line: true, old: true, wrinkles: true, lashes: true,
            head: { jaw: 0.26, tall: 1.12, cheeks: 0.09, chin: 0.07 }, brow: { thick: 0.035, high: 0.24, tilt: 0.1 }, nose: 0.9, smile: 0.05,
        });
        const R = h.R;
        hairCap(b, 'hair', R, 1.12, { down: 0.5, tilt: -0.72, puff: 1.07 });
        b.ball('hair', 0.085, 0, HY + 0.185, HZ - 0.075);                         // chignon
        b.place('extra', new THREE.CylinderGeometry(0.005, 0.005, 0.2, 5), 0, HY + 0.2, HZ - 0.075, 0, 0, 1.1);   // pique à chignon
        for (const s of [1, -1]) {
            b.ball('hair', 0.06, s * 0.125, HY - 0.01, HZ - 0.03, 0.6, 1.3, 1);       // mèches sur les tempes
            const e = h.at(s * 0.34, 0.08, 0.1);
            b.place('extra', new THREE.TorusGeometry(0.19 * R, 0.022 * R, 6, 20), e[0], e[1], e[2]);     // lunettes rondes
            b.box('extra', 0.3 * R, 0.02 * R, 0.02 * R, s * 0.72 * R, e[1], e[2] - 0.12 * R, 0, s * 1.2);
            b.ball('extra', 0.016, s * 0.128, HY - 0.035, HZ - 0.01);                   // boucles d'oreilles
        }
        const br = h.at(0, 0.08, 0.1); b.box('extra', 0.3 * R, 0.02 * R, 0.02 * R, 0, br[1], br[2]);
        // Collier de perles, châle, boutons, pièces cousues
        for (let i = -4; i <= 4; i++) b.ball('white', 0.014, i * 0.024, 0.44 - (16 - i * i) * 0.0022, 0.078 - Math.abs(i) * 0.008);
        b.add('secondary', column([[0.36, 0.2, 0.1, -0.02], [0.42, 0.212, 0.1, -0.022], [0.46, 0.12, 0.074, -0.02]], { radial: 20 }));
        for (const yy of [0.14, 0.22, 0.3]) b.ball('extra', 0.012, 0, yy, 0.13 + (yy < 0.25 ? 0.012 : 0));
        b.box('patch', 0.05, 0.045, 0.01, 0.09, 0.2, 0.108, 0, 0.5, 0.2);
        b.box('patch', 0.04, 0.04, 0.012, -0.262, 0.3, 0.07, 0.6, 0, 0.3);
        // Porte-monnaie (vide) accroché à la ceinture
        b.ball('tertiary', 0.04, -0.13, 0.06, 0.1, 1, 0.8, 0.6);
        b.place('extra', new THREE.TorusGeometry(0.02, 0.006, 5, 12), -0.13, 0.095, 0.1);
    },

    /** Emmène-moi avec toi : le dinosaure en peluche, vert, crête et taches grises, ventre blanc. */
    dino(b) {
        // Corps dodu et ventre blanc
        b.add('body', column([[-0.02, 0.13, 0.12, 0], [0.1, 0.19, 0.16, 0], [0.26, 0.185, 0.15, 0], [0.4, 0.14, 0.12, 0.01], [0.48, 0.1, 0.09, 0.03]], { radial: 22, round: 2.2 }));
        b.ball('belly', 0.13, 0, 0.2, 0.075, 1, 1.35, 0.72);
        // Grosse tête ronde au museau large
        b.ball('head', 0.2, 0, 0.68, 0.07, 1.04, 0.86, 1.22);
        b.ball('belly', 0.15, 0, 0.6, 0.12, 0.98, 0.5, 1.02);                        // dessous du museau, plus clair
        b.place('line', new THREE.TorusGeometry(0.19, 0.005, 5, 30, Math.PI).rotateX(Math.PI / 2), 0, 0.635, 0.085, 0, 0, 0, 1, 1, 1.2);   // couture de la bouche
        for (const s of [1, -1]) {
            b.ball('eye', 0.024, s * 0.125, 0.745, 0.215, 1, 1, 0.5);
            b.ball('white', 0.007, s * 0.125 + 0.008, 0.754, 0.226);
            b.ball('line', 0.008, s * 0.035, 0.7, 0.312);                              // narines
            // Taches grises sur les flancs et la tête
            b.ball('spike', 0.05, s * 0.165, 0.27, -0.02, 0.3, 1, 1.2);
            b.ball('spike', 0.04, s * 0.15, 0.1, 0.06, 0.3, 1, 1.1);
            b.ball('spike', 0.035, s * 0.16, 0.78, -0.02, 0.4, 0.8, 1.1);
            // Petites pattes avant tendues vers le volant
            limb(b, 'body', [s * 0.15, 0.34, 0.04], [s * 0.155, 0.29, 0.33], 0.06, 0.05);
            b.ball('body', 0.056, s * 0.155, 0.29, 0.36);
            // Pattes arrière et pieds ronds
            limb(b, 'body', [s * 0.1, 0.03, 0.04], [s * 0.115, 0.02, 0.36], 0.085, 0.07);
            b.ball('body', 0.075, s * 0.115, 0.01, 0.42, 1, 0.85, 1.2);
            b.ball('belly', 0.05, s * 0.115, 0.005, 0.475, 1, 0.8, 0.5);
        }
        // Crête : de la tête jusqu'au bas du dos
        const crest = [[0.87, -0.02, 0.05, 0.3], [0.84, -0.11, 0.065, 0.9], [0.62, -0.15, 0.06, 1.3], [0.47, -0.13, 0.07, 1.2], [0.33, -0.16, 0.075, 1.4], [0.18, -0.17, 0.065, 1.5]];
        for (const [y, z, s, rx] of crest) b.place('spike', new THREE.ConeGeometry(s, s * 1.7, 10), 0, y, z, -rx, 0, 0, 0.45, 1, 1);
        // Queue
        limb(b, 'body', [0, 0.06, -0.1], [0, 0.03, -0.3], 0.085, 0.03);
    },

    /** Ninjacon : cagoule et masque, bandeau rouge, épaulières, sabre dans le dos. */
    ninjacon(b) {
        const h = human(b, {
            w: 1.04, torso: 'primary', sleeve: 'primary', glove: 'tertiary', neck: 'primary', line: true, ears: false,
            head: { jaw: 0.34, tall: 1.16 }, headRole: 'primary', face: false,
        });
        const R = h.R;
        // Fente du regard : seule la peau autour des yeux est visible
        b.ball('skin', 0.5 * R, 0, HY + 0.08 * R, HZ + 0.47 * R, 1.25, 0.36, 0.72);
        const eye = (xr) => [xr * R, HY + 0.08 * R, HZ + 0.8 * R];
        for (const s of [1, -1]) {
            const e = eye(s * 0.32);
            b.ball('white', 0.13 * R, e[0], e[1], e[2], 1.25, 0.7, 0.5);
            b.ball('iris', 0.075 * R, e[0], e[1], e[2] + 0.05 * R, 1, 1, 0.4);
            b.ball('eye', 0.042 * R, e[0], e[1], e[2] + 0.075 * R, 1, 1, 0.4);
            b.ball('white', 0.016 * R, e[0] + 0.03 * R, e[1] + 0.025 * R, e[2] + 0.09 * R);
            b.box('brow', 0.34 * R, 0.06 * R, 0.06 * R, e[0], e[1] + 0.16 * R, e[2] + 0.04 * R, 0, s * 0.3, s * 0.3);      // sourcils froncés
            // Épaulières en lames et protège-poignets
            b.ball('tertiary', 0.085, s * 0.215, 0.425, -0.02, 1, 0.55, 1);
            b.ball('extra', 0.07, s * 0.225, 0.4, -0.02, 1.05, 0.3, 1.05);
            b.place('tertiary', new THREE.CylinderGeometry(0.043, 0.047, 0.09, 12).rotateX(1.25), s * 0.168, 0.276, 0.29);
            b.place('secondary', new THREE.TorusGeometry(0.045, 0.008, 5, 14).rotateX(1.25), s * 0.172, 0.27, 0.262);
        }
        // Masque en relief sur le nez et la bouche, plis du tissu
        b.ball('tertiary', 0.42 * R, 0, HY - 0.36 * R, HZ + 0.5 * R, 1.05, 0.82, 0.86);
        for (const yy of [-0.22, -0.4, -0.58]) b.box('primary', 0.5 * R, 0.014 * R, 0.02 * R, 0, HY + yy * R, HZ + (0.84 - (yy + 0.22) * -0.14) * R);
        // Bandeau rouge avec plaque de métal et pans qui flottent
        b.place('secondary', new THREE.TorusGeometry(0.87 * R, 0.085 * R, 8, 30).rotateX(Math.PI / 2), 0, HY + 0.42 * R, HZ - 0.01, 0.06, 0, 0, 1, 1, 1.06);
        b.box('extra', 0.4 * R, 0.14 * R, 0.03 * R, 0, HY + 0.43 * R, HZ + 0.92 * R);
        b.place('primary', new THREE.TorusGeometry(0.035 * R, 0.014 * R, 4, 10), 0, HY + 0.43 * R, HZ + 0.94 * R);
        limb(b, 'secondary', [0.02, HY + 0.4 * R, HZ - 0.95 * R], [0.11, HY - 0.3 * R, HZ - 1.75 * R], 0.018, 0.012, 6);
        limb(b, 'secondary', [-0.02, HY + 0.4 * R, HZ - 0.95 * R], [-0.07, HY - 0.6 * R, HZ - 1.6 * R], 0.018, 0.012, 6);
        // Tenue croisée, ceinture, étoile de ninja, sabre dans le dos
        b.box('tertiary', 0.03, 0.3, 0.012, 0.045, 0.3, 0.108, -0.08, 0, 0.55);
        b.box('tertiary', 0.03, 0.3, 0.012, -0.045, 0.3, 0.108, -0.08, 0, -0.55);
        b.place('secondary', new THREE.TorusGeometry(0.158, 0.02, 6, 26).rotateX(Math.PI / 2), 0, 0.1, 0, 0, 0, 0, 1.04, 1, 0.76);
        b.box('secondary', 0.06, 0.05, 0.03, 0, 0.1, 0.125);
        for (let k = 0; k < 4; k++) b.place('extra', new THREE.ConeGeometry(0.012, 0.045, 4), 0.085, 0.2, 0.118, Math.PI / 2, 0, k * Math.PI / 2 + 0.4, 1, 1, 1);
        limb(b, 'tertiary', [0.14, 0.5, -0.13], [-0.1, 0.16, -0.14], 0.016, 0.016, 8);              // fourreau
        limb(b, 'secondary', [0.14, 0.5, -0.13], [0.2, 0.585, -0.128], 0.014, 0.014, 8);           // poignée
        b.place('extra', new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), 0.143, 0.505, -0.13, 0, 0, -0.62);
    },

    /** Doc Zinzin : le scientifique fou. Cheveux blancs en bataille, lunettes de labo, blouse et fiole verte. */
    doc(b) {
        const h = human(b, {
            w: 0.96, torso: 'primary', sleeve: 'primary', glove: 'tertiary', legs: 'pants', line: true, old: true, wrinkles: true,
            head: { jaw: 0.38, tall: 1.22, crown: 0.06, chin: 0.12 }, brow: { thick: 0.085, high: 0.26, tilt: -0.4 }, nose: 1.15, noseDrop: 0.06, smile: 0.09,
        });
        const R = h.R;
        // Crâne dégarni au milieu, touffes hérissées sur les côtés et derrière
        for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
            const a = 0.15 + k * 0.42, len = 0.1 + (k % 3) * 0.035;
            b.place('hair', new THREE.ConeGeometry(0.036, len, 6), s * (0.11 + Math.sin(a) * 0.025), HY + 0.11 - k * 0.022, HZ + 0.05 - k * 0.032, -0.4 - k * 0.12, 0, -s * (1.0 + (k % 2) * 0.35));
        }
        for (let k = -2; k <= 2; k++) b.place('hair', new THREE.ConeGeometry(0.04, 0.12, 6), k * 0.05, HY + 0.06 - Math.abs(k) * 0.02, HZ - 0.14, -1.5 - (k % 2) * 0.2, 0, -k * 0.25);
        b.ball('hair', 0.13, 0, HY + 0.01, HZ - 0.045, 1.02, 0.95, 0.9);
        // Moustache et grosses lunettes de laboratoire relevées sur le front
        for (const s of [1, -1]) {
            const m = h.at(s * 0.14, -0.4, 0.04);
            b.ball('hair', 0.1 * R, m[0], m[1], m[2], 1.6, 0.55, 0.6);
            const g = h.at(s * 0.3, 0.62, 0.1);
            b.place('metal', new THREE.CylinderGeometry(0.2 * R, 0.22 * R, 0.16 * R, 16).rotateX(Math.PI / 2 - 0.3), g[0], g[1], g[2]);
            b.place('glow2', new THREE.CylinderGeometry(0.16 * R, 0.16 * R, 0.17 * R, 16).rotateX(Math.PI / 2 - 0.3), g[0], g[1] + 0.004, g[2] + 0.004);
        }
        b.place('tertiary', new THREE.TorusGeometry(0.9 * R, 0.04 * R, 6, 26).rotateX(Math.PI / 2), 0, HY + 0.62 * R, HZ - 0.02, -0.3, 0, 0, 1, 1, 1.05);
        // Blouse : revers, chemise turquoise, nœud papillon, boutons, poche à stylos et fiole fumante
        b.add('secondary', column([[0.2, 0.06, 0.02, 0.105], [0.36, 0.075, 0.022, 0.1], [0.46, 0.07, 0.03, 0.04]], { radial: 12, round: 3 }));
        for (const s of [1, -1]) {
            b.box('primary', 0.06, 0.2, 0.014, s * 0.075, 0.36, 0.104, -0.12, 0, s * 0.3);            // revers
            b.place('tertiary', new THREE.ConeGeometry(0.03, 0.05, 4), s * 0.03, 0.455, 0.075, 0, 0, s * Math.PI / 2, 1, 1, 0.5);   // nœud papillon
        }
        for (const yy of [0.1, 0.17]) b.ball('tertiary', 0.011, 0.015, yy, 0.123);
        b.box('primary', 0.075, 0.07, 0.012, -0.1, 0.27, 0.105);
        for (const [dx, role] of [[-0.02, 'secondary'], [0, 'tertiary'], [0.02, 'metal']]) b.place(role, new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), -0.1 + dx, 0.315, 0.11);
        b.place('glass', new THREE.CylinderGeometry(0.012, 0.012, 0.07, 10), 0.105, 0.3, 0.115);
        b.ball('glow3', 0.03, 0.105, 0.255, 0.115);
        for (const [dy, r] of [[0.07, 0.01], [0.1, 0.014], [0.135, 0.018]]) b.ball('glow3', r, 0.105 + dy * 0.2, 0.3 + dy, 0.115);
    },

    /** Lina : pilote de rallye. Casque ouvert, queue de cheval, combinaison à bandes. */
    lina(b) {
        const h = human(b, {
            w: 0.92, bust: 1, torso: 'primary', sleeve: 'primary', glove: 'tertiary', legs: 'pants', shin: 'tertiary', lashes: true,
            head: { jaw: 0.36, tall: 1.14, cheeks: 0.06 }, brow: { thick: 0.04, high: 0.23 }, nose: 0.82, smile: 0.06, ears: false,
        });
        const R = h.R;
        // Casque ouvert : calotte, jugulaires, visière relevée, bande et micro
        b.place('secondary', new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), 0, HY + 0.03 * R, HZ - 0.06 * R, -0.78, 0, 0, R * 1.08, R * 1.3, R * 1.18);
        for (const s of [1, -1]) {
            b.ball('secondary', 0.42 * R, s * 0.86 * R, HY - 0.3 * R, HZ - 0.05 * R, 0.42, 1.25, 1.1);
            b.box('tertiary', 0.03 * R, 0.5 * R, 0.08 * R, s * 0.74 * R, HY - 0.72 * R, HZ + 0.35 * R, 0.5, 0, -s * 0.5);
            b.box('extra', 0.02, 0.3, 0.014, s * 0.1, 0.25, 0.108, -0.06, 0, 0);                      // bandes de la combinaison
            b.box('secondary', 0.062, 0.03, 0.062, s * 0.222, 0.33, 0.06, 0, 0, s * 0.5);            // brassard
        }
        b.loft('primary', [[1.2 * R, 0.14 * R, HY + 1.12 * R, HY + 1.24 * R], [0, 0.26 * R, HY + 1.28 * R, HY + 1.36 * R], [-1.1 * R, 0.14 * R, HY + 0.9 * R, HY + 1.0 * R]], { radial: 10, round: 3, tumble: 0 });
        b.place('glass', new THREE.SphereGeometry(1, 20, 8, -Math.PI * 0.82, Math.PI * 0.64, Math.PI * 0.3, Math.PI * 0.16), 0, HY + 0.2 * R, HZ, 0, 0, 0, R * 1.12, R * 1.2, R * 1.2);
        limb(b, 'tertiary', [0.82 * R, HY - 0.3 * R, HZ + 0.2 * R], [0.3 * R, HY - 0.62 * R, HZ + 0.95 * R], 0.006, 0.006, 5);
        b.ball('tertiary', 0.014, 0.3 * R, HY - 0.62 * R, HZ + 0.95 * R);
        // Frange et queue de cheval
        b.ball('hair', 0.5 * R, 0, HY + 0.6 * R, HZ + 0.36 * R, 1.25, 0.3, 0.75);
        limb(b, 'hair', [0, HY - 0.25 * R, HZ - 1.05 * R], [0, 0.44, -0.2], 0.036, 0.022, 8);
        limb(b, 'hair', [0, 0.44, -0.2], [0.01, 0.3, -0.19], 0.022, 0.008, 8);
        b.place('extra', new THREE.TorusGeometry(0.036, 0.01, 5, 12).rotateX(0.9), 0, HY - 0.3 * R, HZ - 1.08 * R);
        // Col, fermeture éclair, ceinture et écusson
        b.add('tertiary', column([[0.44, 0.09, 0.07, -0.02], [0.5, 0.075, 0.062, -0.018]], { radial: 14 }));
        b.box('tertiary', 0.01, 0.3, 0.008, 0, 0.3, 0.112, -0.06);
        b.place('tertiary', new THREE.TorusGeometry(0.15, 0.016, 6, 24).rotateX(Math.PI / 2), 0, 0.09, 0, 0, 0, 0, 1, 1, 0.78);
        b.place('extra', new THREE.CylinderGeometry(0.028, 0.028, 0.01, 14).rotateX(Math.PI / 2), -0.085, 0.36, 0.102);
    },

    /** Nova : l'astronaute. Combinaison blanche, casque-bulle transparent, sac dorsal. */
    nova(b) {
        const h = human(b, {
            w: 1.12, torso: 'primary', sleeve: 'primary', glove: 'tertiary', neck: 'tertiary', legs: 'pants', shoe: 'shoe', sole: 'secondary',
            head: { jaw: 0.3, tall: 1.14 }, brow: { thick: 0.055 }, nose: 1, smile: 0.07, R: 0.138,
        });
        const R = h.R;
        hairCap(b, 'hair', R, 1.14, { down: 0.46, tilt: -0.7, puff: 1.06 });
        for (const s of [1, -1]) b.ball('hair', 0.3 * R, s * 0.7 * R, HY + 0.38 * R, HZ + 0.1 * R, 0.6, 1, 1.3);
        // Casque-bulle et collerette métallique
        b.place('clear', new THREE.SphereGeometry(0.235, 30, 20), 0, HY + 0.02, HZ);
        b.place('tertiary', new THREE.TorusGeometry(0.15, 0.03, 10, 30).rotateX(Math.PI / 2), 0, 0.5, -0.01);
        b.place('secondary', new THREE.TorusGeometry(0.152, 0.012, 6, 30).rotateX(Math.PI / 2), 0, 0.53, -0.01);
        b.ball('white', 0.03, -0.12, HY + 0.14, HZ + 0.15, 1.8, 0.6, 0.4);                      // reflet sur la bulle
        // Anneaux aux articulations, panneau de commande, écusson, tuyaux, sac dorsal
        for (const s of [1, -1]) {
            b.place('secondary', new THREE.TorusGeometry(0.062, 0.012, 6, 16).rotateZ(Math.PI / 2).rotateY(s * 0.3), s * 0.23, 0.32, 0.06);
            b.place('secondary', new THREE.TorusGeometry(0.046, 0.011, 6, 14).rotateX(1.2), s * 0.165, 0.275, 0.285);
            b.place('secondary', new THREE.TorusGeometry(0.066, 0.012, 6, 16).rotateX(1.35), s * 0.103, 0.075, 0.3);
            limb(b, 'tertiary', [s * 0.09, 0.3, 0.1], [s * 0.13, 0.42, -0.14], 0.012, 0.012, 6);
            b.place('secondary', new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), s * 0.085, 0.3, -0.24);
        }
        b.box('tertiary', 0.13, 0.085, 0.02, 0, 0.27, 0.113);
        for (const [dx, role] of [[-0.04, 'extra'], [0, 'secondary'], [0.04, 'glow']]) b.ball(role, 0.012, dx, 0.285, 0.126);
        b.box('eye', 0.09, 0.016, 0.006, 0, 0.25, 0.126);
        b.place('secondary', new THREE.CylinderGeometry(0.03, 0.03, 0.01, 14).rotateX(Math.PI / 2), 0.1, 0.38, 0.098);
        b.box('extra', 0.05, 0.03, 0.008, -0.1, 0.38, 0.1);
        b.loft('primary', [[-0.1, 0.13, 0.12, 0.5], [-0.17, 0.15, 0.1, 0.54], [-0.26, 0.13, 0.14, 0.5]], { radial: 16, round: 4, tumble: 0 });
        b.place('tertiary', new THREE.CylinderGeometry(0.004, 0.004, 0.16, 5), 0.11, 0.6, -0.2);
        b.ball('extra', 0.012, 0.11, 0.685, -0.2);
    },

    /** Capitaine Corail : la pirate. Tricorne, bandeau sur l'œil, manteau rouge à boutons dorés. */
    corail(b) {
        const h = human(b, {
            w: 0.98, bust: 1, torso: 'primary', sleeve: 'primary', cuff: 'secondary', legs: 'pants', shoe: 'shoe', line: true, lashes: true,
            head: { jaw: 0.34, tall: 1.15, cheeks: 0.06 }, brow: { thick: 0.05, tilt: -0.25 }, nose: 0.9, smile: 0.1,
        });
        const R = h.R;
        // Longs cheveux bouclés, foulard sous le chapeau
        hairCap(b, 'hair', R, 1.15, { down: 0.5, tilt: -0.7, puff: 1.08 });
        for (const s of [1, -1]) for (let k = 0; k < 5; k++) b.ball('hair', 0.052 - k * 0.004, s * (0.13 + (k % 2) * 0.02), HY - 0.02 - k * 0.055, HZ - 0.05 - (k % 2) * 0.03);
        for (let k = 0; k < 4; k++) b.ball('hair', 0.06, (k - 1.5) * 0.06, HY - 0.1 - (k % 2) * 0.05, HZ - 0.15);
        b.place('secondary', new THREE.TorusGeometry(0.88 * R, 0.07 * R, 6, 26).rotateX(Math.PI / 2), 0, HY + 0.5 * R, HZ - 0.01, -0.12, 0, 0, 1, 1, 1.06);
        // Tricorne : bords relevés, liseré doré, plume
        b.add('tertiary', column([[HY + 0.62 * R, 0.14, 0.14, HZ - 0.01], [HY + 0.9 * R, 0.12, 0.125, HZ - 0.02], [HY + 1.2 * R, 0.085, 0.09, HZ - 0.02]], { radial: 18, round: 2.2 }));
        for (let k = 0; k < 3; k++) {
            const a = k * Math.PI * 2 / 3 + Math.PI / 2;
            b.place('tertiary', new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), Math.cos(a) * 0.1, HY + 0.66 * R, HZ - 0.01 + Math.sin(a) * 0.1, 0, -a + Math.PI / 2, -1.25, 0.03, 0.11, 0.17);
            b.place('secondary', new THREE.TorusGeometry(0.17, 0.006, 4, 18, Math.PI).rotateX(-0.3), Math.cos(a) * 0.105, HY + 0.68 * R, HZ - 0.01 + Math.sin(a) * 0.105, 0, -a + Math.PI / 2, 0, 1, 0.62, 1);
        }
        limb(b, 'extra', [-0.1, HY + 0.9 * R, HZ - 0.06], [-0.2, HY + 1.75 * R, HZ - 0.16], 0.024, 0.006, 6);
        // Bandeau sur l'œil gauche, anneau d'or, grain de beauté
        const e = h.at(-0.34, 0.08, 0.06);
        b.ball('eye', 0.19 * R, e[0], e[1], e[2], 1.1, 0.95, 0.4);
        limb(b, 'eye', [e[0], e[1] + 0.02, e[2]], [0.8 * R, HY + 0.52 * R, HZ + 0.3 * R], 0.006, 0.006, 5);
        limb(b, 'eye', [e[0], e[1] + 0.01, e[2]], [-0.86 * R, HY + 0.3 * R, HZ + 0.1 * R], 0.006, 0.006, 5);
        b.place('secondary', new THREE.TorusGeometry(0.026, 0.006, 5, 14), 0.128, HY - 0.05, HZ);
        // Manteau : grand col, revers, boutons dorés, épaulettes, jabot blanc, ceinture à boucle
        b.add('extra', column([[0.3, 0.05, 0.02, 0.108], [0.4, 0.065, 0.026, 0.092], [0.47, 0.055, 0.03, 0.05]], { radial: 12, round: 3 }));
        for (const s of [1, -1]) {
            b.box('primary', 0.075, 0.24, 0.016, s * 0.085, 0.36, 0.1, -0.12, 0, s * 0.25);
            for (const yy of [0.16, 0.23, 0.3]) b.ball('secondary', 0.013, s * 0.065, yy, 0.122);
            b.ball('secondary', 0.075, s * 0.21, 0.428, -0.02, 1.1, 0.4, 1.1);
            for (let k = -2; k <= 2; k++) b.place('secondary', new THREE.CylinderGeometry(0.005, 0.005, 0.045, 4), s * 0.235 + k * 0.012 * s, 0.4, -0.02 + k * 0.022, 0, 0, s * 0.3);
        }
        b.place('tertiary', new THREE.TorusGeometry(0.156, 0.022, 6, 24).rotateX(Math.PI / 2), 0, 0.09, 0, 0, 0, 0, 1.02, 1, 0.78);
        b.box('secondary', 0.07, 0.06, 0.02, 0, 0.09, 0.125);
        b.box('tertiary', 0.04, 0.03, 0.024, 0, 0.09, 0.126);
    },

    /** Sven : le montagnard. Bonnet à pompon, masque de ski, barbe blonde, doudoune et écharpe. */
    sven(b) {
        const h = human(b, {
            w: 1.14, belly: 0.25, torso: 'primary', sleeve: 'primary', glove: 'secondary', legs: 'pants', shoe: 'shoe', line: false,
            head: { jaw: 0.24, tall: 1.16, cheeks: 0.07 }, brow: { thick: 0.07 }, nose: 1.1, lips: false,
        });
        const R = h.R;
        // Barbe fournie et moustache
        b.ball('hair', 0.62 * R, 0, HY - 0.62 * R, HZ + 0.3 * R, 1.1, 0.8, 0.9);
        for (const s of [1, -1]) {
            b.ball('hair', 0.36 * R, s * 0.52 * R, HY - 0.36 * R, HZ + 0.3 * R, 0.8, 1.2, 0.9);
            const m = h.at(s * 0.16, -0.4, 0.05); b.ball('hair', 0.11 * R, m[0], m[1], m[2], 1.7, 0.6, 0.6);
            b.ball('hair', 0.2 * R, s * 0.8 * R, HY + 0.1 * R, HZ, 0.5, 1.3, 1);
        }
        const mo = h.at(0, -0.56, 0.02); b.ball('lip', 0.09 * R, 0, mo[1], mo[2] + 0.2 * R, 1.3, 0.3, 0.4);
        // Bonnet côtelé à revers et pompon
        b.place('extra', new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, HY + 0.42 * R, HZ - 0.04 * R, -0.3, 0, 0, R * 0.98, R * 1.0, R * 1.08);
        b.place('tertiary', new THREE.TorusGeometry(0.93 * R, 0.12 * R, 8, 28).rotateX(Math.PI / 2), 0, HY + 0.48 * R, HZ - 0.03 * R, -0.3, 0, 0, 1, 1, 1.08);
        b.ball('tertiary', 0.05, 0, HY + 1.42 * R, HZ - 0.08);
        // Masque de ski relevé sur le bonnet
        b.loft('glow2', [[HZ + 0.98 * R, 0.5 * R, HY + 0.78 * R, HY + 1.06 * R], [HZ + 0.84 * R, 0.58 * R, HY + 0.76 * R, HY + 1.08 * R]], { radial: 16, round: 4, tumble: 0, steps: 2 });
        b.place('eye', new THREE.TorusGeometry(0.96 * R, 0.035 * R, 5, 26).rotateX(Math.PI / 2), 0, HY + 0.92 * R, HZ - 0.03, -0.3, 0, 0, 1, 1, 1.06);
        // Écharpe, doudoune matelassée, fermeture, écusson
        b.place('secondary', new THREE.TorusGeometry(0.1, 0.04, 8, 22).rotateX(Math.PI / 2), 0, 0.485, -0.012, 0.1, 0, 0, 1.05, 1, 0.82);
        limb(b, 'secondary', [0.07, 0.47, 0.06], [0.09, 0.27, 0.125], 0.036, 0.03, 8);
        for (let k = 0; k < 4; k++) b.box('tertiary', 0.008, 0.035, 0.03, 0.078 + k * 0.01, 0.245, 0.127);
        for (const yy of [0.12, 0.22, 0.32]) b.place('secondary', new THREE.TorusGeometry(0.17, 0.006, 4, 26).rotateX(Math.PI / 2), 0, yy, 0, 0, 0, 0, 1.08, 1, 0.78);
        b.box('tertiary', 0.012, 0.36, 0.01, 0, 0.26, 0.128, -0.06);
        b.place('tertiary', new THREE.CylinderGeometry(0.03, 0.03, 0.01, 6).rotateX(Math.PI / 2), -0.1, 0.36, 0.11);
        for (const s of [1, -1]) for (const [p, r] of [[[s * 0.228, 0.31, 0.065], 0.062], [[s * 0.2, 0.258, 0.225], 0.046]]) b.place('secondary', new THREE.TorusGeometry(r, 0.006, 4, 14).rotateX(1.1).rotateY(s * 0.4), p[0], p[1], p[2]);
    },
};

// ---------- Matériaux selon l'apparence (partagés entre toutes les voitures) ----------
const GLOWS = { glow: null, glow2: 0xff8c1a, glow3: 0x7dff6a, jet: 0xffb020 };
const matCache = new Map();

function makeMaterial(role, color, skin) {
    const glowing = role in GLOWS;
    if (skin === 'or' && role !== 'eye' && !glowing) {
        // Or massif : tout le pilote est en or, seuls les yeux restent sombres. Un peu de lueur propre pour rester doré sur fond sombre.
        const tint = role === 'glass' || role === 'clear' ? 0xffe28a : role === 'white' ? 0xfff2b8 : role === 'iris' ? 0xb8860b : 0xf5c242;
        return new THREE.MeshPhysicalMaterial({
            color: tint, metalness: 0.85, roughness: role === 'glass' ? 0.1 : 0.26, clearcoat: 0.6, envMapIntensity: 1.8, emissive: 0x5a3a00, emissiveIntensity: 0.55,
            transparent: role === 'clear', opacity: role === 'clear' ? 0.35 : 1, depthWrite: role !== 'clear',
        });
    }
    if (glowing) return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: role === 'jet' ? 3 : 2.2, toneMapped: false });
    switch (role) {
        case 'eye': return new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.25 });
        case 'white': return new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.35 });
        case 'iris': return new THREE.MeshStandardMaterial({ color, roughness: 0.2, emissive: color, emissiveIntensity: 0.15 });
        case 'glass': return new THREE.MeshStandardMaterial({ color: skin === 'nuit' ? 0x1a1030 : 0x14121c, metalness: 0.9, roughness: 0.08, envMapIntensity: 2 });
        case 'clear': return new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, metalness: 0.1, roughness: 0.03, clearcoat: 1, envMapIntensity: 2, transparent: true, opacity: 0.22, depthWrite: false });
        case 'metal': case 'rim': case 'extra':
            return new THREE.MeshStandardMaterial({ color, metalness: role === 'extra' ? 0.35 : 0.8, roughness: 0.32, envMapIntensity: 1.3 });
        case 'shell': return new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3, envMapIntensity: 1.3 });
        case 'skin': return new THREE.MeshStandardMaterial({ color, roughness: 0.58, envMapIntensity: 0.6 });
        case 'lip': case 'shoe': case 'cheek': case 'heart': return new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
        case 'hair': case 'brow': return new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
        default: return new THREE.MeshStandardMaterial({ color, roughness: 0.82, envMapIntensity: 0.5 });     // tissus, peluche
    }
}

/** Couleur d'un rôle pour une apparence donnée. */
function roleColor(id, role, skin) {
    const p = PALETTES[id];
    let c = p[role] ?? (role in GLOWS ? GLOWS[role] ?? 0xffffff : role === 'line' ? new THREE.Color(p.skin ?? 0x888888).multiplyScalar(0.72).getHex() : 0x888888);
    if (skin === 'nuit') {
        // Nuit : tenue sombre, détails aux néons de la couleur fétiche
        const fav = CHARACTERS[id]?.color ?? 0x20e3ff;
        const neon = fav === 0x2c3e50 ? 0x20e3ff : fav;
        if (['primary', 'shell', 'pants'].includes(role)) c = 0x1b1b26;
        else if (['secondary', 'rim', 'kerchief', 'spike'].includes(role)) c = neon;
        else if (['tertiary', 'apron', 'shoe'].includes(role)) c = 0x2b2b38;
        else if (role === 'body') c = 0x2a3a4a;
        else if (role === 'head') c = 0x34485c;
        else if (role === 'glow') c = neon;
    }
    return c;
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
 * Construit un pilote. Renvoie { root, hover, dispose() }.
 * `skin` : classique | nuit | or. Les matériaux sont partagés : rien à libérer.
 */
export function buildCharacterModel(id, skin = 'classique') {
    if (!BUILD[id]) id = 'bob';
    const root = new THREE.Group();
    for (const [role, geo] of Object.entries(geometries(id))) {
        const key = `${id}|${role}|${skin}`;
        if (!matCache.has(key)) matCache.set(key, makeMaterial(role, roleColor(id, role, skin), skin));
        const m = new THREE.Mesh(geo, matCache.get(key));
        m.castShadow = role !== 'clear' && role !== 'jet';
        if (role === 'clear') m.renderOrder = 2;
        root.add(m);
    }
    root.userData.character = id;
    return { root, hover: id === 'bob', dispose() {} };
}

/** Peinture du kart selon l'apparence : l'or massif dore aussi la carrosserie. */
export function paintForSkin(skin, color) {
    if (skin === 'or') return { color: 0xf2b92e, metalness: 0.9, roughness: 0.2, emissive: 0x3a2400 };
    return { color, metalness: 0.55, roughness: 0.34 };
}
