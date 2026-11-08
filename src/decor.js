// ============================================================
//  Les 4 biomes : couleurs, règles de conduite, décor et vie.
//  Chaque biome peut habiller n'importe quel circuit.
// ============================================================
import * as THREE from 'three';

import { BIOMES, BIOME_ORDER } from './biomes.js';

export { BIOMES, BIOME_ORDER };

// ---------- Outils ----------
export function mulberry32(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/** Place des éléments au hasard, jamais sur la piste (ni derrière les murs si demandé). */
export function scatter(t, rng, count, { margin = 2, extent = 180, maxTries = 12, outsideBarrier = true, minDist = 0 }, place) {
    const { minX, maxX, minZ, maxZ } = t.bbox;
    let done = 0;
    for (let i = 0; i < count; i++) {
        for (let tr = 0; tr < maxTries; tr++) {
            const x = minX - extent + rng() * (maxX - minX + extent * 2);
            const z = minZ - extent + rng() * (maxZ - minZ + extent * 2);
            const near = t.distanceFree(x, z);
            const clear = (outsideBarrier ? near.limit : near.width) + margin;
            if (near.d < clear || near.d < minDist) continue;
            if (t.corridors.length) { const c = t.corridorInfo(x, z); if (c && c.d < c.half + margin) continue; }
            place(x, z, done++, near);
            break;
        }
    }
    return done;
}

function instanced(root, geo, mat, count, cast = true) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    m.castShadow = cast;
    m.receiveShadow = !cast;
    root.add(m);
    return m;
}

const D = new THREE.Object3D(), C = new THREE.Color();
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts });
const flat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...opts });

function place(mesh, i, x, y, z, s = 1, ry = 0, sx = s, sy = s, sz = s, rx = 0, rz = 0) {
    D.position.set(x, y, z); D.rotation.set(rx, ry, rz); D.scale.set(sx, sy, sz); D.updateMatrix();
    mesh.setMatrixAt(i, D.matrix);
}

/** Un endroit dégagé loin de la piste, pour un grand élément (moulin, temple…). */
function freeSpot(t, rng, minClear, extent = 260) {
    let best = null;
    for (let k = 0; k < 60; k++) {
        const { minX, maxX, minZ, maxZ } = t.bbox;
        const x = minX - extent + rng() * (maxX - minX + extent * 2), z = minZ - extent + rng() * (maxZ - minZ + extent * 2);
        const n = t.distanceFree(x, z);
        if (n.d > n.limit + minClear) return { x, z };
        if (!best || n.d > best.d) best = { x, z, d: n.d };
    }
    return best;
}

// ---------- Collines et montagnes à l'horizon ----------
function buildHills(t, b, rng, root) {
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    const radius = Math.max(t.bbox.maxX - t.bbox.minX, t.bbox.maxZ - t.bbox.minZ) / 2 + 520;
    const N = 46;
    const geo = b.hills.mesa ? new THREE.CylinderGeometry(0.75, 1, 1, 7) : new THREE.ConeGeometry(1, 1, 7);
    const hills = instanced(root, geo, flat(b.hills.color, { fog: true }), N, false);
    const caps = b.hills.cap ? instanced(root, new THREE.ConeGeometry(1, 1, 7), flat(b.hills.cap), N, false) : null;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + rng() * 0.1, r = radius + rng() * 260;
        const h = b.hills.height * (0.5 + rng() * 0.9), w = 90 + rng() * 120;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        place(hills, i, x, h / 2 - 2, z, 1, rng() * 6, w, h, w * (0.7 + rng() * 0.5));
        C.setHex(b.hills.color).multiplyScalar(0.8 + rng() * 0.35);
        hills.setColorAt(i, C);
        if (caps) place(caps, i, x, h * 0.78, z, 1, 0, w * 0.34, h * 0.44, w * 0.34);
    }
}

