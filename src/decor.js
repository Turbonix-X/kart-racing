// ============================================================
//  Les 8 biomes : couleurs, règles de conduite, décor et vie.
//  Chaque biome peut habiller n'importe quel circuit.
// ============================================================
import * as THREE from 'three';

import { BIOMES, BIOME_ORDER } from './biomes.js';
import { fbm } from './terrain.js';

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
function buildHills(t, b, rng, root, elev) {
    const base = elev && !elev.flat ? elev.min - 45 : 0;
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
        place(hills, i, x, base + h / 2 - 2, z, 1, rng() * 6, w, h, w * (0.7 + rng() * 0.5));
        C.setHex(b.hills.color).multiplyScalar(0.8 + rng() * 0.35);
        hills.setColorAt(i, C);
        if (caps) place(caps, i, x, base + h * 0.78, z, 1, 0, w * 0.34, h * 0.44, w * 0.34);
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
    // Palmiers près de la piste (un seul appel de dessin pour tous)
    palms(t, rng, root, 90, { margin: 3, extent: 60 });
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
        const ring = instanced(root, palmGeometry(), vc({ side: THREE.DoubleSide }), 7);
        for (let k = 0; k < 7; k++) { const ang = (k / 7) * Math.PI * 2; place(ring, k, oa.x + Math.cos(ang) * 17, 0, oa.z + Math.sin(ang) * 17, 0.9 + rng() * 0.3, rng() * 6); }
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

// ---------- Outils : pièces fusionnées avec leurs couleurs (un seul appel de dessin par instance) ----------
function mergeColored(parts) {
    const pos = [], nor = [], col = [], c = new THREE.Color();
    for (const [g0, hex] of parts) {
        const g = g0.index ? g0.toNonIndexed() : g0;
        if (!g.attributes.normal) g.computeVertexNormals();
        c.setHex(hex);
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
        for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
}
const vc = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });

/** Palmier complet (tronc annelé + palmes courbées) en une seule géométrie. */
function palmGeometry(bend = 0.18) {
    const parts = [];
    let y = 0, x = 0;
    for (let i = 0; i < 7; i++) {
        const seg = new THREE.CylinderGeometry(0.4 - i * 0.03, 0.5 - i * 0.03, 2.1, 8);
        x += bend * i * 0.35;
        seg.rotateZ(-bend * 0.3).translate(x, y + 1.05, 0);
        parts.push([seg, i % 2 ? 0x8a6a44 : 0x7a5a38]);
        y += 2.0;
    }
    for (let l = 0; l < 8; l++) {
        const leaf = new THREE.PlaneGeometry(1.5, 7, 2, 6);
        const p = leaf.attributes.position;
        for (let v = 0; v < p.count; v++) {
            const yy = p.getY(v), xx = p.getX(v), k = (yy + 3.5) / 7;
            p.setX(v, xx * (1 - k * 0.7));
            p.setZ(v, -(k * k) * 2.6 + Math.abs(xx) * 0.25);
        }
        leaf.translate(0, 3.5, 0).rotateX(-0.95).rotateY((l / 8) * Math.PI * 2).translate(x, y, 0);
        parts.push([leaf, l % 2 ? 0x2e8b3a : 0x3fa04a]);
    }
    parts.push([new THREE.SphereGeometry(0.35, 8, 6).translate(x + 0.3, y - 0.3, 0.2), 0x6b4a2b]);     // noix de coco
    parts.push([new THREE.SphereGeometry(0.35, 8, 6).translate(x - 0.3, y - 0.35, -0.1), 0x6b4a2b]);
    return mergeColored(parts);
}
function palms(t, rng, root, count, opts, E = null) {
    const mesh = instanced(root, palmGeometry(), vc({ side: THREE.DoubleSide }), count);
    mesh.count = scatter(t, rng, count, opts, (x, z, i) => {
        place(mesh, i, x, E ? E.terrainAt(x, z) : 0, z, 0.85 + rng() * 0.5, rng() * 6, undefined, undefined, undefined, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.15);
    });
    return mesh;
}

