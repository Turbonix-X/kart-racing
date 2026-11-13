// ============================================================
//  Construction du décor en 3D à partir des données du circuit
//  et du biome choisi. Tout est généré par le code.
//  La construction se fait par étapes, pour l'écran de chargement.
//  Relief : en montagne, la route, les murs, les boîtes et le décor
//  suivent la hauteur donnée par terrain.js (ailleurs, tout est à 0).
// ============================================================
import * as THREE from 'three';
import { BIOMES, buildBiomeDecor, makeObstacle, makeLog, mulberry32, scatter } from './decor.js';
import { Elevation, fbm } from './terrain.js';
import { PICKUP_HALF } from './sim.js';

export const ROAD_Y = 0.06;     // le kart roule au niveau du bitume, jamais dedans
const KERB_Y = 0.075;
const PAINT_Y = 0.09;
export const MARK_Y = 0.1;

// ---------- Textures dessinées au canvas ----------
function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

/** Bruit qui se répète sans couture : indispensable pour une texture en mosaïque. */
function tileHash(i, j, p) {
    i = ((i % p) + p) % p; j = ((j % p) + p) % p;
    const s = Math.sin(i * 127.1 + j * 311.7 + p * 0.37) * 43758.5453;
    return s - Math.floor(s);
}
function tileNoise(x, y, p) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = tileHash(xi, yi, p), b = tileHash(xi + 1, yi, p), c = tileHash(xi, yi + 1, p), d = tileHash(xi + 1, yi + 1, p);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function tileFbm(u, v, base, oct = 4) {
    let s = 0, a = 0.5, f = base, n = 0;
    for (let o = 0; o < oct; o++) { s += a * tileNoise(u * f, v * f, f); n += a; f *= 2; a *= 0.5; }
    return s / n;
}

/** Remplit un canvas pixel par pixel : fn(u, v) → [r, g, b] entre 0 et 255. */
function pixels(g, w, h, fn) {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = fn(x / w, y / h), o = (y * w + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
}
const rgb = hex => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function speckle(g, w, h, count, colors, rng, maxSize = 3) {
    for (let i = 0; i < count; i++) {
        g.fillStyle = colors[Math.floor(rng() * colors.length)];
        const s = 1 + rng() * maxSize;
        g.fillRect(rng() * w, rng() * h, s, s);
    }
}

function groundTexture(b, biomeId, rng) {
    const A = rgb(b.ground), B = rgb(b.groundAlt);
    return canvasTex(512, 512, (g, w, h) => {
        pixels(g, w, h, (u, v) => {
            const n = tileFbm(u, v, 6), fine = tileFbm(u, v, 48, 2);
            const c = mixc(A, B, Math.min(1, Math.max(0, n * 1.6 - 0.3)));
            const k = 0.84 + fine * 0.32;
            return [c[0] * k, c[1] * k, c[2] * k];
        });
        if (biomeId === 'plaine' || biomeId === 'montagne') {
            // Brins d'herbe
            for (let i = 0; i < 5000; i++) {
                const x = rng() * w, y = rng() * h, l = 3 + rng() * 6;
                g.strokeStyle = rng() < 0.5 ? 'rgba(20,60,10,.35)' : 'rgba(170,220,110,.25)';
                g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 3, y - l); g.stroke();
            }
        } else if (biomeId === 'desert' || biomeId === 'plage') {
            // Rides du sable
            g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 3;
            for (let y = 0; y < h; y += 16) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 5); g.stroke(); }
            if (biomeId === 'plage') speckle(g, w, h, 500, ['#ffffffaa', '#f2b5a0aa', '#c9b28066'], rng, 3);
        } else if (biomeId === 'glace') {
            speckle(g, w, h, 900, ['#ffffff', '#cfe8ff', '#b8d8f5'], rng, 2);
        } else if (biomeId === 'jungle') {
            speckle(g, w, h, 1400, ['#1a4a1e', '#3c8a3a', '#5a4024', '#6b8a2a'], rng, 5);
        } else if (biomeId === 'volcan') {
            speckle(g, w, h, 1600, ['#151111', '#4a3a34', '#5a2a1a'], rng, 3);
        } else if (biomeId === 'ville') {
            // Dalles de trottoir
            g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2;
            for (let k = 0; k <= w; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
        }
    });
}

/** Fissures de lave lumineuses (biome volcan) : utilisées comme texture d'émission. */
function lavaCrackTexture(rng) {
    return canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        g.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
            let x = rng() * w, y = rng() * h, a = rng() * 6.28;
            g.strokeStyle = `rgba(255,${90 + rng() * 80},20,${0.5 + rng() * 0.5})`;
            g.lineWidth = 1 + rng() * 2.5;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 12; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
            g.stroke();
        }
    });
}

function roadTexture(b, biomeId, rng) {
    const base = rgb(b.road);
    return canvasTex(512, 1024, (g, w, h) => {
        pixels(g, w, h, (u, v) => {
            const n = tileFbm(u, v, 4, 3), grain = tileFbm(u * 2, v, 96, 2);
            // Trajectoire gommée au centre de chaque voie, un peu plus sombre
            const rubber = Math.exp(-(((u - 0.32) * 7) ** 2)) + Math.exp(-(((u - 0.68) * 7) ** 2));
            const k = 0.88 + n * 0.2 + (grain - 0.5) * 0.22 - rubber * 0.07;
            return [base[0] * k, base[1] * k, base[2] * k];
        });
        speckle(g, w, h, 14000, ['#ffffff14', '#00000030', '#ffffff0a'], rng, 2);
        // Rapiéçages et fissures
        for (let i = 0; i < 5; i++) {
            g.fillStyle = `rgba(0,0,0,${0.06 + rng() * 0.06})`;
            g.fillRect(rng() * w * 0.8, rng() * h, 40 + rng() * 120, 30 + rng() * 90);
        }
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
        for (let i = 0; i < 14; i++) {
            let x = rng() * w, y = rng() * h;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 30; y += rng() * 26; g.lineTo(x, y); }
            g.stroke();
        }
        if (biomeId === 'glace') {
            for (let i = 0; i < 30; i++) {
                g.fillStyle = 'rgba(220,240,255,.16)';
                g.beginPath(); g.ellipse(rng() * w, rng() * h, 10 + rng() * 30, 6 + rng() * 20, rng() * 3, 0, Math.PI * 2); g.fill();
            }
        } else if (biomeId === 'desert' || biomeId === 'plage') {
            for (let i = 0; i < 30; i++) {
                g.fillStyle = 'rgba(216,170,110,.12)';
                g.beginPath(); g.ellipse(rng() < 0.5 ? rng() * 40 : w - rng() * 40, rng() * h, 10 + rng() * 26, 20 + rng() * 40, 0, 0, Math.PI * 2); g.fill();
            }
        }
        // Lignes de rive et tirets centraux
        const lineCol = biomeId === 'ville' ? '#f3f3f3' : '#ececec';
        g.fillStyle = lineCol;
        g.fillRect(6, 0, 9, h); g.fillRect(w - 15, 0, 9, h);
        g.fillStyle = biomeId === 'ville' ? '#ffcf3a' : '#f5f5f5d0';
        g.fillRect(w / 2 - 4, 0, 8, h * 0.42);
        // Usure des peintures
        speckle(g, w, h, 2500, [b.road + 'aa'], rng, 3);
    });
}
/** Relief fin de l'asphalte (gravillons) : texture de bosses. */
function roadBump(rng) {
    return canvasTex(256, 512, (g, w, h) => {
        pixels(g, w, h, (u, v) => { const n = tileFbm(u, v, 64, 2) * 255; return [n, n, n]; });
        speckle(g, w, h, 6000, ['#ffffff', '#000000'], rng, 1.5);
    }, { srgb: false });
}

