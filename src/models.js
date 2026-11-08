// ============================================================
//  Modèles 3D des véhicules. Les carrosseries sont sculptées :
//  une suite de sections (comme les couples d'une coque de bateau)
//  est lissée puis reliée en une surface courbe continue.
//  Une section : [z, demi-largeur, bas, haut]
//  Ajouter un véhicule revient à ajouter une fonction dans BUILDERS.
// ============================================================
import * as THREE from 'three';

// ---------- Outils de géométrie ----------
const smooth = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
};
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** Surface lissée passant par les sections. Fermée aux deux bouts, normales vers l'extérieur. */
function loftGeometry(sections, { radial = 24, steps = 4, round = 3, shoulder = 0.42, tumble = 0.1, cx = 0 } = {}) {
    const rings = [];
    const n = sections.length;
    for (let i = 0; i < n - 1; i++) {
        const a = sections[Math.max(0, i - 1)], b = sections[i], c = sections[i + 1], d = sections[Math.min(n - 1, i + 2)];
        for (let k = 0; k < steps; k++) {
            const t = k / steps;
            rings.push(b.map((_, m) => smooth(a[m], b[m], c[m], d[m], t)));
        }
    }
    rings.push(sections[n - 1]);

    const pos = [], idx = [];
    const exp = 2 / round;
    for (const [z, w, yb, yt] of rings) {
        const ym = yb + (yt - yb) * shoulder;
        for (let j = 0; j < radial; j++) {
            const th = (j / radial) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
            const up = Math.max(0, s);
            const x = cx + spow(c, exp) * Math.max(0.001, w) * (1 - tumble * up);
            const y = s >= 0 ? ym + (yt - ym) * Math.pow(s, exp) : ym - (ym - yb) * Math.pow(-s, exp);
            pos.push(x, y, z);
        }
    }
    const R = rings.length;
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
        idx.push(a, c, b, b, c, d);
    }
    // Fermeture des extrémités
    for (const [ring, flip] of [[0, false], [R - 1, true]]) {
        const [z, , yb, yt] = rings[ring];
        const center = pos.length / 3;
        pos.push(cx, (yb + yt) / 2, z);
        for (let j = 0; j < radial; j++) {
            const a = ring * radial + j, b = ring * radial + (j + 1) % radial;
            if (flip) idx.push(center, a, b); else idx.push(center, b, a);
        }
    }
    // Volume signé : garantit que les faces regardent vers l'extérieur
    let vol = 0;
    for (let i = 0; i < idx.length; i += 3) {
        const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
        vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
            - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
            + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
    }
    if (vol < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

function mergeGeometries(list) {
    let vCount = 0, iCount = 0;
    for (const g of list) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), idx = new Uint32Array(iCount);
    let vo = 0, io = 0;
    for (const g of list) {
        pos.set(g.attributes.position.array, vo * 3);
        nor.set(g.attributes.normal.array, vo * 3);
        const count = g.attributes.position.count;
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
        else { for (let i = 0; i < count; i++) idx[io + i] = i + vo; io += count; }
        vo += count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
}

const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

/** Rassemble les pièces par matériau : une voiture entière tient en quelques appels de dessin. */
class Builder {
    constructor() { this.parts = {}; this.wheels = []; }
    add(mat, geo) { (this.parts[mat] ??= []).push(geo); return this; }
    place(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
        geo.applyMatrix4(_m);
        return this.add(mat, geo);
    }
    loft(mat, sections, opts) { return this.add(mat, loftGeometry(sections, opts)); }
    /** La même pièce des deux côtés. */
    both(fn, x) { fn(x); fn(-x); return this; }
    box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { return this.place(mat, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
    ball(mat, r, x, y, z, sx = 1, sy = 1, sz = 1) { return this.place(mat, new THREE.SphereGeometry(r, 14, 10), x, y, z, 0, 0, 0, sx, sy, sz); }
    /** Aileron au profil arrondi, tendu selon x. */
    foil(mat, span, chord, thick, x, y, z, rx = 0, ry = 0) {
        return this.place(mat, new THREE.CylinderGeometry(0.5, 0.5, span, 14).rotateZ(Math.PI / 2), x, y, z, rx, ry, 0, 1, thick, chord);
    }
    /** Tube entre deux points. */
    tube(mat, a, b, r, seg = 8) {
        const dir = _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = dir.length();
        const g = new THREE.CylinderGeometry(r, r, len, seg);
        _q.setFromUnitVectors(_up, dir.normalize());
        _m.compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
        g.applyMatrix4(_m);
        return this.add(mat, g);
    }
    /** Disque vu de côté, axe x (passage de roue, canule). */
    disc(mat, r, x, y, z, depth = 0.02) { return this.place(mat, new THREE.CylinderGeometry(r, r, depth, 28).rotateZ(Math.PI / 2), x, y, z); }
    /** Élargisseur d'aile en arc au-dessus de la roue. */
    flare(mat, r, x, y, z, thick = 0.055) {
        return this.place(mat, new THREE.TorusGeometry(r, thick, 8, 20, Math.PI).rotateY(Math.PI / 2), x, y, z);
    }
    /** Passage de roue complet, des deux côtés, avec son élargisseur. */
    arch(x, wr, z, flareMat = 'paint') {
        this.both(sx => {
            this.disc('void', wr * 1.14, sx, wr, z);
            if (flareMat) this.flare(flareMat, wr * 1.16, sx, wr, z);
        }, x);
        return this;
    }
    wheel(x, z, r, w, style = {}) { this.wheels.push({ x, z, r, w, style }); return this; }
    pair(x, z, r, w, style) { return this.wheel(x, z, r, w, style).wheel(-x, z, r, w, style); }
    /** Bande de décoration suivant le dessus de la carrosserie. */
    stripe(mat, sections, ratio, cx = 0, lift = 0.008) {
        const s = sections.map(([z, w, , yt]) => [z, w * ratio, yt - 0.03, yt + lift]);
        return this.loft(mat, s, { radial: 12, steps: 4, round: 6, shoulder: 0.5, tumble: 0, cx });
    }
}

// ---------- Les véhicules ----------
const BUILDERS = {
    /** GT de course, longue et basse. */
    sport(b) {
        const body = [[2.02, 0.5, 0.3, 0.44], [1.9, 0.76, 0.2, 0.52], [1.45, 0.87, 0.17, 0.62], [0.75, 0.87, 0.17, 0.72], [0, 0.88, 0.17, 0.76], [-0.8, 0.9, 0.19, 0.8], [-1.42, 0.88, 0.21, 0.8], [-1.88, 0.7, 0.3, 0.78], [-2, 0.45, 0.4, 0.66]];
        b.loft('paint', body, { radial: 28, steps: 5, round: 3.2, shoulder: 0.5 });
        b.loft('glass', [[0.98, 0.5, 0.66, 0.7], [0.5, 0.66, 0.66, 1.0], [0.05, 0.66, 0.68, 1.14], [-0.5, 0.63, 0.7, 1.15], [-1.1, 0.58, 0.72, 0.98], [-1.55, 0.2, 0.68, 0.74]], { radial: 22, tumble: 0.26, shoulder: 0.2 });
        b.loft('paint', [[0.42, 0.34, 1.0, 1.05], [0.18, 0.56, 1.05, 1.14], [-0.45, 0.54, 1.07, 1.17], [-0.95, 0.44, 0.98, 1.05]], { radial: 16, round: 4, tumble: 0.1 });
        b.both(x => {
            b.tube('paint', [x * 0.6, 0.76, 0.72], [x * 0.5, 1.09, 0.2], 0.035);
            b.tube('paint', [x * 0.58, 0.8, -1.25], [x * 0.47, 1.09, -0.75], 0.05);
            b.ball('paint', 0.07, x * 1.0, 0.84, 0.52, 1.35, 0.75, 0.75);        // rétroviseur
            b.tube('dark', [x * 0.85, 0.82, 0.52], [x * 0.68, 0.76, 0.58], 0.02);
            b.ball('head', 0.13, x * 0.58, 0.47, 1.76, 1.65, 0.42, 1.0);          // phare
            b.box('head', 0.42, 0.018, 0.035, x * 0.56, 0.38, 1.82, 0, x > 0 ? 0.55 : -0.55);
            b.box('tail', 0.5, 0.05, 0.02, x * 0.48, 0.67, -1.97);
            b.box('dark', 0.02, 0.2, 0.32, x * 0.895, 0.47, 0.72);                // ouïe latérale
            b.box('dark', 0.02, 0.012, 1.16, x * 0.9, 0.53, -0.12);               // ligne de porte
            b.tube('chrome', [x * 0.35, 0.3, -1.92], [x * 0.35, 0.3, -2.1], 0.065);
            b.box('carbon', 0.03, 0.3, 0.3, x * 0.7, 1.02, -1.68, -0.15);           // support d'aileron
        }, 1);
        b.box('dark', 0.7, 0.12, 0.05, 0, 0.32, 1.93);                             // calandre
        b.foil('carbon', 1.8, 0.38, 0.05, 0, 0.17, 1.82);                          // lame avant
        b.foil('carbon', 1.3, 0.42, 0.14, 0, 0.21, -1.84);                         // diffuseur
        b.foil('carbon', 1.62, 0.44, 0.05, 0, 1.2, -1.72, 0.12);                   // aileron
        b.box('tail', 0.4, 0.04, 0.02, 0, 0.67, -1.98);
        b.both(x => b.box('carbon', 0.09, 0.09, 2.2, x * 0.86, 0.17, 0), 1);       // bas de caisse
        b.stripe('accent', body.slice(0, 7), 0.11, 0.17).stripe('accent', body.slice(0, 7), 0.11, -0.17);
        b.arch(0.895, 0.37, 1.22).arch(0.905, 0.38, -1.22);
        b.pair(0.86, 1.22, 0.37, 0.3, { spokes: 10, rim: 0.74, caliper: 'caliperRed' }).pair(0.86, -1.22, 0.38, 0.34, { spokes: 10, rim: 0.74, caliper: 'caliperRed' });
    },

    /** Muscle car : capot interminable, épaules larges, chromes. */
    muscle(b) {
        const body = [[2.18, 0.82, 0.3, 0.6], [2.1, 0.9, 0.24, 0.66], [1.4, 0.94, 0.2, 0.74], [0.6, 0.94, 0.2, 0.76], [0, 0.94, 0.2, 0.78], [-0.9, 0.96, 0.22, 0.82], [-1.6, 0.94, 0.26, 0.82], [-2.08, 0.88, 0.32, 0.78], [-2.14, 0.8, 0.36, 0.7]];
        b.loft('paint', body, { radial: 28, steps: 5, round: 4.4, shoulder: 0.56, tumble: 0.05 });
        b.loft('glass', [[0.38, 0.54, 0.74, 0.78], [0.05, 0.68, 0.74, 1.04], [-0.35, 0.68, 0.76, 1.17], [-0.95, 0.65, 0.78, 1.16], [-1.65, 0.5, 0.76, 0.9], [-1.9, 0.2, 0.7, 0.76]], { radial: 22, tumble: 0.2, shoulder: 0.2, round: 3.4 });
        b.loft('paint', [[-0.12, 0.42, 1.08, 1.12], [-0.34, 0.58, 1.11, 1.2], [-0.95, 0.58, 1.1, 1.19], [-1.32, 0.46, 1.0, 1.08]], { radial: 16, round: 4.5, tumble: 0.08 });
        b.both(x => {
            b.tube('paint', [x * 0.62, 0.78, 0.26], [x * 0.54, 1.14, -0.24], 0.035);
            b.tube('paint', [x * 0.66, 0.82, -1.6], [x * 0.52, 1.14, -1.04], 0.07);
            b.place('chrome', new THREE.TorusGeometry(0.135, 0.032, 8, 20), x * 0.62, 0.53, 2.14);
            b.place('head', new THREE.SphereGeometry(0.12, 14, 10), x * 0.62, 0.53, 2.12, 0, 0, 0, 1, 1, 0.5);
            for (let i = 0; i < 3; i++) b.box('tail', 0.15, 0.1, 0.02, x * (0.32 + i * 0.18), 0.66, -2.15);
            b.ball('chrome', 0.06, x * 1.02, 0.9, 0.3, 1.2, 0.8, 0.8);
            b.tube('chrome', [x * 0.97, 0.26, 0.15], [x * 0.97, 0.26, -1.05], 0.055);   // échappement latéral
            b.tube('chrome', [x * 0.97, 0.26, -1.05], [x * 0.97, 0.26, -1.18], 0.075);
            b.box('dark', 0.02, 0.012, 1.3, x * 0.96, 0.58, -0.3);
        }, 1);
        b.box('dark', 0.82, 0.24, 0.04, 0, 0.52, 2.17);                            // calandre
        for (let i = -2; i <= 2; i++) b.box('chrome', 0.012, 0.2, 0.02, i * 0.15, 0.52, 2.19);
        b.tube('chrome', [-0.95, 0.3, 2.2], [0.95, 0.3, 2.2], 0.07, 10);           // pare-chocs
        b.tube('chrome', [-0.92, 0.36, -2.18], [0.92, 0.36, -2.18], 0.065, 10);
        // Compresseur qui sort du capot
        b.box('dark', 0.36, 0.1, 0.46, 0, 0.8, 0.95);
        b.box('chrome', 0.4, 0.03, 0.5, 0, 0.86, 0.95);
        b.box('dark', 0.24, 0.1, 0.24, 0, 0.92, 0.95);
        b.box('chrome', 0.28, 0.025, 0.28, 0, 0.98, 0.95);
        b.box('accent', 1.5, 0.03, 0.1, 0, 0.84, -2.02);
        b.stripe('accent', body.slice(0, 8), 0.12, 0.2).stripe('accent', body.slice(0, 8), 0.12, -0.2);
        b.arch(0.95, 0.36, 1.32, null).arch(0.97, 0.42, -1.22, 'paint');
        b.pair(0.9, 1.32, 0.36, 0.3, { spokes: 5, rim: 0.66, chrome: true, whitewall: true }).pair(0.92, -1.22, 0.42, 0.42, { spokes: 5, rim: 0.66, chrome: true, whitewall: true });
    },

    /** Drift : coupé compact, ailes larges, grand aileron, néon sous la caisse. */
    drift(b) {
        const body = [[1.86, 0.62, 0.3, 0.5], [1.76, 0.8, 0.2, 0.58], [1.2, 0.86, 0.17, 0.68], [0.5, 0.86, 0.17, 0.72], [-0.3, 0.86, 0.17, 0.76], [-1.1, 0.86, 0.2, 0.76], [-1.68, 0.8, 0.24, 0.76], [-1.84, 0.66, 0.3, 0.7]];
        b.loft('paint', body, { radial: 28, steps: 5, round: 4, shoulder: 0.5, tumble: 0.06 });
        b.loft('glass', [[0.82, 0.48, 0.68, 0.72], [0.42, 0.65, 0.68, 0.98], [0, 0.66, 0.7, 1.15], [-0.65, 0.64, 0.72, 1.14], [-1.15, 0.56, 0.74, 0.96], [-1.48, 0.2, 0.66, 0.72]], { radial: 22, tumble: 0.2, shoulder: 0.2, round: 3.2 });
        b.loft('paint', [[0.26, 0.38, 1.03, 1.08], [0.06, 0.56, 1.08, 1.17], [-0.7, 0.54, 1.08, 1.16], [-1, 0.44, 1, 1.07]], { radial: 16, round: 4.5, tumble: 0.08 });
        b.both(x => {
            b.tube('paint', [x * 0.6, 0.72, 0.68], [x * 0.51, 1.12, 0.1], 0.035);
            b.tube('paint', [x * 0.58, 0.76, -1.2], [x * 0.46, 1.12, -0.82], 0.05);
            b.box('head', 0.34, 0.05, 0.05, x * 0.55, 0.53, 1.76, 0, x > 0 ? 0.3 : -0.3);
            b.box('tail', 0.38, 0.09, 0.02, x * 0.5, 0.64, -1.84);
            b.foil('carbon', 0.25, 0.22, 0.02, x * 0.74, 0.4, 1.78, 0.35, x > 0 ? 0.5 : -0.5);   // canard
            b.tube('carbon', [x * 0.62, 0.78, -1.46], [x * 0.68, 1.3, -1.5], 0.022);                 // support
            b.box('carbon', 0.02, 0.16, 0.42, x * 0.96, 1.34, -1.52);                          // joue d'aileron
            b.ball('carbon', 0.06, x * 0.96, 0.85, 0.4, 1.35, 0.75, 0.75);
            b.tube('chrome', [x * 0.28, 0.27, -1.8], [x * 0.28, 0.27, -2.0], 0.085);
            b.box('dark', 0.02, 0.012, 1.3, x * 0.875, 0.52, -0.2);
        }, 1);
        b.box('dark', 0.82, 0.13, 0.05, 0, 0.3, 1.8);
        b.foil('accent', 1.72, 0.42, 0.04, 0, 0.16, 1.68);                         // lame avant vive
        b.foil('carbon', 1.92, 0.5, 0.06, 0, 1.33, -1.52, 0.18);                    // grand aileron
        b.foil('accent', 1.92, 0.12, 0.05, 0, 1.38, -1.28, 0.3);
        b.foil('carbon', 1.3, 0.34, 0.14, 0, 0.2, -1.74);
        b.both(x => b.box('accent', 0.09, 0.09, 2.1, x * 0.86, 0.16, 0), 1);
        // Livrée : bande asymétrique
        b.stripe('accent', body.slice(0, 7), 0.2, 0.4);
        b.place('neon', new THREE.PlaneGeometry(1.9, 3.5).rotateX(-Math.PI / 2), 0, 0.05, 0);
        b.arch(0.875, 0.36, 1.1, 'accent').arch(0.875, 0.36, -1.12, 'accent');
        b.pair(0.86, 1.1, 0.36, 0.34, { spokes: 6, rim: 0.76, gold: true, caliper: 'caliperRed', negative: 0.1 }).pair(0.86, -1.12, 0.36, 0.38, { spokes: 6, rim: 0.76, gold: true, caliper: 'caliperRed', negative: 0.1 });
    },

    /** Monoplace : museau effilé, ailerons, pontons, arceau. */
    f1(b) {
        const nose = [[2.5, 0.07, 0.22, 0.28], [2.25, 0.09, 0.2, 0.3], [1.5, 0.16, 0.18, 0.42], [0.8, 0.24, 0.16, 0.56], [0.1, 0.31, 0.15, 0.68], [-0.4, 0.3, 0.15, 0.8], [-1.0, 0.25, 0.17, 0.76], [-1.6, 0.17, 0.2, 0.6], [-2.0, 0.08, 0.25, 0.42]];
        b.loft('paint', nose, { radial: 24, steps: 5, round: 2.3, shoulder: 0.42, tumble: 0.14 });
        b.loft('dark', [[0.55, 0.14, 0.5, 0.62], [0.2, 0.22, 0.55, 0.74], [-0.2, 0.2, 0.55, 0.75], [-0.42, 0.13, 0.55, 0.68]], { radial: 16, round: 2.6, shoulder: 0.2 });
        b.both(x => {
            b.loft('paint', [[0.45, 0.04, 0.26, 0.34], [0.32, 0.17, 0.2, 0.5], [-0.3, 0.2, 0.18, 0.52], [-1.0, 0.16, 0.2, 0.4], [-1.45, 0.05, 0.25, 0.3]], { radial: 14, round: 3, cx: x * 0.42, steps: 4 });
            b.box('dark', 0.26, 0.2, 0.03, x * 0.42, 0.36, 0.4);                          // ouïe du ponton
            // Suspensions apparentes
            b.tube('carbon', [x * 0.12, 0.38, 1.4], [x * 0.78, 0.42, 1.38], 0.018);
            b.tube('carbon', [x * 0.12, 0.26, 1.15], [x * 0.78, 0.28, 1.38], 0.018);
            b.tube('carbon', [x * 0.2, 0.42, -1.1], [x * 0.78, 0.46, -1.32], 0.018);
            b.tube('carbon', [x * 0.2, 0.26, -1.0], [x * 0.78, 0.28, -1.32], 0.018);
            b.box('carbon', 0.025, 0.2, 0.44, x * 0.98, 0.22, 2.15);                       // dérive avant
            b.box('carbon', 0.025, 0.44, 0.5, x * 0.76, 1.02, -1.84);                      // dérive arrière
            b.box('accent', 0.03, 0.08, 0.5, x * 0.76, 1.24, -1.84);
            b.box('tail', 0.04, 0.05, 0.02, x * 0.74, 1.12, -2.1);
        }, 1);
        // Aileron avant à deux lames
        b.foil('carbon', 1.96, 0.42, 0.05, 0, 0.16, 2.2, -0.08);
        b.foil('accent', 1.9, 0.2, 0.04, 0, 0.27, 2.05, -0.35);
        b.foil('paint', 0.3, 0.12, 0.03, 0, 0.3, 2.42);
        b.both(x => b.tube('carbon', [x * 0.06, 0.24, 2.25], [x * 0.08, 0.17, 2.2], 0.02), 1);
        // Aileron arrière
        b.foil('carbon', 1.5, 0.42, 0.05, 0, 1.08, -1.82, 0.12);
        b.foil('accent', 1.5, 0.2, 0.04, 0, 1.2, -1.96, 0.42);
        b.tube('carbon', [0, 0.5, -1.72], [0, 1.08, -1.8], 0.028);
        b.foil('carbon', 1.2, 0.34, 0.12, 0, 0.24, -1.9);
        // Dérive moteur, prise d'air, arceau de sécurité
        b.loft('paint', [[-0.42, 0.012, 0.74, 0.8], [-0.9, 0.018, 0.5, 0.98], [-1.68, 0.012, 0.4, 0.96]], { radial: 8, round: 6, tumble: 0 });
        b.place('dark', new THREE.TorusGeometry(0.13, 0.05, 6, 14), 0, 0.92, -0.42, 0, 0, 0, 1, 0.8, 1);
        b.place('chrome', new THREE.TorusGeometry(0.28, 0.024, 8, 24, Math.PI).rotateX(-Math.PI / 2), 0, 0.91, 0.1, 0.15);
        b.tube('chrome', [0, 0.8, 0.58], [0, 0.93, 0.38], 0.024);
        b.ball('helmet', 0.2, 0, 0.86, -0.1);
        b.ball('visor', 0.155, 0, 0.87, -0.015, 1, 0.5, 0.9);
        b.box('tail', 0.1, 0.1, 0.02, 0, 0.3, -2.06);
        b.stripe('accent', nose.slice(0, 6), 0.3, 0, 0.004);
        b.pair(0.9, 1.38, 0.36, 0.34, { spokes: 12, rim: 0.74, slick: true, caliper: 'caliperRed' }).pair(0.92, -1.32, 0.4, 0.46, { spokes: 12, rim: 0.74, slick: true, caliper: 'caliperRed' });
    },

    /** Monster truck : pick-up perché sur des pneus géants à crampons. */
    truck(b) {
        const lift = 0.68;
        const up = s => s.map(([z, w, yb, yt]) => [z, w, yb + lift, yt + lift]);
        const nose = up([[1.82, 0.74, 0.3, 0.72], [1.68, 0.84, 0.26, 0.8], [1.1, 0.88, 0.24, 0.9], [0.5, 0.88, 0.24, 0.94]]);
        const whole = [...nose, ...up([[-0.2, 0.9, 0.24, 0.92], [-1.0, 0.9, 0.24, 0.9], [-1.76, 0.86, 0.26, 0.88], [-1.84, 0.76, 0.32, 0.82]])];
        b.loft('paint', whole, { radial: 26, steps: 4, round: 5.2, shoulder: 0.55, tumble: 0.03 });
        // Cabine
        b.loft('glass', up([[0.56, 0.6, 0.92, 0.96], [0.22, 0.76, 0.92, 1.42], [-0.1, 0.76, 0.92, 1.56], [-0.72, 0.74, 0.92, 1.56], [-0.84, 0.66, 0.92, 1.42]]), { radial: 20, round: 5, shoulder: 0.2, tumble: 0.12 });
        b.loft('paint', up([[0.14, 0.5, 1.48, 1.52], [-0.05, 0.72, 1.52, 1.62], [-0.72, 0.7, 1.52, 1.62], [-0.86, 0.5, 1.46, 1.52]]), { radial: 16, round: 6, tumble: 0.03 });
        b.both(x => {
            b.tube('paint', [x * 0.72, lift + 0.92, 0.54], [x * 0.66, lift + 1.5, 0.05], 0.05);
            b.tube('paint', [x * 0.76, lift + 0.92, -0.72], [x * 0.68, lift + 1.52, -0.72], 0.07);
            b.box('dark', 0.02, 0.42, 0.04, x * 0.78, lift + 1.2, -0.22);
            // Benne
            b.box('paint', 0.06, 0.32, 0.98, x * 0.84, lift + 1.04, -1.3);
            // Échappement vertical
            b.tube('chrome', [x * 0.72, lift + 0.9, -0.92], [x * 0.72, lift + 1.76, -0.92], 0.06);
            b.tube('dark', [x * 0.72, lift + 1.7, -0.92], [x * 0.72, lift + 1.78, -0.92], 0.07);
            // Phares ronds et feux
            b.place('chrome', new THREE.TorusGeometry(0.135, 0.025, 8, 18), x * 0.56, lift + 0.6, 1.8);
            b.place('head', new THREE.SphereGeometry(0.12, 14, 10), x * 0.56, lift + 0.6, 1.78, 0, 0, 0, 1, 1, 0.5);
            b.box('tail', 0.22, 0.13, 0.02, x * 0.66, lift + 0.72, -1.85);
            // Trains roulants
            b.tube('chrome', [x * 0.2, 0.92, 1.26], [x * 0.92, 0.76, 1.26], 0.05);
            b.tube('chrome', [x * 0.2, 0.92, -1.26], [x * 0.92, 0.76, -1.26], 0.05);
            b.tube('shock', [x * 0.5, 0.8, 1.14], [x * 0.5, 1.2, 1.2], 0.055);
            b.tube('shock', [x * 0.5, 0.8, -1.14], [x * 0.5, 1.2, -1.2], 0.055);
            b.tube('chrome', [x * 0.32, 0.8, 1.38], [x * 0.32, 1.22, 1.32], 0.03);
            b.tube('chrome', [x * 0.32, 0.8, -1.38], [x * 0.32, 1.22, -1.32], 0.03);
            b.ball('chrome', 0.07, x * 0.98, lift + 1.08, 0.3, 0.8, 1.3, 0.7);
        }, 1);
        b.box('carbon', 1.2, 0.2, 3.2, 0, 0.86, 0);                                 // châssis
        b.tube('dark', [-1.02, 0.76, 1.26], [1.02, 0.76, 1.26], 0.06);
        b.tube('dark', [-1.02, 0.76, -1.26], [1.02, 0.76, -1.26], 0.06);
        // Pare-buffle et rampe de phares
        b.tube('chrome', [-0.92, lift + 0.32, 1.98], [0.92, lift + 0.32, 1.98], 0.05);
        b.tube('chrome', [-0.82, lift + 0.82, 1.92], [0.82, lift + 0.82, 1.92], 0.04);
        b.both(x => {
            b.tube('chrome', [x * 0.82, lift + 0.3, 1.98], [x * 0.82, lift + 0.84, 1.92], 0.04);
            b.tube('chrome', [x * 0.32, lift + 0.3, 1.98], [x * 0.32, lift + 0.84, 1.92], 0.03);
        }, 1);
        b.box('dark', 0.84, 0.28, 0.04, 0, lift + 0.56, 1.82);
        for (let i = -3; i <= 3; i++) b.box('chrome', 0.03, 0.26, 0.02, i * 0.1, lift + 0.56, 1.84);
        b.box('dark', 1.2, 0.06, 0.16, 0, lift + 1.66, -0.1);
        for (let i = -2; i <= 2; i++) b.ball('head', 0.075, i * 0.25, lift + 1.72, -0.06, 1, 1, 0.6);
        b.box('paint', 1.7, 0.32, 0.06, 0, lift + 1.04, -1.8);                       // hayon
        b.box('void', 1.62, 0.02, 0.96, 0, lift + 0.91, -1.3);                       // fond de benne
        b.both(x => b.flare('carbon', 0.88, x * 0.98, 0.84, 1.26, 0.075), 1);
        b.both(x => b.flare('carbon', 0.88, x * 0.98, 0.84, -1.26, 0.075), 1);
        b.stripe('accent', whole.slice(0, 4), 0.24, 0, 0.006);
        const s = { spokes: 7, rim: 0.48, knobs: true, chrome: true };
        b.pair(1.08, 1.26, 0.8, 0.62, s).pair(1.08, -1.26, 0.8, 0.62, s);
    },

    /** Kart : châssis tubulaire et pilote à l'air libre. */
    kart(b) {
        for (const x of [-0.45, 0.45]) b.tube('chrome', [x, 0.2, -0.95], [x * 0.75, 0.2, 1.18], 0.03);
        b.tube('chrome', [-0.34, 0.2, 1.18], [0.34, 0.2, 1.18], 0.03);
        b.tube('chrome', [-0.75, 0.22, 0.8], [0.75, 0.22, 0.8], 0.03);
        b.tube('chrome', [-0.78, 0.24, -0.72], [0.78, 0.24, -0.72], 0.035);
        // Carénages
        b.loft('paint', [[1.5, 0.24, 0.18, 0.28], [1.25, 0.46, 0.16, 0.36], [0.72, 0.28, 0.2, 0.52], [0.25, 0.13, 0.26, 0.6]], { radial: 16, steps: 4, round: 2.8 });
        b.both(x => {
            b.loft('paint', [[0.42, 0.05, 0.2, 0.28], [0.2, 0.15, 0.17, 0.4], [-0.45, 0.15, 0.17, 0.4], [-0.7, 0.04, 0.2, 0.28]], { radial: 12, round: 3, cx: x * 0.62 });
            b.place('dark', new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), x * 0.62, 0.37, -0.1);
            b.tube('carbon', [x * 0.32, 0.22, 0.78], [x * 0.68, 0.22, 0.86], 0.02);
        }, 1);
        b.loft('accent', [[-0.65, 0.3, 0.16, 0.32], [-0.95, 0.76, 0.13, 0.38], [-1.14, 0.7, 0.14, 0.34], [-1.2, 0.3, 0.2, 0.28]], { radial: 12, round: 4 });
        b.both(x => b.box('tail', 0.14, 0.05, 0.02, x * 0.4, 0.3, -1.21), 1);
        // Volant, siège, moteur
        b.tube('chrome', [0, 0.32, 0.72], [0, 0.72, 0.28], 0.018);
        b.place('dark', new THREE.TorusGeometry(0.12, 0.018, 6, 16), 0, 0.74, 0.25, 0.82);
        b.loft('dark', [[-0.12, 0.2, 0.2, 0.32], [-0.4, 0.22, 0.2, 0.66], [-0.6, 0.2, 0.3, 0.86], [-0.68, 0.15, 0.46, 0.9]], { radial: 14, round: 3 });
        b.box('carbon', 0.28, 0.28, 0.3, 0.42, 0.36, -0.55);
        b.tube('chrome', [0.42, 0.34, -0.68], [0.5, 0.42, -1.1], 0.05);
        // Pilote
        b.loft('suit', [[-0.14, 0.12, 0.3, 0.42], [-0.3, 0.2, 0.3, 0.86], [-0.5, 0.2, 0.32, 0.92], [-0.62, 0.15, 0.38, 0.88]], { radial: 14, round: 2.6 });
        b.both(x => {
            b.tube('suit', [x * 0.2, 0.84, -0.42], [x * 0.2, 0.68, -0.04], 0.05);
            b.tube('suit', [x * 0.2, 0.68, -0.04], [x * 0.11, 0.74, 0.22], 0.045);
            b.tube('suit', [x * 0.12, 0.34, -0.2], [x * 0.14, 0.42, 0.38], 0.07);
            b.tube('suit', [x * 0.14, 0.42, 0.38], [x * 0.14, 0.26, 0.85], 0.055);
        }, 1);
        b.ball('helmet', 0.2, 0, 1.08, -0.42);
        b.ball('visor', 0.155, 0, 1.09, -0.335, 1, 0.5, 0.9);
        const s = { spokes: 5, rim: 0.56, slick: true };
        b.pair(0.86, 0.86, 0.23, 0.24, s).pair(0.9, -0.72, 0.27, 0.36, s);
    },

    /** Prototype d'endurance : goutte d'eau, verrière et lumières. */
    proto(b) {
        const body = [[2.42, 0.42, 0.2, 0.28], [2.25, 0.82, 0.14, 0.36], [1.6, 0.96, 0.13, 0.5], [1.0, 0.92, 0.13, 0.5], [0.3, 0.84, 0.13, 0.56], [-0.5, 0.92, 0.14, 0.6], [-1.3, 1.0, 0.15, 0.68], [-2.0, 0.96, 0.2, 0.72], [-2.34, 0.76, 0.28, 0.66]];
        b.loft('paint', body, { radial: 30, steps: 5, round: 2.9, shoulder: 0.45, tumble: 0.16 });
        // Bulle du cockpit
        b.loft('glass', [[1.12, 0.14, 0.46, 0.5], [0.72, 0.44, 0.48, 0.74], [0.15, 0.54, 0.5, 1.0], [-0.42, 0.5, 0.54, 1.03], [-0.92, 0.32, 0.58, 0.9]], { radial: 22, round: 2.4, shoulder: 0.1, tumble: 0.22 });
        b.loft('paint', [[0.24, 0.14, 0.92, 0.97], [-0.1, 0.27, 0.96, 1.05], [-0.5, 0.26, 0.94, 1.05], [-1.3, 0.16, 0.74, 0.9], [-2.0, 0.08, 0.68, 0.76]], { radial: 14, round: 3 });
        b.loft('paint', [[-0.5, 0.012, 1.0, 1.05], [-1.2, 0.016, 0.84, 1.14], [-2.1, 0.012, 0.7, 1.22]], { radial: 8, round: 6, tumble: 0 });   // dérive
        b.both(x => {
            b.loft('paint', [[2.0, 0.08, 0.34, 0.42], [1.65, 0.24, 0.28, 0.72], [1.05, 0.24, 0.28, 0.76], [0.6, 0.1, 0.3, 0.5]], { radial: 16, round: 3, cx: x * 0.76 });
            b.loft('paint', [[-0.65, 0.08, 0.34, 0.5], [-1.0, 0.25, 0.28, 0.82], [-1.65, 0.26, 0.26, 0.86], [-2.1, 0.12, 0.34, 0.66]], { radial: 16, round: 3, cx: x * 0.8 });
            b.box('dark', 0.14, 0.22, 0.03, x * 0.48, 0.42, 0.28);                       // prise d'air
            b.ball('dark', 0.22, x * 0.5, 0.42, 0.26, 0.9, 0.7, 0.3);
            b.loft('head', [[2.06, 0.03, 0.42, 0.44], [1.95, 0.2, 0.46, 0.52], [1.72, 0.06, 0.56, 0.58]], { radial: 10, cx: x * 0.72 });
            b.box('head', 0.3, 0.018, 0.03, x * 0.72, 0.38, 2.04, 0, x > 0 ? 0.5 : -0.5);
            b.box('carbon', 0.025, 0.3, 0.46, x * 0.96, 1.2, -2.1);                        // joue d'aileron
            b.tube('carbon', [x * 0.5, 0.66, -1.98], [x * 0.5, 1.24, -2.1], 0.022);
            b.foil('accent', 0.26, 0.14, 0.02, x * 0.97, 0.26, 2.12, 0.25, x > 0 ? 0.25 : -0.25);
        }, 1);
        b.box('tail', 1.84, 0.03, 0.02, 0, 0.66, -2.35);
        b.foil('carbon', 1.92, 0.5, 0.05, 0, 1.28, -2.1, 0.16);
        b.foil('accent', 1.92, 0.14, 0.03, 0, 1.31, -2.3, 0.32);
        b.foil('carbon', 1.9, 0.42, 0.06, 0, 0.14, 2.14);
        b.foil('carbon', 1.5, 0.5, 0.2, 0, 0.26, -2.18);
        b.box('tail', 0.14, 0.14, 0.02, 0, 0.34, -2.45);
        b.stripe('accent', body.slice(0, 5), 0.22, 0, 0.006);
        b.arch(0.99, 0.37, 1.3, null).arch(1.03, 0.4, -1.32, null);
        b.pair(0.96, 1.3, 0.37, 0.32, { spokes: 16, rim: 0.78, caliper: 'caliperYellow' }).pair(1, -1.32, 0.4, 0.42, { spokes: 16, rim: 0.78, caliper: 'caliperYellow' });
    },
};

// ---------- Roues ----------
const wheelCache = new Map();

function buildWheelGeometry(r, w, style) {
    const key = JSON.stringify([r, w, style]);
    if (wheelCache.has(key)) return wheelCache.get(key);

    const rimR = r * (style.rim ?? 0.7), hw = w / 2, sh = Math.min(hw * 0.45, r * 0.12);
    // Pneu : profil arrondi tourné autour de l'axe
    const pts = [[rimR * 0.92, -hw * 0.82], [rimR * 1.02, -hw * 0.98], [r - sh, -hw], [r - sh * 0.3, -hw * 0.8], [r, -hw * 0.45], [r, hw * 0.45], [r - sh * 0.3, hw * 0.8], [r - sh, hw], [rimR * 1.02, hw * 0.98], [rimR * 0.92, hw * 0.82]].map(([a, b]) => new THREE.Vector2(a, b));
    const tireParts = [new THREE.LatheGeometry(pts, 32).rotateZ(Math.PI / 2)];
    if (!style.slick && !style.knobs) {
        // Sculptures de la bande de roulement
        for (const off of [-0.25, 0.25]) tireParts.push(new THREE.TorusGeometry(r - 0.004, 0.006, 4, 32).rotateY(Math.PI / 2).translate(off * w, 0, 0));
    }
    if (style.knobs) {
        // Crampons
        const N = 22;
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            for (const side of [-1, 1]) {
                const knob = new THREE.BoxGeometry(w * 0.4, 0.09, 0.14);
                knob.rotateY(side * 0.45);
                knob.translate(side * w * 0.24, r + 0.012, 0);
                knob.rotateX(a + (side > 0 ? 0.14 : 0));
                tireParts.push(knob);
            }
        }
    }
    const tire = mergeGeometries(tireParts);

    // Jante : voile creux, rayons, écrou. La face visible est vers +x.
    const out = hw + 0.002;
    const dish = new THREE.LatheGeometry([[0.001, out - w * 0.42], [rimR * 0.3, out - w * 0.42], [rimR * 0.72, out - w * 0.18], [rimR * 0.96, out - 0.008], [rimR * 1.02, out], [rimR * 0.99, out + 0.012], [rimR * 0.93, out - 0.01], [rimR * 0.72, out - w * 0.3], [rimR * 0.3, out - w * 0.6], [0.001, out - w * 0.6]].map(([a, b]) => new THREE.Vector2(a, b)), 32).rotateZ(Math.PI / 2);
    const rimParts = [dish];
    const N = style.spokes ?? 7, thick = Math.max(0.018, rimR * (N > 10 ? 0.05 : 0.13));
    for (let i = 0; i < N; i++) {
        const spoke = new THREE.BoxGeometry(0.03, rimR * 0.82, thick);
        spoke.rotateX(style.negative ? 0.12 : 0);
        spoke.translate(out - 0.015 - (style.negative ?? 0), rimR * 0.5, 0);
        spoke.rotateX((i / N) * Math.PI * 2);
        rimParts.push(spoke);
    }
    rimParts.push(new THREE.CylinderGeometry(rimR * 0.18, rimR * 0.22, 0.04, 12).rotateZ(Math.PI / 2).translate(out - 0.015, 0, 0));
    const rim = mergeGeometries(rimParts);

    const brake = new THREE.CylinderGeometry(rimR * 0.76, rimR * 0.76, 0.03, 24).rotateZ(Math.PI / 2).translate(hw - w * 0.5, 0, 0);
    const caliper = new THREE.BoxGeometry(0.08, rimR * 0.46, rimR * 0.3).translate(hw - w * 0.42, rimR * 0.56, 0);
    const wall = style.whitewall ? new THREE.TorusGeometry(rimR * 1.18, r * 0.05, 4, 32).rotateY(Math.PI / 2).translate(hw * 0.98, 0, 0) : null;

    const result = { tire, rim, brake, caliper, wall };
    wheelCache.set(key, result);
    return result;
}

// ---------- Matériaux ----------
const blobTexture = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,.62)'); grad.addColorStop(0.65, 'rgba(0,0,0,.42)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
})();