/** Rocher bosselé : icosaèdre déformé par du bruit, couleurs variées. */
function rockGeometry(seed, colorFn) {
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
    const p = g.attributes.position;
    const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    const disp = new Map();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = key(x, y, z);
        if (!disp.has(k)) disp.set(k, 0.78 + fbm(x * 1.7 + seed, z * 1.7 + y * 1.3 + seed) * 0.45);
        const s = disp.get(k);
        p.setXYZ(i, x * s, Math.max(-0.2, y) * s * 0.8, z * s);
    }
    g.computeVertexNormals();
    const col = new Float32Array(p.count * 3), c = new THREE.Color(), n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
        colorFn(c, n.getY(i), p.getY(i), fbm(p.getX(i) * 3 + seed, p.getZ(i) * 3));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}
const rockColors = {
    rock: (c, ny, y, n) => c.setHex(0x8a8378).multiplyScalar(0.75 + n * 0.45),
    mossy: (c, ny, y, n) => c.setHex(ny > 0.45 ? 0x4f7a34 : 0x7d7a68).multiplyScalar(0.75 + n * 0.45),
    boulder: (c, ny, y, n) => c.setHex(ny > 0.55 && y > 0.1 ? 0xf2f6fb : 0x7d7670).multiplyScalar(0.8 + n * 0.3),
    coral: (c, ny, y, n) => c.setHex(n > 0.5 ? 0xff7f6e : 0xf0a58a).multiplyScalar(0.8 + n * 0.35),
    sandstone: (c, ny, y, n) => c.setHex([0xc5793f, 0xd89a5a, 0xb0622f][Math.floor((y + 1) * 3) % 3]).multiplyScalar(0.85 + n * 0.25),
};

/** Obstacle sur la piste, à l'échelle 1 (rayon 1, hauteur 1). Mis à l'échelle par le monde. */
export function makeObstacle(biomeId, rng) {
    const kind = BIOMES[biomeId].obstacle, g = new THREE.Group();
    const seed = rng() * 100;
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    switch (kind) {
        case 'ice': {
            const mat = new THREE.MeshPhysicalMaterial({ color: 0xa8e6ff, roughness: 0.04, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.88, clearcoat: 1, envMapIntensity: 2 });
            for (let k = 0; k < 5; k++) {
                const m = add(new THREE.OctahedronGeometry(0.5, 0), mat);
                const a = k * 1.3 + seed;
                m.position.set(Math.cos(a) * 0.45 * (k ? 1 : 0), 0.5, Math.sin(a) * 0.45 * (k ? 1 : 0));
                m.scale.set(0.7, k ? 1.4 + rng() : 2.2, 0.7);
                m.rotation.set((rng() - 0.5) * 0.6, a, (rng() - 0.5) * 0.6);
            }
            break;
        }
        case 'basalt': {
            const mat = new THREE.MeshStandardMaterial({ color: 0x24201f, roughness: 0.85, flatShading: true });
            const glow = new THREE.MeshStandardMaterial({ color: 0x2a0a00, emissive: 0xff5a1a, emissiveIntensity: 2.2 });
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2 + seed, r = k ? 0.55 : 0, h = 0.7 + rng() * 0.8;
                const m = add(new THREE.CylinderGeometry(0.34, 0.36, h, 6), mat);
                m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
            }
            const crack = add(new THREE.CylinderGeometry(0.95, 1.0, 0.12, 12), glow);
            crack.position.y = 0.06; crack.castShadow = false;
            break;
        }
        case 'barrels': {
            const tex = (col) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.4 });
            const band = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0x404040 });
            [[-0.42, 0, 0xd62828], [0.42, 0, 0x1f6fd6], [0, 0.8, 0xff8c1a]].forEach(([x, y, c], k) => {
                const b = add(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16), tex(c));
                b.position.set(x, y + 0.4, k === 2 ? 0 : (rng() - 0.5) * 0.2);
                for (const yy of [-0.22, 0.22]) { const r = add(new THREE.TorusGeometry(0.405, 0.03, 6, 20).rotateX(Math.PI / 2), band); r.position.set(b.position.x, b.position.y + yy, b.position.z); }
            });
            break;
        }
        case 'sandstone': {
            for (let k = 0; k < 3; k++) {
                const m = add(rockGeometry(seed + k, rockColors.sandstone), vc({ flatShading: true }));
                m.position.y = 0.25 + k * 0.32; m.scale.set(1 - k * 0.22, 0.45, 1 - k * 0.2); m.rotation.y = k;
            }
            break;
        }
        default: {
            const key = kind === 'mossy' ? 'mossy' : kind === 'boulder' ? 'boulder' : kind === 'coral' ? 'coral' : 'rock';
            const m = add(rockGeometry(seed, rockColors[key]), vc({ flatShading: true, roughness: 0.9 }));
            m.position.y = 0.45;
            if (kind === 'coral') {
                const mat = new THREE.MeshStandardMaterial({ color: 0xff5f7a, roughness: 0.6 });
                for (let k = 0; k < 5; k++) {
                    const tb = add(new THREE.CylinderGeometry(0.05, 0.1, 0.8, 6), mat);
                    tb.position.set((rng() - 0.5) * 0.9, 1.0, (rng() - 0.5) * 0.9); tb.rotation.set(rng() - 0.5, 0, rng() - 0.5);
                }
            }
        }
    }
    return g;
}

