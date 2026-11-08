// ============================================================
//  Effets visuels : particules et traces de pneus.
//  Tout est préalloué : aucun objet créé pendant la course, donc
//  pas de ralentissements dus au nettoyage de la mémoire.
// ============================================================
import * as THREE from 'three';
import { MARK_Y } from './world.js';

const MAX_PARTICLES = 320;
const MAX_MARK_QUADS = 2400;

export class Effects {
    constructor(scene) {
        this.scene = scene;

        // --- Particules ---
        this.mesh = new THREE.InstancedMesh(
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
            MAX_PARTICLES,
        );
        this.mesh.frustumCulled = false;
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
        scene.add(this.mesh);
        this.parts = Array.from({ length: MAX_PARTICLES }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, grav: 0 }));
        this.next = 0;
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        const hide = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < MAX_PARTICLES; i++) this.mesh.setMatrixAt(i, hide);

        // --- Traces : un seul ruban en anneau ; les plus anciennes sont réécrites ---
        const g = this.markGeo = new THREE.BufferGeometry();
        this.markPos = new Float32Array(MAX_MARK_QUADS * 4 * 3).fill(-9999);
        this.markAttr = new THREE.BufferAttribute(this.markPos, 3);
        this.markAttr.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('position', this.markAttr);
        const idx = new Uint32Array(MAX_MARK_QUADS * 6);
        for (let i = 0; i < MAX_MARK_QUADS; i++) {
            const a = i * 4;
            idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
        }
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        this.marks = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
        this.marks.frustumCulled = false;
        scene.add(this.marks);
        this.markHead = 0;
    }

    emit(x, y, z, vx, vy, vz, size, grow, life, color, grav = 0) {
        const p = this.parts[this.next];
        Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, size, grow, grav });
        this.color.set(color);
        this.mesh.setColorAt(this.next, this.color);
        this.mesh.instanceColor.needsUpdate = true;
        this.next = (this.next + 1) % MAX_PARTICLES;
    }

    smoke(x, z, vx, vz, color = 0xdddddd, size = 0.5) {
        const r = () => (Math.random() - 0.5);
        this.emit(x + r(), 0.3, z + r(), vx * 0.15 + r() * 2, 1 + Math.random(), vz * 0.15 + r() * 2, size, 1.8, 0.7 + Math.random() * 0.5, color);
    }
    flame(x, y, z, vx, vz) {
        const r = () => (Math.random() - 0.5);
        this.emit(x + r() * 0.3, y, z + r() * 0.3, vx * 0.7, 0.4, vz * 0.7, 0.32, -0.3, 0.22, Math.random() > 0.5 ? 0xff8a1e : 0xffdf5a);
    }
    sparks(x, y, z, count = 10) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * 6.28, s = 6 + Math.random() * 12;
            this.emit(x, y, z, Math.cos(a) * s, 3 + Math.random() * 7, Math.sin(a) * s, 0.09, 0, 0.35 + Math.random() * 0.3, 0xffcc55, 22);
        }
    }

    /** Retour de flamme à l'échappement quand on lâche l'accélérateur. */
    backfire(x, y, z, dirX, dirZ) {
        const r = () => (Math.random() - 0.5);
        for (let i = 0; i < 5; i++) {
            this.emit(x + r() * 0.2, y + r() * 0.2, z + r() * 0.2, dirX * (5 + i * 2) + r() * 2, r() * 2, dirZ * (5 + i * 2) + r() * 2, 0.22, -0.4, 0.18, i % 2 ? 0xffb030 : 0xff5a1e);
        }
    }
    /** Éclats colorés quand on attrape une boîte bonus. */
    burst(x, y, z) {
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * 6.28, up = Math.random(), s = 4 + Math.random() * 7;
            this.emit(x, y, z, Math.cos(a) * s, 3 + up * 8, Math.sin(a) * s, 0.16, -0.1, 0.55, i % 2 ? 0x9b6dff : 0xffd60a, 18);
        }
    }
    /** Confettis de la ligne d'arrivée, aux couleurs Turbonix. */
    confetti(x, z) {
        const colors = [0xffd60a, 0x9b6dff, 0xffffff, 0xff5a8a, 0x35e0a0];
        for (let i = 0; i < 90; i++) {
            const a = Math.random() * 6.28, s = 2 + Math.random() * 9;
            this.emit(x + Math.cos(a) * 3, 2 + Math.random() * 5, z + Math.sin(a) * 3, Math.cos(a) * s, 7 + Math.random() * 10, Math.sin(a) * s, 0.13, 0, 1.6 + Math.random() * 1.4, colors[i % colors.length], 9);
        }
    }

    /** Prolonge une trace de pneu ; `state` garde la dernière position de cette roue. */
    addMark(state, x, z, hx, hz, width = 0.32) {
        const px = -hz * width, pz = hx * width;
        const lx = x + px, lz = z + pz, rx = x - px, rz = z - pz;
        if (state.active && Math.hypot(x - state.x, z - state.z) < 8) {
            const o = this.markHead * 12, a = this.markPos;
            a[o] = state.lx; a[o + 1] = MARK_Y; a[o + 2] = state.lz;
            a[o + 3] = state.rx; a[o + 4] = MARK_Y; a[o + 5] = state.rz;
            a[o + 6] = lx; a[o + 7] = MARK_Y; a[o + 8] = lz;
            a[o + 9] = rx; a[o + 10] = MARK_Y; a[o + 11] = rz;
            this.markHead = (this.markHead + 1) % MAX_MARK_QUADS;
            this.markDirty = true;
        }
        state.active = true; state.x = x; state.z = z; state.lx = lx; state.lz = lz; state.rx = rx; state.rz = rz;
    }

    update(dt) {
        const d = this.dummy, m = this.mesh;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = this.parts[i];
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) {
                d.scale.setScalar(0); d.position.set(0, -50, 0); d.updateMatrix();
                m.setMatrixAt(i, d.matrix);
                continue;
            }
            p.vy -= p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            p.size = Math.max(0.01, p.size + p.grow * dt);
            const fade = p.grav > 0 ? 1 : Math.min(1, p.life / p.max * 1.6);
            d.position.set(p.x, p.y, p.z);
            d.scale.setScalar(p.size * fade);
            d.updateMatrix();
            m.setMatrixAt(i, d.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        if (this.markDirty) { this.markAttr.needsUpdate = true; this.markDirty = false; }
    }

    dispose() {
        this.scene.remove(this.mesh, this.marks);
        this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose();
        this.markGeo.dispose(); this.marks.material.dispose();
    }
}
