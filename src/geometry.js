// ============================================================
//  Outils de géométrie partagés par les véhicules et les pilotes :
//  surfaces lissées (« loft »), fusion par matériau, constructeur.
// ============================================================
import * as THREE from 'three';

// ---------- Outils de géométrie ----------
const smooth = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
};
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** Surface lissée passant par les sections. Fermée aux deux bouts, normales vers l'extérieur. */
export function loftGeometry(sections, { radial = 24, steps = 4, round = 3, shoulder = 0.42, tumble = 0.1, cx = 0 } = {}) {
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

export function mergeGeometries(list) {
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
export class Builder {
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