// ---------- Plaine ----------
function plaine(t, rng, root, life) {
    const trunk = instanced(root, new THREE.CylinderGeometry(0.35, 0.55, 4, 6), std(0x6b4a2b), 260);
    const leaves = instanced(root, new THREE.IcosahedronGeometry(3.6, 1), flat(0xffffff), 260);
    const r2 = mulberry32(17);
    const n = scatter(t, r2, 260, { margin: 5, extent: 200 }, (x, z, i) => {
        const s = 0.8 + r2() * 0.9;
        place(trunk, i, x, 2 * s, z, s, r2() * 6);
        place(leaves, i, x, 6.2 * s, z, s, r2() * 6, s, s * (0.85 + r2() * 0.3), s);
        C.setHSL(0.27 + r2() * 0.07, 0.5 + r2() * 0.2, 0.32 + r2() * 0.1); leaves.setColorAt(i, C);
    });
    trunk.count = leaves.count = n;

    const bushes = instanced(root, new THREE.IcosahedronGeometry(1.3, 0), flat(0x3f8f37), 220);
    bushes.count = scatter(t, rng, 220, { margin: 2, extent: 140, outsideBarrier: false }, (x, z, i) => {
        const s = 0.6 + rng() * 0.9; place(bushes, i, x, 0.5 * s, z, s, rng() * 6, s * 1.3, s * 0.8, s);
        C.setHSL(0.28 + rng() * 0.06, 0.55, 0.3 + rng() * 0.1); bushes.setColorAt(i, C);
    });

    // Bottes de foin et clôtures
    const hay = instanced(root, new THREE.CylinderGeometry(0.9, 0.9, 1.4, 14).rotateZ(Math.PI / 2), std(0xe2c15b), 50);
    hay.count = scatter(t, rng, 50, { margin: 6, extent: 120 }, (x, z, i) => place(hay, i, x, 0.9, z, 1, rng() * 6));
    const fence = instanced(root, new THREE.BoxGeometry(0.18, 1.2, 0.18), std(0x8a6a44), 400);
    const rail = instanced(root, new THREE.BoxGeometry(0.1, 0.12, 3.1), std(0x9a7a50), 400);
    let k = 0;
    for (let i = 0; i < t.n && k < 400; i += 3) {
        const lim = t.w[i] + t.runoff + 6;
        for (const sgn of [1, -1]) {
            const x = t.x[i] + t.tz[i] * sgn * lim, z = t.z[i] - t.tx[i] * sgn * lim;
            if (t.distanceFree(x, z).d < lim - 1 || k >= 400) continue;
            const h = Math.atan2(t.tx[i], t.tz[i]);
            place(fence, k, x, 0.6, z, 1, h);
            place(rail, k, x, 0.85, z, 1, h);
            k++;
        }
    }
    fence.count = rail.count = k;

    // Moulins à vent : les pales tournent
    for (let m = 0; m < 3; m++) {
        const s = freeSpot(t, rng, 60);
        if (!s) continue;
        const g = new THREE.Group();
        g.position.set(s.x, 0, s.z);
        g.rotation.y = rng() * 6;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 4, 22, 10), std(0xf4efe4));
        tower.position.y = 11; tower.castShadow = true;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 10), std(0x2e7d32));
        cap.position.y = 24;
        const hub = new THREE.Group();
        hub.position.set(0, 20, 3.2);
        for (let b = 0; b < 4; b++) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 13, 0.3), std(b % 2 ? 0xff8c1a : 0xffffff));
            blade.position.y = 6.5;
            const arm = new THREE.Group(); arm.rotation.z = b * Math.PI / 2; arm.add(blade);
            hub.add(arm);
        }
        g.add(tower, cap, hub);
        root.add(g);
        const speed = 0.6 + rng() * 0.6;
        life.push(dt => { hub.rotation.z += dt * speed; });
    }

    // Montgolfières qui flottent
    for (let m = 0; m < 3; m++) {
        const s = freeSpot(t, rng, 20, 160);
        const g = new THREE.Group();
        const env = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshStandardMaterial({ color: m % 2 ? 0xff8c1a : 0x2ecc71, roughness: 0.6 }));
        env.scale.y = 1.2;
        const band = new THREE.Mesh(new THREE.TorusGeometry(7.05, 0.9, 6, 24), std(0xffffff));
        band.rotation.x = Math.PI / 2;
        const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), std(0x8a5a2b));
        basket.position.y = -12;
        for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), std(0x333333));
            rope.position.set(dx * 1.4, -8.5, dz * 1.4);
            g.add(rope);
        }
        g.add(env, band, basket);
        const baseY = 60 + rng() * 50, phase = rng() * 6;
        g.position.set(s.x, baseY, s.z);
        root.add(g);
        life.push((dt, time) => {
            g.position.y = baseY + Math.sin(time * 0.3 + phase) * 4;
            g.position.x += dt * 1.2;
            g.rotation.y += dt * 0.05;
        });
    }
    flock(t, rng, root, life, { count: 26, color: 0x2a2a2a, height: 45, radius: 140 });
}

