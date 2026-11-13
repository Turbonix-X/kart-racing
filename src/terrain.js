// ============================================================
//  Relief : hauteur de la piste et du terrain autour.
//  Seuls les biomes avec `elevation` (la montagne) ont du relief ;
//  partout ailleurs tout reste à plat (hauteur 0).
//  Données pures, sans rendu : la simulation et les tests l'utilisent.
// ============================================================

/** Bruit lissé, déterministe : collines et vallées autour de la piste. */
function hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
}
export function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export function fbm(x, z) {
    return vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 5, z * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 17, z * 4.3 + 3) * 0.15;
}

const MAX_SLOPE = 0.16;            // 16 % : ça se grimpe à fond de gaz

export class Elevation {
    /** @param track tracé (trackmath) · @param biome données du biome (biomes.js) */
    constructor(track, biome) {
        const amp = biome?.elevation ?? 0;
        const n = track.n, sp = track.spacing;
        this.track = track;
        this.flat = !amp;
        this.y = new Float32Array(n);
        this.slope = new Float32Array(n);
        if (this.flat) return;

        const L = track.length;
        const heights = track.def.heights;
        for (let i = 0; i < n; i++) {
            const f = (i * sp) / L;
            let h;
            if (heights) {
                // Profil dessiné à la main : [fraction, hauteur], lissé
                let k = 0;
                while (k < heights.length - 2 && heights[k + 1][0] < f) k++;
                const [f0, h0] = heights[k], [f1, h1] = heights[k + 1];
                const t = Math.max(0, Math.min(1, (f - f0) / (f1 - f0 || 1)));
                h = h0 + (h1 - h0) * t * t * (3 - 2 * t);
            } else if (track.closed) {
                // Harmoniques entières : la boucle se referme à la même hauteur
                const u = f * Math.PI * 2;
                h = 0.62 * Math.sin(2 * u + 0.6) + 0.38 * Math.sin(3 * u + 1.7);
                h *= Math.min(amp, (MAX_SLOPE * L) / 15);
            } else {
                const u = f * Math.PI;
                h = (Math.sin(u) * 0.8 + Math.sin(3 * u) * 0.2) * Math.min(amp, (MAX_SLOPE * L) / 8);
            }
            this.y[i] = h;
        }
        // Une ligne droite au départ : la grille reste à plat
        this.flattenAround(track.startS, 40);
        for (let i = 0; i < n; i++) {
            const a = track.wrap(i - 2), b = track.wrap(i + 2);
            const ds = (track.closed ? 4 : (b - a)) * sp || 1;
            this.slope[i] = (this.y[b] - this.y[a]) / ds;
        }
        let lo = Infinity, hi = -Infinity;
        for (const h of this.y) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
        this.min = lo; this.max = hi;
    }

    flattenAround(s, len) {
        const t = this.track, i0 = t.indexAt(s), r = Math.round(len / t.spacing);
        const h = this.y[i0];
        for (let k = -r * 2; k <= r * 2; k++) {
            const i = t.wrap(i0 + k);
            if (!t.closed && (i0 + k < 0 || i0 + k >= t.n)) continue;
            const w = Math.min(1, Math.max(0, (Math.abs(k) - r) / r));
            this.y[i] = h + (this.y[i] - h) * w;
        }
    }

    /** Hauteur de la piste à la distance s. */
    atS(s) {
        if (this.flat) return 0;
        const t = this.track, f = s / t.spacing, i = Math.floor(f), k = f - i;
        const a = this.y[t.wrap(i)], b = this.y[t.wrap(i + 1)];
        return a + (b - a) * k;
    }
    slopeAtS(s) { return this.flat ? 0 : this.slope[this.track.indexAt(s)]; }
    /** Hauteur sous un véhicule, d'après sa position sur le tracé (nav). */
    at(nav) { return this.flat ? 0 : this.atS(nav.s); }

    /**
     * Hauteur du terrain n'importe où (décor, sol 3D). Près de la piste, le terrain
     * suit la route un peu en dessous ; plus loin il monte en falaise ou plonge en vallée.
     */
    terrainAt(x, z) {
        if (this.flat) return 0;
        return this.terrainFrom(x, z, this.nearest(x, z));
    }

    /** Échantillon de piste le plus proche, avec une grille d'accélération (le sol 3D en demande des milliers). */
    nearest(x, z) {
        const t = this.track, C = 40;
        if (!this.grid) {
            this.grid = new Map();
            for (let i = 0; i < t.n; i++) {
                const k = `${Math.floor(t.x[i] / C)},${Math.floor(t.z[i] / C)}`;
                if (!this.grid.has(k)) this.grid.set(k, []);
                this.grid.get(k).push(i);
            }
        }
        const cx = Math.floor(x / C), cz = Math.floor(z / C);
        let best = -1, bestD = Infinity;
        for (let r = 0; r < 60; r++) {
            for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
                if (Math.max(Math.abs(gx - cx), Math.abs(gz - cz)) !== r) continue;
                const list = this.grid.get(`${gx},${gz}`);
                if (!list) continue;
                for (const i of list) {
                    const dx = x - t.x[i], dz = z - t.z[i], d = dx * dx + dz * dz;
                    if (d < bestD) { bestD = d; best = i; }
                }
            }
            // Plus rien de plus proche ne peut exister au-delà de cet anneau
            if (best >= 0 && Math.sqrt(bestD) < r * C) break;
        }
        if (best < 0) return t.distanceFree(x, z);
        return { d: Math.sqrt(bestD), idx: best, limit: t.w[best] + t.runoff, width: t.w[best] };
    }
    terrainFrom(x, z, near) {
        if (this.flat) return 0;
        const base = this.y[near.idx] - 0.35;
        const extra = near.d - near.limit - 7;
        if (extra <= 0) return base;
        const n = fbm(x * 0.006, z * 0.006);
        const side = fbm(x * 0.0021 + 40, z * 0.0021 - 12) > 0.42 ? 1 : -0.55;     // falaise ou vallée
        const rise = (1 - Math.exp(-extra / 70)) * (40 + n * 90) + extra * 0.06 * n;
        return base + rise * side;
    }
}
