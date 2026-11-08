// ============================================================
//  Commandes : clavier, manette et tactile fusionnés en une seule
//  structure par joueur. Le reste du jeu ne voit jamais les touches.
//  e.code = position physique de la touche : ZQSD sur AZERTY,
//  WASD sur QWERTY, sans rien configurer. Ctrl n'est plus utilisé
//  (Ctrl+W fermerait l'onglet en pleine course).
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

export class Input {
    constructor() {
        this.keys = new Set();
        this.touch = { steer: 0, gas: false, brake: false, drift: false, jump: false, item: false };
        this.active = false;             // vrai pendant la course : on bloque alors le défilement, etc.
        this.twoPlayers = false;
        this.handlers = {};
        this.states = [this.blank(), this.blank()];

        window.addEventListener('keydown', e => {
            if (this.active && GAME_KEYS.has(e.code)) e.preventDefault();
            if (e.repeat) return;
            this.keys.add(e.code);
            this.fire(e);
        });
        window.addEventListener('keyup', e => this.keys.delete(e.code));
        // Si la fenêtre perd le focus, les relâchements de touches ne nous parviennent jamais
        window.addEventListener('blur', () => this.clear());
    }

    blank() { return { throttle: 0, brake: 0, steer: 0, drift: false, hop: false, jump: false, useItem: false, respawn: false, _item: false, _respawn: false, _drift: false }; }
    clear() {
        this.keys.clear();
        Object.assign(this.touch, { steer: 0, gas: false, brake: false, drift: false, jump: false, item: false });
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

    /** Lit l'état courant des commandes du joueur. */
    read(index) {
        const out = this.states[index];
        const map = this.twoPlayers ? (index === 0 ? P1 : P2) : SOLO;
        let throttle = this.held(map.up) ? 1 : 0;
        let brake = this.held(map.down) ? 1 : 0;
        let steer = (this.held(map.left) ? 1 : 0) - (this.held(map.right) ? 1 : 0);
        let drift = this.held(map.drift), jump = this.held(map.jump);
        let item = this.held(map.item), respawn = this.held(map.respawn);

        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = pads && pads[index];
        if (pad && pad.connected) {
            const axis = pad.axes[0] ?? 0;
            if (Math.abs(axis) > 0.12) steer = -axis;
            const btn = i => pad.buttons[i]?.pressed;
            const val = i => pad.buttons[i]?.value ?? 0;
            throttle = Math.max(throttle, val(7), btn(0) ? 1 : 0);
            brake = Math.max(brake, val(6), btn(1) ? 1 : 0);
            drift = drift || btn(5) || btn(4);
            jump = jump || btn(3);
            item = item || btn(2);
            respawn = respawn || btn(8);
            if (btn(14)) steer = 1;
            if (btn(15)) steer = -1;
            if (btn(9) && !this._padStart) this.handlers.pause?.();
            this._padStart = btn(9);
        }

        if (index === 0) {
            const t = this.touch;
            if (t.steer) steer = t.steer;
            if (t.gas) throttle = 1;
            if (t.brake) brake = 1;
            drift = drift || t.drift;
            jump = jump || t.jump;
            item = item || t.item;
        }

        out.throttle = throttle; out.brake = brake; out.steer = steer;
        out.drift = drift; out.jump = jump;
        // Appui sur le bouton de drift = saut synchro (une seule fois par appui)
        out.hop = drift && !out._drift; out._drift = drift;
        out.useItem = item && !out._item; out._item = item;
        out.respawn = respawn && !out._respawn; out._respawn = respawn;
        return out;
    }
}
