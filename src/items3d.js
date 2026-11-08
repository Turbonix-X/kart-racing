// ============================================================
//  Les objets en 3D : projectiles, bulles, aimants, éclairs…
//  Chaque objet a son modèle et son animation. Ce fichier ne
//  change aucune règle : il regarde la simulation et l'affiche.
// ============================================================
import * as THREE from 'three';
import { buildVehicleModel } from './models.js';
import { ROAD_Y } from './world.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, ...o });
const glow = (color, opacity = 0.6) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

function missileModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 12).rotateX(Math.PI / 2), mat(0xf4f4f4));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12).rotateX(Math.PI / 2), mat(0xff3b1f));
    nose.position.z = 1.1;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.2, 12).rotateX(Math.PI / 2), mat(0x22c55e));
    band.position.z = 0.35;
    g.add(body, nose, band);
    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.4), mat(0xff8c1a));
        const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
        fin.position.set(0, 0.3, -0.6); arm.add(fin); g.add(arm);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 10).rotateX(-Math.PI / 2), glow(0xffa030, 0.9));
    flame.position.z = -1.2;
    g.add(flame);
    g.userData.flame = flame;
    return g;
}

function bombModel() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), mat(0x15151a, { metalness: 0.6, roughness: 0.25 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.2, 10), mat(0x777777));
    cap.position.y = 0.58;
    const fuse = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 12, Math.PI), mat(0xd9c48a));
    fuse.position.set(0.15, 0.7, 0);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow(0xffd23f, 1));
    spark.position.set(0.32, 0.72, 0);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.04, 6, 24), mat(0xff8c1a));
    stripe.rotation.x = Math.PI / 2;
    g.add(ball, cap, fuse, spark, stripe);
    g.userData.spark = spark;
    return g;
}

function tornadoModel() {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xd6dde6, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + i * 0.75, 0.5 + i * 0.7, 1.6, 16, 1, true), m);
        ring.position.y = 0.8 + i * 1.5;
        g.add(ring);
    }
    return g;
}

function shieldModel() {
    const g = new THREE.Group();
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(2.7, 24, 16), glow(0x3dffb0, 0.16));
    const net = new THREE.Mesh(new THREE.IcosahedronGeometry(2.75, 1), new THREE.MeshBasicMaterial({ color: 0x8dffc8, wireframe: true, transparent: true, opacity: 0.45, toneMapped: false }));
    g.add(bubble, net);
    g.userData.net = net;
    return g;
}

function magnetModel() {
    const g = new THREE.Group();
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 10, 20, Math.PI), mat(0xe32222));
    u.rotation.z = Math.PI;
    const tipM = mat(0xdddddd, { metalness: 0.9, roughness: 0.2 });
    for (const x of [-0.5, 0.5]) {
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), tipM);
        tip.position.set(x, 0.14, 0);
        g.add(tip);
    }
    g.add(u);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2), glow(0x5dff9e, 0.5));
    g.userData.beam = beam;
    return { g, beam };
}

function springModel() {
    const pts = [];
    for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 10; pts.push(new THREE.Vector3(Math.cos(a) * 0.7, i / 80, Math.sin(a) * 0.7)); }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.07, 6), mat(0xc8ccd4, { metalness: 0.9, roughness: 0.2 }));
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16), mat(0xff8c1a));
    const g = new THREE.Group();
    g.add(coil, plate);
    g.userData.coil = coil;
    return g;
}

function starsModel() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.1 : 0.24, a = (i / 10) * Math.PI * 2;
        if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(r, 0);
    }
    const geo = new THREE.ShapeGeometry(shape);
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, toneMapped: false }));
        s.userData.a = (i / 3) * Math.PI * 2;
        g.add(s);
    }
    return g;
}

function boltGeometry(height) {
    const pts = [];
    let x = 0, z = 0;
    for (let i = 0; i <= 10; i++) {
        pts.push(new THREE.Vector3(x, height * (1 - i / 10), z));
        x += (Math.random() - 0.5) * 2.4; z += (Math.random() - 0.5) * 2.4;
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 40, 0.18, 5);
}

export class ItemFX {
    constructor(scene, effects) {
        this.scene = scene;
        this.fx = effects;
        this.projectiles = new Map();     // id -> modèle
        this.perCar = new Map();          // voiture -> accessoires
        this.flashes = [];                // ondes de choc, éclairs : durée de vie courte
    }

    car(c) {
        if (!this.perCar.has(c)) this.perCar.set(c, {});
        return this.perCar.get(c);
    }