const shared = {
    carbon: new THREE.MeshStandardMaterial({ color: 0x1b1b20, metalness: 0.15, roughness: 0.55, envMapIntensity: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0e0e12, metalness: 0.2, roughness: 0.6, envMapIntensity: 0.6 }),
    void: new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, metalness: 0, envMapIntensity: 0 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08, envMapIntensity: 1.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1420, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, transparent: true, opacity: 0.86 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfffdf0, emissive: 0xfff4c4, emissiveIntensity: 3.2, roughness: 0.2 }),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0xff8c1a, metalness: 0.1, roughness: 0.25, clearcoat: 1 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x151030, metalness: 0.9, roughness: 0.06, clearcoat: 1, envMapIntensity: 2 }),
    suit: new THREE.MeshStandardMaterial({ color: 0x1f7a44, roughness: 0.7 }),
    shock: new THREE.MeshStandardMaterial({ color: 0xff8c1a, metalness: 0.5, roughness: 0.35 }),
    neon: new THREE.MeshBasicMaterial({ color: 0x2bff88, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, map: blobTexture, toneMapped: false }),
    tire: new THREE.MeshStandardMaterial({ color: 0x19191c, roughness: 0.86, metalness: 0 }),
    whitewall: new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc9ccd4, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    rimChrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    rimGold: new THREE.MeshStandardMaterial({ color: 0xf0b429, metalness: 1, roughness: 0.24, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    brake: new THREE.MeshStandardMaterial({ color: 0x55565c, metalness: 0.9, roughness: 0.42 }),
    caliperRed: new THREE.MeshStandardMaterial({ color: 0xe02020, metalness: 0.2, roughness: 0.3 }),
    caliperYellow: new THREE.MeshStandardMaterial({ color: 0x2ecc71, metalness: 0.2, roughness: 0.3 }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x7cf5b0, transparent: true, opacity: 0.3, depthWrite: false }),
    blob: new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }),
};