/** Rondin d'écorce, avec les cernes du bois aux deux bouts. */
export function makeLog() {
    const bark = new THREE.MeshStandardMaterial({ color: 0x5d3f24, roughness: 1, flatShading: true });
    const ring = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 });
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.55, 0.58, 5.4, 12, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (fbm(p.getX(i) * 4, p.getY(i) * 2 + p.getZ(i) * 4) - 0.5) * 0.18; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const body = new THREE.Mesh(geo, [bark, ring, ring]);
    body.castShadow = true;
    g.add(body);
    g.rotation.z = Math.PI / 2;
    return g;
}

// ---------- Montagne : sapins, rochers, chalets, téléphérique, aigles ----------
function montagne(t, rng, root, life, E) {
    const tree = mergeColored([
        [new THREE.CylinderGeometry(0.3, 0.45, 3, 6).translate(0, 1.5, 0), 0x5a3d25],
        [new THREE.ConeGeometry(3.2, 5, 8).translate(0, 4.4, 0), 0x1f5235],
        [new THREE.ConeGeometry(2.5, 4.4, 8).translate(0, 6.8, 0), 0x23603d],
        [new THREE.ConeGeometry(1.7, 3.6, 8).translate(0, 9, 0), 0x2a6b45],
    ]);
    const snowTree = mergeColored([
        [new THREE.CylinderGeometry(0.3, 0.45, 3, 6).translate(0, 1.5, 0), 0x5a3d25],
        [new THREE.ConeGeometry(3.2, 5, 8).translate(0, 4.4, 0), 0x1f5235],
        [new THREE.ConeGeometry(2.6, 4.2, 8).translate(0, 6.9, 0), 0xe8f0f8],
        [new THREE.ConeGeometry(1.7, 3.6, 8).translate(0, 9, 0), 0xf6f9fc],
    ]);
    const trees = instanced(root, tree, vc({ flatShading: true }), 900);
    const snowy = instanced(root, snowTree, vc({ flatShading: true }), 500);
    let a = 0, b2 = 0;
    scatter(t, rng, 1400, { margin: 4, extent: 330 }, (x, z) => {
        const y = E.terrainAt(x, z), s = 0.8 + rng() * 0.9;
        if (y > E.max + 26 + rng() * 20) { if (b2 < 500) place(snowy, b2++, x, y - 0.3, z, s, rng() * 6); }
        else if (a < 900) place(trees, a++, x, y - 0.3, z, s, rng() * 6);
    });
    trees.count = a; snowy.count = b2;

    const rocks = instanced(root, rockGeometry(3, rockColors.boulder), vc({ flatShading: true }), 220);
    rocks.count = scatter(t, rng, 220, { margin: 3, extent: 300 }, (x, z, i) => {
        const s = 1 + rng() * 4; place(rocks, i, x, E.terrainAt(x, z) - s * 0.2, z, s, rng() * 6, s * (0.8 + rng() * 0.6), s * (0.6 + rng() * 0.5), s);
    });

    // Chalets : murs en bois, toit à deux pans enneigé, fenêtres allumées
    const wood = std(0x8a5a32), roof = std(0x5a2d1c), snow = std(0xf4f7fb), win = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffc062, emissiveIntensity: 1.4 });
    for (let k = 0; k < 6; k++) {
        const s = freeSpot(t, rng, 14, 160);
        if (!s) continue;
        const g = new THREE.Group();
        const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), wood); walls.position.y = 2.5; walls.castShadow = true;
        const r = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 10, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), roof);
        r.rotation.set(0, 0, 0); r.scale.set(1, 0.55, 1); r.position.y = 6.4; r.castShadow = true;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 10.2, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), snow);
        cap.scale.set(1, 0.3, 1.02); cap.position.y = 7.6;
        const chim = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), std(0x6b6b6b)); chim.position.set(2.5, 8, 1);
        g.add(walls, r, cap, chim);
        for (const [wx, wz, ry] of [[-2.2, 3.51, 0], [2.2, 3.51, 0], [4.51, 0, Math.PI / 2]]) {
            const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), win); w.position.set(wx, 2.8, wz); w.rotation.y = ry; g.add(w);
        }
        g.position.set(s.x, E.terrainAt(s.x, s.z) - 0.2, s.z); g.rotation.y = rng() * 6;
        root.add(g);
        // Fumée de cheminée
        const puffs = instanced(root, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xdedede, transparent: true, opacity: 0.55 }), 8, false);
        const base = new THREE.Vector3(2.5, 9.5, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
        life.push((dt, time) => {
            for (let i = 0; i < 8; i++) {
                const ph = (time * 0.18 + i / 8) % 1;
                place(puffs, i, base.x + ph * 4, base.y + ph * 14, base.z + ph * 2, 0.6 + ph * 2.4);
            }
            puffs.instanceMatrix.needsUpdate = true;
        });
    }

    // Téléphérique : deux pylônes, un câble, une cabine qui fait l'aller-retour
    const p1 = freeSpot(t, rng, 30, 260), p2 = freeSpot(t, rng, 30, 260);
    if (p1 && p2 && Math.hypot(p1.x - p2.x, p1.z - p2.z) > 120) {
        const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.7, roughness: 0.35 });
        const top = [];
        for (const p of [p1, p2]) {
            const y = E.terrainAt(p.x, p.z);
            const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 34, 6), steel);
            pylon.position.set(p.x, y + 17, p.z); pylon.castShadow = true;
            root.add(pylon);
            top.push(new THREE.Vector3(p.x, y + 34, p.z));
        }
        const dir = top[1].clone().sub(top[0]), len = dir.length();
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 4), std(0x222222));
        cable.position.copy(top[0]).add(top[1]).multiplyScalar(0.5);
        cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        root.add(cable);
        const cabin = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.4 }));
        box.position.y = -4; box.castShadow = true;
        const glass = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 2.7), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.1 }));
        glass.position.y = -3.6;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 4), std(0x333333)); arm.position.y = -1.3;
        cabin.add(box, glass, arm);
        root.add(cabin);
        life.push((dt, time) => {
            const k = (Math.sin(time * 0.08) + 1) / 2;
            cabin.position.copy(top[0]).lerp(top[1], k);
            cabin.position.y -= Math.sin(k * Math.PI) * 6;
            cabin.rotation.z = Math.sin(time * 1.3) * 0.03;
        });
    }
    flock(t, rng, root, life, { count: 5, color: 0x3a2a1a, height: E.max + 70, radius: 160, big: 2.6 });
    flakes(root, life, { count: 500, color: 0xffffff, size: 0.4, fall: 2, box: 140, additive: false });
}