// ---------- Glace ----------
function glace(t, rng, root, life) {
    const N = 420;
    const trunk = instanced(root, new THREE.CylinderGeometry(0.3, 0.45, 3, 6), std(0x5a3d25), N);
    const pine = instanced(root, new THREE.ConeGeometry(3, 9, 7), flat(0x1e4d33), N);
    const snow = instanced(root, new THREE.ConeGeometry(1.8, 4, 7), flat(0xffffff), N);
    const n = scatter(t, rng, N, { margin: 5, extent: 200 }, (x, z, i) => {
        const s = 0.8 + rng() * 0.9, r = rng() * 6;
        place(trunk, i, x, 1.5 * s, z, s, r);
        place(pine, i, x, 7 * s, z, s, r);
        place(snow, i, x, 10 * s, z, s, r);
    });
    trunk.count = pine.count = snow.count = n;

    // Cristaux de glace
    const crystal = instanced(root, new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshPhysicalMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 }), 120);
    crystal.count = scatter(t, rng, 120, { margin: 2, extent: 120, outsideBarrier: false }, (x, z, i) => {
        const s = 0.6 + rng() * 1.6; place(crystal, i, x, s, z, s, rng() * 6, s * 0.7, s * 1.8, s * 0.7, rng() * 0.4);
    });
    // Bonshommes de neige
    for (let m = 0; m < 10; m++) {
        const s = freeSpot(t, rng, 8, 90);
        const g = new THREE.Group();
        const white = std(0xffffff, { roughness: 0.8 });
        [[1.4, 1.3], [1.0, 3.4], [0.72, 5.0]].forEach(([r, y]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), white); b.position.y = y; b.castShadow = true; g.add(b); });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8), std(0xff8c1a));
        nose.rotation.x = Math.PI / 2; nose.position.set(0, 5, 0.85);
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 12), std(0x1a1a1a));
        hat.position.y = 6.05;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 12), std(0x1a1a1a));
        brim.position.y = 5.65;
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 6, 16), std(0x2ecc71));
        scarf.rotation.x = Math.PI / 2; scarf.position.y = 4.35;
        g.add(nose, hat, brim, scarf);
        g.position.set(s.x, 0, s.z);
        g.rotation.y = rng() * 6;
        root.add(g);
    }
    // Igloos
    for (let m = 0; m < 4; m++) {
        const s = freeSpot(t, rng, 18, 140);
        const g = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2f7ff));
        const door = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), std(0xe8f0fa));
        door.position.set(0, 0, 4.8);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(1.2, 12, 0, Math.PI), std(0x1c2a3a));
        hole.position.set(0, 0.01, 6.31);
        g.add(dome, door, hole);
        g.position.set(s.x, 0, s.z); g.rotation.y = rng() * 6;
        root.add(g);
    }
    // Lac gelé
    const lake = freeSpot(t, rng, 45, 160);
    if (lake) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.2, clearcoat: 1 }));
        m.rotation.x = -Math.PI / 2; m.position.set(lake.x, 0.04, lake.z); m.scale.set(1, 0.7, 1);
        root.add(m);
    }
    flakes(root, life, { count: 2600, color: 0xffffff, size: 0.55, fall: 4, box: 140, additive: false });
}

// ---------- Jungle ----------
function palm(rng, leafMat, trunkMat) {
    const g = new THREE.Group();
    const segs = 6, bend = (rng() - 0.5) * 0.5;
    let y = 0, x = 0;
    for (let i = 0; i < segs; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - i * 0.03, 0.5 - i * 0.03, 2.2, 7), trunkMat);
        x += bend * i * 0.4;
        seg.position.set(x, y + 1.1, 0); seg.rotation.z = -bend * 0.3;
        seg.castShadow = true;
        g.add(seg); y += 2.1;
    }
    for (let l = 0; l < 7; l++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 7, 1, 4), leafMat);
        const pos = leaf.geometry.attributes.position;
        for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v); pos.setZ(v, -(((yy + 3.5) / 7) ** 2) * 2.5); }
        leaf.geometry.computeVertexNormals();
        leaf.geometry.translate(0, 3.5, 0);
        leaf.rotation.set(-1.0, (l / 7) * Math.PI * 2, 0, 'YXZ');
        leaf.position.set(x, y, 0);
        leaf.castShadow = true;
        g.add(leaf);
    }
    return g;
}