// Une carrosserie n'est calculée qu'une fois par type, quel que soit le nombre de voitures.
const typeCache = new Map();
function assembled(type) {
    if (typeCache.has(type)) return typeCache.get(type);
    const b = new Builder();
    BUILDERS[type](b);
    const groups = {};
    for (const [mat, list] of Object.entries(b.parts)) groups[mat] = mergeGeometries(list.map(g => (g.attributes.normal ? g : (g.computeVertexNormals(), g))));
    const zs = b.wheels.map(w => w.z), rear = b.wheels.filter(w => w.z < 0)[0];
    // Longueur et largeur pour l'ombre de contact
    let maxZ = 0, minZ = 0, maxX = 0;
    for (const g of Object.values(groups)) {
        g.computeBoundingBox();
        maxZ = Math.max(maxZ, g.boundingBox.max.z); minZ = Math.min(minZ, g.boundingBox.min.z); maxX = Math.max(maxX, g.boundingBox.max.x);
    }
    const data = { groups, wheels: b.wheels, rearX: Math.abs(rear.x), rearZ: rear.z, tail: minZ - 0.05, maxZ, minZ, maxX, frontZ: Math.max(...zs) };
    typeCache.set(type, data);
    return data;
}

const CAST = new Set(['paint', 'accent', 'carbon', 'dark', 'chrome', 'helmet', 'suit']);
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Couleur de décoration lisible sur la peinture : blanc sur foncé, noir sur clair, or sur le reste. */
function accentFor(color) {
    const c = new THREE.Color(color), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return l > 0.5 ? 0x15131c : 0xf6f6f8;
}