const stripeTexture = (a, c) => canvasTex(64, 16, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = c; g.fillRect(w / 2, 0, w / 2, h);
    g.fillStyle = '#00000022'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
});

const checkerTexture = () => canvasTex(64, 64, (g, w, h) => {
    const n = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
        g.fillRect(x * w / n, y * h / n, w / n, h / n);
    }
});

const padTexture = () => canvasTex(128, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff7a00'); grad.addColorStop(1, '#ffb020');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff3c4'; g.lineWidth = 14; g.lineJoin = 'miter';
    for (const y of [10, 74]) { g.beginPath(); g.moveTo(10, y + 44); g.lineTo(w / 2, y); g.lineTo(w - 10, y + 44); g.stroke(); }
});

const FONT = '"Russo One", "Exo 2", Outfit, "Segoe UI", sans-serif';
function billboardTexture(text, bg, fg, accent) {
    return canvasTex(512, 128, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, bg); grad.addColorStop(1, accent ?? bg);
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, h / 2);
        g.fillStyle = fg; g.font = `italic 64px ${FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    }, { repeat: false });
}

// ---------- Rubans le long du tracé ----------
class StripBuilder {
    constructor() { this.pos = []; this.uv = []; this.idx = []; this.count = 0; }
    /** Quad entre deux paires gauche/droite. La face regarde vers le haut si « gauche » est bien à gauche. */
    quad(l0, r0, l1, r1, v0, v1, u0 = 0, u1 = 1) {
        const n = this.count;
        this.pos.push(l0[0], l0[1], l0[2], r0[0], r0[1], r0[2], l1[0], l1[1], l1[2], r1[0], r1[1], r1[2]);
        this.uv.push(u0, v0, u1, v0, u0, v1, u1, v1);
        this.idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        this.count += 4;
    }
    build(flatNormal = true) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setIndex(this.idx);
        if (flatNormal) {
            const normals = new Float32Array(this.pos.length);
            for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
            g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else g.computeVertexNormals();
        return g;
    }
}

function buildRoad(t, b, biomeId, rng, root, E) {
    const tile = 24;
    const off = (i, lat, y) => [t.x[i] + t.tz[i] * lat, y + E.y[i], t.z[i] - t.tx[i] * lat];
    const strip = new StripBuilder();
    const last = t.closed ? t.n : t.n - 1;
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        const v0 = i * t.spacing / tile, v1 = (i + 1) * t.spacing / tile;
        // La largeur dessinée est exactement celle utilisée par la détection
        strip.quad(off(a, t.w[a], ROAD_Y), off(a, -t.w[a], ROAD_Y), off(c, t.w[c], ROAD_Y), off(c, -t.w[c], ROAD_Y), v0, v1);
    }
    const wet = biomeId === 'ville', icy = biomeId === 'glace';
    const mat = new THREE.MeshStandardMaterial({
        map: roadTexture(b, biomeId, rng), bumpMap: roadBump(rng), bumpScale: wet ? 0.25 : 0.8,
        roughness: wet ? 0.42 : icy ? 0.45 : 0.9, metalness: wet ? 0.12 : icy ? 0.15 : 0, envMapIntensity: wet ? 0.7 : 1, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(E.flat ? strip.build() : strip.build(false), mat);
    mesh.receiveShadow = true;
    root.add(mesh);

    // Bordures en relief dans les virages
    const kerb = new StripBuilder(), lip = new StripBuilder();
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        if (Math.max(t.curv[a], t.curv[c]) < 0.006) continue;
        const v0 = i * t.spacing / 6, v1 = (i + 1) * t.spacing / 6;
        for (const sgn of [1, -1]) {
            const outer = l => off(l, sgn * (t.w[l] + 1.5), KERB_Y + 0.07), inner = l => off(l, sgn * (t.w[l] - 0.1), KERB_Y);
            const ground = l => off(l, sgn * (t.w[l] + 1.5), -0.02);
            if (sgn > 0) { kerb.quad(outer(a), inner(a), outer(c), inner(c), v0, v1); lip.quad(ground(a), outer(a), ground(c), outer(c), v0, v1); }
            else { kerb.quad(inner(a), outer(a), inner(c), outer(c), v0, v1); lip.quad(outer(a), ground(a), outer(c), ground(c), v0, v1); }
        }
    }
    if (kerb.count) {
        const tex = stripeTexture(...b.kerb);
        tex.rotation = Math.PI / 2; tex.center.set(0.5, 0.5);
        const kmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide });
        const m = new THREE.Mesh(kerb.build(false), kmat);
        m.receiveShadow = true;
        root.add(m, new THREE.Mesh(lip.build(false), kmat));
    }
}

function buildBarriers(t, b, root, E) {
    const strip = new StripBuilder();
    const H = 1.5, below = E.flat ? 0 : 9;      // en montagne, le mur descend sous le terrain
    const last = t.closed ? t.n : t.n - 1;
    const valid = new Uint8Array(t.n * 2);
    for (let i = 0; i < t.n; i++) {
        [1, -1].forEach((sgn, k) => {
            const lim = t.w[i] + t.runoff;
            const x = t.x[i] + t.tz[i] * sgn * lim, z = t.z[i] - t.tx[i] * sgn * lim;
            const near = t.distanceFree(x, z);
            const inCorr = t.corridors.length && (() => { const c = t.corridorInfo(x, z); return c && c.d < c.half + 1; })();
            // Si une autre portion de piste est plus proche, ce point n'est pas une frontière
            valid[i * 2 + k] = near.d >= lim - 2.5 && !inCorr ? 1 : 0;
        });
    }
    const posts = [];
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        [1, -1].forEach((sgn, k) => {
            if (!valid[a * 2 + k] || !valid[c * 2 + k]) return;
            const la = sgn * (t.w[a] + t.runoff), lc = sgn * (t.w[c] + t.runoff);
            const p = (l, idx, y) => [t.x[idx] + t.tz[idx] * l, y + E.y[idx], t.z[idx] - t.tx[idx] * l];
            const v0 = i * t.spacing / 8, v1 = (i + 1) * t.spacing / 8;
            strip.quad(p(la, a, H), p(la, a, -below), p(lc, c, H), p(lc, c, -below), v0, v1);
            if (i % 3 === 0) posts.push(p(la * 1.0 + sgn * 0.25, a, 0));
        });
    }
    const tex = stripeTexture(...b.barrier);
    tex.rotation = Math.PI / 2; tex.center.set(0.5, 0.5);
    const mesh = new THREE.Mesh(strip.build(false), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
    // Poteaux de glissière
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, H + 0.5, 6).translate(0, (H + 0.5) / 2 - 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.35 }), Math.max(1, posts.length));
    const d = new THREE.Object3D();
    posts.forEach((q, i) => { d.position.set(q[0], q[1], q[2]); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); });
    pm.count = posts.length;
    pm.castShadow = true;
    root.add(pm);

    if (t.corridors.length) {
        const dirt = new THREE.MeshStandardMaterial({ color: 0x8a6239, roughness: 1 });
        for (const c of t.corridors) for (let i = 0; i < c.pts.length - 1; i++) {
            const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1];
            const len = Math.hypot(bx - ax, bz - az);
            const p = new THREE.Mesh(new THREE.PlaneGeometry(c.half * 2, len + c.half), dirt);
            p.rotation.x = -Math.PI / 2;
            p.rotation.z = Math.atan2(bx - ax, bz - az);
            p.position.set((ax + bx) / 2, 0.03 + (E.flat ? 0 : E.terrainAt((ax + bx) / 2, (az + bz) / 2) + 0.35), (az + bz) / 2);
            p.receiveShadow = true;
            root.add(p);
        }
    }
}

/** Pose un objet plat ou un ensemble sur la route : hauteur et pente de la piste à cet endroit. */
function onRoad(obj, t, E, s, x, z, heading, lift = 0) {
    obj.position.set(x, E.atS(s) + lift, z);
    obj.rotation.order = 'YXZ';
    obj.rotation.set(-Math.atan(E.slopeAtS(s)), heading, 0);
}

/** Portique de départ, avec de vrais feux : rouge, orange, vert. */
function buildStartFinish(t, root, world, E) {
    const lineMat = new THREE.MeshBasicMaterial({ map: checkerTexture(), toneMapped: false });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, metalness: 0.6, roughness: 0.4 });
    const addGate = (s, label, color, withLights) => {
        const p = t.pointAt(s, 0), w = p.width, h0 = E.atS(s);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 4).rotateX(-Math.PI / 2), lineMat);
        lineMat.map.repeat.set(4, 1);
        onRoad(line, t, E, s, p.x, p.z, p.heading + Math.PI, PAINT_Y);
        root.add(line);
        for (const sgn of [1, -1]) {
            const q = t.pointAt(s, sgn * (w + 1.5));
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 10), postMat);
            post.position.set(q.x, h0 + 4, q.z); post.castShadow = true;
            root.add(post);
        }
        const tex = billboardTexture(label, color, '#ffffff');
        const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const banner = new THREE.Mesh(new THREE.BoxGeometry((w + 1.5) * 2, 1.8, 0.3), [postMat, postMat, postMat, postMat, face, face]);
        banner.position.set(p.x, h0 + 8, p.z);
        banner.rotation.y = p.heading + Math.PI;
        banner.castShadow = true;
        root.add(banner);
        if (withLights) {
            const box = new THREE.Group();
            box.position.set(p.x, h0 + 10.4, p.z);
            box.rotation.y = p.heading + Math.PI;
            box.add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 0.7), postMat));
            world.lamps = [0xff2020, 0xff8c1a, 0x20e060].map((col, i) => {
                const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 0.05 });
                for (const side of [1, -1]) {
                    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), mat);
                    lamp.position.set(-1.45 + i * 1.45, 0, side * 0.36);
                    if (side < 0) lamp.rotation.y = Math.PI;
                    box.add(lamp);
                }
                return mat;
            });
            root.add(box);
        }
    };
    addGate(t.startS, t.closed ? 'DÉPART / ARRIVÉE' : 'DÉPART', '#1f9d55', true);
    if (!t.closed) addGate(t.finishS, 'ARRIVÉE', '#e8730c', false);
}

/** Forme de flaque irrégulière, de rayon 1. */
function blobGeometry(seed, rough = 0.16) {
    const shape = new THREE.Shape(), N = 28;
    for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = 1 + Math.sin(a * 3 + seed) * rough + Math.sin(a * 5 + seed * 2) * rough * 0.5;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2);
}

/** Cube « ? » des boîtes mystère, sur ses six faces. */
function mysteryTexture() {
    return canvasTex(256, 256, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ffb43a'); grad.addColorStop(0.5, '#ff7a1a'); grad.addColorStop(1, '#22c55e');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,.18)';
        for (let i = 0; i < 6; i++) g.fillRect(0, i * 46, w, 14);
        g.strokeStyle = '#fff'; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = '#fff'; g.font = `italic 170px ${FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 10; g.shadowOffsetY = 6;
        g.fillText('?', w / 2, h / 2 + 10);
    }, { repeat: false });
}

