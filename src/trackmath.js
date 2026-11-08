// ============================================================
//  Géométrie des circuits : un seul tracé fait référence.
//  L'image de la piste, la détection hors-piste, les murs, l'IA
//  et le comptage des tours utilisent tous ces mêmes échantillons.
// ============================================================

const SPACING = 2;      // distance entre deux échantillons

function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/** Échantillonne la courbe passant par les points [x, z, demi-largeur]. */
function sampleCurve(points, closed) {
    const n = points.length;
    const at = i => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
    const raw = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
        const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
        for (let k = 0; k < 40; k++) {
            const t = k / 40;
            raw.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t), b[2] + (c[2] - b[2]) * (t * t * (3 - 2 * t))]);
        }
    }
    if (closed) raw.push(raw[0].slice()); else raw.push(points[n - 1].slice());

    // Rééchantillonnage à distance constante
    const out = [raw[0]];
    let acc = 0;
    for (let i = 1; i < raw.length; i++) {
        let [ax, az, aw] = raw[i - 1];
        const [bx, bz, bw] = raw[i];
        let seg = Math.hypot(bx - ax, bz - az);
        while (acc + seg >= SPACING) {
            const f = (SPACING - acc) / seg;
            ax += (bx - ax) * f; az += (bz - az) * f; aw += (bw - aw) * f;
            out.push([ax, az, aw]);
            seg = Math.hypot(bx - ax, bz - az);
            acc = 0;
        }
        acc += seg;
    }
    return out;
}

export class Track {
    constructor(def) {
        this.def = def;
        this.id = def.id;
        this.name = def.name;
        this.closed = !!def.closed;
        this.runoff = def.runoff;
        this.spacing = SPACING;

        const pts = sampleCurve(def.points, this.closed);
        if (this.closed && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < SPACING * 0.5) pts.pop();
        const n = this.n = pts.length;
        this.x = new Float32Array(n); this.z = new Float32Array(n); this.w = new Float32Array(n);
        this.tx = new Float32Array(n); this.tz = new Float32Array(n);
        this.curv = new Float32Array(n);
        pts.forEach((p, i) => { this.x[i] = p[0]; this.z[i] = p[1]; this.w[i] = p[2]; });
        this.length = this.closed ? n * SPACING : (n - 1) * SPACING;

        for (let i = 0; i < n; i++) {
            const a = this.wrap(i - 1), b = this.wrap(i + 1);
            const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], l = Math.hypot(dx, dz) || 1;
            this.tx[i] = dx / l; this.tz[i] = dz / l;
        }
        const h = 4;
        for (let i = 0; i < n; i++) {
            const a = this.wrap(i - h), b = this.wrap(i + h);
            const cross = this.tx[a] * this.tz[b] - this.tz[a] * this.tx[b];
            const dot = this.tx[a] * this.tx[b] + this.tz[a] * this.tz[b];
            this.curv[i] = Math.abs(Math.atan2(cross, dot)) / (2 * h * SPACING);
        }

        // Ligne de départ et d'arrivée, en distance le long du tracé
        this.startS = this.closed ? 0 : (def.startAt ?? 40);
        this.finishS = this.closed ? this.length : this.length - (def.runout ?? 150);
        this.raceLength = this.finishS - this.startS;

        // Raccourcis : couloirs praticables hors du tracé principal
        this.corridors = (def.shortcuts ?? []).map(c => ({ pts: c.points, half: c.half }));

