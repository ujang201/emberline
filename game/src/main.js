// EMBERLINE boot + fixed-step loop. main.js is the only file that knows the whole
// game: it wires world, player, weapons, bots, bomb, effects, audio and HUD together
// and owns the round state machine (see state.js). Simulation runs at a fixed 60 Hz,
// separate from rendering; the render loop only interpolates the camera and draws.
// ?shot=start|play|buy|end&seed=N renders one deterministic frame for a screenshot,
// paints it twice, freezes, and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mulberry32 } from './rng.js';
import { createState, resetRound, ROUND_TIME, BUY_TIME, PLANT_TIME, BOMB_TIME, WIN_ROUNDS, MAX_ROUNDS, ECONOMY } from './state.js';
import { createWorld, SPAWNS, SITES } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS, GRENADE_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

const state = createState();
const audio = createAudio();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 22, 60);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const bomb = createBomb(scene);
const effects = createEffects(scene);
const weapon = createWeapon(camera);
const hud = createHud();
const player = createPlayer(world.colliders, SPAWNS.us[0]);
const bots = createBots(scene, world.colliders, random);
bots.spawnAll(SPAWNS.us, SPAWNS.them);
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster(); raycaster.far = 90;
const shootables = world.shootables.concat(bots.hitMeshes());
const direction = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

let elapsed = 0, accumulator = 0, lastTime = performance.now(), frozen = false;
let lastBeepSecond = -1;

function scoreText() { return `Wardens ${state.score.us} — ${state.score.them} Raiders · Round ${state.round}`; }
function syncCamera() {
  const p = player.state;
  camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
}
function aimAt(point) {
  const p = player.state;
  const dx = point.x - p.position.x, dy = point.y - (p.position.y + p.eye), dz = point.z - p.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}
function feed(text) { hud.feed(text); }
function award(amount, why) { state.money += amount; hud.setMoney(state.money); }

// --- buying (buy phase only, keys 1-4 or clicking a row) ---
function buy(key) {
  if (state.phase !== 'buy') return;
  if (key === 'grenade') {
    if (state.grenades >= 2 || state.money < GRENADE_PRICE) return;
    state.money -= GRENADE_PRICE; state.grenades += 1; weapon.state.grenades = state.grenades;
  } else {
    const w = WEAPONS[key]; if (!w || state.owned[key] || state.money < w.price) return;
    state.money -= w.price; state.owned[key] = true; weapon.applyWeapon(key); state.weapon = key;
  }
  audio.buy(); hud.setMoney(state.money); hud.setWeapon(weapon.def().name); hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  hud.showBuy(state, buy);
}
function startRound() {
  resetRound(state); state.phase = 'live'; state.roundTime = ROUND_TIME;
  player.respawn(SPAWNS.us[0]); weapon.refillAll(); weapon.applyWeapon(state.weapon);
  weapon.state.grenades = state.grenades;
  bots.reset(SPAWNS.us, SPAWNS.them); bomb.hide();
  hud.hideBuy(); hud.hideOverlay();
  hud.setHealth(100); hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  hud.setWeapon(weapon.def().name); hud.setGrenades(state.grenades);
  hud.setTimer(ROUND_TIME); hud.setScore(state.score.us, state.score.them);
  hud.setAlive(3, 4); hud.setBomb('Charge: carry it to A or B');
  lastBeepSecond = -1;
}
function startBuyPhase() {
  state.phase = 'buy'; state.phaseTime = BUY_TIME;
  hud.showBuy(state, buy);
  hud.setTimer(BUY_TIME); hud.setBomb('Buy phase — keys 1-4, Enter to start');
}
function endRound(won, reason) {
  if (state.phase !== 'live') return;
  state.phase = 'roundEnd'; state.phaseTime = 4; state.roundResult = { won, reason };
  if (won) { state.score.us++; award(ECONOMY.win, 'win'); audio.roundWin(); }
  else { state.score.them++; award(ECONOMY.loss, 'loss'); audio.roundLose(); }
  if (document.pointerLockElement) document.exitPointerLock();
  hud.setScore(state.score.us, state.score.them);
  hud.showRoundEnd(won, reason, scoreText());
}
function endMatch() {
  state.phase = 'matchEnd';
  const won = state.score.us > state.score.them;
  const tied = state.score.us === state.score.them;
  state.matchResult = { won, tied };
  hud.showMatchEnd(won && !tied, `${scoreText()} · Kills ${state.kills}`);
  if (document.pointerLockElement) document.exitPointerLock();
}
function nextAfterRound() {
  if (state.score.us >= WIN_ROUNDS || state.score.them >= WIN_ROUNDS || state.round >= MAX_ROUNDS) { endMatch(); return; }
  state.round++; state.money = Math.max(state.money, 0);
  startBuyPhase();
}
function restartMatch() {
  state.round = 1; state.score = { us: 0, them: 0 }; state.money = ECONOMY.start;
  state.kills = 0; state.deaths = 0; state.grenades = 1;
  state.owned = { pistol: true, rifle: false, smg: false, dmr: false };
  state.weapon = 'pistol'; weapon.applyWeapon('pistol');
  startBuyPhase();
}