function buildFeatures(t, biomeId, root, animated, E, rng) {
    if (t.pads.length) {
        const tex = padTexture();
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
        for (const pad of t.pads) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(pad.half * 2, pad.len * 2).rotateX(-Math.PI / 2), mat);
            onRoad(m, t, E, pad.s, pad.x, pad.z, pad.heading + Math.PI, PAINT_Y + 0.005);
            root.add(m);
        }
        animated.padTex = tex;
    }

    if (t.ramps.length) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.55, side: THREE.DoubleSide });
        const stripes = new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.6 });
        for (const r of t.ramps) {
            const w = r.half * 2, L = 9, H = 1.9;
            const shape = new THREE.BufferGeometry();
            shape.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                -w / 2, 0, -L / 2, w / 2, 0, -L / 2, -w / 2, H, L / 2, w / 2, H, L / 2, -w / 2, 0, L / 2, w / 2, 0, L / 2,
            ]), 3));
            shape.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 4, 2, 1, 3, 5]);
            shape.computeVertexNormals();
            const g = new THREE.Group();
            const m = new THREE.Mesh(shape, mat);
            m.castShadow = true;
            g.add(m);
            for (let k = -2; k <= 2; k++) {
                const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, L * 1.03), stripes);
                s.position.set(k * w / 5.5, H / 2 + 0.02, 0); s.rotation.x = -Math.atan2(H, L);
                g.add(s);
            }
            onRoad(g, t, E, r.s, r.x, r.z, r.heading, ROAD_Y);
            root.add(g);
        }
    }

    // Obstacles : modèle propre au biome
    for (const o of t.obstacles) {
        const m = o.kind === 'log' ? makeLog() : makeObstacle(biomeId, rng);
        if (o.kind === 'log') { m.position.set(o.x, (E.flat ? 0 : E.terrainAt(o.x, o.z) + 0.35) + 0.55, o.z); }
        else {
            m.scale.set(o.r, o.h, o.r);
            const q = t.locate(o.x, o.z, -1, {});
            m.position.set(o.x, E.atS(q.s), o.z);
            m.rotation.y = o.x * 0.37;
        }
        root.add(m);
    }

    // Boîtes mystère : cube irisé, « ? » sur chaque face, anneau lumineux au sol
    const count = Math.max(1, t.pickupSpots.length);
    const S = PICKUP_HALF * 2;
    const boxTex = mysteryTexture();
    const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(S, S, S), new THREE.MeshPhysicalMaterial({
        map: boxTex, emissiveMap: boxTex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.18, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.5,
        transparent: true, opacity: 0.94,
    }), count);
    boxes.frustumCulled = false;
    boxes.castShadow = true;
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.5, 0.08, 6, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5dff9e, toneMapped: false, transparent: true, opacity: 0.85 }), count);
    rings.frustumCulled = false;
    const glow = new THREE.InstancedMesh(new THREE.CircleGeometry(2.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,170,60,0.75)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), count);
    glow.frustumCulled = false;
    root.add(boxes, rings, glow);
    Object.assign(animated, { boxes, rings, glow });
    animated.boxY = t.pickupSpots.map(p => E.atS(t.locate(p.x, p.z, -1, {}).s));

    // Flaques d'eau (sur la piste) : surface brillante, bord mouillé et ronds dans l'eau
    const water = new THREE.InstancedMesh(blobGeometry(1.3), new THREE.MeshPhysicalMaterial({
        color: biomeId === 'volcan' ? 0x3a3434 : 0x5f86a6, roughness: 0.02, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.4,
        transparent: true, opacity: 0.78, depthWrite: false,
    }), 12);
    const wetRim = new THREE.InstancedMesh(blobGeometry(2.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 12);
    const ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, depthWrite: false }), 24);
    // Flaques d'huile (objet) : noires et irisées
    const oil = new THREE.InstancedMesh(blobGeometry(0.4, 0.2), new THREE.MeshPhysicalMaterial({
        color: 0x07070c, metalness: 0.5, roughness: 0.08, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 650], clearcoat: 1, transparent: true, opacity: 0.94, depthWrite: false,
    }), 40);
    for (const m of [water, wetRim, ripples, oil]) { m.frustumCulled = false; m.renderOrder = 1; }
    wetRim.renderOrder = 0;
    root.add(wetRim, water, ripples, oil);
    Object.assign(animated, { water, wetRim, ripples, oil });

    // Cônes renversables
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.45 });
    const n = Math.max(1, t.coneSpots.length);
    const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.1, 16).translate(0, 0.6, 0), coneMat, n);
    const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.33, 0.18, 16).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x777777 }), n);
    const feet = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.08, 0.95).translate(0, 0.04, 0), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 }), n);
    cones.castShadow = true;
    cones.frustumCulled = bands.frustumCulled = feet.frustumCulled = false;
    root.add(cones, bands, feet);
    Object.assign(animated, { cones, bands, feet });
}

