// ============================================================
//  Interface : chargement, écran titre, préparation de la course,
//  HUD, cinématiques, résultats et nouveautés.
//  Style commun aux jeux Turbonix (voir turbonix.css), en tutoyant.
//  Le texte n'est modifié dans la page que s'il a changé.
// ============================================================
import { VEHICLES, COLORS, MS_TO_KMH, VERSION, MEDAL_LABEL } from './config.js';
import { TRACK_DEFS, TRACK_ORDER, getTrack } from './tracks.js';
import { BIOMES, BIOME_ORDER } from './biomes.js';
import { ITEMS, ITEM_IDS } from './sim.js';
import { formatTime } from './storage.js';
import { ICONS, hydrateIcons } from './icons.js';

const $ = id => document.getElementById(id);
const hex = c => '#' + c.toString(16).padStart(6, '0');
const MODES = {
    race: { name: 'Course', desc: 'Affronte les pilotes de Turbonix. Tu gagnes tes médailles au classement.' },
    champ: { name: 'Coupe', desc: 'Tous les circuits débloqués à la suite, avec un classement aux points.' },
    tt: { name: 'Chrono', desc: 'Seul contre ton fantôme, sans objets. Tu gagnes tes médailles au temps.' },
    duel: { name: '2 joueurs', desc: 'Écran partagé sur le même clavier, avec ou sans adversaires.' },
};
const STATS = [['speed', 'Vitesse'], ['accel', 'Accélération'], ['handling', 'Maniabilité'], ['offroad', 'Hors-piste'], ['drift', 'Drift']];
export const TIPS = [
    'Appuie sur Maj pour un saut synchro : il passe par-dessus les flaques d\'huile.',
    'Garde Maj en tournant : la fumée passe au vert puis à l\'orange, relâche pour un boost.',
    'Le missile vise la voiture juste devant toi : garde-le pour un adversaire proche.',
    'Le bouclier encaisse un missile, une bombe ou un éclair, puis disparaît.',
    'En fantôme, tu traverses les voitures, les obstacles et les flaques.',
    'Sur la glace, la piste glisse : freine avant le virage, pas pendant.',
    'Dans le désert, sortir de la piste coûte très cher : le sable freine.',
    'Le ressort fait passer par-dessus les rondins du Canyon Rouge.',
    'Les cônes se renversent, mais ils te ralentissent un peu.',
    'Les médailles débloquent le Kart Éclair, le Prototype X et deux circuits.',
    'L\'éclair rapetisse et ralentit tous ceux qui sont devant toi.',
    'La tornade remonte la piste : lance-la quand le peloton est devant.',
];

const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
const setFill = el => el.style.setProperty('--fill', `${(el.value / el.max) * 100}%`);