function jungle(t, rng, root, life) {
    const N = 300;
    const trunk = instanced(root, new THREE.CylinderGeometry(0.8, 1.3, 14, 7), std(0x5b4128), N);
    const canopy = instanced(root, new THREE.IcosahedronGeometry(6, 1), flat(0xffffff), N);
    const n = scatter(t, rng, N, { margin: 6, extent: 200 }, (x, z, i) => {
        const s = 0.7 + rng() * 0.8;
        place(trunk, i, x, 7 * s, z, s, rng() * 6);
        place(canopy, i, x, 15 * s, z, s, rng() * 6, s * 1.3, s * 0.75, s * 1.3);
        C.setHSL(0.3 + rng() * 0.05, 0.6, 0.18 + rng() * 0.1); canopy.setColorAt(i, C);
    });
    trunk.count = canopy.count = n;
    // Fougères et grandes feuilles
    const fern = instanced(root, new THREE.ConeGeometry(1.6, 2.2, 5, 1, true), flat(0x2f9a3a, { side: THREE.DoubleSide }), 500, false);
    fern.count = scatter(t, rng, 500, { margin: 1, extent: 130, outsideBarrier: false }, (x, z, i) => {
        const s = 0.6 + rng() * 1.1; place(fern, i, x, 0.9 * s, z, s, rng() * 6, s, s, s, Math.PI);
        C.setHSL(0.3 + rng() * 0.08, 0.6, 0.25 + rng() * 0.12); fern.setColorAt(i, C);
    });
    const flowers = instanced(root, new THREE.IcosahedronGeometry(0.35, 0), flat(0xffffff), 300, false);
    const pal = [0xff3d6e, 0xff8c1a, 0xffd23f, 0xb04dff];
    flowers.count = scatter(t, rng, 300, { margin: 1, extent: 110, outsideBarrier: false }, (x, z, i) => {
        place(flowers, i, x, 0.6, z, 0.8 + rng() * 0.8); flowers.setColorAt(i, C.setHex(pal[i % pal.length]));
    });
    // Palmiers près de la piste
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 0.8, side: THREE.DoubleSide });
    const trunkMat = std(0x8a6a44);
    scatter(t, rng, 70, { margin: 3, extent: 60 }, (x, z) => {
        const p = palm(rng, leafMat, trunkMat);
        p.position.set(x, 0, z); p.rotation.y = rng() * 6; p.scale.setScalar(0.9 + rng() * 0.5);
        root.add(p);
    });
    // Temples en ruine
    const stone = flat(0x8d8a72), moss = flat(0x4f7a3a);
    for (let m = 0; m < 2; m++) {
        const s = freeSpot(t, rng, 50, 200);
        const g = new THREE.Group();
        for (let k = 0; k < 6; k++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(30 - k * 4.5, 4, 30 - k * 4.5), k % 2 ? moss : stone);
            step.position.y = 2 + k * 4; step.castShadow = true;
            g.add(step);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), stone);
        top.position.y = 26.5;
        const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.2), std(0x1a1a14));
        door.position.set(0, 26, 2.55);
        g.add(top, door);
        g.position.set(s.x, 0, s.z); g.rotation.y = rng() * 6;
        root.add(g);
    }
    // Mare
    const pond = freeSpot(t, rng, 30, 120);
    if (pond) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshPhysicalMaterial({ color: 0x2f8f8a, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }));
        w.rotation.x = -Math.PI / 2; w.position.set(pond.x, 0.05, pond.z);
        root.add(w);
    }
    flakes(root, life, { count: 380, color: 0xd8ff6a, size: 0.7, fall: -0.2, box: 110, additive: true, blink: true });
    flock(t, rng, root, life, { count: 14, color: 0xff3d3d, height: 30, radius: 90, colors: [0xff3d3d, 0x2f8fff, 0xffd23f, 0x2ecc71] });
}