function radialTexture(inner) {
    return canvasTex(128, 128, (g, w, h) => {
        const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        grad.addColorStop(0, inner); grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }, { repeat: false });
}

/** Spectateurs : corps, tête, bras levés, casquettes et drapeaux. Ils sautent, calculés par la carte graphique. */
function crowdMaterial(animated, color, arms = false) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    m.onBeforeCompile = shader => {
        shader.uniforms.uTime = animated.crowdTime;
        shader.uniforms.uExcite = animated.crowdExcite;
        shader.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
#ifdef USE_INSTANCING
float seed = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z;
float jump = abs(sin(uTime * (4.0 + mod(instanceMatrix[3].x, 3.0)) + seed)) * uExcite;
${arms ? 'transformed.x += sin(uTime * 7.0 + seed) * 0.12 * step(0.5, position.y) * (0.4 + uExcite * 3.0);' : ''}
transformed.y += jump;
#endif`,
        );
    };
    return m;
}

function buildGrandstands(t, rng, root, animated, E, b) {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x7a7e88, roughness: 0.75 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1f9d55, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.5, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.8, roughness: 0.3 });
    animated.crowdTime = { value: 0 };
    animated.crowdExcite = { value: 0.12 };
    const MAX = 1400;
    const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.5, 3, 8).translate(0, 0.5, 0);
    const headGeo = new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.18, 0);
    // Bras levés en V et casquette
    const armA = new THREE.CapsuleGeometry(0.07, 0.5, 2, 5).rotateZ(0.5).translate(-0.34, 1.15, 0);
    const armB = new THREE.CapsuleGeometry(0.07, 0.5, 2, 5).rotateZ(-0.5).translate(0.34, 1.15, 0);
    const armGeo = mergeSimple([armA, armB]);
    const capGeo = new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.22, 0);
    const bodies = new THREE.InstancedMesh(bodyGeo, crowdMaterial(animated, 0xffffff), MAX);
    const heads = new THREE.InstancedMesh(headGeo, crowdMaterial(animated, 0xffffff), MAX);
    const armsM = new THREE.InstancedMesh(armGeo, crowdMaterial(animated, 0xffffff, true), MAX);
    const caps = new THREE.InstancedMesh(capGeo, crowdMaterial(animated, 0xffffff), MAX);
    const flagGeo = new THREE.PlaneGeometry(0.9, 0.6, 4, 1).translate(0.45, 2.2, 0);
    const flagPole = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 4).translate(0, 1.6, 0);
    const flags = new THREE.InstancedMesh(flagGeo, crowdMaterial(animated, 0xffffff, true), 200);
    flags.material.side = THREE.DoubleSide;
    const poles = new THREE.InstancedMesh(flagPole, crowdMaterial(animated, 0xdddddd), 200);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    let count = 0, capN = 0, armN = 0, flagN = 0;
    const shirts = [0xff8c1a, 0x22c55e, 0xe74c3c, 0xecf0f1, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0x34495e];
    const skins = [0xf1c6a8, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbac];
    const flagCols = [0xff8c1a, 0x22c55e, 0xffffff, 0xe74c3c];
    const offsets = t.closed ? [0, 0.06, -0.06] : [0, 0.03];
    for (const f of offsets) {
        const s = t.closed ? ((t.startS + f * t.length) % t.length + t.length) % t.length : t.startS + f * t.length;
        for (const sgn of [1, -1]) {
            const lim = t.pointAt(s, 0).width + t.runoff;
            const p = t.pointAt(s, sgn * (lim + 9));
            if (t.distanceFree(p.x, p.z).d < lim + 6) continue;
            const base = E.atS(s);
            const g = new THREE.Group();
            g.position.set(p.x, base, p.z);
            g.rotation.y = p.heading + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
            const W = 34;
            if (!E.flat) {
                const foot = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 30, 11), standMat);
                foot.position.set(0, -15, -3.5); g.add(foot);
            }
            for (let row = 0; row < 5; row++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2 * (row + 1), 1.6), standMat);
                step.position.set(0, 0.6 * (row + 1), -row * 1.6);
                step.castShadow = row === 4; step.receiveShadow = true;
                g.add(step);
                const seat = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 0.5), seatMat);
                seat.position.set(0, 1.2 * (row + 1) + 0.06, -row * 1.6 - 0.4);
                g.add(seat);
            }
            const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.4, 10), roofMat);
            roof.position.set(0, 10.5, -3.5); roof.rotation.x = -0.06;
            roof.castShadow = true;
            g.add(roof);
            for (const px of [-W / 2, 0, W / 2]) {
                const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 10.5, 8), steel);
                col2.position.set(px, 5.25, -8); g.add(col2);
            }
            g.updateMatrixWorld(true);
            for (let row = 0; row < 5; row++) for (let k = 0; k < 40 && count < MAX; k++) {
                if (rng() < 0.12) continue;
                dummy.position.set(-W / 2 + 0.6 + k * ((W - 1.2) / 39) + (rng() - 0.5) * 0.2, 1.2 * (row + 1), -row * 1.6 - 0.5);
                dummy.rotation.set(0, (rng() - 0.5) * 0.4, 0); dummy.scale.setScalar(0.92 + rng() * 0.2); dummy.updateMatrix();
                dummy.matrix.premultiply(g.matrixWorld);
                bodies.setMatrixAt(count, dummy.matrix);
                heads.setMatrixAt(count, dummy.matrix);
                bodies.setColorAt(count, col.setHex(shirts[Math.floor(rng() * shirts.length)]));
                heads.setColorAt(count, col.setHex(skins[Math.floor(rng() * skins.length)]));
                if (rng() < 0.4) { armsM.setMatrixAt(armN, dummy.matrix); armsM.setColorAt(armN++, col.setHex(skins[Math.floor(rng() * skins.length)])); }
                if (rng() < 0.3) { caps.setMatrixAt(capN, dummy.matrix); caps.setColorAt(capN++, col.setHex(shirts[Math.floor(rng() * shirts.length)])); }
                if (rng() < 0.1 && flagN < 200) {
                    flags.setMatrixAt(flagN, dummy.matrix); poles.setMatrixAt(flagN, dummy.matrix);
                    flags.setColorAt(flagN++, col.setHex(flagCols[Math.floor(rng() * flagCols.length)]));
                }
                count++;
            }
            root.add(g);
        }
    }
    bodies.count = heads.count = count;
    armsM.count = armN; caps.count = capN; flags.count = poles.count = flagN;
    for (const m of [bodies, heads, armsM, caps, flags, poles]) { m.castShadow = m === bodies; if (m.count) root.add(m); }
}

