# EMBERLINE — a three.js tactical FPS

An original round-based tactical FPS for the make.fun bounty
`threejs-fps-02` ("Make the best three.js tactical FPS", $1,000).

**The game:** Wardens (you + 2 ally bots) vs Raiders (4 bots) on **Kestrel
Freight Yard**, an original container yard. Plant the demolition charge at
**Crane Deck (A)** or **Silo Bay (B)** — hold `E` in a site for 4 s — then
defend it for 35 s until it detonates, or clear the other team. First to 5
round wins (max 8 rounds). Money between rounds buys the VK-7 Carbine, the
Hornet-9 SMG, the Longbow DMR and frag grenades.

## How to play (locally)

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome, click **Click to play**
(Pointer Lock), then:

- `W A S D` move · `Shift` sprint · `Ctrl`/`C` crouch · `Space` jump
- Mouse look · Click fire · `R` reload · `1`–`4` switch weapons
- `G` throw grenade · `E` hold to plant the charge · `M` mute

Buy phase (12 s between rounds): keys `1`–`4` buy, `Enter` starts the round.
Win: $3,250 · Kill: $300 · Plant: $300 · Loss: $1,900.

## What is in the game

- **Complete:** first-person Pointer Lock look, WASD, shooting, reload,
  ammo depletion, moving/shooting bots, rounds that end win/lose and
  restart, HUD (health, ammo, round timer, score, money, team counts,
  bomb status, killfeed).
- **Gunplay:** headshots deal ~2.5–2.9× body damage; recoil + spread grow
  with movement speed and sustained fire; acceleration-based movement,
  crouch, sprint, jump, AABB collision with the map.
- **Tactics:** bomb plant/defuse objective, per-round economy + buy menu,
  4 weapons + frag grenade, bots that patrol routes, hold positions,
  react to sight (line-of-sight + field of view) and sound (gunfire).
- **Map/look:** original 46×36 m freight yard — North/Mid/South lanes,
  containers, crane gantry, silos — dusk amber/teal palette, all geometry
  built in code, no copied Counter-Strike map, art or names.
- **Code:** one module per job (`state`, `world`, `player`, `weapons`,
  `bots`, `bomb`, `effects`, `audio`, `hud`, `input`, `main`), fixed
  60 Hz simulation separate from rendering, a single state store, pooled
  effects (no per-frame allocation in the hot loop), WebAudio-synthesised
  sounds, no network requests, no build step.

## Build the submission

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output dir and writes `dossier.json` with `vendor/makefun-threejs.ts`.
It is deterministic: two runs write byte-identical output.

## Screenshots

`1-start.jpg` (cover) — title screen; `2-play.jpg` — mid-round headshot;
`3-buy.jpg` — buy menu; `4-end.jpg` — round won. All are real renders of
this game's code in headless Chromium (`?shot=…&seed=1`), unedited.

Referral noted by the entrant: https://make.fun/r/wfjv7kgb (code `wfjv7kgb`).
