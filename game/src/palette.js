// EMBERLINE — an original tactical FPS. "Emberline" is the freight-yard league, the
// Wardens (player team, teal) vs the Raiders (bots, rust-red). No map, name, character
// or art is copied from any commercial game: the map is Kestrel Freight Yard, an
// original container yard with two bomb sites, Crane Deck (A) and Silo Bay (B).
// Palette: six values only; lighting makes every shade the game needs.
export const PALETTE = {
  canvas: '#262c38',   // dusk sky / fog
  surface: '#3a4150',  // concrete
  hairline: '#565f73', // steel
  ink: '#e9e6df',      // off-white
  muted: '#a8b0b8',    // grey-blue
  accent: '#f0a830',   // amber (Warden / UI)
  teal: '#3fc1a8',     // Warden team
  rust: '#d95b43',     // Raider team / danger
  olive: '#8a9a68',    // yard vegetation / crates
};
export function shade(name) { return PALETTE[name]; }