function mergeSimple(list) {
    const pos = [], nor = [];
    for (const g0 of list) {
        const g = g0.index ? g0.toNonIndexed() : g0;
        g.computeVertexNormals();
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
}

function buildBillboards(t, root, E, b) {
    const posts = new THREE.MeshStandardMaterial({ color: 0x555a62, metalness: 0.6, roughness: 0.4 });
    const looks = [['TURBOKART', '#111', '#ff8c1a', '#2a2420'], ['TURBONIX', '#1f9d55', '#fff', '#0f6b38'], ['NITRO COLA', '#c0392b', '#fff', '#7a1f16'], ['PNEUS VEGA', '#1c6ea4', '#fff', '#0d3f63'], ['ALPHA 1.5', '#ff8c1a', '#111', '#22c55e']];
    const mats = looks.map(l => new THREE.MeshBasicMaterial({ map: billboardTexture(l[0], l[1], l[2], l[3]), toneMapped: false }));
    const span = t.closed ? t.length : t.raceLength;
    for (let i = 0; i < 12; i++) {
        const s = t.startS + (i + 0.5) / 12 * span;
        const sw = t.closed ? s % t.length : s;
        const sgn = i % 2 ? 1 : -1;
        const lim = t.pointAt(sw, 0).width + t.runoff;
        const p = t.pointAt(sw, sgn * (lim + 5));
        if (t.distanceFree(p.x, p.z).d < lim + 3) continue;
        const base = E.atS(sw);
        for (const flip of [0, Math.PI]) {
            const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), mats[i % mats.length]);
            bb.position.set(p.x, base + 6, p.z);
            bb.rotation.y = p.heading + Math.PI + flip;
            root.add(bb);
        }
        const frame = new THREE.Mesh(new THREE.BoxGeometry(14.4, 3.9, 0.12), posts);
        frame.position.set(p.x, base + 6, p.z); frame.rotation.y = p.heading;
        root.add(frame);
        for (const off of [-5, 5]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6 + (E.flat ? 0 : 20), 6), posts);
            post.position.set(p.x + Math.cos(p.heading) * off, base + 3 - (E.flat ? 0 : 10), p.z - Math.sin(p.heading) * off);
            root.add(post);
        }
    }
}

