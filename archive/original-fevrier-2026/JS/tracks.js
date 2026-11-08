// ============================================
// KART RACING Alpha 1.4 — Track Detection
// ============================================
// Store zigzag segments for precise off-track detection
let zigzagSegments = [];

/**
 * Build the zigzag segment list (call once at world creation)
 */
export function buildZigzagSegments() {
    zigzagSegments = [];
    for (let i = 0; i < 14; i++) {
        const ax = i * 50 - 300;
        const az = i % 2 === 0 ? 60 : -60;
        const bx = (i + 1) * 50 - 300;
        const bz = (i + 1) % 2 === 0 ? 60 : -60;
        zigzagSegments.push({ ax, az, bx, bz });
    }
}

/**
 * Distance from point (px, pz) to line segment (ax,az)-(bx,bz)
 */
function distToSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
    let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projZ = az + t * dz;
    return Math.sqrt((px - projX) ** 2 + (pz - projZ) ** 2);
}

/**
 * Check if position is on-track
 */
export function isOnTrack(trackChoice, position) {
    if (trackChoice === 'ovale') {
        const d = Math.sqrt(
            Math.pow(position.x / 180, 2) + Math.pow(position.z / 120, 2)
        );
        return Math.abs(d - 1) < 0.15;
    } else if (trackChoice === 'zigzag') {
        // Segment-based detection: on-track if within 22 units of any segment
        const trackWidth = 22;
        for (const seg of zigzagSegments) {
            const d = distToSegment(position.x, position.z, seg.ax, seg.az, seg.bx, seg.bz);
            if (d < trackWidth) return true;
        }
        return false;
    } else {
        // Infinite straight
        return Math.abs(position.x) < 22;
    }
}

/**
 * Check if track has laps
 */
export function hasLaps(trackChoice) {
    return trackChoice === 'ovale';
}