/** Construit un véhicule : root (position, cap) > chassis (roulis, tangage) + roues animées. */
const DRIVER = new Set(['helmet', 'visor', 'suit']);

export function buildVehicleModel(type, color, { ghost = false, driver = true } = {}) {
    const data = assembled(type);
    const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.15 });
    const accent = new THREE.MeshPhysicalMaterial({ color: accentFor(color), metalness: 0.15, roughness: 0.3, clearcoat: 0.8 });
    const tail = new THREE.MeshStandardMaterial({ color: 0xaa0810, emissive: 0xff1018, emissiveIntensity: 1.1, roughness: 0.25 });
    const own = { paint, accent, tail };
    const mat = key => (ghost ? shared.ghost : own[key] ?? shared[key]);

    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);
    for (const [key, geo] of Object.entries(data.groups)) {
        if (!driver && DRIVER.has(key)) continue;
        const mesh = new THREE.Mesh(geo, mat(key));
        mesh.castShadow = !ghost && CAST.has(key);
        chassis.add(mesh);
    }

    if (!ghost) {
        const blob = new THREE.Mesh(blobGeo, shared.blob);
        blob.scale.set(data.maxX * 2.7 + 0.5, 1, (data.maxZ - data.minZ) * 1.22);
        blob.position.set(0, 0.012, (data.maxZ + data.minZ) / 2);
        root.add(blob);
    }

    const wheels = [];
    for (const w of data.wheels) {
        const g = buildWheelGeometry(w.r, w.w, w.style);
        const pivot = new THREE.Group();      // braquage et suspension
        pivot.position.set(w.x, w.r, w.z);
        const side = new THREE.Group();       // face décorée de la jante vers l'extérieur
        if (w.x < 0) side.rotation.y = Math.PI;
        pivot.add(side);
        const spin = new THREE.Group();       // rotation de la roue
        side.add(spin);
        const rimMat = w.style.gold ? shared.rimGold : w.style.chrome ? shared.rimChrome : shared.rim;
        const tire = new THREE.Mesh(g.tire, ghost ? shared.ghost : shared.tire);
        tire.castShadow = !ghost;
        spin.add(tire);
        if (!ghost) {
            spin.add(new THREE.Mesh(g.rim, rimMat));
            if (g.wall) spin.add(new THREE.Mesh(g.wall, shared.whitewall));
            side.add(new THREE.Mesh(g.brake, shared.brake));
            if (w.style.caliper) side.add(new THREE.Mesh(g.caliper, shared[w.style.caliper]));
        }
        root.add(pivot);
        wheels.push({ pivot, spin, side, front: w.z > 0, baseY: w.r, left: w.x > 0, r: w.r, axle: w.z });
    }

    return {
        root, chassis, wheels, rearMat: ghost ? null : tail, bodyMat: ghost ? null : paint,
        rearX: data.rearX, rearZ: data.rearZ, tail: data.tail,
        roll: 0, rollV: 0, pitch: 0, pitchV: 0, heave: 0, heaveV: 0, wasAir: false, shimmy: 0,
        disposeOwn() { paint.dispose(); accent.dispose(); tail.dispose(); },
    };
}