// --- shooting: hitscan ray vs bots (head = more damage) and vs the world ---
function shoot() {
  const def = weapon.def();
  if (!weapon.takeRound()) { audio.dry(); weapon.reload(); return false; }
  camera.getWorldDirection(direction);
  const spread = shot ? 0 : weapon.spread(player.groundSpeed(), player.state.crouching);
  direction.x += (random() * 2 - 1) * spread; direction.y += (random() * 2 - 1) * spread; direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(shootables, false)[0];
  tmpVec.copy(camera.position).addScaledVector(direction, 40);
  effects.tracer(camera.position, hit ? hit.point : tmpVec);
  audio.shot(state.weapon);
  bots.hearShot(player.state.position, 26);
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const isHead = hit.object.userData.part === 'head';
    const dmg = Math.round(def.damage * (isHead ? def.headMul : 1));
    const killed = bots.damage(bot, dmg);
    hud.hitMarker(killed, shot ? 4000 : 90); audio.hit();
    if (killed) {
      state.kills++; award(ECONOMY.kill, 'kill'); audio.kill();
      feed(`${isHead ? 'Headshot — ' : ''}${bot.name} down (+$${ECONOMY.kill})`);
      hud.setAlive(bots.aliveCount('us') + (player.state.alive ? 1 : 0), bots.aliveCount('them'));
      if (bots.aliveCount('them') === 0 && state.bomb.state !== 'planted') endRound(true, 'All Raiders eliminated');
      else if (bots.aliveCount('them') === 0) endRound(true, 'All Raiders eliminated');
    }
  } else if (hit) {
    // Bullet stopped on the world: a short spark is the tracer's end; no damage.
  }
  weapon.pullTrigger();
  player.recoil(def.kick * (0.9 + random() * 0.2), (random() * 2 - 1) * 0.003);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  hud.setSpread(weapon.spread(player.groundSpeed(), player.state.crouching) * 900);
  return true;
}
function throwGrenade() {
  if (state.grenades <= 0 || state.phase !== 'live') return;
  state.grenades--; weapon.state.grenades = state.grenades; hud.setGrenades(state.grenades);
  camera.getWorldDirection(direction);
  tmpVec.copy(camera.position);
  effects.throwGrenade(tmpVec, direction);
  audio.buy();
}
function explodeGrenade(pos) {
  effects.explosion(pos); audio.explosion();
  const victims = [];
  for (const b of bots.bots) if (b.alive) victims.push({ pos: b.pos, bot: b });
  if (player.state.alive) victims.push({ pos: player.state.position, player: true });
  for (const v of victims) {
    const dist = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
    if (dist > 7) continue;
    const dmg = Math.round(95 * (1 - dist / 7));
    if (v.player) { if (player.damage(dmg)) { state.deaths++; hud.damageFlash(); audio.hurt(); } }
    else if (bots.damage(v.bot, dmg)) { state.kills++; award(ECONOMY.kill, 'kill'); feed(`${v.bot.name} caught by the grenade (+$${ECONOMY.kill})`); }
  }
  bots.hearShot(pos, 30);
  if (!player.state.alive) checkTeamWipe();
  else if (bots.aliveCount('them') === 0) endRound(true, 'All Raiders eliminated');
}
function checkTeamWipe() {
  if (!player.state.alive && bots.aliveCount('us') === 0) {
    if (state.bomb.state === 'planted') { /* charge may still win the round */ return; }
    endRound(false, 'Wardens wiped out');
  }
}
// Bot fire callback: a burst hit on the player or on an ally bot.
function onBotShot(bot, target, hit, dist) {
  tmpVec.set(bot.pos.x, 1.45, bot.pos.z);
  const targetPos = target.kind === 'player' ? player.state.position : target.bot.pos;
  tmpVec2.set(targetPos.x, 1.35, targetPos.z);
  effects.tracer(tmpVec, tmpVec2);
  audio.enemyShot();
  if (!hit) return;
  const dmg = 11 + Math.floor(random() * 8);
  if (target.kind === 'player') {
    if (player.damage(dmg)) { state.deaths++; feed(`${bot.name} eliminated you`); }
    hud.setHealth(player.state.health); hud.damageFlash(); audio.hurt();
    checkTeamWipe();
  } else if (bots.damage(target.bot, dmg)) {
    feed(`${bot.name} eliminated ${target.bot.name}`);
    hud.setAlive(bots.aliveCount('us') + (player.state.alive ? 1 : 0), bots.aliveCount('them'));
    checkTeamWipe();
  }
}
function onDefused(bot) {
  state.bomb.state = 'defused'; bomb.hide();
  feed(`${bot.name} defused the charge`);
  endRound(false, 'Charge defused');
}

