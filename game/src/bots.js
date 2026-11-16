// Bots: 4 Raiders (enemies) + 2 Warden allies. One module, one job: decide where to
// go and when to shoot. Each bot is a small state machine — patrol (follow a route),
// hold (wait at a waypoint), hunt (move to a seen/heard target), defuse (channel on
// the planted charge), investigate (walk to a gunshot they heard). They see with a
// line-of-sight test (world.hasLineOfSight) and a field of view, react after a
// human-like delay, and fire in bursts whose accuracy falls with range and with the
// target's movement. No per-frame allocation: temp vectors are module-level.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { ROUTES, hasLineOfSight } from './world.js';
import { pick } from './rng.js';

const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _d = new THREE.Vector3();
const BOT_SPEED = 3.4, BOT_HEALTH = 100, REACT_MIN = 0.35, REACT_MAX = 0.75;
const ROUTE_NAMES = ['mid', 'north', 'south'];

function makeBody(scene, team, x, z) {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(team === 'them' ? PALETTE.rust : PALETTE.teal), roughness: 0.6, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), mat); torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5 }));
  head.position.y = 1.53;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.28), dark); legs.position.y = 0.32;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), dark); gun.position.set(0.2, 1.05, -0.2);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.3 }));
  visor.position.set(0, 1.55, -0.14);
  group.add(torso, head, legs, gun, visor);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(group);
  return { group, torso, head };
}

