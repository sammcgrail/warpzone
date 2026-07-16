// ─────────────────────────────────────────────────────────────────────────────
//  The centrepiece: a stone sculpture of a pelican riding a bicycle — Claude's
//  benchmark meme, carved and dropped in the liminal void. Built from primitives
//  (no asset), one stone material, so it's cheap and reads at any scale — which
//  matters, because the scale-portals make it loom to cathedral size.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { stone } from './textures';

export function makePelican(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: stone(), roughness: 0.9, metalness: 0.0, color: 0xc4bfb2,
    emissive: 0x38332a, emissiveIntensity: 0.6,   // faint glow — pale monument in the murk
  });
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number,
               rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = m.receiveShadow = false;
    g.add(m); return m;
  };

  // ── bicycle ────────────────────────────────────────────────────────────────
  const wheel = () => new THREE.TorusGeometry(0.62, 0.07, 8, 22);
  add(wheel(), -0.95, 0.62, 0, 0, Math.PI / 2, 0);   // rear wheel
  add(wheel(), 0.95, 0.62, 0, 0, Math.PI / 2, 0);    // front wheel
  // spokes hint — a thin disc
  const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
  add(hub, -0.95, 0.62, 0, 0, 0, Math.PI / 2);
  add(hub, 0.95, 0.62, 0, 0, 0, Math.PI / 2);
  const bar = (len: number) => new THREE.CylinderGeometry(0.055, 0.055, len, 8);
  add(bar(1.5), 0, 0.95, 0, 0, 0, Math.PI / 2 + 0.35);        // down tube
  add(bar(1.35), -0.35, 0.9, 0, 0, 0, 0.7);                    // seat tube
  add(bar(1.15), 0.7, 1.0, 0, 0, 0, -0.55);                    // head tube to bars
  add(bar(1.9), -0.05, 0.66, 0, 0, 0, Math.PI / 2);            // chain stay / bottom
  // handlebars + seat
  add(bar(0.7), 1.05, 1.5, 0, Math.PI / 2, 0, 0);
  add(new THREE.SphereGeometry(0.16, 10, 8), -0.55, 1.45, 0, 0, 0, 0, 1.4, 0.5, 1);

  // ── pelican (riding) ─────────────────────────────────────────────────────
  // body — plump, leaning forward
  add(new THREE.SphereGeometry(0.62, 16, 12), -0.15, 2.1, 0, 0, 0, -0.25, 1.05, 1.35, 1.1);
  // chest / gular pouch swell
  add(new THREE.SphereGeometry(0.4, 14, 10), 0.28, 1.95, 0, 0, 0, 0, 1.1, 1.0, 1.0);
  // neck
  add(new THREE.CylinderGeometry(0.17, 0.24, 0.9, 10), 0.34, 2.5, 0, 0, 0, -0.5);
  // head
  const head = add(new THREE.SphereGeometry(0.28, 14, 12), 0.72, 2.86, 0);
  // the BEAK — the signature. long, with the pouch underneath
  add(new THREE.ConeGeometry(0.15, 1.05, 10), 1.32, 2.72, 0, 0, 0, -Math.PI / 2 + 0.15, 1, 1, 0.7);
  add(new THREE.SphereGeometry(0.2, 12, 8), 1.15, 2.55, 0, 0, 0, 0, 1.7, 0.7, 0.9); // pouch
  // eye ridges (tiny)
  add(new THREE.SphereGeometry(0.05, 6, 6), 0.86, 2.96, 0.16);
  add(new THREE.SphereGeometry(0.05, 6, 6), 0.86, 2.96, -0.16);
  // wings folded along the body
  add(new THREE.SphereGeometry(0.5, 10, 8), -0.28, 2.12, 0.42, 0.2, 0, -0.2, 0.8, 1.1, 0.28);
  add(new THREE.SphereGeometry(0.5, 10, 8), -0.28, 2.12, -0.42, -0.2, 0, -0.2, 0.8, 1.1, 0.28);
  // legs reaching to the pedals
  add(bar(0.8), -0.05, 1.3, 0.2, 0.4, 0, 0.2);
  add(bar(0.8), -0.05, 1.3, -0.2, -0.4, 0, 0.2);
  head.name = 'pelicanHead';

  // a low plinth
  add(new THREE.CylinderGeometry(1.7, 1.9, 0.3, 24), 0, 0.15, 0);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; });
  return g;
}
