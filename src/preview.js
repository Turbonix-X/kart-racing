// Vitrine 3D du menu : un plateau lumineux qui tourne, le véhicule y atterrit à chaque choix.
import * as THREE from 'three';
import { buildVehicleModel } from './models.js';

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Studio virtuel : de grands panneaux lumineux, pour de longs reflets sur la peinture. */
function studioEnvironment(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x0c0a14);
    const panel = (w, h, color, power, x, y, z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        s.add(m);
    };
    panel(24, 8, 0xffffff, 6, 0, 16, 0);
    panel(5, 18, 0xffffff, 5, 15, 5, 10);
    panel(5, 18, 0xffffff, 3.2, -15, 5, 10);
    panel(18, 5, 0x22c55e, 5, -8, 3, -16);
    panel(18, 5, 0xff8c1a, 3.6, 10, 2, -14);
    const rt = pm.fromScene(s, 0.025);
    pm.dispose();
    s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    return rt;
}

export class Preview {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.env = studioEnvironment(this.renderer);
        this.scene.environment = this.env.texture;
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(4, 8, 5);
        this.scene.add(key);

        // Plateau tournant
        this.pivot = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.85, 0.16, 64), new THREE.MeshStandardMaterial({ color: 0x17141f, metalness: 0.85, roughness: 0.28 }));
        disc.position.y = -0.09;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.022, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8c1a, toneMapped: false }));
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.012, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x22c55e, toneMapped: false }));
        this.pivot.add(disc, ring, ring2);
        this.scene.add(this.pivot);

        this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        this.camera.position.set(0, 1.9, this.baseDist = 7.6);
        this.camera.lookAt(0, 0.55, 0);
        this.time = 0;
        this.landing = 1;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const w = this.container.clientWidth, h = this.container.clientHeight;
        if (!w || !h) return;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        // Sur un écran étroit, on recule pour que la voiture rentre entière
        this.camera.position.z = this.baseDist * Math.max(1, 1.9 / (w / h));
        this.camera.updateProjectionMatrix();
    }

    /** Change de véhicule. Seul un changement de modèle rejoue l'atterrissage. */
    show(type, color) {
        if (this.model && this.type === type) {
            this.model.bodyMat.color.setHex(color);
            this.flash = 1;
            return;
        }
        if (this.model) {
            this.pivot.remove(this.model.root);
            this.model.disposeOwn();
        }
        this.type = type;
        // Vitrine : la voiture seule, sans pilote
        this.model = buildVehicleModel(type, color, { driver: false });
        this.pivot.add(this.model.root);
        this.landing = reduced ? 1 : 0;
    }

    /** Vignettes des véhicules pour le menu : rendues une fois, sans fond. */
    renderThumbnails(types, color) {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        r.setPixelRatio(1);
        r.setSize(220, 130);
        r.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        scene.environment = this.env.texture;
        const light = new THREE.DirectionalLight(0xffffff, 1.8);
        light.position.set(4, 8, 5);
        scene.add(light);
        const cam = new THREE.PerspectiveCamera(26, 220 / 130, 0.1, 100);
        const out = {};
        for (const type of types) {
            const m = buildVehicleModel(type, color, { driver: false });
            m.root.rotation.y = -0.65;
            scene.add(m.root);
            const box = new THREE.Box3().setFromObject(m.root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
            const dist = Math.max(size.x, size.z) * 1.85 + 1.5;
            cam.position.set(c.x + dist * 0.15, c.y + dist * 0.42, c.z + dist);
            cam.lookAt(c.x, c.y * 0.8, c.z);
            r.render(scene, cam);
            out[type] = r.domElement.toDataURL('image/png');
            scene.remove(m.root);
            m.disposeOwn();
        }
        r.dispose();
        r.forceContextLoss?.();
        return out;
    }

    frame(dt) {
        if (!this.model) return;
        if (this.container.clientWidth !== this.renderer.domElement.clientWidth) this.resize();
        this.time += dt;
        this.pivot.rotation.y += dt * (reduced ? 0.15 : 0.42);

        // Atterrissage : descend, rebondit, puis se pose
        const root = this.model.root;
        if (this.landing < 1) {
            this.landing = Math.min(1, this.landing + dt * 1.5);
            const t = this.landing;
            const fall = Math.pow(1 - t, 3) * 3;
            const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * (1 - t) * 0.55;
            root.position.y = fall + bounce;
            const squash = 1 + Math.sin(t * Math.PI * 3) * (1 - t) * 0.08;
            root.scale.set(1 / squash, squash, 1 / squash);
            root.rotation.y = (1 - t) * (1 - t) * 2.4;
        } else {
            root.position.y = 0;
            root.scale.setScalar(1);
            root.rotation.y = 0;
        }
        // Roues qui tournent lentement, suspension qui respire
        const wheelSpin = this.time * 1.4;
        for (const w of this.model.wheels) {
            w.spin.rotation.x = w.side.rotation.y ? -wheelSpin : wheelSpin;
            if (w.front) w.pivot.rotation.y = Math.sin(this.time * 0.8) * 0.3;
        }
        this.model.chassis.position.y = Math.sin(this.time * 2) * 0.008;
        this.model.chassis.rotation.z = Math.sin(this.time * 1.2) * 0.008;
        this.renderer.render(this.scene, this.camera);
    }
}
