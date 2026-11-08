// ============================================
// KART RACING Alpha 1.4 — Drift Tire Marks
// ============================================
import * as THREE from 'three';

const MARK_LIFETIME = 5000; // 5 seconds
const marks = []; // { mesh, createdAt }

const markMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
});
const markGeometry = new THREE.PlaneGeometry(0.3, 0.8);

/**
 * Spawn drift tire marks behind the car.
 * Call every frame when drifting.
 */
export function spawnDriftMarks(scene, kart) {
    // Place two marks (left + right rear wheels)
    const offsets = [
        new THREE.Vector3(-0.9, 0, -0.8),
        new THREE.Vector3(0.9, 0, -0.8),
    ];

    for (const offset of offsets) {
        const worldPos = offset.clone().applyQuaternion(kart.quaternion).add(kart.position);
        const mark = new THREE.Mesh(markGeometry, markMaterial.clone());
        mark.rotation.x = -Math.PI / 2;
        mark.rotation.z = kart.rotation.y;
        mark.position.set(worldPos.x, 0.03, worldPos.z);
        scene.add(mark);
        marks.push({ mesh: mark, createdAt: Date.now() });
    }
}

/**
 * Update (fade + cleanup) existing drift marks.
 * Call every frame.
 */
export function updateDriftMarks(scene) {
    const now = Date.now();
    for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i];
        const age = now - m.createdAt;
        if (age >= MARK_LIFETIME) {
            scene.remove(m.mesh);
            m.mesh.material.dispose();
            marks.splice(i, 1);
        } else {
            // Fade out
            m.mesh.material.opacity = 0.7 * (1 - age / MARK_LIFETIME);
        }
    }
}

/**
 * Clear all drift marks (e.g. on game reset)
 */
export function clearDriftMarks(scene) {
    for (const m of marks) {
        scene.remove(m.mesh);
        m.mesh.material.dispose();
    }
    marks.length = 0;
}