        // Bbox pour la mini-carte et le décor
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < n; i++) {
            minX = Math.min(minX, this.x[i]); maxX = Math.max(maxX, this.x[i]);
            minZ = Math.min(minZ, this.z[i]); maxZ = Math.max(maxZ, this.z[i]);
        }
        this.bbox = { minX, maxX, minZ, maxZ };
    }

    wrap(i) {
        if (this.closed) return ((i % this.n) + this.n) % this.n;
        return Math.max(0, Math.min(this.n - 1, i));
    }
    indexAt(s) { return this.wrap(Math.round(s / SPACING)); }

    /** Position d'un point du tracé décalé latéralement. */
    pointAt(s, lat = 0) {
        const i = this.indexAt(s);
        return { x: this.x[i] + this.tz[i] * lat, z: this.z[i] - this.tx[i] * lat, tx: this.tx[i], tz: this.tz[i], heading: Math.atan2(this.tx[i], this.tz[i]), width: this.w[i] };
    }

    /**
     * Trouve le point du tracé le plus proche. Remplit `out` :
     * idx, s (distance), d (écart absolu), lat (écart signé), width, limit (distance du mur), tangente.
     * `hint` : dernier index connu, pour rester sur la bonne portion de piste.
     */
    locate(x, z, hint, out) {
        const n = this.n;
        let best = -1, bestD = Infinity;
        if (hint >= 0) {
            for (let k = -30; k <= 30; k++) {
                const i = this.closed ? ((hint + k) % n + n) % n : hint + k;
                if (i < 0 || i >= n) continue;
                const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz;
                if (d < bestD) { bestD = d; best = i; }
            }
        }
        // Trop loin de la zone attendue : recherche complète
        if (best < 0 || Math.sqrt(bestD) > this.w[best] + this.runoff + 4) {
            for (let i = 0; i < n; i++) {
                const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz;
                if (d < bestD) { bestD = d; best = i; }
            }
        }
        // Affinage : projection sur les deux segments voisins
        let bestS = best * SPACING, px = this.x[best], pz = this.z[best], pw = this.w[best];
        bestD = Infinity;
        for (let k = -1; k <= 0; k++) {
            const a = this.closed ? ((best + k) % n + n) % n : best + k;
            const b = this.closed ? (a + 1) % n : a + 1;
            if (a < 0 || b >= n) continue;
            const ax = this.x[a], az = this.z[a], dx = this.x[b] - ax, dz = this.z[b] - az;
            const l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
            const qx = ax + dx * t, qz = az + dz * t;
            const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
            if (d < bestD) {
                bestD = d; px = qx; pz = qz;
                bestS = (a + t) * SPACING;
                pw = this.w[a] + (this.w[b] - this.w[a]) * t;
            }
        }
        const tx = this.tx[best], tz = this.tz[best];
        out.idx = best;
        out.s = this.closed ? ((bestS % this.length) + this.length) % this.length : bestS;
        out.d = Math.sqrt(bestD);
        out.lat = (x - px) * tz - (z - pz) * tx;
        out.width = pw;
        out.limit = pw + this.runoff;
        out.tx = tx; out.tz = tz; out.px = px; out.pz = pz;
        return out;
    }

    /** Écart à la portion de piste la plus proche (recherche complète, sans mémoire). */
    distanceFree(x, z) {
        let bestD = Infinity, best = 0;
        for (let i = 0; i < this.n; i += 2) {
            const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz;
            if (d < bestD) { bestD = d; best = i; }
        }
        return { d: Math.sqrt(bestD), idx: best, limit: this.w[best] + this.runoff, width: this.w[best] };
    }

    /** Point le plus proche dans un couloir de raccourci, ou null. Renvoie aussi l'écart. */
    corridorInfo(x, z) {
        let found = null;
        for (const c of this.corridors) {
            for (let i = 0; i < c.pts.length - 1; i++) {
                const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1];
                const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
                const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
                const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
                if (!found || d < found.d) found = { d, qx, qz, half: c.half };
            }
        }
        return found;
    }

    /** Vrai si la position est sur le bitume dessiné. */
    isOnRoad(x, z) {
        const q = this.locate(x, z, -1, {});
        return q.d <= q.width;
    }

    /** Distance orientée a → b le long du tracé (gère le bouclage). */
    deltaS(a, b) {
        let d = b - a;
        if (this.closed) {
            if (d > this.length / 2) d -= this.length;
            else if (d < -this.length / 2) d += this.length;
        }
        return d;
    }
}