// ---------- Volcan : cratère fumant, coulées et lac de lave, orgues basaltiques ----------
function lavaMaterial(life, scale = 0.05) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
    life.push((dt, time) => { uniforms.uTime.value = time; });
    return new THREE.ShaderMaterial({
        uniforms, fog: true,
        vertexShader: `varying vec2 vW;
${THREE.ShaderChunk.fog_pars_vertex}
            void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
${THREE.ShaderChunk.fog_vertex}
}`,
        fragmentShader: `uniform float uTime; varying vec2 vW;
${THREE.ShaderChunk.fog_pars_fragment}
            float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
            void main(){
                vec2 p = vW * ${scale.toFixed(3)};
                float a = n(p + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + n(p * 2.3 - uTime * 0.1) * 0.4;
                float crust = smoothstep(0.55, 0.75, a);
                vec3 hot = mix(vec3(1.0, 0.82, 0.25), vec3(1.0, 0.32, 0.04), a);
                vec3 c = mix(hot * 2.2, vec3(0.12, 0.06, 0.05), crust);
                gl_FragColor = vec4(c, 1.0);
${THREE.ShaderChunk.fog_fragment}
            }`,
    });
}
function volcan(t, rng, root, life) {
    // Le volcan au loin, avec son cratère incandescent et un panache de fumée
    const v = freeSpot(t, rng, 260, 520) ?? { x: t.bbox.maxX + 400, z: t.bbox.maxZ + 300 };
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(38, 210, 170, 24, 6, true), flat(0x2a211e));
    const cp = cone.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) { const k = 1 + (fbm(cp.getX(i) * 0.03, cp.getZ(i) * 0.03 + cp.getY(i) * 0.02) - 0.5) * 0.3; cp.setX(i, cp.getX(i) * k); cp.setZ(i, cp.getZ(i) * k); }
    cone.geometry.computeVertexNormals();
    cone.position.set(v.x, 85, v.z);
    root.add(cone);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(36, 24).rotateX(-Math.PI / 2), lavaMaterial(life, 0.12));
    crater.position.set(v.x, 166, v.z);
    root.add(crater);
    // Coulées le long des flancs
    const flowMat = lavaMaterial(life, 0.08);
    for (let k = 0; k < 4; k++) {
        const a = rng() * 6.28, pts = [];
        for (let s = 0; s <= 10; s++) {
            const f = s / 10, r = 38 + f * 175, y = 168 - f * 168;
            pts.push(new THREE.Vector3(v.x + Math.cos(a + Math.sin(f * 6 + k) * 0.08) * r, y + 1.5, v.z + Math.sin(a + Math.sin(f * 6 + k) * 0.08) * r));
        }
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 4 + rng() * 3, 6), flowMat);
        tube.scale.y = 1;
        root.add(tube);
    }
    const plume = instanced(root, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x3a3230, transparent: true, opacity: 0.6, fog: false }), 22, false);
    life.push((dt, time) => {
        for (let i = 0; i < 22; i++) {
            const ph = (time * 0.04 + i / 22) % 1;
            place(plume, i, v.x + ph * 160 + Math.sin(i) * 10, 175 + ph * 260, v.z + ph * 60, 18 + ph * 70);
        }
        plume.instanceMatrix.needsUpdate = true;
    });
    const glow = new THREE.PointLight(0xff6a2a, 3, 600, 1.2);
    glow.position.set(v.x, 200, v.z);
    root.add(glow);

    // Lac de lave près de la piste (au centre du Cratère Ardent)
    const lake = freeSpot(t, rng, 40, 100);
    if (lake) {
        const r = 30 + rng() * 20;
        const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), lavaMaterial(life, 0.06));
        m.position.set(lake.x, 0.08, lake.z); m.scale.set(1, 1, 0.75);
        root.add(m);
        const rim = instanced(root, rockGeometry(9, (c, ny, y, n) => c.setHex(0x2a2220).multiplyScalar(0.7 + n * 0.6)), vc({ flatShading: true }), 40);
        for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2, s = 2 + rng() * 3;
            place(rim, i, lake.x + Math.cos(a) * r, 0.2, lake.z + Math.sin(a) * r * 0.75, s, rng() * 6);
        }
        const l = new THREE.PointLight(0xff5a1a, 2.5, 160, 1.5);
        l.position.set(lake.x, 12, lake.z);
        root.add(l);
        life.push((dt, time) => { l.intensity = 2.2 + Math.sin(time * 3) * 0.4 + Math.sin(time * 7.3) * 0.2; });
    }

    // Orgues basaltiques et arbres calcinés
    const col = instanced(root, new THREE.CylinderGeometry(1, 1, 1, 6), flat(0x2d2826), 300);
    col.count = scatter(t, rng, 300, { margin: 4, extent: 220 }, (x, z, i) => {
        const h = 2 + rng() * 14, r = 1 + rng() * 1.6;
        place(col, i, x, h / 2, z, 1, rng() * 6, r, h, r);
        C.setHex(0x2d2826).multiplyScalar(0.7 + rng() * 0.6); col.setColorAt(i, C);
    });
    const dead = mergeColored([
        [new THREE.CylinderGeometry(0.2, 0.35, 6, 5).translate(0, 3, 0), 0x1b1512],
        [new THREE.CylinderGeometry(0.08, 0.14, 2.6, 4).rotateZ(0.9).translate(0.9, 4.2, 0), 0x1b1512],
        [new THREE.CylinderGeometry(0.07, 0.12, 2.2, 4).rotateZ(-0.8).translate(-0.7, 3.4, 0), 0x1b1512],
    ]);
    const trees = instanced(root, dead, vc({ flatShading: true }), 90);
    trees.count = scatter(t, rng, 90, { margin: 3, extent: 160 }, (x, z, i) => place(trees, i, x, 0, z, 0.8 + rng() * 0.8, rng() * 6));
    // Mares de lave éparses
    const pool = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), lavaMaterial(life, 0.1), 16);
    pool.count = scatter(t, rng, 16, { margin: 10, extent: 200 }, (x, z, i) => place(pool, i, x, 0.07, z, 5 + rng() * 9, rng() * 6, undefined, 1, undefined));
    root.add(pool);
    flakes(root, life, { count: 900, color: 0xff8a2a, size: 0.35, fall: -1.4, box: 120, additive: true, blink: true });
    flakes(root, life, { count: 1400, color: 0x6a5f5c, size: 0.45, fall: 1.2, box: 130, additive: false, wind: 2 });
}