    /** Réagit aux événements de la course (explosions, éclairs, ressorts…). */
    onEvent(e) {
        const fx = this.fx;
        switch (e.type) {
            case 'explode': {
                const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), glow(0xff8c1a, 0.8));
                shell.position.set(e.x, 1, e.z);
                const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 32).rotateX(Math.PI / 2), glow(0xffe08a, 0.7));
                ring.position.set(e.x, 0.3, e.z);
                this.scene.add(shell, ring);
                const max = e.small ? 3 : 7;
                this.flashes.push({ life: 0.6, max: 0.6, update: (k) => { const s = 1 + (1 - k) * max; shell.scale.setScalar(s); shell.material.opacity = k * 0.8; ring.scale.setScalar(s * 1.1); ring.material.opacity = k * 0.7; }, objects: [shell, ring] });
                fx.sparks(e.x, 1, e.z, e.small ? 14 : 30);
                for (let i = 0; i < (e.small ? 4 : 10); i++) fx.smoke(e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, 0, 0, 0x555555, 0.9);
                break;
            }
            case 'zap':
                for (const target of e.targets) this.bolt(target.v.x, target.v.z);
                break;
            case 'useItem': {
                const c = e.car, v = c.v;
                if (e.item === 'turbo') {
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 8, 28), glow(0xff8c1a, 0.9));
                    ring.position.set(v.x - Math.sin(v.heading) * 2, 0.8, v.z - Math.cos(v.heading) * 2);
                    ring.rotation.y = v.heading;
                    this.scene.add(ring);
                    this.flashes.push({ life: 0.45, max: 0.45, update: k => { ring.scale.setScalar(1 + (1 - k) * 3); ring.material.opacity = k; }, objects: [ring] });
                } else if (e.item === 'spring') {
                    this.car(c).springTime = 0.6;
                } else if (e.item === 'oil') {
                    fx.burst(v.x - Math.sin(v.heading) * 4, 0.8, v.z - Math.cos(v.heading) * 4);
                }
                break;
            }
            case 'blocked': {
                const p = this.car(e.car).shield;
                if (p) { p.visible = true; p.scale.setScalar(1.6); }
                this.fx.sparks(e.car.v.x, 1.2, e.car.v.z, 16);
                break;
            }
        }
    }

    /** Éclair qui tombe du ciel sur une voiture. */
    bolt(x, z) {
        const m = new THREE.Mesh(boltGeometry(40), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, toneMapped: false, transparent: true }));
        m.position.set(x, 0, z);
        const flash = new THREE.PointLight(0x9fd8ff, 60, 30);
        flash.position.set(x, 6, z);
        this.scene.add(m, flash);
        this.flashes.push({ life: 0.35, max: 0.35, update: k => { m.material.opacity = k > 0.5 ? 1 : k * 2; flash.intensity = 60 * k; }, objects: [m, flash] });
        this.fx.sparks(x, 0.8, z, 18);
    }

    /** Appelé à chaque image : place et anime tout ce qui concerne les objets. */
    sync(sim, dt, time) {
        const fx = this.fx;
        // --- Projectiles ---
        const alive = new Set();
        for (const p of sim.projectiles) {
            alive.add(p.id);
            let m = this.projectiles.get(p.id);
            if (!m) {
                m = p.kind === 'missile' ? missileModel() : p.kind === 'bomb' ? bombModel() : tornadoModel();
                this.scene.add(m);
                this.projectiles.set(p.id, m);
            }
            if (p.kind === 'missile') {
                m.position.set(p.x, ROAD_Y + 0.8 + Math.sin(time * 20) * 0.05, p.z);
                m.rotation.set(0, p.heading, time * 8);
                m.userData.flame.scale.setScalar(0.8 + Math.random() * 0.5);
                fx.flame(p.x - Math.sin(p.heading) * 1.4, 0.8, p.z - Math.cos(p.heading) * 1.4, -Math.sin(p.heading) * 6, -Math.cos(p.heading) * 6);
            } else if (p.kind === 'bomb') {
                m.position.set(p.x, ROAD_Y + p.y, p.z);
                m.rotation.x += dt * 8;
                const blink = p.life < 0.8 ? (Math.sin(time * 40) > 0 ? 1.6 : 0.6) : 1;
                m.userData.spark.scale.setScalar(blink + Math.random() * 0.3);
            } else {
                m.position.set(p.x, ROAD_Y, p.z);
                m.rotation.y += dt * 9;
                m.children.forEach((r, i) => { r.position.x = Math.sin(time * 5 + i) * 0.4; });
                if (Math.random() < 0.6) fx.smoke(p.x + (Math.random() - 0.5) * 3, p.z + (Math.random() - 0.5) * 3, 0, 0, 0xcfc6b8, 0.7);
            }
        }
        for (const [id, m] of this.projectiles) if (!alive.has(id)) { this.disposeObject(m); this.projectiles.delete(id); }

        // --- Accessoires des voitures ---
        for (const car of sim.cars) {
            const v = car.v, a = this.car(car), root = car.model.root;

            // Bouclier
            if (v.shield > 0 && !a.shield) { a.shield = shieldModel(); this.scene.add(a.shield); a.shield.scale.setScalar(0.1); }
            if (a.shield) {
                if (v.shield > 0) {
                    a.shield.position.set(root.position.x, root.position.y + 0.9, root.position.z);
                    const target = 1 + Math.sin(time * 6) * 0.03;
                    a.shield.scale.setScalar(a.shield.scale.x + (target - a.shield.scale.x) * Math.min(1, dt * 10));
                    a.shield.userData.net.rotation.y += dt * 1.2;
                    a.shield.visible = v.shield > 1 || Math.sin(time * 30) > 0;   // clignote avant de disparaître
                } else { this.disposeObject(a.shield); a.shield = null; fx.sparks(root.position.x, 1.2, root.position.z, 12); }
            }

            // Aimant sur le toit, rayon vers la cible
            if (v.magnet > 0 && !a.magnet) { a.magnet = magnetModel(); this.scene.add(a.magnet.g, a.magnet.beam); }
            if (a.magnet) {
                if (v.magnet > 0) {
                    a.magnet.g.position.set(root.position.x, root.position.y + 2.1 + Math.sin(time * 5) * 0.12, root.position.z);
                    a.magnet.g.rotation.y = root.rotation.y + Math.sin(time * 3) * 0.3;
                    const tg = car.magnetTarget;
                    if (tg) {
                        const tp = tg.model.root.position, from = a.magnet.g.position;
                        const d = from.distanceTo(tp);
                        a.magnet.beam.visible = d < 90;
                        a.magnet.beam.position.copy(from);
                        a.magnet.beam.lookAt(tp.x, tp.y + 1, tp.z);
                        a.magnet.beam.scale.set(1 + Math.sin(time * 20) * 0.3, 1, d);
                    } else a.magnet.beam.visible = false;
                } else { this.disposeObject(a.magnet.g); this.disposeObject(a.magnet.beam); a.magnet = null; car.magnetTarget = null; }
            }

            // Fantôme : la vraie voiture disparaît, une silhouette translucide la remplace
            if (v.ghost > 0) {
                if (!a.ghost) { a.ghost = buildVehicleModel(v.type, 0xffffff, { ghost: true }); this.scene.add(a.ghost.root); }
                a.ghost.root.position.copy(root.position);
                a.ghost.root.rotation.copy(root.rotation);
                a.ghost.chassis.rotation.copy(car.model.chassis.rotation);
                a.ghost.root.visible = true;
                root.visible = false;
                a.ghost.root.position.y += Math.sin(time * 4) * 0.15;
            } else if (a.ghost) { this.scene.remove(a.ghost.root); a.ghost = null; root.visible = true; }

            // Éclair : la voiture rapetisse le temps du ralentissement
            const targetScale = v.zap > 0 ? 0.62 : 1;
            a.scale = (a.scale ?? 1) + (targetScale - (a.scale ?? 1)) * Math.min(1, dt * 8);
            root.scale.setScalar(a.scale);
            if (v.zap > 0 && Math.random() < 0.25) fx.sparks(root.position.x, 0.8, root.position.z, 2);

            // Ressort qui se détend sous la voiture
            if (a.springTime > 0) {
                if (!a.spring) { a.spring = springModel(); this.scene.add(a.spring); }
                a.springTime -= dt;
                const k = 1 - a.springTime / 0.6;
                a.spring.position.set(root.position.x, ROAD_Y, root.position.z);
                a.spring.scale.set(1, Math.max(0.05, root.position.y - ROAD_Y + 0.3) * (0.6 + Math.sin(k * Math.PI * 6) * 0.1), 1);
                if (a.springTime <= 0) { this.disposeObject(a.spring); a.spring = null; }
            }

            // Étoiles qui tournent au-dessus de la tête après un choc
            if (v.spin > 0 && !a.stars) { a.stars = starsModel(); this.scene.add(a.stars); }
            if (a.stars) {
                if (v.spin > 0) {
                    a.stars.position.set(root.position.x, root.position.y + 2.2, root.position.z);
                    a.stars.children.forEach(s => {
                        const ang = s.userData.a + time * 6;
                        s.position.set(Math.cos(ang) * 0.9, Math.sin(time * 8 + s.userData.a) * 0.1, Math.sin(ang) * 0.9);
                        s.rotation.y = -ang;
                    });
                } else { this.disposeObject(a.stars); a.stars = null; }
            }
        }

        // --- Effets courts ---
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.life -= dt;
            f.update(Math.max(0, f.life / f.max));
            if (f.life <= 0) { f.objects.forEach(o => this.disposeObject(o)); this.flashes.splice(i, 1); }
        }
    }

    disposeObject(o) {
        this.scene.remove(o);
        o.traverse?.(x => { x.geometry?.dispose(); if (x.material && !x.material.isShared) x.material.dispose?.(); });
    }

    dispose() {
        for (const m of this.projectiles.values()) this.disposeObject(m);
        for (const a of this.perCar.values()) {
            for (const k of ['shield', 'spring', 'stars']) if (a[k]) this.disposeObject(a[k]);
            if (a.magnet) { this.disposeObject(a.magnet.g); this.disposeObject(a.magnet.beam); }
            if (a.ghost) this.scene.remove(a.ghost.root);
        }
        this.flashes.forEach(f => f.objects.forEach(o => this.disposeObject(o)));
        this.projectiles.clear(); this.perCar.clear(); this.flashes = [];
    }
}