/** Anime le véhicule avec de vrais ressorts : la caisse prend du retard, plonge et rebondit. */
export function animateModel(model, v, dt) {
    const speed = Math.abs(v.speed), ratio = Math.min(1, speed / v.spec.topSpeed);

    // Cibles : roulis dans les virages, plongée au freinage, cabrage à l'accélération
    const targetRoll = -v.steer * ratio * 0.085 - v.lateral * 0.0052;
    const targetPitch = v.braking ? 0.05 * Math.min(1, speed / 15) : -Math.max(-1, Math.min(1, v.accelG / 34)) * 0.042 - (v.boost > 0 ? 0.03 : 0);

    // Ressort-amortisseur : dt plafonné pour rester stable après une image lente
    const h = Math.min(dt, 1 / 30), k = 90, c = 11;
    model.rollV += ((targetRoll - model.roll) * k - model.rollV * c) * h;
    model.roll += model.rollV * h;
    model.pitchV += ((targetPitch - model.pitch) * k - model.pitchV * c) * h;
    model.pitch += model.pitchV * h;
    const air = v.y > 0;
    if (model.wasAir && !air) model.heaveV -= 3.2;            // écrasement à l'atterrissage
    model.wasAir = air;
    model.heaveV += ((0 - model.heave) * 130 - model.heaveV * 9) * h;
    model.heave += model.heaveV * h;

    // Vibrations : plus fortes hors-piste et à haute vitesse
    model.shimmy += h * (20 + speed * 1.2);
    const rough = (v.onRoad ? 0.0028 : 0.022) * ratio * (air ? 0 : 1);
    const shakeA = Math.sin(model.shimmy) * rough, shakeB = Math.sin(model.shimmy * 1.37 + 1) * rough;

    const ch = model.chassis;
    ch.rotation.z = model.roll + shakeA * 0.8;
    ch.rotation.x = model.pitch + shakeB * 0.6;
    ch.position.y = model.heave + shakeA;

    // Contre-braquage visible en drift
    const steerAngle = v.drifting ? -v.driftDir * 0.28 + v.steer * 0.3 : v.steer * 0.46;
    for (const w of model.wheels) {
        w.spin.rotation.x = v.wheelAngle * (1 / (w.r * 0.8)) * (w.left ? 1 : 1);
        if (w.side.rotation.y) w.spin.rotation.x = -w.spin.rotation.x;   // roue retournée : sens inversé
        if (w.front) w.pivot.rotation.y = steerAngle * (v.speed >= -1 ? 1 : 0.5);
        // Suspension : chaque roue suit la route pendant que la caisse bouge
        const droop = air ? -0.09 : 0;
        const bump = (w.front ? Math.sin(model.shimmy * 0.7) : Math.sin(model.shimmy * 0.7 + 2)) * rough * 1.6;
        w.pivot.position.y = w.baseY + droop + bump + (air ? 0 : model.heave * 0.25);
    }
    if (model.rearMat) model.rearMat.emissiveIntensity = v.braking ? 6 : 1.1;
}
