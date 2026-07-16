// ═══════════════════════════════════════════════════════════════════════════
//  THE NON-EUCLIDEAN ENGINE
//
//  Cells (rooms / corridors) are placed FAR APART in world space so they never
//  visually overlap. Doorways teleport the player across those gaps — thick
//  FogExp2 means you never see the emptiness between, so the topology reads as
//  impossible: you walk out the south door of a room and in through its north
//  door, having covered six feet. (Antichamber's trick — research-confirmed as
//  the cheap, mobile-friendly, genuinely-impossible-feeling choice over live
//  stencil portals.)
//
//  Teleport math is Sebastian Lague's: map the player through the relative
//  transform of the doorway pair. We keep every doorway normal CARDINAL (±X/±Z)
//  so the transform is robust. Some doorways carry a scale factor < 1 — cross
//  one and you SHRINK, so the fixed-size pelican looms (Superliminal).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { wallpaper, carpet, ceiling } from './textures';
import { makePelican } from './pelican';

export interface Doorway {
  cell: Cell;
  pos: THREE.Vector3;      // centre of the opening, at floor level, world space
  normal: THREE.Vector3;   // outward horizontal unit (the way you exit)
  width: number;
  link?: Doorway;
  scale: number;           // player-scale multiplier applied crossing INTO link
}
export interface Cell {
  id: string;
  min: THREE.Vector2;      // walkable XZ (inside the walls)
  max: THREE.Vector2;
  doorways: Doorway[];
}

export interface World {
  root: THREE.Group;
  cells: Cell[];
  start: { cell: Cell; pos: THREE.Vector3; yaw: number };
  pelican: THREE.Group;
  lights: THREE.Object3D[];
}

const WALL = 0.2;          // wall thickness
const H = 5.0;             // ceiling height (world units)
const DOOR_W = 2.4;
const DOOR_H = 3.4;

// The Backrooms are famously FLAT, shadowless, oppressively even-lit — so the
// environment is unlit MeshBasic (texture at full brightness). It's the
// authentic look AND the cheapest on mobile AND can never render black (the
// r155+ physical-light-unit trap that ate MeshStandard). Only the pelican is
// lit (MeshStandard) so the sculpture keeps its form.
let wallMat: THREE.MeshBasicMaterial;
let floorMat: THREE.MeshBasicMaterial;
let ceilMat: THREE.MeshBasicMaterial;
let panelMat: THREE.MeshBasicMaterial;

function mats() {
  wallMat = new THREE.MeshBasicMaterial({ map: wallpaper() });
  floorMat = new THREE.MeshBasicMaterial({ map: carpet() });
  ceilMat = new THREE.MeshBasicMaterial({ map: ceiling() });
  panelMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2 }); // the glowing strip
}

/** A wall segment along X or Z, from a→b at fixed coordinate `fixed`, with
 *  optional doorway gaps (list of centre-offsets along the run). */
function wallRun(g: THREE.Group, axis: 'x' | 'z', a: number, b: number, fixed: number,
                 yBase: number, gaps: number[]) {
  const len = b - a;
  const segs: [number, number][] = [];
  let cursor = a;
  const sorted = [...gaps].sort((p, q) => p - q);
  for (const gcx of sorted) {
    const gs = gcx - DOOR_W / 2, ge = gcx + DOOR_W / 2;
    if (gs > cursor) segs.push([cursor, gs]);
    cursor = ge;
  }
  if (cursor < b) segs.push([cursor, b]);
  // solid segments (full height) — per-segment material so the striped wallpaper
  // keeps a constant world period instead of stretching with segment width.
  for (const [s, e] of segs) {
    const w = e - s;
    const geo = new THREE.BoxGeometry(axis === 'x' ? w : WALL, H, axis === 'x' ? WALL : w);
    const wm = wallMat.clone(); wm.map = wallMat.map!.clone();
    wm.map.wrapS = wm.map.wrapT = THREE.RepeatWrapping;
    wm.map.repeat.set(w / 4, H / 4); wm.map.needsUpdate = true;
    const m = new THREE.Mesh(geo, wm);
    if (axis === 'x') m.position.set((s + e) / 2, yBase + H / 2, fixed);
    else m.position.set(fixed, yBase + H / 2, (s + e) / 2);
    g.add(m);
  }
  // lintel above each doorway gap
  for (const gcx of sorted) {
    const lh = H - DOOR_H;
    const geo = new THREE.BoxGeometry(axis === 'x' ? DOOR_W : WALL, lh, axis === 'x' ? WALL : DOOR_W);
    const m = new THREE.Mesh(geo, wallMat);
    if (axis === 'x') m.position.set(gcx, yBase + DOOR_H + lh / 2, fixed);
    else m.position.set(fixed, yBase + DOOR_H + lh / 2, gcx);
    g.add(m);
  }
  len; // (silence unused in strict builds)
}