// ---------- Désert ----------
function desert(t, rng, root, life) {
    const dunes = instanced(root, new THREE.SphereGeometry(1, 14, 8), flat(0xd8a25e), 70, false);
    dunes.count = scatter(t, rng, 70, { margin: 24, extent: 260 }, (x, z, i) => {
        const r = 18 + rng() * 34; place(dunes, i, x, -r * 0.62, z, 1, rng() * 6, r * 1.6, r * 0.75, r);
        C.setHex(0xd8a25e).multiplyScalar(0.9 + rng() * 0.15); dunes.setColorAt(i, C);
    });
    const mesas = instanced(root, new THREE.CylinderGeometry(1, 1.25, 1, 7), flat(0xb5653a), 40);
    mesas.count = scatter(t, rng, 40, { margin: 30, extent: 240 }, (x, z, i) => {
        const r = 12 + rng() * 22, h = 14 + rng() * 38;
        place(mesas, i, x, h / 2, z, 1, rng() * 6, r, h, r * (0.7 + rng() * 0.5));
        C.setHex(0xb5653a).multiplyScalar(0.8 + rng() * 0.3); mesas.setColorAt(i, C);
    });
    // Cactus à bras
    const cactusMat = std(0x3c7a44);
    const body = instanced(root, new THREE.CapsuleGeometry(0.5, 4, 3, 8), cactusMat, 140);
    const arms = instanced(root, new THREE.CapsuleGeometry(0.32, 1.6, 3, 6), cactusMat, 280);
    let a = 0;
    body.count = scatter(t, rng, 140, { margin: 3, extent: 140 }, (x, z, i) => {
        const s = 0.8 + rng() * 0.8, r = rng() * 6;
        place(body, i, x, 2.5 * s, z, s, r);
        for (const side of [-1, 1]) {
            if (rng() < 0.3) continue;
            const ox = Math.cos(r) * side * 0.9 * s, oz = -Math.sin(r) * side * 0.9 * s;
            place(arms, a++, x + ox, (2.6 + rng() * 1.2) * s, z + oz, s, r);
        }
    });
    arms.count = a;
    // Pyramides au loin
    for (let m = 0; m < 3; m++) {
        const s = freeSpot(t, rng, 120, 320);
        const p = new THREE.Mesh(new THREE.ConeGeometry(40 - m * 9, 46 - m * 10, 4), flat(0xe0b878));
        p.position.set(s.x, (46 - m * 10) / 2, s.z); p.rotation.y = Math.PI / 4;
        p.castShadow = true;
        root.add(p);
    }
    // Oasis
    const oa = freeSpot(t, rng, 40, 140);
    if (oa) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshPhysicalMaterial({ color: 0x2fb3c8, roughness: 0.06, clearcoat: 1 }));
        w.rotation.x = -Math.PI / 2; w.position.set(oa.x, 0.05, oa.z);
        root.add(w);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a9a40, roughness: 0.8, side: THREE.DoubleSide }), trunkMat = std(0x9a7a50);
        for (let k = 0; k < 7; k++) {
            const p = palm(rng, leafMat, trunkMat), ang = (k / 7) * Math.PI * 2;
            p.position.set(oa.x + Math.cos(ang) * 17, 0, oa.z + Math.sin(ang) * 17);
            root.add(p);
        }
    }
    // Virevoltants qui roulent et rebondissent
    const weeds = instanced(root, new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0x9a7444, wireframe: true }), 10, false);
    const tw = Array.from({ length: 10 }, () => ({ x: t.bbox.minX - 100 + rng() * (t.bbox.maxX - t.bbox.minX + 200), z: t.bbox.minZ - 100 + rng() * (t.bbox.maxZ - t.bbox.minZ + 200), sp: 5 + rng() * 6, ph: rng() * 6, rot: 0 }));
    life.push((dt, time) => {
        tw.forEach((w, i) => {
            w.x += w.sp * dt; w.rot += w.sp * dt;
            if (w.x > t.bbox.maxX + 160) w.x = t.bbox.minX - 160;
            place(weeds, i, w.x, 0.9 + Math.abs(Math.sin(time * 2.4 + w.ph)) * 1.2, w.z, 1, 0, 1, 1, 1, 0, -w.rot);
        });
        weeds.instanceMatrix.needsUpdate = true;
    });
    flakes(root, life, { count: 600, color: 0xf3d49a, size: 0.35, fall: 0.3, box: 120, additive: false, wind: 6 });
    flock(t, rng, root, life, { count: 6, color: 0x2a2018, height: 60, radius: 70, big: 1.8 });
}