export function createBots(scene, colliders, random) {
  const bots = [];
  function addBot(team, spawn, name, isAlly) {
    const body = makeBody(scene, team, spawn.x, spawn.z);
    const bot = {
      name, team, isAlly, body, health: BOT_HEALTH, alive: true,
      pos: body.group.position, yaw: spawn.yaw || 0, speed: 0,
      state: 'patrol', route: pick(random, ROUTE_NAMES), wp: 0, holdUntil: 0,
      target: null, seenAt: -99, reactAt: 0, burstLeft: 0, fireTimer: 0,
      investigate: null, defusing: false, defuseProgress: 0, fall: 0, respawnAt: 0,
      stepPhase: random() * 6.28,
    };
    body.torso.userData.bot = bot; body.torso.userData.part = 'torso';
    body.head.userData.bot = bot; body.head.userData.part = 'head';
    bots.push(bot); return bot;
  }
  return {
    bots,
    hitMeshes() { const out = []; for (const b of bots) out.push(b.body.torso, b.body.head); return out; },
    spawnAll(usSpawns, themSpawns) {
      bots.length = 0;
      // Remove old groups from scene is handled by reset() below via visibility; fresh
      // spawn is only called once per match start in main.js, so groups are new.
      addBot('us', usSpawns[1], 'Warden Ash', true);
      addBot('us', usSpawns[2], 'Warden Pike', true);
      const names = ['Raider Vex', 'Raider Moss', 'Raider Kite', 'Raider Bramble'];
      for (let i = 0; i < 4; i++) addBot('them', themSpawns[i], names[i], false);
    },
    reset(usSpawns, themSpawns) {
      // Reuse the same groups: reset positions, health and state for a new round.
      const us = bots.filter((b) => b.isAlly), them = bots.filter((b) => !b.isAlly);
      us.forEach((b, i) => { b.pos.set(usSpawns[i + 1].x, 0, usSpawns[i + 1].z); b.yaw = usSpawns[i + 1].yaw; b.health = BOT_HEALTH; b.alive = true; b.body.group.visible = true; b.body.group.rotation.set(0, 0, 0); b.state = 'patrol'; b.route = pick(random, ROUTE_NAMES); b.wp = 0; b.target = null; b.defusing = false; b.defuseProgress = 0; b.fall = 0; });
      them.forEach((b, i) => { b.pos.set(themSpawns[i].x, 0, themSpawns[i].z); b.yaw = themSpawns[i].yaw; b.health = BOT_HEALTH; b.alive = true; b.body.group.visible = true; b.body.group.rotation.set(0, 0, 0); b.state = 'patrol'; b.route = pick(random, ROUTE_NAMES); b.wp = 0; b.target = null; b.defusing = false; b.defuseProgress = 0; b.fall = 0; });
    },
    aliveCount(team) { let n = 0; for (const b of bots) if (b.team === team && b.alive) n++; return n; },
    damage(bot, amount) {
      if (!bot.alive) return false;
      bot.health -= amount;
      if (bot.health > 0) return false;
      bot.alive = false; bot.fall = 0; bot.target = null; bot.defusing = false; return true;
    },
    hearShot(pos, radius) { // gunfire: bots in radius investigate the sound
      for (const b of bots) {
        if (!b.alive || b.state === 'defuse') continue;
        _d.set(b.pos.x - pos.x, 0, b.pos.z - pos.z);
        if (_d.lengthSq() < radius * radius && !b.target) { b.investigate = { x: pos.x, z: pos.z }; b.state = 'investigate'; }
      }
    },
    // --- the per-frame brain. ctx: {time, dt, player, playerAlive, bomb, colliders, onBotShot, onBotKilled}
    step(dt, time, ctx) {
      for (const bot of bots) {
        if (!bot.alive) { // fall-over animation, no respawn inside a round
          if (bot.fall < 1) { bot.fall = Math.min(1, bot.fall + dt / 0.4); bot.body.group.rotation.x = -bot.fall * 1.45; }
          continue;
        }
        bot.body.group.rotation.x = 0;
        // --- pick a visible enemy: player first, then the nearest living bot of the other team
        let target = null, targetPos = null, targetSpeed = 0;
        const candidates = [];
        if (ctx.playerAlive) candidates.push({ pos: ctx.player.pos, speed: ctx.player.speed, kind: 'player' });
        for (const other of bots) if (other.alive && other.team !== bot.team) candidates.push({ pos: other.pos, speed: other.speed, kind: 'bot', bot: other });
        for (const c of candidates) {
          _a.set(bot.pos.x, 1.5, bot.pos.z); _b.set(c.pos.x, 1.35, c.pos.z);
          const dist = _a.distanceTo(_b);
          if (dist > 42) continue;
          if (!hasLineOfSight(_a, _b, colliders)) continue;
          // Field of view: ~100 degrees around current facing, unless very close
          _d.set(c.pos.x - bot.pos.x, 0, c.pos.z - bot.pos.z).normalize();
          const fwdX = -Math.sin(bot.yaw), fwdZ = -Math.cos(bot.yaw);
          const dot = fwdX * _d.x + fwdZ * _d.z;
          if (dist > 4 && dot < 0.1) continue;
          target = c; targetPos = c.pos; targetSpeed = c.speed; break;
        }
        if (target) {
          if (bot.target !== target) { bot.target = target; bot.reactAt = time + REACT_MIN + random() * (REACT_MAX - REACT_MIN); bot.burstLeft = 0; }
          bot.seenAt = time;
        } else if (bot.target && time - bot.seenAt > 1.2) bot.target = null;

        // --- bomb logic: Raiders defuse a planted charge; Wardens hold the site
        if (ctx.bomb.state === 'planted' && !bot.isAlly) {
          const site = ctx.bomb.site;
          _d.set(site.x - bot.pos.x, 0, site.z - bot.pos.z);
          if (_d.length() < 2.2) {
            bot.state = 'defuse'; bot.defusing = true;
            bot.defuseProgress += dt;
            if (bot.defuseProgress >= 5) { ctx.onDefused(bot); bot.defusing = false; }
            bot.body.group.rotation.y = bot.yaw;
            continue;
          }
          bot.state = 'hunt'; bot.investigate = { x: site.x, z: site.z };
        } else bot.defusing = false;

        // --- movement: toward waypoint / investigate point / target strafe
        let mx = 0, mz = 0, wantYaw = bot.yaw;
        if (bot.target && targetPos) {
          // Face the target, strafe slowly to stay unpredictable
          wantYaw = Math.atan2(-(targetPos.x - bot.pos.x), -(targetPos.z - bot.pos.z));
          const strafe = Math.sin(time * 0.9 + bot.stepPhase) * 0.5;
          mx = -Math.cos(wantYaw) * strafe; mz = Math.sin(wantYaw) * strafe;
        } else if (bot.state === 'investigate' && bot.investigate) {
          const dx = bot.investigate.x - bot.pos.x, dz = bot.investigate.z - bot.pos.z;
          const len = Math.hypot(dx, dz);
          if (len < 1.2) { bot.state = 'patrol'; bot.investigate = null; }
          else { mx = dx / len; mz = dz / len; wantYaw = Math.atan2(-dx, -dz); }
        } else {
          const route = ROUTES[bot.route];
          const wp = route[bot.wp % route.length];
          const dx = wp[0] - bot.pos.x, dz = wp[1] - bot.pos.z;
          const len = Math.hypot(dx, dz);
          if (len < 1.0) {
            bot.wp++;
            if (bot.wp % route.length === 0 && random() < 0.4) { bot.state = 'hold'; bot.holdUntil = time + 2 + random() * 3; bot.route = pick(random, ROUTE_NAMES); bot.wp = 0; }
          } else if (bot.state === 'hold' && time < bot.holdUntil) { mx = 0; mz = 0; }
          else { bot.state = 'patrol'; mx = dx / len; mz = dz / len; wantYaw = Math.atan2(-dx, -dz); }
        }
        // Move with simple collision: try x then z, stop on a wall (same AABB test as player)
        const nx = bot.pos.x + mx * BOT_SPEED * dt, nz = bot.pos.z + mz * BOT_SPEED * dt;
        bot.speed = Math.hypot(mx, mz) * BOT_SPEED;
        if (mx || mz) {
          if (!collides(nx, bot.pos.z, colliders)) bot.pos.x = nx;
          if (!collides(bot.pos.x, nz, colliders)) bot.pos.z = nz;
        }
        // Smooth yaw turn
        let dyaw = wantYaw - bot.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        bot.yaw += Math.max(-dt * 5, Math.min(dt * 5, dyaw));
        bot.body.group.position.set(bot.pos.x, 0, bot.pos.z);
        bot.body.group.rotation.y = bot.yaw;
        bot.body.group.position.y = Math.abs(Math.sin(time * 6 + bot.stepPhase)) * 0.02 * (bot.speed > 0.5 ? 1 : 0);

        // --- shooting: burst fire after the reaction delay, accuracy vs range/speed
        if (bot.target && targetPos && time >= bot.reactAt) {
          bot.fireTimer -= dt;
          if (bot.fireTimer <= 0) {
            if (bot.burstLeft <= 0) { bot.burstLeft = 3 + Math.floor(random() * 3); bot.fireTimer = 0.12; }
            else {
              bot.burstLeft--; bot.fireTimer = 0.11;
              const dist = Math.hypot(targetPos.x - bot.pos.x, targetPos.z - bot.pos.z);
              const hitChance = Math.max(0.12, 0.55 - dist * 0.012 - targetSpeed * 0.03);
              ctx.onBotShot(bot, target, random() < hitChance, dist);
            }
          }
        } else bot.fireTimer = 0;
      }
    },
  };
}
const _probe = new THREE.Box3();
function collides(x, z, colliders) {
  _probe.min.set(x - 0.34, 0.04, z - 0.34); _probe.max.set(x + 0.34, 1.7, z + 0.34);
  for (let i = 0; i < colliders.length; i++) if (_probe.intersectsBox(colliders[i])) return true;
  return false;
}
