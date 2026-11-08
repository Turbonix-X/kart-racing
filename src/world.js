// ============================================================
//  Construction du décor en 3D à partir des données du circuit
//  et du biome choisi. Tout est généré par le code.
//  La construction se fait par étapes, pour l'écran de chargement.
// ============================================================
import * as THREE from 'three';
import { BIOMES, buildBiomeDecor, obstacleLook, mulberry32, scatter } from './decor.js';

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

function speckle(g, w, h, count, colors, rng, maxSize = 3) {
    for (let i = 0; i < count; i++) {
        g.fillStyle = colors[Math.floor(rng() * colors.length)];
        const s = 1 + rng() * maxSize;
        g.fillRect(rng() * w, rng() * h, s, s);
    }
}

function groundTexture(b, biomeId, rng) {
    return canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = b.ground; g.fillRect(0, 0, w, h);
        speckle(g, w, h, 5000, [b.groundAlt, b.ground + 'cc', '#00000014', '#ffffff12'], rng, 4);
        for (let i = 0; i < 60; i++) {
            g.fillStyle = b.groundAlt + '55';
            g.beginPath(); g.arc(rng() * w, rng() * h, 12 + rng() * 40, 0, Math.PI * 2); g.fill();
        }
        if (biomeId === 'desert') {
            // Rides du sable
            g.strokeStyle = '#00000014'; g.lineWidth = 3;
            for (let y = 0; y < h; y += 18) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 5); g.stroke(); }
        } else if (biomeId === 'glace') {
            speckle(g, w, h, 600, ['#ffffff', '#cfe8ff'], rng, 2);
        } else if (biomeId === 'jungle') {
            speckle(g, w, h, 900, ['#1a4a1e', '#3c8a3a', '#5a4024'], rng, 5);
        }
    });
}

function roadTexture(b, biomeId, rng) {
    return canvasTex(256, 512, (g, w, h) => {
        g.fillStyle = b.road; g.fillRect(0, 0, w, h);
        speckle(g, w, h, 9000, ['#ffffff12', '#00000024', '#ffffff08'], rng, 2);
        if (biomeId === 'glace') {
            // Plaques de givre sur la route
            for (let i = 0; i < 26; i++) {
                g.fillStyle = 'rgba(220,240,255,.16)';
                g.beginPath(); g.ellipse(rng() * w, rng() * h, 10 + rng() * 26, 6 + rng() * 18, rng() * 3, 0, Math.PI * 2); g.fill();
            }
        }
        g.fillStyle = '#e8e8e8';
        g.fillRect(3, 0, 5, h); g.fillRect(w - 8, 0, 5, h);        // lignes de rive
        g.fillStyle = '#f5f5f5cc';
        g.fillRect(w / 2 - 2, 0, 4, h * 0.45);                     // tirets centraux
    });
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
    g.fillStyle = '#ff7a00'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff3c4'; g.lineWidth = 14; g.lineJoin = 'miter';
    for (const y of [10, 74]) { g.beginPath(); g.moveTo(10, y + 44); g.lineTo(w / 2, y); g.lineTo(w - 10, y + 44); g.stroke(); }
});

function billboardTexture(text, bg, fg) {
    return canvasTex(512, 128, (g, w, h) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = fg; g.font = '900 64px Outfit, "Segoe UI", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
    }, { repeat: false });
}

