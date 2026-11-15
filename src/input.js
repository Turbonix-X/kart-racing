// ============================================================
//  Commandes : clavier, manettes et tactile fusionnés en une seule
//  structure par joueur. Le reste du jeu ne voit jamais les touches.
//  e.code = position physique de la touche : ZQSD sur AZERTY,
//  WASD sur QWERTY, sans rien configurer. Ctrl n'est plus utilisé
//  (Ctrl+W fermerait l'onglet en pleine course).
//  À deux joueurs, chacun a son appareil : clavier + clavier,
//  clavier + manette, manette + clavier ou deux manettes.
// ============================================================

const SOLO = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    drift: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], item: ['KeyE'], respawn: ['KeyR'],
};
const P1 = {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    drift: ['ShiftLeft'], jump: ['Space'], item: ['KeyE'], respawn: ['KeyR'],
};
const P2 = {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    drift: ['ShiftRight'], jump: ['Enter'], item: ['KeyL'], respawn: ['KeyK'],
};
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'Enter', 'Tab']);

export const SCHEMES = {
    'kb-kb': 'Clavier + clavier',
    'kb-pad': 'Clavier (J1) + manette (J2)',
    'pad-kb': 'Manette (J1) + clavier (J2)',
    'pad-pad': 'Deux manettes',
};
const TAP = 220;          // ms : un appui court sur R replace sur la piste, un appui long regarde derrière
const DEAD = 0.16;        // zone morte du stick

export class Input {
    constructor() {
        this.keys = new Set();
        this.touch = { steer: 0, gas: false, brake: false, drift: false, jump: false, item: false, rear: false };
        this.active = false;             // vrai pendant la course : on bloque alors le défilement, etc.
        this.players = 1;
        this.scheme = 'kb-kb';
        this.handlers = {};
        this.states = [this.blank(), this.blank()];
        this.lastDevice = 'kb';
        this.isTouch = false;
        this._edges = {};

        window.addEventListener('keydown', e => {
            if (this.active && GAME_KEYS.has(e.code)) e.preventDefault();
            if (e.repeat) return;
            this.keys.add(e.code);
            this.lastDevice = 'kb';
            this.fire(e);
        });
        window.addEventListener('keyup', e => this.keys.delete(e.code));
        // Si la fenêtre perd le focus, les relâchements de touches ne nous parviennent jamais
        window.addEventListener('blur', () => this.clear());
        for (const ev of ['gamepadconnected', 'gamepaddisconnected']) window.addEventListener(ev, () => this.handlers.pads?.(this.padCount));
    }

    blank() { return { throttle: 0, brake: 0, steer: 0, drift: false, hop: false, jump: false, useItem: false, respawn: false, rear: false, _item: false, _respawn: false, _drift: false, _t: 0 }; }
    clear() {
        this.keys.clear();
        Object.assign(this.touch, { steer: 0, gas: false, brake: false, drift: false, jump: false, item: false, rear: false });
    }

    on(name, fn) { this.handlers[name] = fn; }
    fire(e) {
        const key = e.key?.toLowerCase();
        if (e.code === 'Escape') this.handlers.pause?.();
        else if (e.code === 'KeyC') this.handlers.camera?.();
        // La lettre M, pas sa position : elle n'est pas au même endroit en AZERTY et QWERTY
        else if (key === 'm') this.handlers.mute?.();
        else if (e.code === 'F2') this.handlers.help?.();
    }

    held(list) { for (const k of list) if (this.keys.has(k)) return true; return false; }

    // ---------- Manettes ----------
    /** Les manettes branchées, dans l'ordre. */
    pads() {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        const out = [];
        for (const p of list) if (p && p.connected) out.push(p);
        return out;
    }
    get padCount() { return this.pads().length; }

    /** Répartition des appareils pour une course. Renvoie le schéma réellement utilisé (repli sur le clavier s'il manque une manette). */
    setup(players, scheme = 'kb-kb') {
        this.players = players;
        if (players < 2) { this.scheme = 'solo'; return this.scheme; }
        const need = scheme.split('-').filter(d => d === 'pad').length;
        this.scheme = SCHEMES[scheme] && this.padCount >= need ? scheme : 'kb-kb';
        return this.scheme;
    }
    /** Schéma conseillé selon le nombre de manettes branchées. */
    bestScheme() { const n = this.padCount; return n >= 2 ? 'pad-pad' : n === 1 ? 'kb-pad' : 'kb-kb'; }

    /** Appareil d'un joueur : { kb: table de touches | null, pad: manette | null }. */
    device(index) {
        if (this.players < 2) return { kb: SOLO, pad: this.pads()[0] ?? null };
        const parts = this.scheme.split('-');
        if (parts[index] === 'kb') return { kb: parts[1 - index] === 'kb' ? (index === 0 ? P1 : P2) : SOLO, pad: null };
        const before = parts.slice(0, index).filter(d => d === 'pad').length;
        return { kb: null, pad: this.pads()[before] ?? null };
    }