// --- fixed-step simulation ---
function step(dt) {
  elapsed += dt; state.elapsed = elapsed;
  if (state.phase === 'buy') {
    state.phaseTime -= dt; hud.setTimer(state.phaseTime);
    if (state.phaseTime <= 0) startRound();
    return;
  }
  if (state.phase === 'roundEnd') {
    state.phaseTime -= dt;
    bots.step(dt, elapsed, botCtx());
    if (state.phaseTime <= 0) nextAfterRound();
    return;
  }
  if (state.phase !== 'live') return;
  state.roundTime -= dt; hud.setTimer(state.roundTime);
  player.step(dt, input.state.keys);
  weapon.step(dt);
  // Planting: hold E inside a site while carrying the charge.
  const site = bomb.siteAt(player.state.position.x, player.state.position.z);
  if (state.bomb.state === 'carried' && player.state.alive && site && input.state.keys.has('KeyE')) {
    state.bomb.plantProgress += dt / PLANT_TIME;
    hud.setPlant(Math.min(1, state.bomb.plantProgress), `Planting at ${site.name}…`);
    if (state.bomb.plantProgress >= 1) {
      state.bomb.state = 'planted'; state.bomb.site = site; state.bomb.timer = BOMB_TIME;
      state.plants++; award(ECONOMY.plant, 'plant'); audio.plant();
      bomb.show(site, true); feed(`Charge planted at ${site.name} — defend it`);
      hud.setBomb(`Charge planted at ${site.name} — ${Math.ceil(BOMB_TIME)}s`);
      hud.setPlant(null);
    }
  } else {
    state.bomb.plantProgress = Math.max(0, state.bomb.plantProgress - dt / PLANT_TIME);
    hud.setPlant(state.bomb.plantProgress > 0 ? state.bomb.plantProgress : null);
  }
  if (state.bomb.state === 'planted') {
    state.bomb.timer -= dt; bomb.step(dt, true);
    const sec = Math.ceil(state.bomb.timer);
    hud.setBomb(`Charge planted at ${state.bomb.site.name} — ${sec}s`);
    if (sec !== lastBeepSecond) { lastBeepSecond = sec; audio.beep(sec <= 5); }
    if (state.bomb.timer <= 0) {
      effects.explosion(tmpVec.set(state.bomb.site.x, 1, state.bomb.site.z)); audio.explosion();
      endRound(true, `Charge detonated at ${state.bomb.site.name}`);
      return;
    }
  }
  bots.step(dt, elapsed, botCtx());
  const boomPos = effects.step(dt);
  if (boomPos) explodeGrenade(boomPos);
  hud.setHealth(player.state.health);
  hud.setAlive(bots.aliveCount('us') + (player.state.alive ? 1 : 0), bots.aliveCount('them'));
  if (state.roundTime <= 0 && state.bomb.state !== 'planted') endRound(false, 'Time expired — charge never planted');
}
function botCtx() {
  return {
    time: elapsed, player: { pos: player.state.position, speed: player.groundSpeed() },
    playerAlive: player.state.alive, bomb: state.bomb, colliders: world.colliders,
    onBotShot, onDefused,
  };
}
function onLockChange(locked) {
  if (shot) return;
  audio.unlock();
  if (locked) { state.started = true; hud.hideOverlay(); }
  else if (state.phase === 'live' && !state.roundResult) hud.showOverlay('paused');
  else if (state.phase === 'menu') hud.showOverlay('start');
}
hud.setAmmo(weapon.state.mag, weapon.state.reserve);
hud.setScore(0, 0); hud.setMoney(state.money); hud.setHealth(100);
hud.setWeapon(weapon.def().name); hud.setGrenades(1); hud.setTimer(ROUND_TIME);
hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (state.phase === 'menu') { restartMatch(); input.requestLock(); return; }
  if (state.phase === 'matchEnd') { restartMatch(); input.requestLock(); return; }
  if (state.phase === 'roundEnd') { input.requestLock(); return; }
  input.requestLock();
});
function handlePressed(codes) {
  for (const code of codes) {
    if (code === 'KeyR' && state.phase === 'live') { if (weapon.reload()) audio.reload(); }
    if (code === 'KeyG') throwGrenade();
    if (code === 'KeyM') audio.toggleMute();
    if (code === 'Enter' && state.phase === 'buy') startRound();
    if (code === 'KeyB' && state.phase === 'live') { /* buy menu is between rounds only */ }
    if (state.phase === 'buy' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
      buy({ Digit1: 'rifle', Digit2: 'smg', Digit3: 'dmr', Digit4: 'grenade' }[code]);
    } else if (state.phase === 'live' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
      const key = { Digit1: 'pistol', Digit2: 'rifle', Digit3: 'smg', Digit4: 'dmr' }[code];
      if (state.owned[key]) { weapon.saveAmmo(); weapon.applyWeapon(key); state.weapon = key; hud.setWeapon(weapon.def().name); hud.setAmmo(weapon.state.mag, weapon.state.reserve); }
    }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;
  if (!frozen) {
    const look = input.takeLook(); player.look(look.x, look.y);
    handlePressed(input.drainPressed());
    if (state.phase === 'live' && input.state.firing) {
      const def = weapon.def();
      if (weapon.ready()) shoot();
      else if (weapon.state.mag === 0 && def.auto) weapon.reload();
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) { step(FIXED_STEP); accumulator -= FIXED_STEP; steps++; }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}
function settle(steps) { for (let i = 0; i < steps; i++) step(FIXED_STEP); }
function runShot(name) {
  hud.hideOverlay(); hud.hideBuy();
  state.started = true;
  if (name === 'buy') {
    restartMatch(); // phase 'buy', buy menu visible
    player.state.position.set(-19, 0, 0); player.state.yaw = -Math.PI / 2; player.state.pitch = 0;
    settle(10); syncCamera(); paintTwiceThenReady(); return;
  }
  if (name === 'play') {
    restartMatch(); startRound();
    player.state.position.set(-10, 0, 2); player.state.yaw = -Math.PI / 2; player.state.pitch = 0;
    // Put two Raiders in view down Mid, then land a hit on one of them.
    const b0 = bots.bots.find((b) => !b.isAlly); const b1 = bots.bots.filter((b) => !b.isAlly)[1];
    b0.pos.set(2, 0, 1); b1.pos.set(6, 0, -3);
    settle(20);
    // Two headshots drop the first Raider (pistol 26 x 2.5 head = 65 each); one body
    // shot tags the second. Hit marker + killfeed stay up for the capture.
    for (let r = 0; r < 2; r++) { tmpVec.set(b0.pos.x, 1.53, b0.pos.z); aimAt(tmpVec); shoot(); settle(12); }
    tmpVec.set(b1.pos.x, 1.35, b1.pos.z); aimAt(tmpVec); shoot();
    hud.setScore(state.score.us, state.score.them);
    settle(12); syncCamera(); paintTwiceThenReady(); return;
  }
  if (name === 'end') {
    restartMatch(); startRound();
    state.score.us = 1; state.money += ECONOMY.win; hud.setMoney(state.money);
    state.bomb.state = 'planted'; state.bomb.site = SITES.A;
    bomb.show(SITES.A, true);
    for (const b of bots.bots) if (!b.isAlly) { b.alive = false; b.fall = 1; b.body.group.rotation.x = -1.45; }
    player.state.position.set(-12, 0, -6); player.state.yaw = -Math.PI / 2 - 0.4; player.state.pitch = 0;
    settle(10); syncCamera();
    hud.setScore(1, 0); hud.setAlive(3, 0);
    hud.showRoundEnd(true, 'Charge detonated at Crane Deck', scoreText());
    paintTwiceThenReady(); return;
  }
  // start: menu view down Mid Lane, start overlay on top.
  player.state.position.set(-19, 0, 0); player.state.yaw = -Math.PI / 2; player.state.pitch = 0.02;
  settle(20); syncCamera();
  hud.showOverlay('start');
  paintTwiceThenReady();
}
function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera(); renderer.render(scene, camera);
    painted++;
    if (painted === 2) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
syncCamera();
hud.showOverlay('start');
if (shot) runShot(shot); else requestAnimationFrame(frame);
