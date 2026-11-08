// ============================================
// KART RACING Alpha 1.4 — Car Builder
// ============================================
import * as THREE from 'three';

/**
 * Build the kart group based on carType and selectedColor
 */
export function buildKartModel(carType, selectedColor) {
    const kart = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: selectedColor, metalness: 0.6, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.05 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.5 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    const rearLightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.1, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 });

    if (carType === 'f1') {
        const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 3.0), bodyMat);
        bodyMain.position.y = 0.25; kart.add(bodyMain); bodyMain.castShadow = true;
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 1.0), bodyMat);
        nose.position.set(0, 0.2, 2.0); kart.add(nose); nose.castShadow = true;
        const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.7), darkMat);
        cockpit.position.set(0, 0.55, -0.2); kart.add(cockpit);
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.05), glassMat);
        windshield.position.set(0, 0.6, 0.15); kart.add(windshield);
        const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), chromeMat);
        wingPillarL.position.set(-0.5, 0.55, -1.4); kart.add(wingPillarL);
        const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), chromeMat);
        wingPillarR.position.set(0.5, 0.55, -1.4); kart.add(wingPillarR);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), bodyMat);
        wing.position.set(0, 0.85, -1.4); kart.add(wing); wing.castShadow = true;
        const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), darkMat);
        intakeL.position.set(-0.7, 0.3, -0.5); kart.add(intakeL);
        const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), darkMat);
        intakeR.position.set(0.7, 0.3, -0.5); kart.add(intakeR);
        const headlightL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lightMat);
        headlightL.position.set(-0.2, 0.25, 2.45); kart.add(headlightL);
        const headlightR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lightMat);
        headlightR.position.set(0.2, 0.25, 2.45); kart.add(headlightR);
        const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.02), rearLightMat);
        tailL.position.set(-0.45, 0.35, -1.5); kart.add(tailL);
        const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.02), rearLightMat);
        tailR.position.set(0.45, 0.35, -1.5); kart.add(tailR);
        const wR = 0.35, wW = 0.35;
        [[-0.9, wR, 1.2], [0.9, wR, 1.2], [-0.9, wR, -1.0], [0.9, wR, -1.0]].forEach(p => {
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, wW, 16), tireMat);
            tire.rotation.z = Math.PI / 2; tire.position.set(...p); kart.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.5, wR * 0.5, wW + 0.02, 8), rimMat);
            rim.rotation.z = Math.PI / 2; rim.position.set(...p); kart.add(rim);
        });

    } else if (carType === 'truck') {
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.8), darkMat);
        chassis.position.y = 0.8; kart.add(chassis);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.4), bodyMat);
        cabin.position.set(0, 1.5, -0.2); kart.add(cabin); cabin.castShadow = true;
        const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.2), bodyMat);
        bed.position.set(0, 1.1, -1.0); kart.add(bed); bed.castShadow = true;
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.0), bodyMat);
        hood.position.set(0, 1.1, 0.9); kart.add(hood); hood.castShadow = true;
        const ws = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.08), glassMat);
        ws.position.set(0, 1.7, 0.5); ws.rotation.x = -0.2; kart.add(ws);
        const bull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.1), chromeMat);
        bull.position.set(0, 1.1, 1.4); kart.add(bull);
        const headlightL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightMat);
        headlightL.position.set(-0.5, 1.2, 1.41); kart.add(headlightL);
        const headlightR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightMat);
        headlightR.position.set(0.5, 1.2, 1.41); kart.add(headlightR);
        for (let i = -2; i <= 2; i++) {
            const rl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), lightMat);
            rl.position.set(i * 0.25, 1.95, -0.1); kart.add(rl);
        }
        const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), rearLightMat);
        tailL.position.set(-0.6, 1.15, -1.6); kart.add(tailL);
        const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), rearLightMat);
        tailR.position.set(0.6, 1.15, -1.6); kart.add(tailR);
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), chromeMat);
        exhaust.position.set(0.7, 1.4, -0.8); exhaust.rotation.x = -0.3; kart.add(exhaust);
        const wR = 0.7, wW = 0.55;
        [[-1.1, wR, 1.1], [1.1, wR, 1.1], [-1.1, wR, -1.1], [1.1, wR, -1.1]].forEach(p => {
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, wW, 16), tireMat);
            tire.rotation.z = Math.PI / 2; tire.position.set(...p); kart.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.45, wR * 0.45, wW + 0.02, 6), rimMat);
            rim.rotation.z = Math.PI / 2; rim.position.set(...p); kart.add(rim);
        });

    } else if (carType === 'sport') {
        const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 2.8), bodyMat);
        bodyMain.position.y = 0.35; kart.add(bodyMain); bodyMain.castShadow = true;
        const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.0), bodyMat);
        hoodMesh.position.set(0, 0.5, 1.1); hoodMesh.rotation.x = -0.1; kart.add(hoodMesh); hoodMesh.castShadow = true;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.0), bodyMat);
        roof.position.set(0, 0.7, -0.1); kart.add(roof); roof.castShadow = true;
        const ws = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.08), glassMat);
        ws.position.set(0, 0.65, 0.4); ws.rotation.x = -0.3; kart.add(ws);
        const rw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.08), glassMat);
        rw.position.set(0, 0.65, -0.6); rw.rotation.x = 0.3; kart.add(rw);
        const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.15), lightMat);
        headlightL.position.set(-0.55, 0.4, 1.55); kart.add(headlightL);
        const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.15), lightMat);
        headlightR.position.set(0.55, 0.4, 1.55); kart.add(headlightR);
        const tailBand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.02), rearLightMat);
        tailBand.position.set(0, 0.4, -1.4); kart.add(tailBand);
        const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.3), darkMat);
        diffuser.position.set(0, 0.18, -1.35); kart.add(diffuser);
        const exhL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), chromeMat);
        exhL.position.set(-0.3, 0.2, -1.5); exhL.rotation.x = Math.PI / 2; kart.add(exhL);
        const exhR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), chromeMat);
        exhR.position.set(0.3, 0.2, -1.5); exhR.rotation.x = Math.PI / 2; kart.add(exhR);
        const wR = 0.32, wW = 0.3;
        [[-0.85, wR, 1.0], [0.85, wR, 1.0], [-0.85, wR, -0.9], [0.85, wR, -0.9]].forEach(p => {
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, wW, 16), tireMat);
            tire.rotation.z = Math.PI / 2; tire.position.set(...p); kart.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.6, wR * 0.6, wW + 0.02, 5), rimMat);
            rim.rotation.z = Math.PI / 2; rim.position.set(...p); kart.add(rim);
        });

    } else if (carType === 'muscle') {
        const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 3.0), bodyMat);
        bodyMain.position.y = 0.4; kart.add(bodyMain); bodyMain.castShadow = true;
        const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.4), bodyMat);
        hoodMesh.position.set(0, 0.6, 0.8); kart.add(hoodMesh);
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), darkMat);
        scoop.position.set(0, 0.75, 0.9); kart.add(scoop);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.9), bodyMat);
        roof.position.set(0, 0.75, -0.3); kart.add(roof); roof.castShadow = true;
        const ws = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.08), glassMat);
        ws.position.set(0, 0.7, 0.15); ws.rotation.x = -0.25; kart.add(ws);
        const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.08), glassMat);
        rwMesh.position.set(0, 0.7, -0.75); rwMesh.rotation.x = 0.25; kart.add(rwMesh);
        const headlightL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
        headlightL.position.set(-0.6, 0.5, 1.5); kart.add(headlightL);
        const headlightR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
        headlightR.position.set(0.6, 0.5, 1.5); kart.add(headlightR);
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.05), chromeMat);
        grille.position.set(0, 0.4, 1.5); kart.add(grille);
        const tailL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), rearLightMat);
        tailL.position.set(-0.6, 0.45, -1.5); kart.add(tailL);
        const tailR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), rearLightMat);
        tailR.position.set(0.6, 0.45, -1.5); kart.add(tailR);
        const exhL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), chromeMat);
        exhL.position.set(-0.9, 0.25, -1.0); exhL.rotation.x = Math.PI / 2; kart.add(exhL);
        const exhR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), chromeMat);
        exhR.position.set(0.9, 0.25, -1.0); exhR.rotation.x = Math.PI / 2; kart.add(exhR);
        [[-0.95, 0.33, 1.1, 0.33], [0.95, 0.33, 1.1, 0.33], [-0.95, 0.4, -1.0, 0.4], [0.95, 0.4, -1.0, 0.4]].forEach(p => {
            const r = p[3];
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 16), tireMat);
            tire.rotation.z = Math.PI / 2; tire.position.set(p[0], p[1], p[2]); kart.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.37, 5), rimMat);
            rim.rotation.z = Math.PI / 2; rim.position.set(p[0], p[1], p[2]); kart.add(rim);
        });

    } else if (carType === 'drift') {
        const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.6), bodyMat);
        bodyMain.position.y = 0.3; kart.add(bodyMain); bodyMain.castShadow = true;
        const fenderFL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), bodyMat);
        fenderFL.position.set(-0.85, 0.35, 0.8); kart.add(fenderFL);
        const fenderFR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), bodyMat);
        fenderFR.position.set(0.85, 0.35, 0.8); kart.add(fenderFR);
        const fenderRL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), bodyMat);
        fenderRL.position.set(-0.85, 0.35, -0.7); kart.add(fenderRL);
        const fenderRR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), bodyMat);
        fenderRR.position.set(0.85, 0.35, -0.7); kart.add(fenderRR);
        const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.0), bodyMat);
        hoodMesh.position.set(0, 0.48, 0.8); kart.add(hoodMesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.9), bodyMat);
        roof.position.set(0, 0.6, -0.1); kart.add(roof); roof.castShadow = true;
        const ws = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.08), glassMat);
        ws.position.set(0, 0.55, 0.35); ws.rotation.x = -0.35; kart.add(ws);
        const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), chromeMat);
        wingPillarL.position.set(-0.55, 0.65, -1.2); kart.add(wingPillarL);
        const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), chromeMat);
        wingPillarR.position.set(0.55, 0.65, -1.2); kart.add(wingPillarR);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.35), bodyMat);
        wing.position.set(0, 0.9, -1.2); kart.add(wing); wing.castShadow = true;
        const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.3), darkMat);
        splitter.position.set(0, 0.15, 1.35); kart.add(splitter);
        const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.2), darkMat);
        skirtL.position.set(-0.8, 0.15, 0); kart.add(skirtL);
        const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.2), darkMat);
        skirtR.position.set(0.8, 0.15, 0); kart.add(skirtR);
        const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), lightMat);
        headlightL.position.set(-0.5, 0.38, 1.3); kart.add(headlightL);
        const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), lightMat);
        headlightR.position.set(0.5, 0.38, 1.3); kart.add(headlightR);
        const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.02), rearLightMat);
        tailL.position.set(-0.5, 0.38, -1.3); kart.add(tailL);
        const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.02), rearLightMat);
        tailR.position.set(0.5, 0.38, -1.3); kart.add(tailR);
        const wR = 0.3, wW = 0.32;
        [[-0.9, wR, 0.9], [0.9, wR, 0.9], [-0.9, wR, -0.8], [0.9, wR, -0.8]].forEach(p => {
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, wW, 16), tireMat);
            tire.rotation.z = Math.PI / 2; tire.position.set(...p); kart.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.65, wR * 0.65, wW + 0.02, 6), rimMat);
            rim.rotation.z = Math.PI / 2; rim.position.set(...p); kart.add(rim);
        });
    }

    kart.castShadow = true;
    return kart;
}
