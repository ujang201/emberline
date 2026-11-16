// Kestrel Freight Yard — an original map, never a copy of a commercial map.
// 46 x 36 m yard, three lanes: North Lane (long sightline to Site A), Mid (crates and
// a crane gantry), South Lane (containers to Site B). Two bomb sites: Crane Deck (A,
// north-west) and Silo Bay (B, south-east). Wardens spawn west, Raiders east.
// Every box is a collider for movement and a surface bullets stop on. Palette: dusk
// amber key light, cool fill, concrete / steel / rust containers, olive crates.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const SITES = {
  A: { name: 'Crane Deck', x: -16, z: -11, r: 3.4 },
  B: { name: 'Silo Bay', x: 16, z: 11, r: 3.4 },
};
export const SPAWNS = {
  us: [{ x: -19, z: 0, yaw: -Math.PI / 2 }, { x: -19, z: -4, yaw: -Math.PI / 2 }, { x: -19, z: 4, yaw: -Math.PI / 2 }],
  them: [{ x: 19, z: -6, yaw: Math.PI / 2 }, { x: 19, z: 0, yaw: Math.PI / 2 }, { x: 19, z: 6, yaw: Math.PI / 2 }, { x: 15, z: -12, yaw: Math.PI / 2 }],
};
// Waypoint graph bots patrol/hold on: [x, z] nodes, edges implied by list order + links.
export const ROUTES = {
  mid: [[-14, 0], [-6, 0], [0, 0], [6, 0], [14, 0]],
  north: [[-14, -8], [-6, -10], [0, -12], [8, -12], [16, -11]],
  south: [[-14, 8], [-6, 10], [0, 12], [8, 12], [16, 11]],
  aHold: [[-16, -11], [-12, -8], [-18, -6]],
  bHold: [[16, 11], [12, 8], [18, 6]],
};

