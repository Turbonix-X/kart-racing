// ============================================
// KART RACING Alpha 1.4 — Best Time (localStorage)
// ============================================

const STORAGE_KEY = 'kartRacing_bestTimes';

function getAllTimes() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function makeKey(track, car) {
    return `${track}_${car}`;
}

/**
 * Get the best time for a track+car combo.
 * @returns {number|null} best time in milliseconds, or null
 */
export function getBestTime(track, car) {
    const times = getAllTimes();
    const key = makeKey(track, car);
    return times[key] ?? null;
}

/**
 * Try to save a new time. Returns true if it's a new record.
 * @param {string} track
 * @param {string} car
 * @param {number} timeMs - time in milliseconds
 * @returns {boolean}
 */
export function saveBestTime(track, car, timeMs) {
    const times = getAllTimes();
    const key = makeKey(track, car);
    const prev = times[key] ?? null;
    if (prev === null || timeMs < prev) {
        times[key] = timeMs;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
        } catch { /* localStorage full, ignore */ }
        return true;
    }
    return false;
}

/**
 * Format milliseconds into mm:ss.ms
 */
export function formatTime(ms) {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
