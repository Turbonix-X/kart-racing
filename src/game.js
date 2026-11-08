// ============================================================
//  Le jeu : machine à états, boucle à pas fixe, caméras et rendu.
//  États : menu · demo (écran titre) · intro (cinématique)
//          · countdown · racing · finishing · results
//  Aucun rechargement de page : tout se construit et se détruit ici.
// ============================================================
import * as THREE from 'three';
import { FIXED_DT, BOT_NAMES, BOT_COLORS, VEHICLES } from './config.js';
import { getTrack, TRACK_ORDER } from './tracks.js';
import { RaceSim, createCar } from './sim.js';
import { World, ROAD_Y } from './world.js';
import { BIOMES, BIOME_ORDER } from './biomes.js';
import { Effects } from './effects.js';
import { ItemFX } from './items3d.js';
import { buildVehicleModel, animateModel } from './models.js';
import { computeScore, medalForTime, medalForPosition } from './storage.js';

const CAMERA_MODES = ['chase', 'far', 'hood'];
const BOT_VEHICLES = ['sport', 'muscle', 'drift', 'f1', 'kart', 'truck', 'proto'];
const INTRO_TIME = 5.6;

export class Game {
    constructor({ ui, audio, input, save }) {
        this.ui = ui; this.audio = audio; this.input = input; this.save = save;
        this.state = 'menu';
        this.paused = false;
        this.acc = 0;
        this.timeScale = 1;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.renderer.setScissorTest(true);
        document.getElementById('game-canvas').appendChild(this.renderer.domElement);
        this.directorCam = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);
        this._v = new THREE.Vector3();