// ---------- Vie : oiseaux, particules ----------
function birdGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -1.4, 0.2, -0.2, 0, 0, -0.5, 0, 0, 0.5, 1.4, 0.2, -0.2, 0, 0, -0.5], 3));
    g.computeVertexNormals();
    return g;
}

/** Une volée d'oiseaux qui tourne en battant des ailes. */
function flock(t, rng, root, life, { count, color, height, radius, colors = null, big = 1 }) {
    const mesh = instanced(root, birdGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), count, false);
    mesh.frustumCulled = false;
    const birds = [];
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    for (let i = 0; i < count; i++) {
        birds.push({ a: rng() * 6.28, r: radius * (0.6 + rng() * 0.8), h: height + rng() * 20, sp: (0.12 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1), ph: rng() * 6, cx: cx + (rng() - 0.5) * 160, cz: cz + (rng() - 0.5) * 160 });
        mesh.setColorAt(i, C.setHex(colors ? colors[i % colors.length] : color));
    }
    life.push((dt, time) => {
        birds.forEach((b, i) => {
            b.a += b.sp * dt;
            const flap = 0.4 + Math.abs(Math.sin(time * 9 + b.ph)) * 0.9;
            place(mesh, i, b.cx + Math.cos(b.a) * b.r, b.h + Math.sin(time + b.ph) * 2, b.cz + Math.sin(b.a) * b.r, 1, -b.a + (b.sp > 0 ? 0 : Math.PI), big * 1.4, big * 1.4 * flap, big * 1.4);
        });
        mesh.instanceMatrix.needsUpdate = true;
    });
}

/** Neige, lucioles, poussière : des points qui suivent la caméra, animés par la carte graphique. */
function flakes(root, life, { count, color, size, fall, box, additive, blink = false, wind = 0 }) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = Math.random() * box; pos[i * 3 + 1] = Math.random() * box * 0.5; pos[i * 3 + 2] = Math.random() * box;
        seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(color) } };
    const mat = new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float aSeed; varying float vA;
            void main(){
                vec3 p = position;
                p.y -= uTime * ${fall.toFixed(2)} * (0.6 + aSeed * 0.8);
                p.x += sin(uTime * 0.7 + aSeed * 20.0) * 1.6 + uTime * ${wind.toFixed(2)};
                p.z += cos(uTime * 0.5 + aSeed * 13.0) * 1.6;
                vec3 box = vec3(${box.toFixed(1)}, ${(box * 0.5).toFixed(1)}, ${box.toFixed(1)});
                vec3 rel = mod(p - uCenter + box * 0.5, box) - box * 0.5;
                vec4 mv = modelViewMatrix * vec4(uCenter + rel, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = ${(size * 300).toFixed(1)} / -mv.z;
                vA = ${blink ? '0.35 + 0.65 * max(0.0, sin(uTime * 2.5 + aSeed * 40.0))' : '0.85'} * smoothstep(${(box * 0.5).toFixed(1)}, ${(box * 0.2).toFixed(1)}, length(rel));
            }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
            void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.1, d)); }`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    root.add(pts);
    life.push((dt, time, cam) => {
        uniforms.uTime.value = time;
        if (cam) uniforms.uCenter.value.copy(cam);
    });
}

/** Construit le décor du biome. Renvoie la liste des fonctions d'animation. */
export function buildBiomeDecor(t, biomeId, rng, root) {
    const b = BIOMES[biomeId], life = [];
    buildHills(t, b, rng, root);
    ({ plaine, glace, jungle, desert })[biomeId](t, rng, root, life);
    return life;
}

/** Habillage des obstacles selon le biome. */
export function obstacleLook(biomeId) {
    switch (BIOMES[biomeId].obstacle) {
        case 'ice': return { geo: new THREE.BoxGeometry(1.5, 1.5, 1.5), mat: new THREE.MeshPhysicalMaterial({ color: 0xa8e6ff, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 }), box: true };
        case 'mossy': return { geo: new THREE.DodecahedronGeometry(1, 0), mat: flat(0x5b7a44) };
        case 'sandstone': return { geo: new THREE.DodecahedronGeometry(1, 0), mat: flat(0xc5793f) };
        default: return { geo: new THREE.DodecahedronGeometry(1, 0), mat: flat(0x8a8378) };
    }
}
