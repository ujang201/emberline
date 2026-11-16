// Keyboard + mouse + Pointer Lock. Look deltas are accumulated and consumed once per
// frame (takeLook); edge-triggered actions (reload, buy keys, grenade, plant, weapon
// switch, buy-menu toggle) are queued as one-shot events so the fixed-step sim sees
// each press exactly once. No per-frame allocation except the small event queue drain.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const state = { keys, locked: false, firing: false, lookX: 0, lookY: 0 };
  const pressed = []; // one-shot codes, drained by main.js each frame
  function setKey(e, down) {
    if (down) { if (!e.repeat) pressed.push(e.code); keys.add(e.code); }
    else keys.delete(e.code);
    if (e.code === 'Space') e.preventDefault();
  }
  window.addEventListener('keydown', (e) => setKey(e, true));
  window.addEventListener('keyup', (e) => setKey(e, false));
  window.addEventListener('blur', () => { keys.clear(); state.firing = false; });
  window.addEventListener('mousemove', (e) => { if (state.locked) { state.lookX += e.movementX; state.lookY += e.movementY; } });
  window.addEventListener('mousedown', (e) => { if (state.locked && e.button === 0) state.firing = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) state.firing = false; });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { keys.clear(); state.firing = false; }
    onLockChange(state.locked);
  });
  return {
    state,
    requestLock() { try { canvas.requestPointerLock(); } catch { /* no-op */ } },
    takeLook() { const x = state.lookX, y = state.lookY; state.lookX = 0; state.lookY = 0; return { x, y }; },
    drainPressed() { if (!pressed.length) return pressed; const out = pressed.splice(0, pressed.length); return out; },
    consume(code) { const i = pressed.indexOf(code); if (i >= 0) pressed.splice(i, 1); },
  };
}