// ---------- Rubans le long du tracé ----------
class StripBuilder {
    constructor() { this.pos = []; this.uv = []; this.idx = []; this.count = 0; }
    /** Quad entre deux paires gauche/droite. La face regarde vers le haut si « gauche » est bien à gauche. */
    quad(l0, r0, l1, r1, v0, v1) {
        const n = this.count;
        this.pos.push(l0[0], l0[1], l0[2], r0[0], r0[1], r0[2], l1[0], l1[1], l1[2], r1[0], r1[1], r1[2]);
        this.uv.push(0, v0, 1, v0, 0, v1, 1, v1);
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

function offset(t, i, lat, y) {
    return [t.x[i] + t.tz[i] * lat, y, t.z[i] - t.tx[i] * lat];
}

function buildRoad(t, b, biomeId, rng, root) {
    const tile = 24;
    const strip = new StripBuilder();
    const last = t.closed ? t.n : t.n - 1;
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        const v0 = i * t.spacing / tile, v1 = (i + 1) * t.spacing / tile;
        // La largeur dessinée est exactement celle utilisée par la détection
        strip.quad(offset(t, a, t.w[a], ROAD_Y), offset(t, a, -t.w[a], ROAD_Y), offset(t, c, t.w[c], ROAD_Y), offset(t, c, -t.w[c], ROAD_Y), v0, v1);
    }
    const mesh = new THREE.Mesh(strip.build(), new THREE.MeshStandardMaterial({ map: roadTexture(b, biomeId, rng), roughness: biomeId === 'glace' ? 0.45 : 0.92, metalness: biomeId === 'glace' ? 0.15 : 0, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    root.add(mesh);

    // Bordures dans les virages
    const kerb = new StripBuilder();
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        if (Math.max(t.curv[a], t.curv[c]) < 0.006) continue;
        const v0 = i * t.spacing / 6, v1 = (i + 1) * t.spacing / 6;
        for (const sgn of [1, -1]) {
            const outer = l => offset(t, l, sgn * (t.w[l] + 1.4), KERB_Y), inner = l => offset(t, l, sgn * (t.w[l] - 0.1), KERB_Y);
            if (sgn > 0) kerb.quad(outer(a), inner(a), outer(c), inner(c), v0, v1);
            else kerb.quad(inner(a), outer(a), inner(c), outer(c), v0, v1);
        }
    }
    if (kerb.count) {
        const tex = stripeTexture(...b.kerb);
        tex.rotation = Math.PI / 2; tex.center.set(0.5, 0.5);
        const m = new THREE.Mesh(kerb.build(), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
        m.receiveShadow = true;
        root.add(m);
    }
}

function buildBarriers(t, b, root) {
    const strip = new StripBuilder();
    const H = 1.5;
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
    for (let i = 0; i < last; i++) {
        const a = i, c = t.wrap(i + 1);
        [1, -1].forEach((sgn, k) => {
            if (!valid[a * 2 + k] || !valid[c * 2 + k]) return;
            const la = sgn * (t.w[a] + t.runoff), lc = sgn * (t.w[c] + t.runoff);
            const v0 = i * t.spacing / 8, v1 = (i + 1) * t.spacing / 8;
            strip.quad(offset(t, a, la, H), offset(t, a, la, 0), offset(t, c, lc, H), offset(t, c, lc, 0), v0, v1);
        });
    }
    const tex = stripeTexture(...b.barrier);
    tex.rotation = Math.PI / 2; tex.center.set(0.5, 0.5);
    const mesh = new THREE.Mesh(strip.build(false), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);

    if (t.corridors.length) {
        const dirt = new THREE.MeshStandardMaterial({ color: 0x8a6239, roughness: 1 });
        for (const c of t.corridors) for (let i = 0; i < c.pts.length - 1; i++) {
            const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1];
            const len = Math.hypot(bx - ax, bz - az);
            const p = new THREE.Mesh(new THREE.PlaneGeometry(c.half * 2, len + c.half), dirt);
            p.rotation.x = -Math.PI / 2;
            p.rotation.z = Math.atan2(bx - ax, bz - az);
            p.position.set((ax + bx) / 2, 0.03, (az + bz) / 2);
            p.receiveShadow = true;
            root.add(p);
        }
    }
}

/** Portique de départ, avec de vrais feux : rouge, orange, vert. */
function buildStartFinish(t, root, world) {
    const lineMat = new THREE.MeshBasicMaterial({ map: checkerTexture(), toneMapped: false });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, metalness: 0.6, roughness: 0.4 });
    const addGate = (s, label, color, withLights) => {
        const p = t.pointAt(s, 0), w = p.width;
        const line = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 4), lineMat);
        lineMat.map.repeat.set(4, 1);
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = p.heading + Math.PI;
        line.position.set(p.x, PAINT_Y, p.z);
        root.add(line);
        for (const sgn of [1, -1]) {
            const q = t.pointAt(s, sgn * (w + 1.5));
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 8), postMat);
            post.position.set(q.x, 4, q.z); post.castShadow = true;
            root.add(post);
        }
        const tex = billboardTexture(label, color, '#ffffff');
        const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const banner = new THREE.Mesh(new THREE.BoxGeometry((w + 1.5) * 2, 1.8, 0.3), [postMat, postMat, postMat, postMat, face, face]);
        banner.position.set(p.x, 8, p.z);
        banner.rotation.y = p.heading + Math.PI;
        banner.castShadow = true;
        root.add(banner);
        if (withLights) {
            // Boîtier de feux au-dessus du portique, face aux voitures
            const box = new THREE.Group();
            box.position.set(p.x, 10.4, p.z);
            box.rotation.y = p.heading + Math.PI;
            const housing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 0.7), postMat);
            box.add(housing);
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