    /** Touche ou bouton à afficher pour lancer un objet. */
    hint(index) {
        if (this.players < 2) {
            if (this.isTouch) return { device: 'touch', item: '★' };
            return this.lastDevice === 'pad' ? { device: 'pad', item: 'X' } : { device: 'kb', item: 'E' };
        }
        const d = this.device(index);
        if (!d.kb) return { device: 'pad', item: 'X' };
        return { device: 'kb', item: d.kb === P2 ? 'L' : 'E' };
    }

    /** Vibration de la manette du joueur (chocs, atterrissages). */
    rumble(index, strength = 0.5, ms = 160) {
        const pad = this.device(index).pad;
        try { pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.6) }); } catch { /* manette sans vibration */ }
    }

    /**
     * Boutons de manette utiles dans les menus, à lire une fois par image :
     * renvoie { a, b, start } vrais à l'instant où le bouton est enfoncé (toutes manettes confondues).
     */
    pollPads() {
        const now = { a: false, b: false, start: false, y: false };
        for (const pad of this.pads()) {
            const btn = i => !!pad.buttons[i]?.pressed;
            now.a ||= btn(0); now.b ||= btn(1); now.start ||= btn(9); now.y ||= btn(3);
        }
        const out = {};
        for (const k in now) { out[k] = now[k] && !this._edges[k]; this._edges[k] = now[k]; }
        if (now.a || now.b || now.start) this.lastDevice = 'pad';
        return out;
    }

    /** Lit l'état courant des commandes du joueur. */
    read(index) {
        const out = this.states[index];
        const { kb, pad } = this.device(index);
        let throttle = 0, brake = 0, steer = 0, drift = false, jump = false, item = false, respawn = false, rear = false;

        if (kb) {
            throttle = this.held(kb.up) ? 1 : 0;
            brake = this.held(kb.down) ? 1 : 0;
            steer = (this.held(kb.left) ? 1 : 0) - (this.held(kb.right) ? 1 : 0);
            drift = this.held(kb.drift); jump = this.held(kb.jump);
            item = this.held(kb.item); respawn = this.held(kb.respawn);
        }

        if (pad) {
            const btn = i => !!pad.buttons[i]?.pressed;
            const val = i => pad.buttons[i]?.value ?? 0;
            const axis = pad.axes[0] ?? 0;
            if (Math.abs(axis) > DEAD) {
                // Zone morte puis courbe douce : précis près du centre, franc en butée
                const a = (Math.abs(axis) - DEAD) / (1 - DEAD);
                steer = -Math.sign(axis) * Math.min(1, a * (0.55 + 0.45 * a));
            }
            if (btn(14)) steer = 1;
            if (btn(15)) steer = -1;
            throttle = Math.max(throttle, val(7), btn(0) ? 1 : 0);
            brake = Math.max(brake, val(6), btn(1) ? 1 : 0);
            drift = drift || btn(5) || btn(4);
            jump = jump || btn(3);
            item = item || btn(2);
            respawn = respawn || btn(8);
            // Stick droit tiré vers soi, ou clic du stick droit : regarder derrière
            rear = btn(11) || (pad.axes[3] ?? 0) > 0.6;
            if (this.players < 2 && (throttle > 0.1 || brake > 0.1 || Math.abs(steer) > 0.3 || drift || item)) {
                if (!this.held(SOLO.up) && !this.held(SOLO.left) && !this.held(SOLO.right)) this.lastDevice = 'pad';
            }
        }

        if (index === 0 && this.players < 2) {
            const t = this.touch;
            if (t.steer) steer = t.steer;
            if (t.gas) throttle = 1;
            if (t.brake) brake = 1;
            drift = drift || t.drift;
            jump = jump || t.jump;
            item = item || t.item;
            rear = rear || t.rear;
        }

        out.throttle = throttle; out.brake = brake; out.steer = steer;
        out.drift = drift; out.jump = jump;
        // Appui sur le bouton de drift = saut synchro (une seule fois par appui)
        out.hop = drift && !out._drift; out._drift = drift;
        out.useItem = item && !out._item; out._item = item;
        // R : appui court = retour sur la piste (au relâchement), maintenu = vue arrière
        const now = performance.now();
        if (respawn) {
            if (!out._respawn) out._t = now;
            out.respawn = false;
            rear = rear || now - out._t > TAP;
        } else {
            out.respawn = out._respawn && now - out._t <= TAP;
        }
        out._respawn = respawn;
        out.rear = rear;
        return out;
    }
}