// ---------- Plage : palmiers, parasols, phare, bateaux, mouettes ----------
function plage(t, rng, root, life) {
    palms(t, rng, root, 160, { margin: 4, extent: 150 });
    // Parasols et serviettes
    const umbrellaCols = [0xff5a5a, 0xffd23f, 0x2fb3c8, 0xff8c1a, 0x22c55e, 0xffffff];
    const top = instanced(root, new THREE.ConeGeometry(2.4, 1, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 }), 70);
    const pole = instanced(root, new THREE.CylinderGeometry(0.06, 0.06, 3, 5), std(0xeeeeee), 70);
    const towel = instanced(root, new THREE.PlaneGeometry(1.4, 2.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 70, false);
    const n = scatter(t, rng, 70, { margin: 3, extent: 70 }, (x, z, i) => {
        const r = rng() * 6;
        place(pole, i, x, 1.5, z, 1, 0, 1, 1, 1, (rng() - 0.5) * 0.2);
        place(top, i, x, 3.1, z, 1, r);
        place(towel, i, x + 1.6, 0.04, z, 1, r);
        top.setColorAt(i, C.setHex(umbrellaCols[i % umbrellaCols.length]));
        towel.setColorAt(i, C.setHex(umbrellaCols[(i + 2) % umbrellaCols.length]));
    });
    top.count = pole.count = towel.count = n;
    // Coquillages, étoiles de mer et rochers coralliens
    const rocks = instanced(root, rockGeometry(4, rockColors.coral), vc({ flatShading: true }), 60);
    rocks.count = scatter(t, rng, 60, { margin: 3, extent: 160 }, (x, z, i) => { const s = 0.8 + rng() * 2.5; place(rocks, i, x, s * 0.2, z, s, rng() * 6); });
    // Le phare et son faisceau tournant
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    const rx = (t.bbox.maxX - t.bbox.minX) / 2 + 200, rz = (t.bbox.maxZ - t.bbox.minZ) / 2 + 180;
    const lh = new THREE.Group();
    for (let k = 0; k < 6; k++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.2 - k * 0.3, 3.5 - k * 0.3, 5, 16), std(k % 2 ? 0xd62828 : 0xf6f6f6));
        seg.position.y = 2.5 + k * 5; seg.castShadow = true; lh.add(seg);
    }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xfff2a0, emissiveIntensity: 3 }));
    lamp.position.y = 31.5;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.4, 16), std(0xd62828)); hat.position.y = 34;
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 16, 1, true).translate(0, -30, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 31.5;
    lh.add(lamp, hat, beam);
    lh.position.set(cx + rx * 0.98, 0, cz);
    root.add(lh);
    life.push(dt => { beam.rotation.y += dt * 0.8; });
    // Voiliers qui se balancent sur le lagon
    const boats = [];
    for (let k = 0; k < 7; k++) {
        const g = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.9, 9, 8, 1).rotateX(Math.PI / 2).scale(1, 0.5, 1), std(0xf4f4f4));
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 5), std(0x8a6a44)); mast.position.y = 5;
        const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.8, -3.5), new THREE.Vector3(0, 9.8, 0), new THREE.Vector3(0, 0.8, 3)]), new THREE.MeshStandardMaterial({ color: umbrellaCols[k % 6], side: THREE.DoubleSide }));
        sail.geometry.computeVertexNormals(); sail.position.x = 0.15;
        g.add(hull, mast, sail);
        const a = rng() * 6.28, d = 1.25 + rng() * 0.6;
        g.position.set(cx + Math.cos(a) * rx * d, 0, cz + Math.sin(a) * rz * d);
        g.rotation.y = rng() * 6;
        root.add(g);
        boats.push({ g, ph: rng() * 6 });
    }
    life.push((dt, time) => boats.forEach(b => { b.g.position.y = Math.sin(time * 1.2 + b.ph) * 0.3; b.g.rotation.z = Math.sin(time + b.ph) * 0.06; b.g.position.x += dt * 0.6; }));
    flock(t, rng, root, life, { count: 18, color: 0xffffff, height: 35, radius: 150 });
}

