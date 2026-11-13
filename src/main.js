// ============================================================
//  Point d'entrée : chargement, écran titre, préparation, courses,
//  coupe. Relie la sauvegarde, le son, les commandes, l'interface et le jeu.
// ============================================================
import { CHAMP_POINTS, CHAMP_TRACKS, COLORS, VEHICLES } from './config.js';
import { Save } from './storage.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Preview } from './preview.js';
import { BIOMES } from './biomes.js';
import { getTrack } from './tracks.js';

const save = new Save();
const audio = new AudioEngine(save.data.settings);
const input = new Input();
const ui = new UI({ save, audio, input });

// Les navigateurs n'autorisent le son qu'après une action du joueur
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });
document.addEventListener('click', e => { if (e.target.closest?.('button')) audio.click(); });

function hasWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { return false; }
}

let game = null, preview = null, busy = false;

// --- Démarrage : un vrai écran de chargement, étape par étape ---
async function boot() {
    ui.showLoading();
    try {
        if (!hasWebGL()) throw new Error('webgl');
        ui.setProgress(0.05, 'Polices et interface');
        // Les panneaux et les boîtes « ? » sont écrits avec la police du jeu : on l'attend un instant
        await Promise.race([Promise.all([document.fonts?.load('64px "Russo One"'), document.fonts?.load('800 16px "Exo 2"')]).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
        await document.fonts?.ready;
        game = new Game({ ui, audio, input, save, portraits: (id, skin) => preview?.portrait(id, skin, 96) ?? null });
        window.__game = game;     // accessible pour le débogage et les tests en jeu
        ui.setProgress(0.15, 'Le garage');
        preview = new Preview(document.getElementById('preview'));
        window.__preview = preview;
        const p = save.data.prefs;
        // Les 7 carrosseries sont calculées une fois, puis photographiées pour le menu
        ui.setProgress(0.25, 'Les carrosseries');
        await new Promise(r => setTimeout(r, 0));
        ui.setVehicleThumbs(preview.renderThumbnails(Object.keys(VEHICLES), 0xff8c1a));
        ui.setProgress(0.32, 'Les pilotes');
        await new Promise(r => setTimeout(r, 0));
        ui.setPortraitProvider((id, skin, size) => preview.portrait(id, skin, size));
        preview.show(p.vehicle, COLORS[p.color], { skin: p.skin, wheels: p.wheels });
        await startDemo(0.4);
    } catch (e) {
        console.error(e);
        ui.showFatal('Ton navigateur ne peut pas afficher la 3D (WebGL indisponible). Active l\'accélération matérielle dans ses réglages ou essaie Chrome, Edge ou Firefox à jour.');
    }
}

/** Écran titre avec une course de démonstration en fond. */
async function startDemo(from = 0) {
    await game.startDemo((p, label) => ui.setProgress(from + p * (1 - from), label));
    await ui.hideLoading(from > 0 ? 1100 : 500);
    ui.showTitle(`${game.track.name} · ${BIOMES[game.biomeId].name}`);
}

// --- Coupe ---
let cup = null;
let lastCfg = null;

async function launch(cfg) {
    if (busy) return;
    busy = true;
    lastCfg = cfg;
    const t = getTrack(cfg.track);
    const biome = cfg.biome && cfg.biome !== 'auto' ? cfg.biome : t.def.biome;
    ui.showLoading(`${t.name} · ${BIOMES[biome].name}`);
    ui.hideMenu(); ui.hideTitle();
    document.getElementById('results-overlay').hidden = true;
    try {
        await game.startRace(cfg, (p, label) => ui.setProgress(p, label));
        if (save.data.settings.intro === false) game.skipIntro();
        await ui.hideLoading();
    } finally { busy = false; }
}

async function goTitle() {
    cup = null;
    ui.showLoading();
    game.quitToMenu();
    ui.hideMenu();
    await startDemo(0);
}

function goSetup() {
    game.quitToMenu();
    ui.hideTitle();
    ui.showMenu();
    const p = save.data.prefs;
    preview?.show(p.vehicle, COLORS[p.color], { skin: p.skin, wheels: p.wheels });
}

ui.on('play', goSetup);
ui.on('home', goTitle);
ui.on('start', cfg => {
    if (!game) return;
    if (cfg.mode === 'champ') {
        const tracks = CHAMP_TRACKS.filter(t => save.isTrackUnlocked(t));
        cup = { tracks, index: 0, standings: {}, done: false };
        cfg = { ...cfg, track: tracks[0] };
    } else cup = null;
    launch(cfg);
});
ui.on('restart', () => { game.setPaused(false); launch(lastCfg); });
ui.on('resume', () => game.setPaused(false));
ui.on('pause', () => game.togglePause());
ui.on('quit', () => { cup = null; game.setPaused(false); goSetup(); });
ui.on('previewChanged', (type, color, opts) => preview?.show(type, color, opts));
ui.on('next', () => {
    if (!cup) { launch(lastCfg); return; }
    if (cup.done) { cup = null; goSetup(); return; }
    cup.index++;
    launch({ ...lastCfg, track: cup.tracks[cup.index] });
});

// Les résultats passent par ici pour y ajouter les points de la coupe
const showResults = ui.showResults.bind(ui);
ui.showResults = (res, cfg) => {
    if (cup && cfg.mode === 'champ') {
        res.ranking.forEach((r, i) => { cup.standings[r.name] = (cup.standings[r.name] ?? 0) + (CHAMP_POINTS[i] ?? 0); });
        cup.done = cup.index >= cup.tracks.length - 1;
        if (cup.done) {
            const top = Object.entries(cup.standings).sort((a, b) => b[1] - a[1])[0][0];
            if (res.ranking.find(r => r.name === top)?.human) res.unlocked.push(...save.awardCup());
        }
    }
    showResults(res, cfg, cup);
};

// --- Touches globales ---
function toggleMute() {
    save.data.settings.muted = !save.data.settings.muted;
    audio.applyVolumes();
    ui.syncMute();
    save.write();
}
ui.on('mute', toggleMute);
input.on('mute', toggleMute);
input.on('pause', () => {
    if (ui.closeTopOverlay()) return;
    game?.togglePause();
});
input.on('camera', () => game?.nextCamera());
// Une touche ou un clic passe la cinématique
window.addEventListener('keydown', e => { if (game?.state === 'intro' && e.code !== 'Escape') game.skipIntro(); });
window.addEventListener('pointerdown', e => { if (game?.state === 'intro' && !e.target.closest('button')) game.skipIntro(); });

// --- Boucle principale : le garage et la course ne tournent jamais en même temps ---
let last = performance.now();
function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!game) return;
    if (ui.menuVisible) preview?.frame(dt);
    else game.frame(dt);
}
requestAnimationFrame(loop);

window.addEventListener('error', e => console.error(e.message));
boot();
