// Effects with a fixed pool — no new objects per frame in the hot loop (criterion 5).
// Tracers (8 stretched boxes), explosion (one sphere + light + 12 debris boxes),
// grenade (one mesh, ballistic). Everything is pre-allocated in createEffects and
// only shown/hidden and repositioned afterwards.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createEffects(scene) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.85 });
  const tracers = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), tracerMat);
    m.visible = false; scene.add(m); tracers.push({ mesh: m, left: 0 });
  }
  const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 }));
  boom.visible = false; scene.add(boom);
  const boomLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 18); scene.add(boomLight);
  const debris = [];
  const debrisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.rust), roughness: 0.7 });
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), debrisMat);
    m.visible = false; scene.add(m); debris.push({ mesh: m, vel: new THREE.Vector3(), left: 0 });
  }
  const grenade = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.4, metalness: 0.5 }));
  grenade.visible = false; scene.add(grenade);
  const g = { active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), timer: 0 };
  let boomLeft = 0; let ti = 0;
  const _mid = new THREE.Vector3();
  return {
    tracer(from, to) {
      const t = tracers[ti]; ti = (ti + 1) % tracers.length;
      _mid.addVectors(from, to).multiplyScalar(0.5);
      t.mesh.position.copy(_mid);
      t.mesh.lookAt(to); t.mesh.scale.z = from.distanceTo(to); t.mesh.visible = true; t.left = 0.07;
    },
    explosion(pos) {
      boom.position.copy(pos); boom.visible = true; boom.scale.setScalar(0.4); boomLeft = 0.5;
      boomLight.position.copy(pos); boomLight.intensity = 60;
      for (let i = 0; i < debris.length; i++) {
        const d = debris[i]; d.mesh.position.copy(pos);
        d.vel.set((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8);
        d.mesh.visible = true; d.left = 0.7;
      }
    },
    throwGrenade(from, dir) {
      g.active = true; g.pos.copy(from); g.vel.copy(dir).multiplyScalar(14); g.vel.y += 4.5; g.timer = 1.6;
      grenade.visible = true; grenade.position.copy(g.pos);
    },
    // Returns the explosion position when the grenade goes off, else null.
    step(dt) {
      for (const t of tracers) if (t.left > 0) { t.left -= dt; if (t.left <= 0) t.mesh.visible = false; }
      if (boomLeft > 0) {
        boomLeft -= dt; boom.scale.setScalar(0.4 + (0.5 - boomLeft) * 7);
        boom.material.opacity = Math.max(0, boomLeft * 1.8);
        boomLight.intensity = Math.max(0, boomLeft * 120);
        if (boomLeft <= 0) { boom.visible = false; boomLight.intensity = 0; }
      }
      for (const d of debris) {
        if (d.left <= 0) continue;
        d.left -= dt; d.vel.y -= 14 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < 0.06) { d.mesh.position.y = 0.06; d.vel.y *= -0.4; }
        if (d.left <= 0) d.mesh.visible = false;
      }
      if (!g.active) return null;
      g.timer -= dt; g.vel.y -= 12 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.09) { g.pos.y = 0.09; g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; }
      grenade.position.copy(g.pos);
      if (g.timer <= 0) { g.active = false; grenade.visible = false; const p = g.pos.clone(); return p; }
      return null;
    },
  };
}