/** Floor + ceiling + fluorescent light strips for a rectangular cell. */
function slab(g: THREE.Group, min: THREE.Vector2, max: THREE.Vector2, y: number,
             lights: THREE.Object3D[]) {
  const w = max.x - min.x, d = max.y - min.y, cx = (min.x + max.x) / 2, cz = (min.y + max.y) / 2;
  // per-cell floor material so carpet density is constant in world units (the
  // shared material can't hold per-cell repeat). clone() shares the canvas image.
  const fm = floorMat.clone(); fm.map = floorMat.map!.clone();
  fm.map.wrapS = fm.map.wrapT = THREE.RepeatWrapping; fm.map.repeat.set(w / 4, d / 4); fm.map.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fm);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, y, cz);
  g.add(floor);
  const cm = ceilMat.clone(); cm.map = ceilMat.map!.clone();
  cm.map.wrapS = cm.map.wrapT = THREE.RepeatWrapping; cm.map.repeat.set(w / 4, d / 4); cm.map.needsUpdate = true;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cm);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, y + H, cz);
  g.add(ceil);
  // fluorescent panels on a grid — bright unlit quads (they ARE the light).
  // No per-panel point lights: env is unlit, so lights would only cost frames.
  const stepX = 6, stepZ = 6;
  for (let px = min.x + stepX / 2; px < max.x; px += stepX) {
    for (let pz = min.y + stepZ / 2; pz < max.y; pz += stepZ) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), panelMat);
      panel.rotation.x = Math.PI / 2; panel.position.set(px, y + H - 0.02, pz);
      g.add(panel);
    }
  }
  lights;
}

/** Build a rectangular cell with walls (doorway gaps punched per edge). */
function makeCell(id: string, min: THREE.Vector2, max: THREE.Vector2,
                 gapSpec: { n?: number[]; s?: number[]; e?: number[]; w?: number[] },
                 g: THREE.Group, lights: THREE.Object3D[]): Cell {
  slab(g, min, max, 0, lights);
  wallRun(g, 'x', min.x, max.x, min.y, 0, gapSpec.s ?? []);   // south (−Z edge)
  wallRun(g, 'x', min.x, max.x, max.y, 0, gapSpec.n ?? []);   // north (+Z edge)
  wallRun(g, 'z', min.y, max.y, min.x, 0, gapSpec.w ?? []);   // west  (−X edge)
  wallRun(g, 'z', min.y, max.y, max.x, 0, gapSpec.e ?? []);   // east  (+X edge)
  return { id, min: min.clone(), max: max.clone(), doorways: [] };
}

function door(cell: Cell, pos: THREE.Vector3, normal: THREE.Vector3, scale = 1): Doorway {
  const d: Doorway = { cell, pos, normal: normal.clone().normalize(), width: DOOR_W, scale };
  cell.doorways.push(d);
  return d;
}
function link(a: Doorway, b: Doorway) { a.link = b; b.link = a; }

// ── the layout ──────────────────────────────────────────────────────────────
export function buildWorld(): World {
  mats();
  const root = new THREE.Group();
  const lights: THREE.Object3D[] = [];
  const cells: Cell[] = [];

  // ROOM — the pelican chamber, 20×20. Doorways on south (to the loop) and
  // north (loop returns here). Cells live in their own far-apart regions.
  const roomG = new THREE.Group(); root.add(roomG);
  const room = makeCell('room', new THREE.Vector2(-10, -10), new THREE.Vector2(10, 10),
    { s: [0], n: [0] }, roomG, lights);
  cells.push(room);
  const pelican = makePelican();
  pelican.position.set(0, 0, 0);
  roomG.add(pelican);

  // three corridors, each parked 400+ units away so nothing overlaps
  const corr = (id: string, ox: number, oz: number, gaps: any): Cell => {
    const g = new THREE.Group(); root.add(g);
    const min = new THREE.Vector2(ox - 2.2, oz - 14), max = new THREE.Vector2(ox + 2.2, oz + 14);
    const c = makeCell(id, min, max, gaps, g, lights);
    cells.push(c); return c;
  };
  const c1 = corr('c1', 500, 0, { s: [500], n: [500] });
  const c2 = corr('c2', 1000, 0, { s: [1000], n: [1000] });
  const c3 = corr('c3', 1500, 0, { s: [1500], n: [1500] });

  // doorways (all normals cardinal)
  const S = new THREE.Vector3(0, 0, -1), N = new THREE.Vector3(0, 0, 1);
  const roomS = door(room, new THREE.Vector3(0, 0, -10), S, 0.62); // shrink entering the ring
  const roomN = door(room, new THREE.Vector3(0, 0, 10), N);

  const c1s = door(c1, new THREE.Vector3(500, 0, -14), S);
  const c1n = door(c1, new THREE.Vector3(500, 0, 14), N);
  const c2s = door(c2, new THREE.Vector3(1000, 0, -14), S);
  const c2n = door(c2, new THREE.Vector3(1000, 0, 14), N);
  const c3s = door(c3, new THREE.Vector3(1500, 0, -14), S);
  const c3n = door(c3, new THREE.Vector3(1500, 0, 14), N);

  // the impossible ring:  room.S → c1.N → c1.S → c2.N → c2.S → c3.N → c3.S → room.N
  link(roomS, c1n);
  link(c1s, c2n);
  link(c2s, c3n);
  link(c3s, roomN);

  return { root, cells, start: { cell: room, pos: new THREE.Vector3(0, 0, 6), yaw: Math.PI }, pelican, lights };
}

export { H as CEIL_H, DOOR_W, WALL };
