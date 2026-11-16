// The DOM HUD: crosshair (widens with spread), hit marker, health, ammo, money,
// round timer, round score, team counts, bomb status, killfeed, damage flash and the
// overlays (start / buy menu / round end / match end). It never touches the sim;
// main.js pushes numbers in and reads callbacks out. DOM writes are cached so a
// value that did not change is not written again.
import { WEAPONS, GRENADE_PRICE } from './weapons.js';

const COPY = {
  start: { title: 'EMBERLINE', copy: 'Kestrel Freight Yard. Plant the charge at Crane Deck (A) or Silo Bay (B), or clear the Raiders. Click to play.', action: 'Click to play' },
  paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'), play: $('play'),
    buy: $('buy-menu'), health: $('health-value'), healthBar: $('health-bar'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), ammo: $('ammo'),
    money: $('money-value'), timer: $('timer-value'), score: $('score-value'),
    alive: $('alive-value'), bomb: $('bomb-status'), feed: $('killfeed'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'), damage: $('damage-flash'),
    plantBar: $('plant-bar'), plantFill: $('plant-fill'), plantLabel: $('plant-label'),
    weaponName: $('weapon-name'), grenades: $('grenade-value'),
  };
  let last = {};
  function setText(node, key, value) { if (last[key] !== value) { last[key] = value; node.textContent = value; } }
  let hitTimer = 0;
  return {
    setHealth(v) { setText(el.health, 'hp', String(Math.ceil(v))); el.healthBar.style.width = `${Math.max(0, v)}%`; el.healthBar.classList.toggle('low', v <= 30); },
    setAmmo(mag, reserve) { setText(el.ammoMag, 'mag', String(mag)); setText(el.ammoReserve, 'res', `/ ${reserve}`); el.ammo.classList.toggle('empty', mag === 0); },
    setWeapon(name) { setText(el.weaponName, 'wpn', name); },
    setGrenades(n) { setText(el.grenades, 'gr', `Grenades ${n}`); },
    setMoney(v) { setText(el.money, 'money', `$${v}`); },
    setTimer(sec) { const s = Math.max(0, Math.ceil(sec)); setText(el.timer, 't', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); el.timer.classList.toggle('low', sec <= 15); },
    setScore(us, them) { setText(el.score, 'score', `Wardens ${us} — ${them} Raiders`); },
    setAlive(us, them) { setText(el.alive, 'alive', `Alive ${us}v${them}`); },
    setBomb(text) { setText(el.bomb, 'bomb', text); },
    setSpread(spreadPx) { el.crosshair.style.setProperty('--gap', `${4 + spreadPx}px`); },
    setPlant(progress, label) {
      if (progress == null) { el.plantBar.hidden = true; return; }
      el.plantBar.hidden = false; el.plantFill.style.width = `${Math.round(progress * 100)}%`;
      setText(el.plantLabel, 'plant', label);
    },
    hitMarker(killed, holdMs = 90) {
      el.hitmarker.classList.add('on'); el.hitmarker.style.transform = killed ? 'translate(-50%,-50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer); hitTimer = setTimeout(() => { el.hitmarker.classList.remove('on'); el.hitmarker.style.transform = ''; }, holdMs);
    },
    damageFlash() { el.damage.classList.add('on'); setTimeout(() => el.damage.classList.remove('on'), 180); },
    feed(text) {
      const div = document.createElement('div'); div.textContent = text; el.feed.prepend(div);
      while (el.feed.children.length > 5) el.feed.lastChild.remove();
      setTimeout(() => div.remove(), 6000);
    },
    showOverlay(mode, scoreText) {
      const text = COPY[mode]; el.title.textContent = text.title;
      el.copy.textContent = mode === 'start' ? text.copy : `${text.copy} ${scoreText || ''}`;
      el.play.textContent = text.action; el.overlay.hidden = false; el.play.focus();
    },
    showRoundEnd(won, reason, scoreText) {
      el.title.textContent = won ? 'Round won' : 'Round lost';
      el.copy.textContent = `${reason} — ${scoreText}`;
      el.play.textContent = 'Next round'; el.overlay.hidden = false; el.play.focus();
    },
    showMatchEnd(won, scoreText) {
      el.title.textContent = won ? 'Match won — Emberline is yours' : 'Match lost';
      el.copy.textContent = scoreText;
      el.play.textContent = 'Play again'; el.overlay.hidden = false; el.play.focus();
    },
    hideOverlay() { el.overlay.hidden = true; },
    showBuy(state, onBuy) {
      el.buy.hidden = false;
      el.buy.querySelector('#buy-money').textContent = `$${state.money} — buy with keys 1-4, Enter to start`;
      const rows = el.buy.querySelectorAll('[data-buy]');
      rows.forEach((row) => {
        const key = row.dataset.buy;
        const price = key === 'grenade' ? GRENADE_PRICE : WEAPONS[key].price;
        const owned = key === 'grenade' ? state.grenades >= 2 : state.owned[key];
        row.querySelector('.buy-price').textContent = owned ? 'OWNED' : `$${price}`;
        row.classList.toggle('afford', state.money >= price && !owned);
      });
      el.buy.onclick = (e) => { const r = e.target.closest('[data-buy]'); if (r) onBuy(r.dataset.buy); };
    },
    hideBuy() { el.buy.hidden = true; },
    onPlay(handler) { el.play.addEventListener('click', handler); },
  };
}