function buildFeatures(t, biomeId, root, animated) {
    if (t.pads.length) {
        const tex = padTexture();
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
        for (const pad of t.pads) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(pad.half * 2, pad.len * 2), mat);
            m.rotation.x = -Math.PI / 2;
            m.rotation.z = pad.heading + Math.PI;
            m.position.set(pad.x, PAINT_Y + 0.005, pad.z);
            root.add(m);
        }
        animated.padTex = tex;
    }

    if (t.ramps.length) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.55, side: THREE.DoubleSide });
        for (const r of t.ramps) {
            const w = r.half * 2, L = 9, H = 1.9;
            const shape = new THREE.BufferGeometry();
            shape.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                -w / 2, 0, -L / 2, w / 2, 0, -L / 2, -w / 2, H, L / 2, w / 2, H, L / 2, -w / 2, 0, L / 2, w / 2, 0, L / 2,
            ]), 3));
            shape.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 4, 2, 1, 3, 5]);
            shape.computeVertexNormals();
            const m = new THREE.Mesh(shape, mat);
            m.position.set(r.x, ROAD_Y, r.z);
            m.rotation.y = r.heading;
            m.castShadow = true;
            root.add(m);
        }
    }

    // Obstacles : habillés selon le biome
    const look = obstacleLook(biomeId);
    const logGeo = new THREE.CylinderGeometry(0.55, 0.55, 5.4, 10);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6d4a2a, roughness: 1 });
    for (const o of t.obstacles) {
        let m;
        if (o.kind === 'log') {
            m = new THREE.Mesh(logGeo, logMat);
            m.rotation.z = Math.PI / 2;
            m.position.set(o.x, 0.55, o.z);
        } else {
            m = new THREE.Mesh(look.geo, look.mat);
            const s = look.box ? o.r * 0.9 : o.r;
            m.scale.set(s, o.h * (look.box ? 0.9 : 1.1), s);
            m.position.set(o.x, o.h * 0.5, o.z);
            m.rotation.y = o.x * 0.37;
        }
        m.castShadow = true;
        root.add(m);
    }

    // Boîtes mystère : un cube « ? » qui tourne au-dessus d'un anneau lumineux
    const boxTex = canvasTex(64, 64, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ff8c1a'); grad.addColorStop(1, '#22c55e');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
        g.fillStyle = '#ffffff'; g.font = '900 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2 + 2);
    }, { repeat: false });
    const count = Math.max(1, t.pickupSpots.length);
    const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ map: boxTex, emissive: 0xff8c1a, emissiveIntensity: 0.35, roughness: 0.3 }), count);
    boxes.frustumCulled = false;
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.25, 0.08, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5dff9e, toneMapped: false, transparent: true, opacity: 0.85 }), count);
    rings.frustumCulled = false;
    root.add(boxes, rings);
    animated.boxes = boxes;
    animated.rings = rings;

    // Flaques d'huile
    const oilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.9, roughness: 0.15, transparent: true, opacity: 0.9 });
    const oilMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), oilMat, 40);
    oilMesh.frustumCulled = false;
    root.add(oilMesh);
    animated.oilMesh = oilMesh;

    // Cônes renversables
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
    const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.1, 12).translate(0, 0.55, 0), coneMat, Math.max(1, t.coneSpots.length));
    const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.33, 0.18, 12).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0xffffff }), Math.max(1, t.coneSpots.length));
    cones.castShadow = true;
    cones.frustumCulled = bands.frustumCulled = false;
    root.add(cones, bands);
    animated.cones = cones;
    animated.bands = bands;
}

