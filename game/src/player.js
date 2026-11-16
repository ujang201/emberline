// Player movement: acceleration-based (not velocity-snapping), friction, gravity,
// jump, crouch with headroom check, resolved as an AABB against the world's colliders
// one axis at a time. Standing still is faster to stop and steadier to shoot than
// running — the same groundSpeed() feeds weapon spread in weapons.js.
import * as THREE from 'three';

const RADIUS = 0.34, STAND_HEIGHT = 1.72, CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6, CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2, CROUCH_SPEED = 2.4, SPRINT_SPEED = 6.4;
const GROUND_ACCEL = 42, AIR_ACCEL = 9, FRICTION = 9, GRAVITY = 20, JUMP_SPEED = 6.2;

export function createPlayer(colliders, spawn) {
  const player = {
    position: new THREE.Vector3(spawn.x, 0, spawn.z), velocity: new THREE.Vector3(),
    yaw: spawn.yaw || 0, pitch: 0, eye: STAND_EYE, onGround: true, crouching: false,
    height: STAND_HEIGHT, health: 100, alive: true, stepAcc: 0,
  };
  const probe = new THREE.Box3(); const wish = new THREE.Vector3();
  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (let i = 0; i < colliders.length; i++) if (probe.intersectsBox(colliders[i])) return colliders[i];
    return null;
  }
  function look(dx, dy, sensitivity = 0.0022) {
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }
  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick); player.yaw += yawKick;
  }
  function step(dt, keys) {
    if (!player.alive) return;
    const crouching = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouching && !player.crouching) { player.crouching = true; player.height = CROUCH_HEIGHT; }
    else if (!crouching && player.crouching && !overlaps(player.position.x, player.position.y, player.position.z, STAND_HEIGHT, 0.02)) {
      player.crouching = false; player.height = STAND_HEIGHT;
    }
    const eyeTarget = player.crouching ? CROUCH_EYE : STAND_EYE;
    player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 12);
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (fwd || str) {
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      wish.set(-sin * fwd + cos * str, 0, -cos * fwd - sin * str).normalize();
    }
    const sprinting = keys.has('ShiftLeft') && fwd > 0 && !player.crouching;
    const speed = player.crouching ? CROUCH_SPEED : (sprinting ? SPRINT_SPEED : WALK_SPEED);
    const blend = Math.min(1, (player.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    player.velocity.x += (wish.x * speed - player.velocity.x) * blend;
    player.velocity.z += (wish.z * speed - player.velocity.z) * blend;
    if (player.onGround && !wish.lengthSq()) { const d = Math.max(0, 1 - FRICTION * dt); player.velocity.x *= d; player.velocity.z *= d; }
    if (keys.has('Space') && player.onGround) { player.velocity.y = JUMP_SPEED; player.onGround = false; }
    player.velocity.y -= GRAVITY * dt;
    const nx = player.position.x + player.velocity.x * dt;
    if (!overlaps(nx, player.position.y, player.position.z, player.height, 0.04)) player.position.x = nx; else player.velocity.x = 0;
    const nz = player.position.z + player.velocity.z * dt;
    if (!overlaps(player.position.x, player.position.y, nz, player.height, 0.04)) player.position.z = nz; else player.velocity.z = 0;
    player.position.y += player.velocity.y * dt; player.onGround = false;
    const hit = overlaps(player.position.x, player.position.y, player.position.z, player.height, 0);
    if (hit && player.velocity.y <= 0) { player.position.y = hit.max.y; player.velocity.y = 0; player.onGround = true; }
    else if (hit) { player.position.y = hit.min.y - player.height; player.velocity.y = 0; }
    if (player.position.y < 0) { player.position.y = 0; player.velocity.y = 0; player.onGround = true; }
    player.velocity.y = Math.max(-30, player.velocity.y);
  }
  return {
    state: player, step, look, recoil,
    groundSpeed() { return Math.hypot(player.velocity.x, player.velocity.z); },
    respawn(spawnPoint) {
      player.position.set(spawnPoint.x, 0, spawnPoint.z); player.velocity.set(0, 0, 0);
      player.yaw = spawnPoint.yaw || 0; player.pitch = 0; player.health = 100; player.alive = true;
      player.crouching = false; player.height = STAND_HEIGHT; player.eye = STAND_EYE;
    },
    damage(amount) { if (!player.alive) return false; player.health -= amount; if (player.health <= 0) { player.health = 0; player.alive = false; return true; } return false; },
  };
}