/** Petit lecteur Markdown pour le journal des nouveautés. */
function renderMarkdown(md) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
    let html = '', list = false;
    for (const raw of md.split(/\r?\n/)) {
        const line = raw.trimEnd();
        const close = () => { if (list) { html += '</ul>'; list = false; } };
        if (/^# /.test(line)) { close(); continue; }
        if (/^## /.test(line)) { close(); html += `<h3 class="news-version">${inline(line.slice(3))}</h3>`; }
        else if (/^### /.test(line)) { close(); html += `<h4>${inline(line.slice(4))}</h4>`; }
        else if (/^\s*- /.test(line)) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.replace(/^\s*- /, ''))}</li>`; }
        else if (line.trim()) { close(); html += `<p>${inline(line)}</p>`; }
        else close();
    }
    return html + (list ? '</ul>' : '');
}

export class UI {
    constructor({ save, audio, input }) {
        this.save = save; this.audio = audio; this.input = input;
        this.huds = [];
        this.prefs = save.data.prefs;
        this.handlers = {};
        this.thumbs = {};
        // Le pointeur principal, pas la simple présence d'un écran tactile : un PC tactile garde son clavier
        this.isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        document.body.classList.toggle('touch', this.isTouch);
        for (const id of ['version', 'title-version']) setText($(id), VERSION);
        setText($('year'), String(new Date().getFullYear()));
        hydrateIcons();
        this.sanitizePrefs();
        this.buildMenu();
        this.buildItemsCard();
        this.bindTitle();
        this.bindOverlays();
        this.bindTouch();
        this.syncMute();
    }

    on(name, fn) { this.handlers[name] = fn; }

    sanitizePrefs() {
        const p = this.prefs;
        if (!VEHICLES[p.vehicle] || !this.save.isVehicleUnlocked(p.vehicle)) p.vehicle = 'sport';
        if (!TRACK_DEFS[p.track] || !this.save.isTrackUnlocked(p.track)) p.track = 'ovale';
        if (!MODES[p.mode]) p.mode = 'race';
        if (!(p.color >= 0 && p.color < COLORS.length)) p.color = 0;
        if (p.biome !== 'auto' && !BIOMES[p.biome]) p.biome = 'auto';
    }

    // ---------- Chargement ----------
    showLoading(sub = 'Turbonix Entertainment') {
        const el = $('loading');
        el.hidden = false;
        el.classList.remove('done');
        setText($('load-sub'), sub);
        $('load-tip').textContent = '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)];
        this.setProgress(0, 'Préparation');
        this.loadStart = performance.now();
    }
    setProgress(p, label) {
        const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
        $('load-fill').style.width = `${pct}%`;
        $('load-car').style.left = `calc(${pct}% - ${pct * 0.64}px)`;
        setText($('load-pct'), `${pct} %`);
        if (label) setText($('load-label'), label);
    }
    /** Le chargement reste au moins un instant : on a le temps de lire l'astuce. */
    async hideLoading(minMs = 700) {
        const left = minMs - (performance.now() - this.loadStart);
        if (left > 0) await new Promise(r => setTimeout(r, left));
        const el = $('loading');
        el.classList.add('done');
        await new Promise(r => setTimeout(r, 380));
        el.hidden = true;
    }

    // ---------- Écran titre ----------
    bindTitle() {
        $('t-play').onclick = () => this.handlers.play?.();
        $('t-news').onclick = () => this.openNews();
        $('t-help').onclick = () => { $('help-overlay').hidden = false; };
        $('t-settings').onclick = () => this.openSettings();
        $('title-sound').onclick = () => this.handlers.mute?.();
    }
    showTitle(demoInfo) {
        $('title').hidden = false;
        $('menu').hidden = true;
        setText($('title-points'), `⭐ ${this.save.points()} pt${this.save.points() > 1 ? 's' : ''}`);
        setText($('demo-tag'), demoInfo ? `Démo · ${demoInfo}` : '');
        $('t-play').focus({ preventScroll: true });
    }
    hideTitle() { $('title').hidden = true; }
    get titleVisible() { return !$('title').hidden; }
    flashCut() {
        const el = $('cut-flash');
        el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    }

    openNews() {
        const src = $('changelog-src')?.textContent.trim();
        const fill = md => { $('news-body').innerHTML = renderMarkdown(md); };
        if (src) fill(src);
        else fetch('../CHANGELOG.md').then(r => r.text()).then(fill).catch(() => fill('Le journal des nouveautés n\'a pas pu être chargé.'));
        $('news-overlay').hidden = false;
    }

    // ---------- Préparation de la course ----------
    buildMenu() {
        const p = this.prefs;
        const tabs = $('mode-tabs');
        for (const [id, m] of Object.entries(MODES)) {
            const b = document.createElement('button');
            b.className = 'chip icon-chip'; b.dataset.id = id;
            b.innerHTML = `${ICONS[id]}<span>${m.name}</span>`;
            b.setAttribute('role', 'radio');
            b.onclick = () => { p.mode = id; this.refreshMenu(); };
            tabs.appendChild(b);
        }
        const bg = $('biome-grid');
        for (const id of ['auto', ...BIOME_ORDER]) {
            const b = document.createElement('button');
            b.className = 'biome-btn'; b.dataset.id = id;
            b.innerHTML = `${ICONS[id]}<span>${id === 'auto' ? 'Du circuit' : BIOMES[id].name}</span>`;
            b.setAttribute('role', 'radio');
            b.onclick = () => { p.biome = id; this.refreshMenu(); };
            bg.appendChild(b);
        }
        COLORS.forEach((col, i) => {
            const b = document.createElement('button');
            b.className = 'swatch';
            b.style.setProperty('--c', hex(col));
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-label', `Couleur ${i + 1}`);
            b.onclick = () => { p.color = i; this.refreshMenu(); this.handlers.previewChanged?.(p.vehicle, COLORS[i]); };
            $('colorPicker').appendChild(b);
            $('p2-color').add(new Option(`Couleur ${i + 1}`, i));
        });
        $('p2-color').value = 2;

        $('lapCount').value = String(p.laps);
        $('botCount').value = String(p.bots);
        $('difficulty').value = p.difficulty;
        $('lapCount').onchange = e => { p.laps = +e.target.value; this.refreshMenu(); };
        $('botCount').onchange = e => { p.bots = +e.target.value; this.save.write(); };
        $('difficulty').onchange = e => { p.difficulty = e.target.value; this.save.write(); };

        $('start-btn').onclick = () => this.handlers.start?.(this.collectConfig());
        $('btn-home').onclick = () => this.handlers.home?.();
        $('btn-help').onclick = () => { $('help-overlay').hidden = false; };
        $('btn-settings').onclick = () => this.openSettings();
        $('btn-sound').onclick = () => this.handlers.mute?.();
        $('btn-theme').onclick = () => {
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            this.save.data.settings.theme = next;
            this.save.write();
        };
        $('prev-car').onclick = () => this.stepVehicle(-1);
        $('next-car').onclick = () => this.stepVehicle(1);
        this.rebuildGrids();
        this.refreshMenu();
    }

    /** Fiches des 10 objets, avec leur icône et leur effet. */
    buildItemsCard() {
        $('items-grid').innerHTML = ITEM_IDS.map(id => `<div class="item-card"><div class="item-ico">${ICONS[id]}</div><div><strong>${ITEMS[id].name}</strong><small>${ITEMS[id].desc}</small></div></div>`).join('');
    }

    /** Vignettes 3D des véhicules, rendues au chargement. */
    setVehicleThumbs(map) {
        this.thumbs = map;
        this.rebuildGrids();
        this.refreshMenu();
    }

    stepVehicle(dir) {
        const p = this.prefs;
        const list = Object.keys(VEHICLES).filter(id => this.save.isVehicleUnlocked(id));
        p.vehicle = list[(list.indexOf(p.vehicle) + dir + list.length) % list.length];
        this.refreshMenu();
        this.handlers.previewChanged?.(p.vehicle, COLORS[p.color]);
    }

    rebuildGrids() {
        const p = this.prefs;
        const tg = $('track-grid'); tg.innerHTML = '';
        for (const id of TRACK_ORDER) {
            const d = TRACK_DEFS[id], unlocked = this.save.isTrackUnlocked(id);
            const b = document.createElement('button');
            b.className = 'track-btn'; b.dataset.id = id; b.disabled = !unlocked;
            b.setAttribute('role', 'radio');
            const cv = document.createElement('canvas');
            cv.width = 180; cv.height = 96;
            drawTrackThumb(cv, getTrack(id));
            b.appendChild(cv);
            const label = document.createElement('span');
            label.textContent = d.name;
            b.appendChild(label);
            const tag = document.createElement('span');
            tag.className = 'biome-tag';
            tag.innerHTML = ICONS[d.biome];
            tag.title = BIOMES[d.biome].name;
            b.appendChild(tag);
            if (!unlocked) {
                const l = document.createElement('span');
                l.className = 'lock-tag'; l.textContent = `🔒 ${d.unlock} pt${d.unlock > 1 ? 's' : ''}`;
                b.appendChild(l);
            }
            const medal = this.save.data.medals[id];
            if (medal) {
                const m = document.createElement('span');
                m.className = 'medal-tag'; m.textContent = MEDAL_LABEL[medal].split(' ')[0];
                b.appendChild(m);
            }
            b.onclick = () => { p.track = id; this.refreshMenu(); };
            tg.appendChild(b);
        }

        const vg = $('vehicle-grid'); vg.innerHTML = '';
        const sel2 = $('p2-vehicle'), keep = sel2.value || 'muscle'; sel2.innerHTML = '';
        for (const [id, v] of Object.entries(VEHICLES)) {
            const unlocked = this.save.isVehicleUnlocked(id);
            const b = document.createElement('button');
            b.className = 'vehicle-btn'; b.dataset.id = id; b.disabled = !unlocked;
            b.setAttribute('role', 'radio');
            const img = this.thumbs[id] ? `<img class="thumb" src="${this.thumbs[id]}" alt="">` : `<span class="thumb-ph"></span>`;
            b.innerHTML = `${img}<span class="vname">${v.name}</span>${unlocked ? '' : `<span class="lock-tag">🔒 ${v.unlock} pts</span>`}`;
            b.onclick = () => { p.vehicle = id; this.refreshMenu(); this.handlers.previewChanged?.(id, COLORS[p.color]); };
            vg.appendChild(b);
            if (unlocked) sel2.add(new Option(v.name, id));
        }
        sel2.value = keep;
        if (sel2.selectedIndex < 0) sel2.selectedIndex = 0;
    }

    refreshMenu() {
        const p = this.prefs, def = TRACK_DEFS[p.track], s = VEHICLES[p.vehicle];
        const check = (list, ok) => list.forEach(el => {
            const on = ok(el);
            el.setAttribute('aria-checked', on ? 'true' : 'false');
            el.classList.toggle('active', on);
        });
        check($('mode-tabs').querySelectorAll('.chip'), el => el.dataset.id === p.mode);
        check($('track-grid').querySelectorAll('.track-btn'), el => el.dataset.id === p.track);
        check($('biome-grid').querySelectorAll('.biome-btn'), el => el.dataset.id === p.biome);
        check($('vehicle-grid').querySelectorAll('.vehicle-btn'), el => el.dataset.id === p.vehicle);
        check($('colorPicker').querySelectorAll('.swatch'), el => [...el.parentNode.children].indexOf(el) === p.color);

        const isCup = p.mode === 'champ', isTT = p.mode === 'tt', isDuel = p.mode === 'duel';
        setText($('mode-desc'), MODES[p.mode].desc);
        setText($('track-desc'), isCup ? 'La coupe enchaîne tous les circuits débloqués.' : def.desc);
        const biome = p.biome === 'auto' ? def.biome : p.biome;
        setText($('biome-desc'), `${BIOMES[biome].name} : ${BIOMES[biome].desc}${p.biome === 'auto' ? ' (biome du circuit)' : ''}`);
        $('track-grid').style.opacity = isCup ? 0.5 : 1;
        $('lap-field').hidden = !(isCup || def.closed);
        $('bots-field').hidden = isTT || isCup;
        $('diff-field').hidden = isTT;
        $('p2-panel').hidden = !isDuel;
        setText($('player-label'), isDuel ? '· Joueur 1' : '');
        setText($('points-display'), `⭐ ${this.save.points()} pt${this.save.points() > 1 ? 's' : ''}`);

        const nameEl = $('car-name');
        if (nameEl.textContent !== s.name) {
            setText(nameEl, s.name);
            setText($('car-desc'), s.desc);
            const label = nameEl.parentNode;
            label.style.animation = 'none';
            void label.offsetWidth;
            label.style.animation = '';
        }

        const bars = $('carStatsDisplay');
        if (!bars.children.length) {
            bars.innerHTML = STATS.map(([k, name]) =>
                `<div class="bar-row"><div class="bar-label"><span>${name}</span><small data-stat="${k}"></small></div><div class="bar"><div class="bar-fill" data-fill="${k}"></div></div></div>`).join('');
        }
        for (const [k] of STATS) {
            bars.querySelector(`[data-fill="${k}"]`).style.width = `${s[k]}%`;
            setText(bars.querySelector(`[data-stat="${k}"]`), String(s[k]));
        }

        const laps = def.closed ? p.laps : 1;
        const rec = this.save.getRecord(p.track, p.vehicle, laps);
        const lap = this.save.getBestLap(p.track, p.vehicle);
        const score = this.save.getScore(p.track, p.vehicle);
        const medal = this.save.data.medals[p.track];
        const lines = [
            `<b>${def.name}</b> · ${s.name}${def.closed ? ` · ${laps} tour${laps > 1 ? 's' : ''}` : ''}`,
            rec != null ? `🏅 Record : ${formatTime(rec)}` : '🏅 Pas encore de record',
        ];
        if (lap != null && def.closed) lines[1] += ` · Meilleur tour : ${formatTime(lap)}`;
        if (score != null) lines[1] += ` · Score : ${score}`;
        if (medal) lines.push(`Ta meilleure médaille : ${MEDAL_LABEL[medal]}`);
        lines.push(`⏱️ Or en chrono : ${formatTime(def.par * laps)}`);
        $('best-time-display').innerHTML = lines.join('<br>');
        this.save.write();
    }

    collectConfig() {
        const p = this.prefs;
        const me = { vehicle: p.vehicle, color: COLORS[p.color], name: p.mode === 'duel' ? 'Joueur 1' : 'Toi' };
        const cfg = { mode: p.mode, track: p.track, biome: p.biome, laps: p.laps, bots: p.bots, difficulty: p.difficulty, players: [me] };
        if (p.mode === 'tt') cfg.bots = 0;
        if (p.mode === 'champ') cfg.bots = 5;
        if (p.mode === 'duel') cfg.players.push({ vehicle: $('p2-vehicle').value, color: COLORS[+$('p2-color').value], name: 'Joueur 2' });
        return cfg;
    }

    showMenu() {
        this.sanitizePrefs();
        this.rebuildGrids();
        this.refreshMenu();
        $('menu').hidden = false;
        $('title').hidden = true;
        $('results-overlay').hidden = true;
        $('pause-overlay').hidden = true;
        this.hideRaceUi();
    }
    hideMenu() { $('menu').hidden = true; }
    get menuVisible() { return !$('menu').hidden; }

    // ---------- Superpositions ----------
    bindOverlays() {
        $('resume-btn').onclick = () => this.handlers.resume?.();
        $('restart-btn').onclick = () => this.confirm('Recommencer la course ?', () => this.handlers.restart?.());
        $('quit-btn').onclick = () => this.confirm('Abandonner la course ?', () => this.handlers.quit?.());
        $('pause-btn').onclick = () => this.handlers.pause?.();
        $('pause-help-btn').onclick = () => { $('help-overlay').hidden = false; };
        $('pause-settings-btn').onclick = () => this.openSettings();
        $('help-close').onclick = () => { $('help-overlay').hidden = true; };
        $('news-close').onclick = () => { $('news-overlay').hidden = true; };
        $('settings-close').onclick = () => { $('settings-overlay').hidden = true; this.save.write(); };
        $('confirm-yes').onclick = () => { $('confirm-overlay').hidden = true; this._onYes?.(); };
        $('confirm-no').onclick = () => { $('confirm-overlay').hidden = true; };
        $('results-menu').onclick = () => this.handlers.quit?.();
        $('results-next').onclick = () => this.handlers.next?.();

        const s = this.save.data.settings;
        const apply = () => { this.audio.applyVolumes(); this.syncMute(); };
        $('set-music').oninput = e => { s.music = +e.target.value; setFill(e.target); apply(); };
        $('set-sfx').oninput = e => { s.sfx = +e.target.value; setFill(e.target); apply(); };
        $('set-muted').onchange = e => { s.muted = e.target.checked; apply(); };
        $('set-shadows').onchange = e => { s.shadows = e.target.checked; };   // appliqué à la prochaine course
        $('set-intro').onchange = e => { s.intro = e.target.checked; };
        $('reset-btn').onclick = () => this.confirm('Effacer tes records et tes médailles ? C\'est définitif.', () => {
            this.save.resetProgress();
            this.showMenu();
        });
    }

    openSettings() {
        const s = this.save.data.settings;
        $('set-music').value = s.music; $('set-sfx').value = s.sfx;
        setFill($('set-music')); setFill($('set-sfx'));
        $('set-muted').checked = s.muted; $('set-shadows').checked = s.shadows; $('set-intro').checked = s.intro !== false;
        $('settings-overlay').hidden = false;
    }
    syncMute() {
        const muted = this.save.data.settings.muted;
        $('set-muted').checked = muted;
        for (const id of ['btn-sound', 'title-sound']) {
            $(id).classList.toggle('off', muted);
            $(id).title = muted ? 'Sons coupés' : 'Sons activés';
        }
    }

    confirm(message, onYes) {
        setText($('confirm-message'), message);
        this._onYes = onYes;
        $('confirm-overlay').hidden = false;
        $('confirm-no').focus();
    }

    /** Échap ferme d'abord ce qui est au premier plan. Renvoie vrai si quelque chose a été fermé. */
    closeTopOverlay() {
        for (const id of ['confirm-overlay', 'settings-overlay', 'help-overlay', 'news-overlay']) {
            if (!$(id).hidden) { $(id).hidden = true; return true; }
        }
        return false;
    }

    showFatal(msg) {
        setText($('fatal-message'), msg);
        $('fatal-overlay').hidden = false;
        $('loading').hidden = true;
    }

    showPause(v) {
        $('pause-overlay').hidden = !v;
        if (v) $('resume-btn').focus();
        else { document.activeElement?.blur?.(); for (const id of ['help-overlay', 'settings-overlay', 'confirm-overlay']) $(id).hidden = true; }
    }

    // ---------- Tactile ----------
    bindTouch() {
        const t = this.input.touch;
        const set = (name, on) => {
            if (name === 'left') t.steer = on ? 1 : (t.steer === 1 ? 0 : t.steer);
            else if (name === 'right') t.steer = on ? -1 : (t.steer === -1 ? 0 : t.steer);
            else t[name] = on;
        };
        document.querySelectorAll('#touch-controls button').forEach(b => {
            const name = b.dataset.touch;
            const down = e => { e.preventDefault(); b.classList.add('down'); set(name, true); };
            const up = e => { e.preventDefault(); b.classList.remove('down'); set(name, false); };
            b.addEventListener('pointerdown', down);
            b.addEventListener('pointerup', up);
            b.addEventListener('pointercancel', up);
            b.addEventListener('pointerleave', up);
        });
    }

    // ---------- Cinématiques ----------
    showIntro({ track, biome, laps, mode }) {
        const modeName = MODES[mode]?.name ?? '';
        setText($('intro-kicker'), `${modeName} · ${laps > 1 ? `${laps} tours` : '1 course'}`);
        setText($('intro-track'), track);
        setText($('intro-biome'), `Biome ${biome}`);
        const el = $('intro');
        el.hidden = false;
        el.classList.remove('out');
        $('hud-root').classList.add('cinema');
        document.body.classList.add('cinema');
    }
    hideIntro() {
        const el = $('intro');
        el.classList.add('out');
        $('hud-root').classList.remove('cinema');
        document.body.classList.remove('cinema');
        setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 500);
    }
    showFinishBanner(res) {
        const me = res.players[0];
        let text = 'Arrivée !';
        if (res.mode === 'race' || res.mode === 'champ') text = me.position === 1 && res.ranking.length > 1 ? 'Victoire !' : `${me.position}${me.position === 1 ? 'er' : 'e'} !`;
        if (res.mode === 'tt' && me.newRecord) text = 'Record !';
        setText($('finish-text'), text);
        setText($('finish-sub'), formatTime(me.time));
        const el = $('finish-banner');
        el.hidden = false;
        el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
        setTimeout(() => { el.hidden = true; }, 3300);
    }

    // ---------- HUD ----------
    setupHud(humans, sim, save, cfg) {
        const root = $('hud-root');
        root.innerHTML = '';
        root.hidden = false;
        this.huds = humans.map(car => this.createHud(root, car, sim, save, humans.length));
        this.setupMinimap(sim.track, humans.length);
        $('pause-btn').hidden = false;
        $('touch-controls').hidden = !(this.isTouch && humans.length === 1);
        $('touch-controls').querySelector('[data-touch="jump"]').hidden = !VEHICLES[humans[0].v.type].canJump;
        $('touch-controls').querySelector('[data-touch="item"]').hidden = cfg.mode === 'tt';
        $('results-overlay').hidden = true;
        $('pause-overlay').hidden = true;
        this.setCountdown('');
        this.frameCount = 0;
    }

    createHud(root, car, sim, save, count) {
        const el = document.createElement('div');
        el.className = 'hud';
        const showPos = sim.cars.length > 1;
        const laps = sim.laps;
        el.innerHTML = `
            <div class="speed-lines" data-f="lines"></div>
            <div class="hud-tl">
                ${count > 1 ? `<div class="hud-name">${car.name}</div>` : ''}
                ${showPos ? `<div class="hud-box hud-pos" data-f="pos"></div>` : ''}
                ${sim.track.closed ? `<div class="hud-box"><small>Tour</small><span data-f="lap"></span></div>` : `<div class="hud-box"><small>Parcours</small><span data-f="progress"></span></div>`}
                <div class="hud-box"><small>Temps</small><span data-f="time"></span></div>
                ${laps > 1 ? `<div class="hud-box"><small>Meilleur tour</small><span data-f="best"></span></div>` : ''}
                <div class="hud-box"><small>Record</small><span data-f="record"></span></div>
            </div>
            <div class="hud-center"><div data-f="center"></div><div data-f="toasts"></div></div>
            <div class="drift-wrap" data-f="driftWrap"><div class="drift-bar" data-f="drift"></div></div>
            ${sim.mode === 'tt' ? '' : `<div class="item-slot" data-f="item" title="Objet"><span class="slot-ico" data-f="itemIco"></span><kbd>${count > 1 ? (car.playerIndex ? 'L' : 'E') : 'E'}</kbd></div>`}
            <div class="status-row" data-f="status"></div>
            <div class="gauge" data-f="gauge">
                <svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#ff8c1a"/></linearGradient></defs><circle class="bg" cx="50" cy="50" r="40"></circle><circle class="fg" data-f="arc" cx="50" cy="50" r="40"></circle></svg>
                <div class="gauge-val"><span data-f="speed">0</span><small>km/h</small></div>
            </div>`;
        root.appendChild(el);
        const f = {};
        el.querySelectorAll('[data-f]').forEach(n => { f[n.dataset.f] = n; });

        const record = save.getRecord(sim.track.id, car.v.type, sim.laps);
        setText(f.record, formatTime(record));
        const hud = { el, f, car, wrong: false, off: false, lastSpeed: -1, bestLap: null, lastPos: car.position, lastLines: -1, status: '' };
        if (f.best) setText(f.best, formatTime(save.getBestLap(sim.track.id, car.v.type)));
        return hud;
    }

    layoutHud(rects) {
        this.huds.forEach((h, i) => {
            const r = rects[i];
            Object.assign(h.el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
        });
    }

    updateHud(humans, sim) {
        this.frameCount++;
        for (const hud of this.huds) {
            const car = hud.car, v = car.v, f = hud.f;
            const kmh = Math.round(Math.abs(v.speed) * MS_TO_KMH);
            if (kmh !== hud.lastSpeed) {
                f.speed.textContent = kmh; hud.lastSpeed = kmh;
                const arc = Math.min(188.5, (Math.abs(v.speed) / (v.spec.topSpeed * 1.3)) * 188.5);
                f.arc.style.strokeDasharray = `${arc.toFixed(1)} 251.3`;
            }
            f.arc.classList.toggle('boost', v.boost > 0);
            f.gauge.classList.toggle('boosting', v.boost > 0);

            const ratio = Math.abs(v.speed) / v.spec.topSpeed;
            const lines = Math.round(Math.max(0, (ratio - 0.72) / 0.5) * 10) / 10 + (v.boost > 0 ? 0.3 : 0);
            if (lines !== hud.lastLines) { f.lines.style.opacity = Math.min(0.75, lines); hud.lastLines = lines; }

            const time = car.finished ? car.finishTime : sim.time;
            setText(f.time, formatTime(time));
            if (f.pos) {
                const suffix = car.position === 1 ? 'er' : 'e';
                const txt = `${car.position}${suffix}`;
                if (f.pos.dataset.v !== txt) {
                    f.pos.dataset.v = txt;
                    f.pos.innerHTML = `${car.position}<sup>${suffix}</sup>`;
                    if (car.position !== hud.lastPos) {
                        f.pos.className = 'hud-box hud-pos';
                        void f.pos.offsetWidth;
                        f.pos.classList.add(car.position < hud.lastPos ? 'gain' : 'lose');
                        hud.lastPos = car.position;
                    }
                }
            }
            if (f.lap) setText(f.lap, `${Math.min(sim.laps, car.lapsDone + 1)} / ${sim.laps}`);
            if (f.progress) setText(f.progress, `${Math.max(0, Math.min(100, Math.round(100 * car.maxDist / sim.totalLen)))} %`);

            f.driftWrap.classList.toggle('on', v.drifting);
            if (v.drifting) {
                f.drift.style.width = `${Math.min(100, (v.driftCharge / 1.5) * 100)}%`;
                f.drift.className = 'drift-bar' + (v.driftCharge >= 1.5 ? ' t2' : v.driftCharge >= 0.7 ? ' t1' : '');
            }

            // Effets actifs : petites pastilles avec le temps restant
            const st = [['shield', v.shield], ['ghost', v.ghost], ['magnet', v.magnet], ['zap', v.zap]].filter(([, t]) => t > 0);
            const key = st.map(([k, t]) => `${k}${Math.ceil(t)}`).join();
            if (key !== hud.status) {
                hud.status = key;
                f.status.innerHTML = st.map(([k, t]) => `<span class="status ${k}">${ICONS[k]}<b>${Math.ceil(t)}</b></span>`).join('');
            }

            const off = car.offTrackTime > 0.1 && !car.finished;
            if (car.wrongWay !== hud.wrong || off !== hud.off) {
                hud.wrong = car.wrongWay; hud.off = off;
                f.center.innerHTML = hud.wrong ? '<div class="wrong-way">⛔ Mauvais sens !</div>' : hud.off ? '<div class="offroad">⚠️ Hors-piste</div>' : '';
            }
        }
    }

    /** Objet : les icônes défilent un instant avant de s'arrêter sur le bon. */
    setItem(index, item) {
        const hud = this.huds[index];
        if (!hud?.f.item) return;
        const slot = hud.f.item, ico = hud.f.itemIco;
        clearInterval(hud.rollTimer);
        slot.classList.remove('rolling');
        if (!item) {
            slot.classList.remove('full');
            ico.innerHTML = '';
            slot.classList.remove('used'); void slot.offsetWidth; slot.classList.add('used');
            return;
        }
        let n = 0;
        slot.classList.add('rolling');
        slot.classList.remove('full');
        hud.rollTimer = setInterval(() => {
            ico.innerHTML = ICONS[ITEM_IDS[n++ % ITEM_IDS.length]];
            if (n > 9) {
                clearInterval(hud.rollTimer);
                slot.classList.remove('rolling');
                slot.classList.add('full');
                slot.title = ITEMS[item].name;
                ico.innerHTML = ICONS[item];
                this.toast(index, `${ITEMS[item].name} : appuie sur ${this.huds.length > 1 && index ? 'L' : 'E'}`, 'info');
            }
        }, 55);
    }

    toast(index, text, kind = '') {
        const hud = this.huds[index];
        if (!hud) return;
        const t = document.createElement('div');
        t.className = `toast-hud ${kind}`;
        t.textContent = text;
        hud.f.toasts.replaceChildren(t);
        t.addEventListener('animationend', e => { if (e.animationName === 'toast-hud') t.remove(); });
    }

    lapToast(index, lapTime, best, lap, total) {
        const finalLap = lap === total;
        let msg = finalLap ? 'Dernier tour !' : `Tour ${lap} / ${total}`;
        msg += ` · ${formatTime(lapTime)}`;
        let kind = '';
        if (best != null) {
            const d = lapTime - best;
            msg += ` (${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)})`;
            kind = d < 0 ? 'good' : 'bad';
        }
        this.toast(index, msg, finalLap ? 'gold' : kind);
        const hud = this.huds[index];
        if (hud?.f.best && (hud.bestLap == null || lapTime < hud.bestLap)) {
            hud.bestLap = lapTime;
            if (best == null || lapTime < best) setText(hud.f.best, formatTime(lapTime));
        }
    }

    /** Feux de départ : rouge à 3, orange à 2 et 1, vert au départ. */
    setCountdown(text) {
        const box = $('countdown');
        if (!text) { box.replaceChildren(); return; }
        const go = text === 'GO !';
        const lit = go ? 2 : text === '3' ? 0 : 1;
        const blink = text === '1' ? ' blink' : '';
        box.innerHTML = `<div class="lights">${['red', 'orange', 'green'].map((c, i) => `<i class="${c}${i === lit ? ' on' + blink : ''}"></i>`).join('')}</div><div class="count-num${go ? ' go' : ''}">${text}</div>`;
    }

    hideRaceUi() {
        $('hud-root').hidden = true;
        $('minimap').hidden = true;
        $('pause-btn').hidden = true;
        $('touch-controls').hidden = true;
        $('intro').hidden = true;
        document.body.classList.remove('cinema');
        this.setCountdown('');
    }
    teardownHud() {
        this.huds.forEach(h => clearInterval(h.rollTimer));
        this.hideRaceUi();
        $('hud-root').innerHTML = '';
        this.huds = [];
    }

    // ---------- Mini-carte ----------
    setupMinimap(track, players) {
        const cv = $('minimap');
        cv.hidden = false;
        cv.classList.toggle('split', players > 1);
        const size = cv.width, pad = 16;
        const { minX, maxX, minZ, maxZ } = track.bbox;
        const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ, 1);
        const ox = (size - (maxX - minX) * scale) / 2, oz = (size - (maxZ - minZ) * scale) / 2;
        this.mapX = x => ox + (x - minX) * scale;
        this.mapZ = z => oz + (z - minZ) * scale;
        const path = new Path2D();
        for (let i = 0; i < track.n; i += 3) {
            const x = this.mapX(track.x[i]), y = this.mapZ(track.z[i]);
            if (i) path.lineTo(x, y); else path.moveTo(x, y);
        }
        if (track.closed) path.closePath();
        this.mapPath = path;
        this.mapStart = track.pointAt(track.startS, 0);
        this.mapFinish = track.closed ? null : track.pointAt(track.finishS, 0);
        this.mapCtx = cv.getContext('2d');
    }

    drawMinimap(sim, humans) {
        const g = this.mapCtx, w = g.canvas.width, h = g.canvas.height;
        g.clearRect(0, 0, w, h);
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 11; g.stroke(this.mapPath);
        g.strokeStyle = '#e8e6f0'; g.lineWidth = 6; g.stroke(this.mapPath);
        g.fillStyle = '#22c55e';
        g.fillRect(this.mapX(this.mapStart.x) - 5, this.mapZ(this.mapStart.z) - 5, 10, 10);
        if (this.mapFinish) { g.fillStyle = '#ff8c1a'; g.fillRect(this.mapX(this.mapFinish.x) - 5, this.mapZ(this.mapFinish.z) - 5, 10, 10); }
        // Projectiles en vol
        for (const p of sim.projectiles) {
            g.fillStyle = p.kind === 'tornado' ? '#c8d0dc' : '#ff3b1f';
            g.beginPath(); g.arc(this.mapX(p.x), this.mapZ(p.z), 3.5, 0, 7); g.fill();
        }
        for (const c of sim.cars) {
            if (c.human) continue;
            g.fillStyle = hex(c.color);
            g.beginPath(); g.arc(this.mapX(c.v.x), this.mapZ(c.v.z), 5, 0, 7); g.fill();
        }
        for (const c of humans) {
            g.fillStyle = hex(c.color); g.strokeStyle = '#fff'; g.lineWidth = 3;
            g.beginPath(); g.arc(this.mapX(c.v.x), this.mapZ(c.v.z), 8, 0, 7); g.fill(); g.stroke();
        }
    }

    // ---------- Résultats ----------
    showResults(res, cfg, cup = null) {
        const me = res.players[0];
        let title;
        const sub = `${res.trackName} · ${res.biomeName} · ${res.laps > 1 ? `${res.laps} tours` : '1 course'}`;
        if (res.mode === 'duel') {
            const best = [...res.players].sort((a, b) => a.position - b.position)[0];
            title = `🏆 ${best.name} gagne !`;
        } else if (res.mode === 'tt') {
            title = me.newRecord ? '⏱️ Nouveau record !' : '⏱️ Chrono terminé';
        } else if (cfg.bots === 0) {
            title = '🏁 Course terminée';
        } else if (me.position === 1) title = '🏆 Victoire !';
        else title = `${me.position}e sur ${res.ranking.length}`;
        setText($('results-title'), title);
        setText($('results-sub'), sub);

        const rows = res.ranking.map((r, i) => `<tr class="${r.human ? 'me' : ''}" style="--i:${i}"><td>${i + 1}</td><td>${r.name}</td><td>${VEHICLES[r.vehicle].name}</td><td>${r.finished ? formatTime(r.time) : `à ${Math.round(r.gap)} m`}</td></tr>`).join('');
        const table = res.ranking.length > 1 ? `<table class="res-table">${rows}</table>` : '';

        const stats = res.players.map(p => {
            const lines = [];
            const stat = (a, b) => lines.push(`<div class="stat-row" style="--i:${lines.length}"><span>${a}</span><span>${b}</span></div>`);
            if (res.players.length > 1) lines.push(`<div class="stat-row"><b>${p.name}</b><span></span></div>`);
            stat('Temps', formatTime(p.time));
            if (p.lapTimes.length > 1) stat('Meilleur tour', formatTime(p.bestLap));
            if (p.lapTimes.length > 1) stat('Tours', p.lapTimes.map(formatTime).join(' · '));
            stat('Vitesse max', `${Math.round(p.topSpeed * MS_TO_KMH)} km/h`);
            stat('Boosts de drift', p.stats.driftBoosts);
            stat('Objets lancés', p.stats.items);
            stat('Adversaires touchés', p.stats.hits);
            stat('Chocs', p.stats.impacts);
            if (p.score != null) stat('Score', `${p.score}${p.recordScore != null ? ` (record ${p.recordScore})` : ''}`);
            if (p.record != null) stat('Record', formatTime(p.record));
            return lines.join('');
        }).join('');

        let banner = '';
        if (res.players.length === 1) {
            if (me.newRecord && res.mode !== 'tt') banner += '<div class="new-record">🏅 Nouveau record !</div>';
            else if (me.newBestLap && res.laps > 1) banner += '<div class="new-record">🏅 Nouveau meilleur tour !</div>';
            if (me.medal) banner += `<div class="medal-big">Médaille : ${MEDAL_LABEL[me.medal]}</div>`;
        }
        for (const u of res.unlocked) banner += `<div class="unlock">🔓 Débloqué : ${u}</div>`;

        const cupHtml = cup ? cupTable(cup) : '';
        $('results-body').innerHTML = `${banner}${cupHtml}<div class="res-grid"><div>${table}</div><div>${stats}</div></div>`;
        setText($('results-next'), cup ? (cup.done ? '🏆 Fin de la coupe' : '▶ Course suivante') : '🔁 Rejouer');
        $('results-overlay').hidden = false;
        $('results-next').focus();
    }
}

function cupTable(cup) {
    const sorted = Object.entries(cup.standings).sort((a, b) => b[1] - a[1]);
    const rows = sorted.map(([n, pts], i) => `<tr class="${n === 'Toi' ? 'me' : ''}" style="--i:${i}"><td>${i + 1}</td><td>${n}</td><td>${pts} pts</td></tr>`).join('');
    const head = cup.done
        ? `<div class="medal-big">${sorted[0][0] === 'Toi' ? '🏆 Tu remportes la coupe !' : `La coupe revient à ${sorted[0][0]}`}</div>`
        : `<p class="muted small">Coupe : course ${cup.index + 1} sur ${cup.tracks.length}</p>`;
    return `${head}<table class="res-table" style="margin-bottom:10px">${rows}</table>`;
}

function drawTrackThumb(cv, t) {
    const g = cv.getContext('2d'), pad = 9;
    const { minX, maxX, minZ, maxZ } = t.bbox;
    const scale = Math.min((cv.width - pad * 2) / Math.max(maxX - minX, 1), (cv.height - pad * 2) / Math.max(maxZ - minZ, 1));
    const ox = (cv.width - (maxX - minX) * scale) / 2, oz = (cv.height - (maxZ - minZ) * scale) / 2;
    g.beginPath();
    for (let i = 0; i < t.n; i += 3) {
        const x = ox + (t.x[i] - minX) * scale, y = oz + (t.z[i] - minZ) * scale;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    if (t.closed) g.closePath();
    const grad = g.createLinearGradient(0, 0, cv.width, cv.height);
    grad.addColorStop(0, '#ff8c1a');
    grad.addColorStop(1, '#22c55e');
    g.lineJoin = 'round';
    g.strokeStyle = grad; g.lineWidth = 5; g.stroke();
}