/** Tribunes et public près de la ligne de départ. */
function buildGrandstands(t, rng, root, animated) {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x6b6e78, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1f9d55, roughness: 0.6 });
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    // Le public saute : calculé par la carte graphique
    animated.crowdTime = { value: 0 };
    animated.crowdExcite = { value: 0.12 };
    crowdMat.onBeforeCompile = shader => {
        shader.uniforms.uTime = animated.crowdTime;
        shader.uniforms.uExcite = animated.crowdExcite;
        shader.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.y += abs(sin(uTime * (4.0 + mod(instanceMatrix[3].x, 3.0)) + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z)) * uExcite;\n#endif',
        );
    };
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.8, 0.45), crowdMat, 1600);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    let count = 0;
    const palette = [0xff8c1a, 0x22c55e, 0xe74c3c, 0xecf0f1, 0x3498db, 0xf1c40f, 0x9b59b6];
    const offsets = t.closed ? [0, 0.06, -0.06] : [0, 0.03];
    for (const f of offsets) {
        const s = t.closed ? ((t.startS + f * t.length) % t.length + t.length) % t.length : t.startS + f * t.length;
        for (const sgn of [1, -1]) {
            const lim = t.pointAt(s, 0).width + t.runoff;
            const p = t.pointAt(s, sgn * (lim + 9));
            if (t.distanceFree(p.x, p.z).d < lim + 6) continue;
            const g = new THREE.Group();
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.heading + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
            const W = 34;
            for (let row = 0; row < 5; row++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2 * (row + 1), 1.6), standMat);
                step.position.set(0, 0.6 * (row + 1), -row * 1.6);
                step.castShadow = row === 4;
                g.add(step);
            }
            const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.4, 10), roofMat);
            roof.position.set(0, 10.5, -3.5);
            roof.castShadow = true;
            g.add(roof);
            g.updateMatrixWorld(true);
            for (let row = 0; row < 5; row++) for (let k = 0; k < 44 && count < 1600; k++) {
                if (rng() < 0.15) continue;
                dummy.position.set(-W / 2 + 0.5 + k * ((W - 1) / 43), 1.2 * (row + 1) + 0.4, -row * 1.6);
                dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
                dummy.matrix.premultiply(g.matrixWorld);
                crowd.setMatrixAt(count, dummy.matrix);
                col.setHex(palette[Math.floor(rng() * palette.length)]);
                crowd.setColorAt(count, col);
                count++;
            }
            root.add(g);
        }
    }
    crowd.count = count;
    if (count) root.add(crowd);
}

function buildBillboards(t, root) {
    const posts = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const looks = [['TURBONIX', '#111', '#ff8c1a'], ['KART RACING', '#1f9d55', '#fff'], ['NITRO COLA', '#c0392b', '#fff'], ['PNEUS VEGA', '#1c6ea4', '#fff']];
    const mats = looks.map(l => new THREE.MeshBasicMaterial({ map: billboardTexture(...l), toneMapped: false }));
    const span = t.closed ? t.length : t.raceLength;
    for (let i = 0; i < 12; i++) {
        const s = t.startS + (i + 0.5) / 12 * span;
        const sgn = i % 2 ? 1 : -1;
        const lim = t.pointAt(s, 0).width + t.runoff;
        const p = t.pointAt(s, sgn * (lim + 5));
        if (t.distanceFree(p.x, p.z).d < lim + 3) continue;
        // Deux faces dos à dos : le texte se lit dans les deux sens
        for (const flip of [0, Math.PI]) {
            const b = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), mats[i % mats.length]);
            b.position.set(p.x, 6, p.z);
            b.rotation.y = p.heading + Math.PI + flip;
            root.add(b);
        }
        for (const off of [-5, 5]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 5), posts);
            post.position.set(p.x + Math.cos(p.heading) * off, 3, p.z - Math.sin(p.heading) * off);
            root.add(post);
        }
    }
}