// ---------- Ciel ----------
function buildSky(b, root) {
    const night = !!b.night;
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1400, 32, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: {
                top: { value: new THREE.Color(b.skyTop) }, low: { value: new THREE.Color(b.skyLow) },
                sunDir: { value: new THREE.Vector3(55, 120, 40).normalize() }, sunCol: { value: new THREE.Color(night ? 0xdfe6ff : 0xfff0d0) },
                sunSize: { value: night ? 2400 : 600 },
            },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize;
                float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
                void main(){
                    float y = vP.y; float t = clamp(y * 2.4, 0.0, 1.0);
                    vec3 c = mix(low, top, pow(t, 0.7));
                    c = mix(c, low * 0.85, smoothstep(0.0, -0.2, y));
                    float s = max(0.0, dot(vP, sunDir));
                    c += sunCol * (pow(s, sunSize) * 3.0 + pow(s, 24.0) * 0.22 + pow(s, 4.0) * 0.06);
                    ${night ? 'vec3 q = floor(vP * 420.0); float st = step(0.9965, h(q)) * smoothstep(0.02, 0.3, y); c += vec3(st) * (0.6 + 0.4 * h(q + 1.0));' : ''}
                    gl_FragColor = vec4(c, 1.0);
                    #include <colorspace_fragment>
                }`,
        }),
    );
    sky.renderOrder = -10;
    root.add(sky);
    return sky;
}

function buildClouds(t, b, rng, root) {
    const n = Math.round(140 * (b.clouds ?? 1));
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: b.cloudColor ?? 0xffffff, emissive: b.cloudColor ?? 0xffffff, emissiveIntensity: 0.55, fog: false, transparent: true, opacity: 0.92 }), Math.max(1, n));
    const d = new THREE.Object3D();
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    let i = 0;
    for (let c = 0; c < n / 6 && i < n; c++) {
        const a = rng() * 6.283, r = 300 + rng() * 800, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = 190 + rng() * 120;
        for (let k = 0; k < 6 && i < n; k++, i++) {
            d.position.set(x + (k - 2.5) * 22 + rng() * 10, y + rng() * 10 - Math.abs(k - 2.5) * 3, z + rng() * 22);
            d.scale.set(22 + rng() * 22, 10 + rng() * 9, 18 + rng() * 16);
            d.updateMatrix();
            mesh.setMatrixAt(i, d.matrix);
        }
    }
    mesh.count = i;
    if (!n) mesh.visible = false;
    root.add(mesh);
    return mesh;
}

/** Reflets de l'environnement : sol neutre, pour ne pas teinter les chromes de la couleur de l'herbe. */
export function makeEnvironment(renderer, b) {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    const night = !!b.night;
    s.background = new THREE.Color(b.skyLow);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: b.skyTop, side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(50, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.ground).lerp(new THREE.Color(0x3c3c42), 0.8) }));
    floor.position.y = -1;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 15, 13).multiplyScalar(night ? 0.15 : 1) }));
    sun.position.set(25, 35, 15);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(night ? 0xff2fa0 : 0xffffff).multiplyScalar(night ? 1.2 : 1.6), side: THREE.BackSide }));
    band.position.y = 3;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(50, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(night ? 0x20e3ff : 0xffffff).multiplyScalar(night ? 1.4 : 3.2) }));
    top.position.y = 40;
    s.add(dome, floor, sun, band, top);
    const rt = pm.fromScene(s, 0.03);
    pm.dispose();
    s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    return rt;
}

// ---------- Sol ----------
/** Sol plat, île de sable (plage) ou relief montagneux coloré selon l'altitude et la pente. */
function buildGround(t, b, biomeId, rng, root, E, life) {
    const size = Math.max(t.bbox.maxX - t.bbox.minX, t.bbox.maxZ - t.bbox.minZ) + 1600;
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    const gTex = groundTexture(b, biomeId, rng);
    const matOpts = { map: gTex, roughness: 1, envMapIntensity: 0.3 };
    if (biomeId === 'volcan') {
        const crack = lavaCrackTexture(rng);
        Object.assign(matOpts, { emissiveMap: crack, emissive: 0xff5a1a, emissiveIntensity: 1.3 });
    }
    if (biomeId === 'ville') Object.assign(matOpts, { roughness: 0.55, metalness: 0.2 });

    if (E.flat) {
        if (biomeId === 'plage') return buildIsland(t, b, root, gTex, matOpts, life, size, cx, cz);
        gTex.repeat.set(size / 40, size / 40);
        if (matOpts.emissiveMap) matOpts.emissiveMap.repeat.set(size / 60, size / 60);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial(matOpts));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(cx, 0, cz);
        ground.receiveShadow = true;
        root.add(ground);
        return;
    }

    // Relief : grille fine autour de la piste, avec couleurs par altitude et pente
    const span = Math.max(t.bbox.maxX - t.bbox.minX, t.bbox.maxZ - t.bbox.minZ) + 900;
    const N = 300;
    const geo = new THREE.PlaneGeometry(span, span, N, N).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x5e8a4a), grass2 = new THREE.Color(0x7a9a52), rock = new THREE.Color(0x857d74), snow = new THREE.Color(0xf4f7fb), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
        const near = E.nearest(x, z);
        pos.setXYZ(i, x, E.terrainFrom(x, z, near), z);
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), slope = 1 - nor.getY(i);
        const n = fbm(x * 0.02, z * 0.02);
        c.copy(grass).lerp(grass2, n);
        c.lerp(rock, Math.min(1, Math.max(0, (slope - 0.18) * 4)));
        const snowLine = E.max + 18 + n * 20;
        c.lerp(snow, Math.min(1, Math.max(0, (y - snowLine) / 14)) * (slope < 0.55 ? 1 : 0.4));
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Texture de détail claire, multipliée par les couleurs
    const detail = canvasTex(256, 256, (g, w, h) => {
        pixels(g, w, h, (u, v) => { const k = 190 + tileFbm(u, v, 16, 3) * 65; return [k, k, k]; });
    });
    detail.repeat.set(span / 30, span / 30);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: detail, vertexColors: true, roughness: 0.95, envMapIntensity: 0.3 }));
    ground.receiveShadow = true;
    root.add(ground);
    // Au-delà : un grand sol neutre, bas, pour l'horizon
    gTex.repeat.set(size / 40, size / 40);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshStandardMaterial({ color: 0x6b7f5a, roughness: 1 }));
    far.rotation.x = -Math.PI / 2;
    far.position.set(cx, E.min - 45, cz);
    root.add(far);
}

/** Plage : une île de sable au milieu d'un lagon, vagues animées. */
function buildIsland(t, b, root, gTex, matOpts, life, size, cx, cz) {
    const rx = (t.bbox.maxX - t.bbox.minX) / 2 + 230, rz = (t.bbox.maxZ - t.bbox.minZ) / 2 + 210;
    gTex.repeat.set(rx / 20, rz / 20);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial(matOpts));
    sand.scale.set(rx, 1, rz);
    sand.position.set(cx, 0, cz);
    sand.receiveShadow = true;
    // Sable mouillé et eau peu profonde autour de l'île
    const wetSand = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.06, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 0.4 }));
    wetSand.scale.set(rx, 1, rz); wetSand.position.set(cx, -0.03, cz);
    const shallow = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fe0d6, transparent: true, opacity: 0.55, depthWrite: false }));
    shallow.scale.set(rx, 1, rz); shallow.position.set(cx, -0.08, cz);
    const foam = new THREE.Mesh(new THREE.RingGeometry(1.045, 1.06, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    foam.scale.set(rx, 1, rz); foam.position.set(cx, -0.05, cz);
    // L'océan : reflets du ciel et petites vagues
    const waveTex = canvasTex(256, 256, (g, w, h) => {
        pixels(g, w, h, (u, v) => { const n = tileFbm(u, v, 8, 3); return [128 + (n - 0.5) * 120, 128 + (tileFbm(v, u, 8, 3) - 0.5) * 120, 255]; });
    }, { srgb: false });
    waveTex.repeat.set(size / 60, size / 60);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.2, size * 2.2).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({
        color: 0x0f8fb8, roughness: 0.08, metalness: 0.1, clearcoat: 1, normalMap: waveTex, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6,
    }));
    ocean.position.set(cx, -0.25, cz);
    root.add(ocean, shallow, wetSand, foam, sand);
    life.push((dt, time) => {
        waveTex.offset.set(time * 0.012, time * 0.008);
        const k = 1 + Math.sin(time * 0.9) * 0.006;
        foam.scale.set(rx * k, 1, rz * k);
        foam.material.opacity = 0.55 + Math.sin(time * 0.9) * 0.3;
    });
}

const nextTick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

/** Monde complet d'une course. Utiliser World.create() pour la construction par étapes. */
export class World {
    static async create(track, biomeId, renderer, opts = {}, onProgress = () => {}) {
        const w = new World();
        await w.build(track, biomeId, renderer, opts, onProgress);
        return w;
    }

    async build(track, biomeId, renderer, opts, onProgress) {
        this.track = track;
        this.biomeId = biomeId;
        const b = this.biome = BIOMES[biomeId];
        const E = this.elev = opts.elev ?? new Elevation(track, b);
        this.scene = new THREE.Scene();
        this.root = new THREE.Group();
        this.scene.add(this.root);
        const rng = mulberry32(track.id.length * 977 + biomeId.length * 31 + 42);
        const step = async (p, label) => { onProgress(p, label); await nextTick(); };
        this.life = [];
        this._hint = -1;
        this._q = {};

        await step(0.05, 'Lumière et ciel');
        this.scene.fog = new THREE.Fog(b.fog, b.fogNear, b.fogFar);
        this.env = makeEnvironment(renderer, b);
        this.scene.environment = this.env.texture;
        this.scene.add(new THREE.HemisphereLight(b.night ? 0x8090ff : 0xffffff, new THREE.Color(b.ground), b.hemi * 0.7));
        const sun = this.sun = new THREE.DirectionalLight(b.sun, b.sunI);
        sun.castShadow = opts.shadows !== false;
        sun.shadow.mapSize.set(2048, 2048);
        const box = opts.wideShadow ? 110 : 70;
        Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 420 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        this.scene.add(sun, sun.target);
        this.sky = buildSky(b, this.root);
        this.clouds = buildClouds(track, b, rng, this.root);

        await step(0.15, E.flat ? 'Le sol' : 'Les montagnes');
        buildGround(track, b, biomeId, rng, this.root, E, this.life);

        await step(0.32, 'La piste');
        this.animated = {};
        buildRoad(track, b, biomeId, rng, this.root, E);
        await step(0.42, 'Les murs');
        buildBarriers(track, b, this.root, E);
        buildStartFinish(track, this.root, this, E);
        await step(0.52, 'Les boîtes mystère');
        buildFeatures(track, biomeId, this.root, this.animated, E, rng);
        await step(0.62, 'Les tribunes');
        buildGrandstands(track, rng, this.root, this.animated, E, b);
        buildBillboards(track, this.root, E, b);
        await step(0.72, `Le décor : ${b.name}`);
        this.life.push(...buildBiomeDecor(track, biomeId, rng, this.root, E));
        await step(0.92, 'Préparation de l\'affichage');

        this._d = new THREE.Object3D();
        this._time = 0;
        this._cam = new THREE.Vector3();
        this.setStartLights(0);
    }

    /** Hauteur de la route sous un point (pour les effets) : 0 hors relief. */
    roadHeight(x, z) {
        if (this.elev.flat) return 0;
        const q = this.track.locate(x, z, this._hint, this._q);
        this._hint = q.idx;
        return this.elev.atS(q.s);
    }

    /** Feux du portique : 0 éteints, 1 rouge, 2 orange, 3 vert. */
    setStartLights(phase) {
        if (!this.lamps) return;
        this.lamps.forEach((m, i) => { m.emissiveIntensity = phase === i + 1 ? 5 : 0.05; });
    }

    /** L'ombre suit la zone regardée, où que l'on soit sur le circuit. */
    followShadow(x, y, z) {
        this.sun.position.set(x + 55, y + 120, z + 40);
        this.sun.target.position.set(x, y, z);
        this.sun.target.updateMatrixWorld();
    }

    setCrowdExcitement(v) { if (this.animated.crowdExcite) this.animated.crowdExcite.value = v; }

    /** Anime le décor et les éléments de course. `cam` : position de la caméra principale. */
    update(dt, sim, cam) {
        this._time += dt;
        const time = this._time;
        if (cam) this._cam.copy(cam);
        for (const f of this.life) f(dt, time, this._cam);
        const A = this.animated;
        if (A.padTex) A.padTex.offset.y = (time * 1.4) % 1;
        if (A.crowdTime) A.crowdTime.value = time;
        this.clouds.position.x = Math.sin(time * 0.02) * 60 + time * 0.8;

        const d = this._d;
        d.rotation.order = 'XYZ';
        sim.pickups.forEach((p, i) => {
            const on = p.timer <= 0, gy = A.boxY[i] ?? 0;
            const pop = on ? Math.min(1, (p.shown = (p.shown ?? 1) + dt * 3)) : (p.shown = 0);
            const bounce = pop < 1 ? Math.sin(pop * Math.PI) * 0.25 : 0;
            d.position.set(p.x, on ? gy + 1.7 + Math.sin(time * 2 + i) * 0.22 : -999, p.z);
            d.rotation.set(0.35, time * 1.5 + i, 0.2);
            d.scale.setScalar(on ? 0.15 + 0.85 * pop + bounce + Math.sin(time * 4 + i) * 0.03 : 0.001);
            d.updateMatrix();
            A.boxes.setMatrixAt(i, d.matrix);
            d.position.y = on ? gy + 0.16 : -999;
            d.rotation.set(0, -time, 0);
            d.scale.setScalar(on ? 1 + Math.sin(time * 3 + i) * 0.1 : 0.001);
            d.updateMatrix();
            A.rings.setMatrixAt(i, d.matrix);
            d.position.y = on ? gy + 0.12 : -999;
            d.scale.setScalar(on ? 1.1 + Math.sin(time * 3 + i) * 0.15 : 0.001);
            d.updateMatrix();
            A.glow.setMatrixAt(i, d.matrix);
        });
        A.boxes.count = A.rings.count = A.glow.count = sim.pickups.length;
        A.boxes.instanceMatrix.needsUpdate = A.rings.instanceMatrix.needsUpdate = A.glow.instanceMatrix.needsUpdate = true;

        let nw = 0, no = 0, nr = 0;
        for (const o of sim.oils) {
            o.gy ??= this.roadHeight(o.x, o.z);
            o.seed ??= (o.x * 0.37 + o.z * 0.11) % 6.28;
            const grow = o.age < 0 ? 1 : Math.min(1, o.age * 4 + 0.2);
            d.position.set(o.x, o.gy + PAINT_Y + 0.012, o.z);
            d.rotation.set(0, o.seed, 0);
            if (o.water && nw < 12) {
                d.scale.setScalar(o.r);
                d.updateMatrix();
                A.water.setMatrixAt(nw, d.matrix);
                d.position.y -= 0.004; d.scale.setScalar(o.r * 1.18); d.updateMatrix();
                A.wetRim.setMatrixAt(nw++, d.matrix);
                for (let k = 0; k < 2 && nr < 24; k++) {
                    const ph = (time * 0.45 + k * 0.5 + o.seed) % 1;
                    d.position.y = o.gy + PAINT_Y + 0.02;
                    d.scale.setScalar(o.r * (0.15 + ph * 0.75));
                    d.updateMatrix();
                    A.ripples.setMatrixAt(nr++, d.matrix);
                }
            } else if (!o.water && no < 40) {
                d.scale.setScalar(o.r * grow);
                d.updateMatrix();
                A.oil.setMatrixAt(no++, d.matrix);
            }
        }
        A.water.count = A.wetRim.count = nw; A.oil.count = no; A.ripples.count = nr;
        for (const m of [A.water, A.wetRim, A.oil, A.ripples]) m.instanceMatrix.needsUpdate = true;

        sim.props.forEach((c, i) => {
            c.gy = c.timer > 0 || c.gy == null ? this.roadHeight(c.x, c.z) : c.gy;
            d.position.set(c.x, c.gy + ROAD_Y + c.y, c.z);
            d.rotation.set(c.rx, 0, c.rz);
            d.scale.setScalar(1);
            d.updateMatrix();
            A.cones.setMatrixAt(i, d.matrix);
            A.bands.setMatrixAt(i, d.matrix);
            A.feet.setMatrixAt(i, d.matrix);
        });
        A.cones.count = A.bands.count = A.feet.count = sim.props.length;
        A.cones.instanceMatrix.needsUpdate = A.bands.instanceMatrix.needsUpdate = A.feet.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        const textures = new Set(), mats = new Set(), geos = new Set();
        this.root.traverse(o => {
            if (o.geometry) geos.add(o.geometry);
            for (const m of [].concat(o.material ?? [])) {
                mats.add(m);
                for (const k of ['map', 'emissiveMap', 'bumpMap', 'normalMap']) if (m[k]) textures.add(m[k]);
            }
            if (o.isInstancedMesh) o.dispose();
        });
        geos.forEach(g => g.dispose());
        textures.forEach(t => t.dispose());
        mats.forEach(m => m.dispose());
        this.sun.shadow.map?.dispose();
        this.env.dispose();
    }
}

export { BIOMES, scatter };