export function createWorld(scene) {
  const group = new THREE.Group(); scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE[name]), roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92, metalness: 0.03 });
  }
  const colliders = []; const shootables = [];
  function box(w, h, d, x, y, z, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[mat]);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    const b = new THREE.Box3().setFromObject(mesh);
    if (collide) colliders.push(b);
    shootables.push(mesh);
    return mesh;
  }
  function container(x, z, mat, rotY = 0) { // 6m shipping container, 2.6m high
    const m = box(6, 2.6, 2.4, x, 1.3, z, mat); m.rotation.y = rotY; return m;
  }
  // Floor + perimeter (46 x 36, walls 4.6m)
  box(46.4, 0.4, 36.4, 0, -0.2, 0, 'surface');
  box(0.4, 4.6, 36.4, -23.2, 2.3, 0, 'surface');
  box(0.4, 4.6, 36.4, 23.2, 2.3, 0, 'surface');
  box(46.4, 4.6, 0.4, 0, 2.3, -18.2, 'surface');
  box(46.4, 4.6, 0.4, 0, 2.3, 18.2, 'surface');
  // Site markers: flat amber/teal pads (no collision) + site crates
  function sitePad(site, mat) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(site.r * 2, 0.06, site.r * 2), materials[mat]);
    pad.position.set(site.x, 0.03, site.z); pad.receiveShadow = true; group.add(pad);
  }
  sitePad(SITES.A, 'accent'); sitePad(SITES.B, 'teal');
  // North lane: crane gantry legs + long wall segments create the A sightline
  box(1.0, 5.2, 1.0, -10, 2.6, -13, 'hairline'); box(1.0, 5.2, 1.0, -2, 2.6, -13, 'hairline');
  box(9.5, 0.8, 1.2, -6, 5.0, -13, 'rust');
  box(8, 1.1, 1.2, -12, 0.55, -6, 'hairline'); box(1.2, 1.1, 4, -4, 0.55, -9, 'hairline');
  box(2.4, 2.2, 2.4, -16, 1.1, -6, 'olive');
  // Mid: crate maze + central pillar, crouch cover
  box(1.2, 3.4, 1.2, 0, 1.7, 0, 'hairline');
  box(3.6, 1.1, 1.2, -5, 0.55, 2, 'olive'); box(1.2, 1.1, 3.6, 5, 0.55, -2, 'olive');
  box(1.6, 0.7, 1.6, -8, 0.35, -2, 'olive'); box(1.6, 0.7, 1.6, 8, 0.35, 2, 'olive');
  box(2.4, 0.9, 1.2, -2, 0.45, 6, 'hairline'); box(2.4, 0.9, 1.2, 3, 0.45, -6, 'hairline');
  container(-1, 8, 'rust'); container(2, -9, 'teal');
  // South lane: containers form the B approach, with a gap to peek through
  container(10, 9, 'rust'); container(12, 13, 'olive'); container(-12, 12, 'teal');
  box(1.2, 1.1, 3.6, 8, 0.55, 5, 'hairline'); box(3.6, 1.1, 1.2, 14, 0.55, 4, 'olive');
  // East (Raider) side: silo cylinders (as boxes with round look via cylinders) + cover
  const siloMat = materials.surface;
  for (const [sx, sz] of [[18, -14], [18, 14]]) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 16), siloMat);
    silo.position.set(sx, 2.5, sz); silo.castShadow = true; silo.receiveShadow = true; group.add(silo);
    colliders.push(new THREE.Box3().setFromObject(silo)); shootables.push(silo);
  }
  box(2, 1.4, 2, 16, 0.7, -4, 'hairline'); box(2, 1.4, 2, 16, 0.7, 4, 'hairline');
  // Raised platform at A (walkable step 0.5m, bots/player step onto it via floor collider)
  box(6, 0.5, 3, -16, 0.25, -14, 'surface');
  // Dusk lighting: warm amber key, cool fill, hemisphere sky/ground
  scene.add(new THREE.HemisphereLight(new THREE.Color(PALETTE.ink), new THREE.Color(PALETTE.surface), 1.9));
  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.accent), 2.8);
  key.position.set(12, 16, 8); key.target.position.set(0, 0, -3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26; key.shadow.camera.right = 26; key.shadow.camera.top = 22; key.shadow.camera.bottom = -22; key.shadow.camera.far = 60; key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.9);
  fill.position.set(-10, 10, 12); scene.add(fill);
  // Site beacons: tall amber/teal poles so sites read at a glance
  for (const [site, mat] of [[SITES.A, 'accent'], [SITES.B, 'teal']]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), materials[mat]);
    pole.position.set(site.x + site.r, 2.1, site.z); group.add(pole);
    const lamp = new THREE.PointLight(new THREE.Color(PALETTE[mat]), 6, 9);
    lamp.position.set(site.x, 3.2, site.z); scene.add(lamp);
  }
  return { colliders, shootables, group };
}
// Segment vs AABB line-of-sight: true when no collider blocks a->b. Used by bots.
export function hasLineOfSight(a, b, colliders) {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    // Slab test, ignoring boxes whose top is below both eye heights (floor/platform)
    if (box.max.y < Math.min(a.y, b.y) - 0.1) continue;
    let tmin = 0, tmax = 1, hit = true;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const mins = [box.min.x - a.x, box.min.y - a.y, box.min.z - a.z];
    const maxs = [box.max.x - a.x, box.max.y - a.y, box.max.z - a.z];
    const ds = [dx, dy, dz];
    for (let ax = 0; ax < 3; ax++) {
      if (Math.abs(ds[ax]) < 1e-8) { if (mins[ax] > 0 || maxs[ax] < 0) { hit = false; break; } }
      else {
        let t1 = mins[ax] / ds[ax], t2 = maxs[ax] / ds[ax];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { hit = false; break; }
      }
    }
    if (hit && tmax > 0.02 && tmin < 0.98) return false;
  }
  return true;
}