// ---------- Ville de nuit : gratte-ciel, néons, réverbères ----------
function windowTexture(rng, hue) {
    return canvasTex(128, 256, (g, w, h) => {
        g.fillStyle = '#0c0d14'; g.fillRect(0, 0, w, h);
        for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 12) {
            const on = rng() < 0.42;
            g.fillStyle = on ? (rng() < 0.2 ? `hsl(${hue},90%,70%)` : `hsl(${40 + rng() * 15},${60 + rng() * 30}%,${55 + rng() * 25}%)`) : '#161822';
            g.fillRect(x, y, 7, 9);
        }
    });
}
function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function ville(t, rng, root, life) {
    // Immeubles posés sur une grille de rues, jamais trop près de la piste
    const variants = [[18, 40, 18], [22, 70, 20], [16, 110, 16], [26, 30, 22], [20, 150, 20], [30, 55, 26]];
    const hues = [320, 190, 280, 30];
    const meshes = variants.map(([w, h, d], k) => {
        const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            // Les fenêtres gardent leur taille, quelle que soit la façade
            const face = Math.floor(i / 4), horiz = face < 2 ? d : w;
            uv.setXY(i, uv.getX(i) * horiz / 10, uv.getY(i) * (face === 2 || face === 3 ? d / 10 : h / 18));
        }
        const tex = windowTexture(rng, hues[k % hues.length]);
        return instanced(root, geo, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.4 }), 140);
    });
    const counts = variants.map(() => 0);
    const { minX, maxX, minZ, maxZ } = t.bbox;
    const roofs = [];
    for (let x = minX - 320; x <= maxX + 320; x += 38) for (let z = minZ - 320; z <= maxZ + 320; z += 38) {
        const near = t.distanceFree(x, z);
        if (near.d < near.limit + 22 || rng() < 0.12) continue;
        const k = near.d > near.limit + 140 ? Math.floor(rng() * variants.length) : [0, 3, 5][Math.floor(rng() * 3)];
        if (counts[k] >= 140) continue;
        place(meshes[k], counts[k]++, x + (rng() - 0.5) * 6, 0, z + (rng() - 0.5) * 6, 1, Math.floor(rng() * 4) * Math.PI / 2);
        if (rng() < 0.3) roofs.push([x, variants[k][1], z]);
    }
    meshes.forEach((m, k) => { m.count = counts[k]; });
    // Enseignes et feux d'antenne sur les toits
    const neonCols = [0xff2fa0, 0x20e3ff, 0x9b6dff, 0xffd23f, 0x22ff88];
    const signs = instanced(root, new THREE.BoxGeometry(8, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), roofs.length || 1, false);
    const blink = instanced(root, new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }), roofs.length || 1, false);
    roofs.forEach(([x, h, z], i) => {
        place(signs, i, x, h + 2, z, 1, rng() * 6);
        signs.setColorAt(i, C.setHex(neonCols[i % neonCols.length]).multiplyScalar(2));
        place(blink, i, x + 3, h + 6, z);
    });
    signs.count = blink.count = roofs.length;
    life.push((dt, time) => { blink.visible = Math.sin(time * 4) > 0; });

    // Réverbères des deux côtés, avec leur halo de lumière sur la route
    const poles = instanced(root, new THREE.CylinderGeometry(0.15, 0.2, 9, 6).translate(0, 4.5, 0), std(0x2b2e36, { metalness: 0.7, roughness: 0.4 }), 260);
    const heads = instanced(root, new THREE.BoxGeometry(1.4, 0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false }), 260, false);
    const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 260);
    pools.frustumCulled = false;
    root.add(pools);
    let k = 0;
    for (let i = 0; i < t.n && k < 260; i += 14) {
        for (const sgn of [1, -1]) {
            const side = sgn * (i % 28 ? 1 : -1);
            const lim = t.w[i] + t.runoff + 1.5;
            const x = t.x[i] + t.tz[i] * side * lim, z = t.z[i] - t.tx[i] * side * lim;
            if (t.distanceFree(x, z).d < lim - 1 || k >= 260) continue;
            const hx = t.x[i] + t.tz[i] * side * (lim - 2.5), hz = t.z[i] - t.tx[i] * side * (lim - 2.5);
            place(poles, k, x, 0, z);
            place(heads, k, hx, 9, hz, 1, Math.atan2(t.tx[i], t.tz[i]));
            const lx = t.x[i] + t.tz[i] * side * (t.w[i] * 0.5), lz = t.z[i] - t.tx[i] * side * (t.w[i] * 0.5);
            place(pools, k, lx, 0.11, lz, 11);
            k++;
            break;
        }
    }
    poles.count = heads.count = pools.count = k;
    // Arches de néon au-dessus de la piste
    const arch = new THREE.TorusGeometry(1, 0.035, 8, 40, Math.PI);
    for (let a = 0; a < 6; a++) {
        const i = Math.floor(((a + 0.5) / 6) * t.n), w = t.w[i] + 3;
        const m = new THREE.Mesh(arch, new THREE.MeshBasicMaterial({ color: new THREE.Color(neonCols[a % neonCols.length]).multiplyScalar(2.2), toneMapped: false }));
        m.scale.set(w, w * 0.7, w);
        m.position.set(t.x[i], 0, t.z[i]);
        m.rotation.y = Math.atan2(t.tx[i], t.tz[i]) + Math.PI / 2;
        root.add(m);
    }
    // La lune
    const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf2f0ff, fog: false }));
    moon.position.set((minX + maxX) / 2 + 600, 520, (minZ + maxZ) / 2 + 460);
    root.add(moon);
}
function radialPool() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,214,150,.55)'); grad.addColorStop(0.6, 'rgba(255,190,120,.18)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
}

/** Construit le décor du biome. Renvoie la liste des fonctions d'animation. */
export function buildBiomeDecor(t, biomeId, rng, root, elev) {
    const b = BIOMES[biomeId], life = [];
    buildHills(t, b, rng, root, elev);
    ({ plaine, glace, jungle, desert, montagne, volcan, plage, ville })[biomeId](t, rng, root, life, elev);
    return life;
}