        window.addEventListener('resize', () => this.onResize());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
        window.addEventListener('blur', () => this.autoPause());
    }

    // ---------- Construction d'une course (réelle ou démonstration) ----------
    async build(cfg, onProgress = () => {}) {
        this.teardown();
        this.cfg = cfg;
        const track = this.track = getTrack(cfg.track);
        const biome = cfg.biome && cfg.biome !== 'auto' ? cfg.biome : track.def.biome;
        this.biomeId = biome;
        const laps = track.closed ? cfg.laps : 1;
        const cars = [];
        const botCount = cfg.bots;

        // Les joueurs partent derrière : il faut remonter le peloton
        for (let i = 0; i < botCount; i++) {
            cars.push(createCar(track, BOT_VEHICLES[(i + (cfg.shuffle ?? 0)) % BOT_VEHICLES.length], {
                slot: i, name: BOT_NAMES[i % BOT_NAMES.length], color: BOT_COLORS[i % BOT_COLORS.length], difficulty: cfg.difficulty,
            }));
        }
        cfg.players.forEach((p, i) => {
            cars.push(createCar(track, p.vehicle, { slot: botCount + i, human: true, playerIndex: i, name: p.name, color: p.color }));
        });
        const sim = new RaceSim({ track, laps, cars, mode: cfg.mode, biome });
        const humans = cars.filter(c => c.human);

        const world = await World.create(track, biome, this.renderer, { shadows: this.save.data.settings.shadows, wideShadow: humans.length === 2 }, onProgress);
        onProgress(0.95, 'Les voitures');
        const effects = new Effects(world.scene);
        const items = new ItemFX(world.scene, effects);
        for (const car of cars) {
            car.model = buildVehicleModel(car.v.type, car.color);
            car.model.root.position.set(car.v.x, ROAD_Y, car.v.z);
            car.model.root.rotation.y = car.v.heading;
            world.scene.add(car.model.root);
            car.prev = { x: car.v.x, y: car.v.y, z: car.v.z, h: car.v.heading };
            car.markL = { active: false }; car.markR = { active: false };
            if (car.human) {
                const c = new THREE.PerspectiveCamera(70, 1, 0.5, 2600);
                car.view = { cam: c, mode: 0, shake: 0, fov: 70, rect: null, snapped: false, look: new THREE.Vector3(car.v.x, 1, car.v.z) };
            }
        }
        // Les shaders sont préparés maintenant, pas pendant la course
        this.directorCam.position.set(cars[0].v.x, 20, cars[0].v.z - 30);
        this.directorCam.lookAt(cars[0].v.x, 0, cars[0].v.z);
        this.renderer.compile(world.scene, this.directorCam);
        onProgress(1, 'C\'est parti !');

        Object.assign(this, { sim, humans, world, effects, items });
        this.acc = 0; this.tick = 0; this.paused = false; this.timeScale = 1;
        this.frameSkip = true;
    }

    /** Course réelle : cinématique d'ouverture, puis décompte. */
    async startRace(cfg, onProgress) {
        await this.build(cfg, onProgress);
        const n = cfg.players.length;
        this.input.twoPlayers = n === 2;
        this.input.active = true;
        document.activeElement?.blur?.();

        this.ghost = null; this.ghostRecord = null;
        if (cfg.mode === 'tt') {
            const data = this.save.getGhost(cfg.track, cfg.players[0].vehicle, this.sim.laps);
            if (data?.length > 6) {
                const model = buildVehicleModel(cfg.players[0].vehicle, 0xffffff, { ghost: true });
                this.world.scene.add(model.root);
                this.ghost = { data, model };
            }
            this.ghostRecord = [];
        }

        this.ui.setupHud(this.humans, this.sim, this.save, cfg);
        this.onResize();
        this.countdown = 3;
        this.lastBeep = 4;
        this.goTimer = 0;
        this.introTime = 0;
        this.setState('intro');
        this.ui.showIntro({ track: this.track.name, biome: BIOMES[this.biomeId].name, laps: this.sim.laps, mode: cfg.mode });
        this.audio.setMusic('race');
        this.audio.resume();
    }

    /** Démonstration derrière l'écran titre : l'IA court, la caméra change de plan. */
    async startDemo(onProgress) {
        const unlocked = TRACK_ORDER.filter(id => id !== 'droite');
        const track = unlocked[Math.floor(Math.random() * unlocked.length)];
        const biome = BIOME_ORDER[Math.floor(Math.random() * BIOME_ORDER.length)];
        await this.build({ mode: 'race', track, biome, laps: 50, bots: 6, difficulty: 'hard', players: [], shuffle: Math.floor(Math.random() * 7) }, onProgress);
        this.humans = [];
        this.input.active = false;
        this.shot = null;
        this.setState('demo');
        this.world.setCrowdExcitement(0.3);
        this.onResize();
        this.audio.setMusic('menu');
    }

    setState(s) { this.state = s; }

    teardown() {
        if (!this.world) return;
        for (const car of this.sim.cars) car.model?.disposeOwn();
        if (this.ghost) this.world.scene.remove(this.ghost.model.root);
        this.items.dispose();
        this.effects.dispose();
        this.world.dispose();
        this.renderer.renderLists.dispose();
        this.world = null; this.sim = null; this.effects = null; this.items = null; this.ghost = null;
        this.audio.updateCar(null);
        this.input.active = false;
        this.ui.teardownHud();
    }

    quitToMenu() {
        this.teardown();
        this.setState('menu');
        this.paused = false;
        this.audio.resume();
        this.audio.setMusic('menu');
        this.renderer.setScissorTest(false);
        this.renderer.setClearColor(0x000000);
        this.renderer.clear();
        this.renderer.setScissorTest(true);
    }

    // ---------- Pause ----------
    autoPause() {
        if (['intro', 'countdown', 'racing'].includes(this.state)) this.setPaused(true);
    }
    togglePause() {
        if (['intro', 'countdown', 'racing'].includes(this.state)) this.setPaused(!this.paused);
    }
    setPaused(v) {
        if (this.paused === v) return;
        this.paused = v;
        this.input.clear();
        if (v) this.audio.pause(); else this.audio.resume();
        this.ui.showPause(v);
    }

    nextCamera() {
        for (const c of this.humans ?? []) c.view.mode = (c.view.mode + 1) % CAMERA_MODES.length;
    }

    /** Une touche ou un clic pendant la cinématique la passe. */
    skipIntro() {
        if (this.state === 'intro' && !this.paused) this.introTime = INTRO_TIME;
    }

    // ---------- Boucle ----------
    /** Appelé à chaque image. La simulation avance toujours par pas de 1/60 s, quel que soit l'écran. */
    frame(dt) {
        if (this.state === 'menu' || this.state === 'results' || !this.world) return;
        if (this.paused) return;
        if (this.frameSkip) { dt = 0; this.frameSkip = false; }

        if (this.state === 'intro') {
            this.introTime += dt;
            if (this.introTime >= INTRO_TIME) {
                this.ui.hideIntro();
                for (const c of this.humans) c.view.snapped = false;
                this.setState('countdown');
            }
        }

        if (this.state === 'countdown') {
            this.countdown -= dt;
            const shown = Math.ceil(this.countdown);
            if (shown !== this.lastBeep && shown > 0) {
                this.lastBeep = shown;
                this.audio.beep(false);
                this.ui.setCountdown(String(shown));
                this.world.setStartLights(shown === 3 ? 1 : 2);
            }
            if (this.countdown <= 0) {
                // Feu vert : « GO ! » et la voiture répond au même instant
                this.setState('racing');
                this.audio.beep(true);
                this.ui.setCountdown('GO !');
                this.world.setStartLights(3);
                this.goTimer = 0.8;
                this.world.setCrowdExcitement(0.45);
                this.crowdTimer = 4;
            }
        }

        if (this.state === 'racing' || this.state === 'demo') {
            if (this.goTimer > 0) { this.goTimer -= dt; if (this.goTimer <= 0) { this.ui.setCountdown(''); } }
            if (this.crowdTimer > 0) { this.crowdTimer -= dt; if (this.crowdTimer <= 0) { this.world.setCrowdExcitement(0.12); this.world.setStartLights(0); } }
            this.advance(dt);
        } else if (this.state === 'finishing') {
            this.finishTime += dt;
            // Ralenti au passage de la ligne, puis retour à la vitesse normale
            this.timeScale = this.finishTime < 1.4 ? 0.3 : Math.min(1, this.timeScale + dt);
            this.autoplay(dt * this.timeScale);
            if (this.finishTime >= 3.4) { this.showResults(); return; }
        }

        this.renderFrame(dt * (this.state === 'finishing' ? this.timeScale : 1));
    }

    advance(dt) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 8) {
            this.step();
            this.acc -= FIXED_DT;
            steps++;
            if (this.state !== 'racing' && this.state !== 'demo') break;
        }
        if (steps === 8) this.acc = 0;    // machine trop lente : on ralentit plutôt que de bondir
    }

    savePrev() {
        for (const car of this.sim.cars) {
            const p = car.prev, v = car.v;
            p.x = v.x; p.y = v.y; p.z = v.z; p.h = v.heading;
        }
    }

    step() {
        const sim = this.sim;
        this.savePrev();
        const inputs = [];
        for (const c of this.humans) inputs[c.playerIndex] = this.input.read(c.playerIndex);
        sim.step(FIXED_DT, inputs);
        this.tick++;
        this.processEvents();
        this.emitEffects();

        if (this.ghostRecord && this.tick % 6 === 0 && this.ghostRecord.length < 18000) {
            const v = this.humans[0].v;
            this.ghostRecord.push(Math.round(v.x * 10), Math.round(v.z * 10), Math.round(v.heading * 100));
        }
        if (sim.finished && this.state === 'racing') {
            this.setState('finishing');
            this.finishTime = 0;
            this.results = this.computeResults();
            this.ui.showFinishBanner(this.results);
        }
    }

    /** Après l'arrivée, l'IA prend le volant. */
    autoplay(dt) {
        this.acc += dt;
        const sim = this.sim;
        sim.finished = false;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 8) {
            this.savePrev();
            sim.step(FIXED_DT, []);
            this.acc -= FIXED_DT;
            steps++;
            this.tick++;
            this.emitEffects();
        }
        sim.finished = true;
        for (const e of sim.events) this.items.onEvent(e);
        sim.events.length = 0;
    }

    processEvents() {
        const a = this.audio, ui = this.ui;
        for (const e of this.sim.events) {
            const car = e.car;
            const me = car?.human;
            this.items.onEvent(e);
            switch (e.type) {
                case 'lap':
                    if (me) {
                        a.lap();
                        const best = this.save.getBestLap(this.cfg.track, car.v.type);
                        ui.lapToast(car.playerIndex, e.lapTime, best, e.lap, this.sim.laps);
                    }
                    break;
                case 'finish':
                    if (me) {
                        a.finish();
                        this.effects.confetti(car.v.x, car.v.z);
                        this.world.setCrowdExcitement(0.5);
                        this.crowdTimer = 0;
                        const others = this.humans.filter(c => !c.finished);
                        if (!others.length || this.humans.length === 1) a.updateCar(null);
                        ui.toast(car.playerIndex, 'Arrivée !', 'gold');
                    }
                    break;
                case 'pad': if (me) a.boost(); break;
                case 'driftBoost':
                    if (me) { a.boost(); ui.toast(car.playerIndex, e.tier === 2 ? 'Super boost !' : 'Boost !', 'boost'); }
                    break;
                case 'crash': case 'bump':
                    if (me) { a.crash(e.power); car.view.shake = Math.min(0.9, car.view.shake + e.power * 0.03); }
                    this.effects.sparks(car.v.x, 0.7, car.v.z, Math.min(16, 4 + Math.floor(e.power)));
                    break;
                case 'pickup':
                    this.effects.burst(e.x, 1.5, e.z);
                    if (me) { a.pickup(); ui.setItem(car.playerIndex, e.item); }
                    break;
                case 'useItem':
                    if (me) {
                        ui.setItem(car.playerIndex, null);
                        if (e.item === 'turbo' || e.item === 'spring') a.boost(); else a.useItem();
                    }
                    break;
                case 'hit':
                    if (me) { a.spin(); car.view.shake = 0.7; ui.toast(car.playerIndex, 'Touché !', 'bad'); }
                    if (e.by?.human) ui.toast(e.by.playerIndex, `Bien visé : ${car.name} !`, 'good');
                    break;
                case 'zapped': if (me) { a.spin(); ui.toast(car.playerIndex, 'Foudroyé !', 'bad'); } break;
                case 'blocked': if (me) ui.toast(car.playerIndex, 'Bloqué !', 'good'); break;
                case 'explode': {
                    a.crash(14);
                    for (const h of this.humans) {
                        const d = Math.hypot(h.v.x - e.x, h.v.z - e.z);
                        if (d < 40) h.view.shake = Math.min(1, h.view.shake + (40 - d) * 0.02);
                    }
                    break;
                }
                case 'cone': if (me) a.land(); break;
                case 'spin': if (me) { a.spin(); ui.toast(car.playerIndex, 'Glissade !', 'bad'); } break;
                case 'jump': case 'ramp': case 'hop': if (me) a.jump(); break;
                case 'land': if (me) { a.land(); car.view.shake = Math.min(0.5, car.view.shake + e.power * 0.02); } break;
                case 'respawn':
                    if (me) ui.toast(car.playerIndex, 'Retour sur la piste', 'info');
                    car.markL.active = false; car.markR.active = false;
                    car.prev.x = car.v.x; car.prev.z = car.v.z; car.prev.h = car.v.heading;
                    break;
            }
        }
        this.sim.events.length = 0;
    }

    emitEffects() {
        const fx = this.effects;
        for (const car of this.sim.cars) {
            const v = car.v, sinH = Math.sin(v.heading), cosH = Math.cos(v.heading), m = car.model;
            const wx = m.rearX, wz = m.rearZ;
            const lx = v.x + sinH * wz + cosH * wx, lz = v.z + cosH * wz - sinH * wx;
            const rx = v.x + sinH * wz - cosH * wx, rz = v.z + cosH * wz + sinH * wx;
            const slide = Math.abs(v.lateral) > 7 || v.drifting;
            const hardBrake = v.braking && v.speed > 25;
            const grounded = v.y <= 0;

            // Retour de flamme quand on lâche l'accélérateur à haut régime
            const lifted = car.wasThrottle && !v.throttle && v.speed > v.spec.topSpeed * 0.55;
            car.wasThrottle = v.throttle > 0;
            if (lifted) {
                fx.backfire(v.x + sinH * m.tail, 0.42 + v.y, v.z + cosH * m.tail, -sinH, -cosH);
                if (car.human) this.audio.backfire();
            }

            if (grounded && v.onRoad && (slide || hardBrake)) {
                fx.addMark(car.markL, lx, lz, sinH, cosH);
                fx.addMark(car.markR, rx, rz, sinH, cosH);
            } else {
                car.markL.active = false; car.markR.active = false;
            }

            if (grounded) {
                if (v.onRoad && slide && this.tick % 2 === 0) {
                    const tier = v.driftCharge >= 1.5 ? 0xff8a3c : v.driftCharge >= 0.7 ? 0x6dffa8 : 0xe8e8e8;
                    fx.smoke(lx, lz, v.vx, v.vz, tier);
                    fx.smoke(rx, rz, v.vx, v.vz, tier);
                } else if (!v.onRoad && Math.abs(v.speed) > 6 && this.tick % 3 === 0) {
                    const c = this.world.biome.groundAlt;
                    fx.smoke(lx, lz, v.vx, v.vz, c, 0.55);
                    fx.smoke(rx, rz, v.vx, v.vz, c, 0.55);
                }
            }
            if (v.boost > 0) {
                const tx = v.x + sinH * m.tail, tz = v.z + cosH * m.tail;
                fx.flame(tx + cosH * 0.35, 0.45 + v.y, tz - sinH * 0.35, v.vx - sinH * 8, v.vz - cosH * 8);
                fx.flame(tx - cosH * 0.35, 0.45 + v.y, tz + sinH * 0.35, v.vx - sinH * 8, v.vz - cosH * 8);
            }
        }
    }

    // ---------- Rendu ----------
    renderFrame(dt) {
        const frozen = this.state === 'intro' || this.state === 'countdown';
        const alpha = frozen ? 1 : Math.min(1, this.acc / FIXED_DT);
        const sim = this.sim;
        for (const car of sim.cars) {
            const p = car.prev, v = car.v, r = car.model.root;
            r.position.set(p.x + (v.x - p.x) * alpha, ROAD_Y + p.y + (v.y - p.y) * alpha, p.z + (v.z - p.z) * alpha);
            r.rotation.y = p.h + (v.heading - p.h) * alpha;
            animateModel(car.model, v, dt);
        }
        if (this.ghost) this.updateGhost();

        this.effects.update(dt);
        this.items.sync(sim, dt, this.world._time);

        // Caméra principale : celle du joueur 1, ou celle du réalisateur
        const views = this.humans.length && this.state !== 'intro' ? this.humans.map(c => { this.updateCamera(c, dt); return c.view; }) : [this.directorView(dt)];
        this.world.update(dt, sim, views[0].cam.position);

        const focus = this.humans.length ? this.humans : [this.shot?.car ?? sim.cars[0]];
        let fx = 0, fz = 0;
        for (const c of focus) { fx += c.model.root.position.x; fz += c.model.root.position.z; }
        this.world.followShadow(fx / focus.length, fz / focus.length);
        this.renderer.shadowMap.needsUpdate = true;

        const H = this.renderer.domElement.clientHeight;
        for (const view of views) {
            const { rect, cam } = view;
            const y = H - rect.y - rect.h;
            this.renderer.setViewport(rect.x, y, rect.w, rect.h);
            this.renderer.setScissor(rect.x, y, rect.w, rect.h);
            this.world.sky.position.copy(cam.position);
            this.renderer.render(this.world.scene, cam);
        }

        if (this.state === 'demo') { this.audio.updateCar(null); return; }
        // Son : on écoute le joueur 1 tant qu'il court
        const listener = this.humans.find(c => !c.finished);
        if (this.state === 'racing' && listener) this.audio.updateCar(listener.v);
        else this.audio.updateCar(null);

        if (this.state !== 'intro') {
            this.ui.updateHud(this.humans, sim, this.state);
            if (this.tick % 3 === 0) this.ui.drawMinimap(sim, this.humans);
        }
    }

    // ---------- Réalisateur : cinématiques et démonstration ----------
    /** Caméra plein écran pour la cinématique d'ouverture et l'écran titre. */
    directorView(dt) {
        const cam = this.directorCam, W = window.innerWidth, H = window.innerHeight;
        const rect = { x: 0, y: 0, w: W, h: H };
        if (cam.aspect !== W / H) { cam.aspect = W / H; cam.updateProjectionMatrix(); }
        if (this.state === 'intro') this.introCamera(cam);
        else this.demoCamera(cam, dt);
        return { cam, rect };
    }

    /** Ouverture en trois plans : survol du circuit, travelling sur la grille, descente derrière le joueur. */
    introCamera(cam) {
        const t = this.introTime, track = this.track, player = this.humans[0], root = player.model.root;
        const ease = x => x * x * (3 - 2 * x);
        if (t < 2.4) {
            // Plan 1 : un drone remonte la piste jusqu'à la grille
            const k = ease(t / 2.4);
            const s = track.startS + 260 * (1 - k) + 20;
            const p = track.pointAt(track.closed ? s % track.length : Math.min(track.length - 1, s), 0);
            const ahead = track.pointAt(track.closed ? (s - 40 + track.length) % track.length : Math.max(0, s - 40), 0);
            cam.position.set(p.x, 34 - k * 18, p.z);
            cam.lookAt(ahead.x, 0, ahead.z);
            cam.fov = 55;
        } else if (t < 4.4) {
            // Plan 2 : travelling au ras du sol le long de la grille
            const k = ease((t - 2.4) / 2);
            const sGrid = track.startS - 6 - k * 34;
            const s = track.closed ? (sGrid + track.length) % track.length : Math.max(1, sGrid);
            const p = track.pointAt(s, 0);
            const side = track.pointAt(s, p.width + 2.5);
            cam.position.set(side.x, 1.4, side.z);
            cam.lookAt(p.x, 0.9, p.z);
            cam.fov = 50;
        } else {
            // Plan 3 : la grue descend derrière le joueur
            const k = ease(Math.min(1, (t - 4.4) / 1.2));
            const h = root.rotation.y;
            const dist = 14 - k * 6.8, height = 10 - k * 7;
            cam.position.set(root.position.x - Math.sin(h) * dist, root.position.y + height, root.position.z - Math.cos(h) * dist);
            cam.lookAt(root.position.x + Math.sin(h) * 6, 1, root.position.z + Math.cos(h) * 6);
            cam.fov = 60 + k * 6;
        }
        cam.updateProjectionMatrix();
    }

    /** Démonstration : un plan différent toutes les 5 secondes, sur une voiture au hasard. */
    demoCamera(cam, dt) {
        const sim = this.sim, track = this.track;
        if (!this.shot || this.shot.time > this.shot.len) {
            const kinds = ['chase', 'trackside', 'heli', 'front', 'wheel'];
            const car = sim.order[Math.floor(Math.random() * Math.min(4, sim.cars.length))];
            this.shot = { kind: kinds[Math.floor(Math.random() * kinds.length)], car, time: 0, len: 4.5 + Math.random() * 2.5, spot: null };
            this.ui.flashCut?.();
        }
        const shot = this.shot;
        shot.time += dt;
        const root = shot.car.model.root, h = root.rotation.y, p = root.position;
        const sinH = Math.sin(h), cosH = Math.cos(h);
        const target = this._v;
        switch (shot.kind) {
            case 'chase':
                target.set(p.x - sinH * 8, p.y + 3, p.z - cosH * 8);
                cam.position.lerp(target, shot.time < 0.05 ? 1 : 1 - Math.exp(-dt * 6));
                cam.lookAt(p.x + sinH * 6, 1, p.z + cosH * 6);
                cam.fov = 64;
                break;
            case 'trackside':
                if (!shot.spot) {
                    const s = (shot.car.nav.s + 70) % track.length;
                    const q = track.pointAt(s, (track.pointAt(s, 0).width + 4) * (Math.random() < 0.5 ? 1 : -1));
                    shot.spot = new THREE.Vector3(q.x, 1.3, q.z);
                }
                cam.position.copy(shot.spot);
                cam.lookAt(p.x, 0.9, p.z);
                cam.fov = 38;
                break;
            case 'heli': {
                const a = shot.time * 0.35;
                cam.position.set(p.x + Math.cos(a) * 26, 18, p.z + Math.sin(a) * 26);
                cam.lookAt(p.x, 0, p.z);
                cam.fov = 50;
                break;
            }
            case 'front':
                cam.position.set(p.x + sinH * 7 + cosH * 2, p.y + 1.1, p.z + cosH * 7 - sinH * 2);
                cam.lookAt(p.x, 0.8, p.z);
                cam.fov = 58;
                break;
            case 'wheel':
                cam.position.set(p.x + cosH * 3.2 - sinH * 2, 0.6, p.z - sinH * 3.2 - cosH * 2);
                cam.lookAt(p.x + sinH * 4, 0.6, p.z + cosH * 4);
                cam.fov = 70;
                break;
        }
        cam.updateProjectionMatrix();
    }

    updateGhost() {
        const { data, model } = this.ghost;
        const t = this.sim.time * 10, i = Math.floor(t);
        const a = i * 3, b = a + 3;
        if (b + 2 >= data.length) { model.root.visible = false; return; }
        const f = t - i;
        model.root.visible = true;
        model.root.position.set((data[a] + (data[b] - data[a]) * f) / 10, ROAD_Y, (data[a + 1] + (data[b + 1] - data[a + 1]) * f) / 10);
        model.root.rotation.y = (data[a + 2] + (data[b + 2] - data[a + 2]) * f) / 100;
    }

    updateCamera(car, dt) {
        const view = car.view, cam = view.cam, v = car.v, root = car.model.root;
        const mode = CAMERA_MODES[view.mode];
        const k = 1 - Math.exp(-dt * 7);

        if (this.state === 'finishing' || (car.finished && this.state !== 'racing')) {
            const t = this.finishTime ?? 0;
            if (t < 1.4) {
                // Ralenti : caméra posée devant la voiture, au ras du sol
                if (!view.finishSpot) {
                    const h = root.rotation.y;
                    view.finishSpot = new THREE.Vector3(root.position.x + Math.sin(h) * 14 + Math.cos(h) * 3, 1, root.position.z + Math.cos(h) * 14 - Math.sin(h) * 3);
                }
                cam.position.copy(view.finishSpot);
                cam.fov = 45;
            } else {
                const a = t * 0.5;
                const px = root.position.x + Math.cos(a) * 10, pz = root.position.z + Math.sin(a) * 10;
                cam.position.x += (px - cam.position.x) * k * 0.6;
                cam.position.y += (4 - cam.position.y) * k * 0.6;
                cam.position.z += (pz - cam.position.z) * k * 0.6;
                cam.fov = 60;
            }
            cam.updateProjectionMatrix();
            cam.lookAt(root.position.x, 0.9, root.position.z);
            return;
        }
        view.finishSpot = null;

        const heading = root.rotation.y;
        const sinH = Math.sin(heading), cosH = Math.cos(heading);
        const speed = Math.abs(v.speed), ratio = Math.min(1.3, speed / v.spec.topSpeed);

        // La caméra suit le cap et la direction réelle du mouvement en virage ou en drift
        let bx = sinH, bz = cosH;
        if (speed > 8) {
            const l = Math.hypot(v.vx, v.vz) || 1;
            const sgn = v.speed >= 0 ? 1 : -1;
            bx = sinH * 0.72 + (v.vx / l) * sgn * 0.28;
            bz = cosH * 0.72 + (v.vz / l) * sgn * 0.28;
            const n = Math.hypot(bx, bz) || 1; bx /= n; bz /= n;
        }

        let dist, height, lookAhead, lookY;
        if (mode === 'hood') {
            dist = -0.6; height = 1.15 + (v.type === 'truck' ? 1.2 : 0); lookAhead = 20; lookY = 0.9;
        } else if (mode === 'far') {
            dist = 15 + ratio * 3; height = 7.5; lookAhead = 10; lookY = 1;
        } else {
            dist = 7.2 + ratio * 2; height = 3 + ratio * 0.45; lookAhead = 6 + ratio * 8; lookY = 1;
        }

        const tx = root.position.x - bx * dist, tz = root.position.z - bz * dist, ty = root.position.y + height;
        if (!view.snapped || mode === 'hood') {
            if (!view.snapped && this.state === 'countdown') {
                // Raccord avec la fin de la cinématique
                cam.position.copy(this.directorCam.position);
            } else cam.position.set(tx, ty, tz);
            view.look.set(root.position.x + bx * lookAhead, lookY, root.position.z + bz * lookAhead);
            view.snapped = true;
        }
        const kPos = 1 - Math.exp(-dt * 11);
        cam.position.x += (tx - cam.position.x) * kPos;
        cam.position.y += (ty - cam.position.y) * kPos;
        cam.position.z += (tz - cam.position.z) * kPos;
        view.look.x += (root.position.x + bx * lookAhead - view.look.x) * kPos;
        view.look.y += (lookY + root.position.y * 0.5 - view.look.y) * kPos;
        view.look.z += (root.position.z + bz * lookAhead - view.look.z) * kPos;

        // Sensation de vitesse et secousses (chocs, atterrissages, turbo)
        const targetFov = (mode === 'hood' ? 78 : 66) + ratio * 15 + (v.boost > 0 ? 7 : 0);
        view.fov += (targetFov - view.fov) * (1 - Math.exp(-dt * 4));
        cam.fov = view.fov;
        cam.updateProjectionMatrix();

        const boostShake = v.boost > 0 ? 0.035 : 0;
        const sh = view.shake + boostShake;
        if (sh > 0.001) {
            cam.position.x += (Math.random() - 0.5) * sh;
            cam.position.y += (Math.random() - 0.5) * sh;
            cam.position.z += (Math.random() - 0.5) * sh;
        }
        view.shake *= Math.exp(-dt * 6);
        cam.lookAt(view.look);
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.renderer.setSize(w, h);
        if (!this.humans?.length || !this.world) return;
        const rects = [];
        if (this.humans.length === 1) rects.push({ x: 0, y: 0, w, h });
        else if (w >= h) { rects.push({ x: 0, y: 0, w: Math.floor(w / 2) - 1, h }, { x: Math.ceil(w / 2) + 1, y: 0, w: Math.floor(w / 2) - 1, h }); }
        else { rects.push({ x: 0, y: 0, w, h: Math.floor(h / 2) - 1 }, { x: 0, y: Math.ceil(h / 2) + 1, w, h: Math.floor(h / 2) - 1 }); }
        this.humans.forEach((c, i) => {
            c.view.rect = rects[i];
            c.view.cam.aspect = rects[i].w / rects[i].h;
            c.view.cam.updateProjectionMatrix();
        });
        this.ui.layoutHud(rects);
        if (this.paused) this.renderFrame(0);
    }

    // ---------- Résultats ----------
    computeResults() {
        const sim = this.sim, cfg = this.cfg, track = this.track;
        const out = { players: [], unlocked: [], laps: sim.laps };

        for (const c of this.humans) {
            const stats = { ...c.stats };
            const entry = {
                name: c.name, vehicle: c.v.type, time: c.finishTime, lapTimes: c.lapTimes, position: c.position,
                bestLap: Math.min(...c.lapTimes), topSpeed: stats.topSpeed, stats, medal: null,
            };
            entry.score = track.id === 'droite' ? computeScore(c.finishTime, stats.topSpeed, stats) : null;

            // Un seul joueur humain : course et chrono comptent pour les médailles
            if (this.humans.length === 1) {
                const ghost = cfg.mode === 'tt' ? this.ghostRecord : null;
                const saved = this.save.saveRun({ track: track.id, car: c.v.type, laps: sim.laps, time: c.finishTime, lapTimes: c.lapTimes, score: entry.score, ghost });
                Object.assign(entry, saved);
                entry.medal = cfg.mode === 'tt'
                    ? medalForTime(c.finishTime, track.def.par, sim.laps)
                    : medalForPosition(c.position, cfg.bots);
                out.unlocked.push(...this.save.awardMedal(track.id, entry.medal));
            }
            entry.record = this.save.getRecord(track.id, c.v.type, sim.laps);
            entry.recordLap = this.save.getBestLap(track.id, c.v.type);
            entry.recordScore = this.save.getScore(track.id, c.v.type);
            out.players.push(entry);
        }

        out.ranking = sim.order.map(c => ({
            name: c.name, vehicle: c.v.type, human: c.human, finished: c.finished, time: c.finishTime,
            gap: c.finished ? 0 : Math.max(0, sim.totalLen - c.maxDist),
        }));
        out.mode = cfg.mode;
        out.trackName = track.name;
        out.biomeName = BIOMES[this.biomeId].name;
        return out;
    }

    showResults() {
        this.setState('results');
        this.timeScale = 1;
        this.world.setCrowdExcitement(0.12);
        this.audio.updateCar(null);
        this.audio.setMusic('menu');
        this.ui.hideRaceUi();
        this.ui.showResults(this.results, this.cfg);
    }
}

export { VEHICLES };