// ---------- Ciel ----------
function buildSky(b, root) {
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1400, 24, 12),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { top: { value: new THREE.Color(b.skyTop) }, low: { value: new THREE.Color(b.skyLow) }, sunDir: { value: new THREE.Vector3(55, 120, 40).normalize() } },
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 low; uniform vec3 sunDir;\nvoid main(){ float h = clamp(vP.y * 2.4, 0.0, 1.0); vec3 c = mix(low, top, pow(h, 0.7)); float s = max(0.0, dot(vP, sunDir)); c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 2.0 + pow(s, 24.0) * 0.25); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
        }),
    );
    sky.renderOrder = -10;
    root.add(sky);
    return sky;
}

function buildClouds(t, b, rng, root) {
    const n = Math.round(140 * b.clouds);
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: b.clouds > 1.3 ? 0xe4ecf4 : 0xffffff, fog: false, transparent: true, opacity: 0.9 }), Math.max(1, n));
    const d = new THREE.Object3D();
    const cx = (t.bbox.minX + t.bbox.maxX) / 2, cz = (t.bbox.minZ + t.bbox.maxZ) / 2;
    let i = 0;
    for (let c = 0; c < n / 5 && i < n; c++) {
        const a = rng() * 6.283, r = 300 + rng() * 800, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = 170 + rng() * 120;
        for (let k = 0; k < 5 && i < n; k++, i++) {
            d.position.set(x + (k - 2) * 26 + rng() * 10, y + rng() * 9, z + rng() * 22);
            d.scale.set(26 + rng() * 26, 9 + rng() * 9, 18 + rng() * 18);
            d.updateMatrix();
            mesh.setMatrixAt(i, d.matrix);
        }
    }
    mesh.count = i;
    root.add(mesh);
    return mesh;
}

