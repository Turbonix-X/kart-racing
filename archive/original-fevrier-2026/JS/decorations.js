// ============================================
// KART RACING Alpha 1.4 — Grass Decorations
// ============================================
import * as THREE from 'three';

/**
 * Add decorations (flowers, grass tufts, stones) around the map.
 * Uses instanced meshes for performance.
 */
export function addDecorations(scene) {
    const rng = mulberry32(42); // seeded RNG for consistent placement

    addGrassTufts(scene, rng);
    addFlowers(scene, rng);
    addStones(scene, rng);
}

// Simple seeded PRNG
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function randInCircle(rng, radius) {
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

function addGrassTufts(scene, rng) {
    const count = 600;
    const geo = new THREE.ConeGeometry(0.2, 0.8, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a7a2e, roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        const pos = randInCircle(rng, 450);
        dummy.position.set(pos.x, 0.3, pos.z);
        dummy.scale.set(0.5 + rng() * 1.0, 0.5 + rng() * 1.5, 0.5 + rng() * 1.0);
        dummy.rotation.y = rng() * Math.PI * 2;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
}

function addFlowers(scene, rng) {
    const flowerColors = [0xff6b9d, 0xffd93d, 0xc084fc, 0xff8fa3, 0xffffff, 0x6dd5ed];
    const count = 300;

    // Stems
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d7a1e, roughness: 0.8 });
    const stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const dummy = new THREE.Object3D();

    // Petals (small spheres on top)
    const petalGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const pos = randInCircle(rng, 450);
        const h = 0.3 + rng() * 0.3;

        // Stem
        dummy.position.set(pos.x, h / 2, pos.z);
        dummy.scale.set(1, 0.8 + rng() * 0.5, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        stemMesh.setMatrixAt(i, dummy.matrix);

        // Petal
        dummy.position.set(pos.x, h + 0.1, pos.z);
        dummy.scale.set(1 + rng() * 0.5, 0.6 + rng() * 0.4, 1 + rng() * 0.5);
        dummy.updateMatrix();
        petalMesh.setMatrixAt(i, dummy.matrix);

        color.set(flowerColors[Math.floor(rng() * flowerColors.length)]);
        petalMesh.setColorAt(i, color);
    }

    stemMesh.instanceMatrix.needsUpdate = true;
    petalMesh.instanceMatrix.needsUpdate = true;
    petalMesh.instanceColor.needsUpdate = true;
    scene.add(stemMesh);
    scene.add(petalMesh);
}

function addStones(scene, rng) {
    const count = 200;
    const geo = new THREE.DodecahedronGeometry(0.3, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95, metalness: 0.1 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const pos = randInCircle(rng, 450);
        const scale = 0.3 + rng() * 0.8;
        dummy.position.set(pos.x, scale * 0.15, pos.z);
        dummy.scale.set(scale, scale * (0.4 + rng() * 0.6), scale);
        dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Slight color variation
        const grey = 0.3 + rng() * 0.4;
        color.setRGB(grey, grey * 0.95, grey * 0.9);
        mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
}
