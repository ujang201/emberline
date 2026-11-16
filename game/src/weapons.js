// Weapons: four guns + one grenade. Each entry is data, not code — damage, headshot
// multiplier, magazine, fire rate, reload, spread and recoil. Spread grows with
// movement speed and with sustained fire (heat), and recoil kicks the pitch up, so
// stopping, crouching and tapping beats spraying on the move. The view model is one
// shared group rebuilt per weapon (no per-frame allocation).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: { name: 'P9 Sidearm', price: 0, damage: 26, headMul: 2.5, mag: 12, reserve: 48, fireGap: 0.18, auto: false, reload: 1.4, spreadStill: 0.003, spreadMove: 0.02, kick: 0.007, barrel: 0.28 },
  rifle: { name: 'VK-7 Carbine', price: 2700, damage: 34, headMul: 2.9, mag: 30, reserve: 90, fireGap: 0.10, auto: true, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.026, kick: 0.011, barrel: 0.42 },
  smg: { name: 'Hornet-9 SMG', price: 1500, damage: 24, headMul: 2.5, mag: 32, reserve: 96, fireGap: 0.07, auto: true, reload: 1.6, spreadStill: 0.004, spreadMove: 0.03, kick: 0.007, barrel: 0.32 },
  dmr: { name: 'Longbow DMR', price: 3400, damage: 78, headMul: 2.2, mag: 10, reserve: 30, fireGap: 0.45, auto: false, reload: 2.4, spreadStill: 0.0008, spreadMove: 0.02, kick: 0.02, barrel: 0.58 },
};
export const GRENADE_PRICE = 300;
const SPREAD_MOVE_REF = 5.2;

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.1 });
  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), accentMat);
  sight.position.set(0, 0.075, -0.05);
  model.add(receiver, barrel, stock, sight);
  model.position.set(0.2, -0.24, -0.52);
  model.scale.setScalar(0.7);
  camera.add(model);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  flash.position.set(0.24, -0.18, -0.95); flash.visible = false; camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6); camera.add(flashLight);

  const ammo = {};
  for (const k of Object.keys(WEAPONS)) ammo[k] = { mag: WEAPONS[k].mag, reserve: WEAPONS[k].reserve };
  const state = { weapon: 'pistol', mag: 12, reserve: 48, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, heat: 0, grenades: 1 };

  function applyWeapon(key) {
    state.weapon = key;
    const w = WEAPONS[key];
    state.mag = ammo[key].mag; state.reserve = ammo[key].reserve;
    state.cooldown = 0; state.reloadLeft = 0; state.heat = 0;
    barrel.scale.z = w.barrel / 0.4;
    barrel.position.z = -0.2 - w.barrel / 2 + 0.02;
  }
  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.heat = Math.max(0, state.heat - dt * 1.6);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.52 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const w = WEAPONS[state.weapon];
      model.rotation.x = -0.55 * Math.min(1, (w.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = w.mag - state.mag, take = Math.min(need, state.reserve);
        state.mag += take; state.reserve -= take; ammo[state.weapon] = { mag: state.mag, reserve: state.reserve };
      }
    }
  }
  return {
    state, step, applyWeapon,
    def() { return WEAPONS[state.weapon]; },
    ready() { return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    reloading() { return state.reloadLeft > 0; },
    pullTrigger() { state.cooldown = WEAPONS[state.weapon].fireGap; state.flash = 0.06; state.kick = 0.055; state.heat = Math.min(1, state.heat + 0.09); },
    takeRound() { if (state.mag <= 0) return false; state.mag -= 1; ammo[state.weapon].mag = state.mag; return true; },
    reload() { const w = WEAPONS[state.weapon]; if (state.reloadLeft > 0 || state.mag === w.mag || state.reserve === 0) return false; state.reloadLeft = w.reload; return true; },
    spread(speed, crouching) {
      const w = WEAPONS[state.weapon];
      const move = Math.min(1, speed / SPREAD_MOVE_REF) * w.spreadMove;
      return (w.spreadStill + move + state.heat * 0.012) * (crouching ? 0.7 : 1);
    },
    refillAll() { for (const k of Object.keys(WEAPONS)) { ammo[k] = { mag: WEAPONS[k].mag, reserve: WEAPONS[k].reserve }; } state.mag = ammo[state.weapon].mag; state.reserve = ammo[state.weapon].reserve; state.cooldown = 0; state.reloadLeft = 0; },
    saveAmmo() { ammo[state.weapon] = { mag: state.mag, reserve: state.reserve }; },
  };
}
