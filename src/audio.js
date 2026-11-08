// ============================================================
//  Son entièrement synthétisé : moteur, musiques, effets.
//  Trois niveaux séparés (musique, effets, général) pour que
//  rien n'écrase le reste et que le joueur puisse tout régler.
// ============================================================

const NOTE = 0.1875;       // double-croche à 80 bpm en 16 pas par mesure ≈ boucle de 3 s

const PATTERNS = {
    race: {
        bass: [55, 0, 55, 55, 73.4, 0, 73.4, 65.4, 55, 0, 55, 55, 82.4, 0, 73.4, 65.4],
        lead: [220, 0, 261.6, 293.7, 220, 0, 329.6, 293.7, 220, 0, 261.6, 293.7, 349.2, 329.6, 293.7, 261.6],
        kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
        hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
        leadType: 'square', step: NOTE,
    },
    menu: {
        bass: [65.4, 0, 0, 0, 98, 0, 0, 0, 87.3, 0, 0, 0, 98, 0, 0, 0],
        lead: [261.6, 0, 329.6, 0, 392, 0, 329.6, 0, 349.2, 0, 440, 0, 392, 0, 329.6, 293.7],
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        leadType: 'triangle', step: 0.26,
    },
};

export class AudioEngine {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.mode = 'menu';
        this.timer = null;
        this.step = 0;
    }

    /** À appeler lors d'une action du joueur : les navigateurs bloquent le son avant. */
    unlock() {
        if (this.ctx) { if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();

        this.master = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        this.master.connect(limiter); limiter.connect(ctx.destination);
        this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
        this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
        this.applyVolumes();

        // Bruit blanc réutilisé par les effets
        const len = ctx.sampleRate * 2;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        this.buildEngine();
        this.skid = this.loopNoise('bandpass', 1300, 3);
        this.gravel = this.loopNoise('lowpass', 480, 0.8);

        this.nextTime = ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 120);
    }

    applyVolumes() {
        if (!this.ctx) return;
        const s = this.settings, t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.02);
        this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.02);
        this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.02);
    }

    buildEngine() {
        const ctx = this.ctx;
        const filter = this.engFilter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 300; filter.Q.value = 2;
        const gain = this.engGain = ctx.createGain();
        gain.gain.value = 0;
        filter.connect(gain); gain.connect(this.sfxBus);
        this.engOsc = [['sawtooth', 1, 0.5], ['square', 0.5, 0.3], ['sawtooth', 2.01, 0.14]].map(([type, ratio, vol]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type; o.frequency.value = 60; g.gain.value = vol;
            o.connect(g); g.connect(filter); o.start();
            return { o, ratio };
        });
    }

    loopNoise(type, freq, q) {
        const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise; src.loop = true;
        f.type = type; f.frequency.value = freq; f.Q.value = q;
        g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.sfxBus);
        src.start();
        return g;
    }

    setMusic(mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        this.step = 0;
    }

    schedule() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.03;
        while (this.nextTime < ctx.currentTime + 0.35) {
            const p = PATTERNS[this.mode], i = this.step % 16, t = this.nextTime;
            if (p.bass[i]) this.note('square', p.bass[i], t, p.step * 0.9, 0.22, this.musicBus);
            if (p.lead[i]) this.note(p.leadType, p.lead[i], t, p.step * 0.85, 0.09, this.musicBus);
            if (p.kick[i]) this.kick(t);
            if (p.hat[i]) this.noiseHit(t, 0.03, 7000, 0.05, this.musicBus, 'highpass');
            this.step++;
            this.nextTime += p.step;
        }
    }

    note(type, freq, t, dur, vol, bus) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + 0.02);
    }
    kick(t) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(35, t + 0.09);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g); g.connect(this.musicBus);
        o.start(t); o.stop(t + 0.16);
    }
    noiseHit(t, dur, freq, vol, bus, type = 'lowpass') {
        const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this.noise;
        s.loop = true;
        f.type = type; f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(t, Math.random()); s.stop(t + dur + 0.02);
    }

    /** Moteur et bruits de roulement du véhicule écouté. Passer null coupe tout. */
    updateCar(v) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        if (!v) {
            this.engGain.gain.setTargetAtTime(0, t, 0.12);
            this.skid.gain.setTargetAtTime(0, t, 0.08);
            this.gravel.gain.setTargetAtTime(0, t, 0.08);
            return;
        }
        // Boîte de vitesses simulée : le régime redescend à chaque rapport
        const ratio = Math.min(1.25, Math.abs(v.speed) / v.spec.topSpeed);
        const gears = 5, g = Math.min(gears - 1, Math.floor(ratio * gears));
        const inGear = ratio * gears - g;
        const rpm = 0.34 + inGear * 0.5 + g * 0.05 + (v.boost > 0 ? 0.12 : 0);
        const freq = 48 + rpm * 118;
        for (const e of this.engOsc) e.o.frequency.setTargetAtTime(freq * e.ratio, t, 0.03);
        this.engFilter.frequency.setTargetAtTime(240 + rpm * 1700, t, 0.05);
        this.engGain.gain.setTargetAtTime(0.13 + rpm * 0.1, t, 0.05);
        const sliding = v.drifting || Math.abs(v.lateral) > 8;
        this.skid.gain.setTargetAtTime(sliding && v.y <= 0 ? 0.13 : 0, t, 0.05);
        this.gravel.gain.setTargetAtTime(!v.onRoad && v.y <= 0 ? Math.min(0.28, Math.abs(v.speed) * 0.012) : 0, t, 0.06);
    }

    // ---------- Effets ponctuels ----------
    _now() { return this.ctx && this.ctx.state === 'running' ? this.ctx.currentTime : null; }
    beep(high) { const t = this._now(); if (t != null) this.note('square', high ? 880 : 440, t, high ? 0.5 : 0.22, 0.28, this.sfxBus); }
    lap() { const t = this._now(); if (t == null) return; [659, 880].forEach((f, i) => this.note('square', f, t + i * 0.09, 0.18, 0.2, this.sfxBus)); }
    finish() { const t = this._now(); if (t == null) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.note('square', f, t + i * 0.12, 0.26, 0.22, this.sfxBus)); }
    crash(power) { const t = this._now(); if (t != null) this.noiseHit(t, 0.28, 900, Math.min(0.75, 0.15 + power * 0.02), this.sfxBus); }
    boost() {
        const t = this._now(); if (t == null) return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(860, t + 0.35);
        g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.44);
        this.noiseHit(t, 0.4, 2600, 0.2, this.sfxBus, 'bandpass');
    }
    pickup() { const t = this._now(); if (t == null) return; [784, 988, 1319].forEach((f, i) => this.note('triangle', f, t + i * 0.05, 0.12, 0.2, this.sfxBus)); }
    useItem() { const t = this._now(); if (t != null) this.note('triangle', 520, t, 0.15, 0.2, this.sfxBus); }
    spin() { const t = this._now(); if (t != null) this.noiseHit(t, 0.6, 1800, 0.3, this.sfxBus, 'bandpass'); }
    jump() { const t = this._now(); if (t == null) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.16); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.2); }
    land() { const t = this._now(); if (t != null) this.noiseHit(t, 0.16, 280, 0.45, this.sfxBus); }
    backfire() { const t = this._now(); if (t != null) { this.noiseHit(t, 0.07, 420, 0.32, this.sfxBus); this.noiseHit(t + 0.08, 0.05, 520, 0.2, this.sfxBus); } }
    click() { const t = this._now(); if (t != null) this.note('square', 660, t, 0.05, 0.08, this.sfxBus); }

    pause() { this.paused = true; if (this.ctx?.state === 'running') this.ctx.suspend(); }
    resume() { this.paused = false; if (this.ctx?.state === 'suspended') this.ctx.resume(); }
}
