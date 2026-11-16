// The charge: plant it at Crane Deck (A) or Silo Bay (B), then defend it. Holding E
// inside a site for PLANT_TIME plants it; the 35 s fuse then runs and Raiders walk
// in to defuse (their channel is DEFUSE_TIME in bots.js). Detonation wins the round
// for the Wardens; defusal loses it. One shared mesh + light, reused every round.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { SITES } from './world.js';

export function createBomb(scene) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.4, metalness: 0.4 }));
  box.position.y = 0.16; box.castShadow = true;
  const light = new THREE.PointLight(new THREE.Color(PALETTE.rust), 0, 8);
  light.position.y = 0.6;
  group.add(box, light); group.visible = false; scene.add(group);
  let blink = 0;
  return {
    group,
    siteAt(x, z) {
      for (const key of Object.keys(SITES)) {
        const s = SITES[key];
        if (Math.hypot(x - s.x, z - s.z) <= s.r) return { key, ...s };
      }
      return null;
    },
    show(site, planted) { group.position.set(site.x, 0, site.z); group.visible = true; light.intensity = planted ? 4 : 0; },
    hide() { group.visible = false; light.intensity = 0; },
    step(dt, planted) {
      if (!planted) return;
      blink += dt;
      light.intensity = (blink % 1 < 0.12) ? 8 : 1.5; // beeping blink
    },
  };
}
