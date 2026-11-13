// ============================================================
//  Sauvegarde : records, fantômes, médailles, réglages.
//  Le stockage peut être absent (navigation privée) : le jeu continue
//  alors sans sauvegarde, et les tests passent leur propre stockage.
// ============================================================
import { MEDALS, CUP_POINTS, VEHICLES } from './config.js';
import { TRACK_DEFS } from './tracks.js';

const KEY = 'kartRacing_v2';

const DEFAULT_DATA = () => ({
    records: {},      // "piste_vehicule_tours" -> temps en s
    bestLaps: {},     // "piste_vehicule" -> meilleur tour en s
    scores: {},       // "piste_vehicule" -> meilleur score (Ligne Droite)
    ghosts: {},       // "piste_vehicule_tours" -> échantillons du meilleur chrono
    medals: {},       // "piste" -> gold | silver | bronze
    cups: 0,
    prefs: { color: 0, vehicle: 'sport', track: 'ovale', biome: 'auto', laps: 3, racers: 6, difficulty: 'normal', mode: 'race', character: 'bob', skin: 'classique', wheels: 'route', p2Character: 'lina' },
    settings: { music: 0.7, sfx: 0.8, muted: false, shadows: true, theme: null, intro: true },
});

export class Save {
    constructor(storage = safeStorage()) {
        this.storage = storage;
        this.data = this.load();
    }
    load() {
        const base = DEFAULT_DATA();
        try {
            const raw = this.storage?.getItem(KEY);
            if (!raw) return base;
            const d = JSON.parse(raw);
            return { ...base, ...d, prefs: { ...base.prefs, ...d.prefs }, settings: { ...base.settings, ...d.settings } };
        } catch { return base; }
    }
    write() {
        try { this.storage?.setItem(KEY, JSON.stringify(this.data)); }
        catch {
            // Plein : les fantômes sont les plus lourds, on les sacrifie en premier
            this.data.ghosts = {};
            try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* tant pis */ }
        }
    }

    /** Un record dépend de la piste, du véhicule ET du nombre de tours. */
    recordKey(track, car, laps) { return `${track}_${car}_${laps}`; }
    getRecord(track, car, laps) { return this.data.records[this.recordKey(track, car, laps)] ?? null; }
    getBestLap(track, car) { return this.data.bestLaps[`${track}_${car}`] ?? null; }
    getScore(track, car) { return this.data.scores[`${track}_${car}`] ?? null; }
    getGhost(track, car, laps) { return this.data.ghosts[this.recordKey(track, car, laps)] ?? null; }

    saveRun({ track, car, laps, time, lapTimes, score, ghost }) {
        const k = this.recordKey(track, car, laps);
        const res = { newRecord: false, newBestLap: false, newScore: false };
        if (this.data.records[k] == null || time < this.data.records[k]) {
            this.data.records[k] = time;
            res.newRecord = true;
            if (ghost) this.data.ghosts[k] = ghost;
        }
        const lk = `${track}_${car}`, best = Math.min(...lapTimes);
        if (Number.isFinite(best) && (this.data.bestLaps[lk] == null || best < this.data.bestLaps[lk])) {
            this.data.bestLaps[lk] = best;
            res.newBestLap = true;
        }
        if (score != null && (this.data.scores[lk] == null || score > this.data.scores[lk])) {
            this.data.scores[lk] = score;
            res.newScore = true;
        }
        this.write();
        return res;
    }

    /** Garde la meilleure médaille obtenue sur le circuit. Renvoie ce qui vient d'être débloqué. */
    awardMedal(track, medal) {
        const before = this.unlockSnapshot();
        const cur = this.data.medals[track];
        if (medal && (!cur || MEDALS[medal] > MEDALS[cur])) this.data.medals[track] = medal;
        this.write();
        return this.diffUnlocks(before);
    }
    awardCup() {
        const before = this.unlockSnapshot();
        this.data.cups++;
        this.write();
        return this.diffUnlocks(before);
    }
    points() {
        const m = Object.values(this.data.medals).reduce((a, x) => a + (MEDALS[x] ?? 0), 0);
        return m + this.data.cups * CUP_POINTS;
    }
    isVehicleUnlocked(id) { return this.points() >= (VEHICLES[id].unlock ?? 0); }
    isTrackUnlocked(id) { return this.points() >= (TRACK_DEFS[id].unlock ?? 0); }

    unlockSnapshot() {
        return {
            v: Object.keys(VEHICLES).filter(id => this.isVehicleUnlocked(id)),
            t: Object.keys(TRACK_DEFS).filter(id => this.isTrackUnlocked(id)),
        };
    }
    diffUnlocks(before) {
        const after = this.unlockSnapshot();
        return [
            ...after.v.filter(x => !before.v.includes(x)).map(x => VEHICLES[x].name),
            ...after.t.filter(x => !before.t.includes(x)).map(x => TRACK_DEFS[x].name),
        ];
    }
    resetProgress() {
        const keep = { prefs: this.data.prefs, settings: this.data.settings };
        this.data = { ...DEFAULT_DATA(), ...keep };
        this.write();
    }
}

function safeStorage() {
    try { return window.localStorage; } catch { return null; }
}

// ---------- Règles de score et de médailles (pures, donc testables) ----------

export function formatTime(sec) {
    if (sec == null || !Number.isFinite(sec)) return '--:--.--';
    const total = Math.max(0, Math.floor(sec * 100));
    const min = Math.floor(total / 6000), s = Math.floor(total / 100) % 60, cs = total % 100;
    return `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function medalForTime(time, par, laps) {
    const ref = par * laps;
    if (time <= ref) return 'gold';
    if (time <= ref * 1.15) return 'silver';
    if (time <= ref * 1.35) return 'bronze';
    return null;
}

export function medalForPosition(position, botCount) {
    if (botCount < 2) return null;              // une « victoire » sans vrai adversaire ne compte pas
    return position === 1 ? 'gold' : position === 2 ? 'silver' : position === 3 ? 'bronze' : null;
}

export function computeScore(time, topSpeed, stats) {
    return Math.round(120000 / Math.max(1, time) + topSpeed * 10 + stats.pads * 150 + stats.driftBoosts * 200 - stats.impacts * 100);
}