/** Reflets de l'environnement : sol neutre, pour ne pas teinter les chromes de la couleur de l'herbe. */
export function makeEnvironment(renderer, b) {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.background = new THREE.Color(b.skyLow);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: b.skyTop, side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(50, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.ground).lerp(new THREE.Color(0x3c3c42), 0.8) }));
    floor.position.y = -1;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 15, 13) }));
    sun.position.set(25, 35, 15);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.6), side: THREE.BackSide }));
    band.position.y = 3;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(50, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(3.2) }));
    top.position.y = 40;
    s.add(dome, floor, sun, band, top);
    const rt = pm.fromScene(s, 0.03);
    pm.dispose();
    s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    return rt;
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
        this.scene = new THREE.Scene();
        this.root = new THREE.Group();
        this.scene.add(this.root);
        const rng = mulberry32(track.id.length * 977 + biomeId.length * 31 + 42);
        const step = async (p, label) => { onProgress(p, label); await nextTick(); };

        await step(0.05, 'Lumière et ciel');
        this.scene.fog = new THREE.Fog(b.fog, b.fogNear, b.fogFar);
        this.env = makeEnvironment(renderer, b);
        this.scene.environment = this.env.texture;
        this.scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(b.ground), b.hemi * 0.7));
        const sun = this.sun = new THREE.DirectionalLight(b.sun, b.sunI);
        sun.castShadow = opts.shadows !== false;
        sun.shadow.mapSize.set(2048, 2048);
        const box = opts.wideShadow ? 110 : 70;
        Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 320 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        this.scene.add(sun, sun.target);
        this.sky = buildSky(b, this.root);
        this.clouds = buildClouds(track, b, rng, this.root);

        await step(0.2, 'Le sol');
        const size = Math.max(track.bbox.maxX - track.bbox.minX, track.bbox.maxZ - track.bbox.minZ) + 1600;
        const gTex = groundTexture(b, biomeId, rng);
        gTex.repeat.set(size / 40, size / 40);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: gTex, roughness: 1, envMapIntensity: 0.3 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((track.bbox.minX + track.bbox.maxX) / 2, 0, (track.bbox.minZ + track.bbox.maxZ) / 2);
        ground.receiveShadow = true;
        this.root.add(ground);

        await step(0.32, 'La piste');
        this.animated = {};
        buildRoad(track, b, biomeId, rng, this.root);
        await step(0.45, 'Les murs');
        buildBarriers(track, b, this.root);
        buildStartFinish(track, this.root, this);
        await step(0.55, 'Les boîtes mystère');
        buildFeatures(track, biomeId, this.root, this.animated);
        await step(0.65, 'Les tribunes');
        buildGrandstands(track, rng, this.root, this.animated);
        buildBillboards(track, this.root);
        await step(0.75, `Le décor : ${b.name}`);
        this.life = buildBiomeDecor(track, biomeId, rng, this.root);
        await step(0.92, 'Préparation de l\'affichage');

        this._d = new THREE.Object3D();
        this._time = 0;
        this._cam = new THREE.Vector3();
        this.setStartLights(0);
    }

    /** Feux du portique : 0 éteints, 1 rouge, 2 orange, 3 vert. */
    setStartLights(phase) {
        if (!this.lamps) return;
        this.lamps.forEach((m, i) => { m.emissiveIntensity = phase === i + 1 ? 5 : 0.05; });
    }

    /** L'ombre suit la zone regardée, où que l'on soit sur le circuit. */
    followShadow(x, z) {
        this.sun.position.set(x + 55, 120, z + 40);
        this.sun.target.position.set(x, 0, z);
        this.sun.target.updateMatrixWorld();
    }

    setCrowdExcitement(v) { if (this.animated.crowdExcite) this.animated.crowdExcite.value = v; }

    /** Anime le décor et les éléments de course. `cam` : position de la caméra principale. */
    update(dt, sim, cam) {
        this._time += dt;
        const time = this._time;
        if (cam) this._cam.copy(cam);
        for (const f of this.life) f(dt, time, this._cam);
        const { padTex, boxes, rings, oilMesh, crowdTime, cones, bands } = this.animated;
        if (padTex) padTex.offset.y = (time * 1.4) % 1;
        if (crowdTime) crowdTime.value = time;
        this.clouds.position.x = Math.sin(time * 0.02) * 60 + time * 0.8;

        const d = this._d;
        sim.pickups.forEach((p, i) => {
            const on = p.timer <= 0;
            const pop = on ? Math.min(1, (p.shown = (p.shown ?? 1) + dt * 3)) : (p.shown = 0);
            d.position.set(p.x, on ? 1.5 + Math.sin(time * 2 + i) * 0.25 : -10, p.z);
            d.rotation.set(0.4, time * 1.6 + i, 0.2);
            d.scale.setScalar(on ? 0.2 + 0.8 * pop + Math.sin(time * 4 + i) * 0.04 : 0.001);
            d.updateMatrix();
            boxes.setMatrixAt(i, d.matrix);
            d.position.y = on ? 0.15 : -10;
            d.rotation.set(0, -time, 0);
            d.scale.setScalar(on ? 1 + Math.sin(time * 3 + i) * 0.12 : 0.001);
            d.updateMatrix();
            rings.setMatrixAt(i, d.matrix);
        });
        boxes.count = rings.count = sim.pickups.length;
        boxes.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;

        let n = 0;
        for (const o of sim.oils) {
            if (n >= 40) break;
            const grow = o.age < 0 ? 1 : Math.min(1, o.age * 4 + 0.2);
            d.position.set(o.x, PAINT_Y + 0.01, o.z);
            d.rotation.set(0, 0, 0);
            d.scale.setScalar(o.r * grow);
            d.updateMatrix();
            oilMesh.setMatrixAt(n++, d.matrix);
        }
        oilMesh.count = n;
        oilMesh.instanceMatrix.needsUpdate = true;

        sim.props.forEach((c, i) => {
            d.position.set(c.x, ROAD_Y + c.y, c.z);
            d.rotation.set(c.rx, 0, c.rz);
            d.scale.setScalar(1);
            d.updateMatrix();
            cones.setMatrixAt(i, d.matrix);
            bands.setMatrixAt(i, d.matrix);
        });
        cones.count = bands.count = sim.props.length;
        cones.instanceMatrix.needsUpdate = bands.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        const textures = new Set(), mats = new Set(), geos = new Set();
        this.root.traverse(o => {
            if (o.geometry) geos.add(o.geometry);
            for (const m of [].concat(o.material ?? [])) {
                mats.add(m);
                if (m.map) textures.add(m.map);
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
