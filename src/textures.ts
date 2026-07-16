// ─────────────────────────────────────────────────────────────────────────────
//  All textures are painted on a <canvas> at load — zero image assets, so the
//  first-load payload stays tiny (SKILL: a big blocking fetch hangs Safari's
//  progress bar) and the Backrooms palette is exact. Research validated this
//  against backrooms-ThreeJs: canvas textures + Web-Audio synth, ~70 draw calls.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number, a = 0.06) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    if (Math.random() < a) { d[i] -= 18; d[i + 1] -= 18; d[i + 2] -= 16; } // damp specks
  }
  ctx.putImageData(img, 0, 0);
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mono-yellow two-tone striped wallpaper — the canonical Backrooms wall. */
export function wallpaper(): THREE.CanvasTexture {
  const [c, x] = cv(256, 256);
  x.fillStyle = '#c8b46b'; x.fillRect(0, 0, 256, 256);          // aged desat yellow
  // vertical two-tone stripes
  for (let i = 0; i < 256; i += 32) {
    x.fillStyle = (i / 32) % 2 ? 'rgba(150,132,74,0.35)' : 'rgba(214,200,120,0.30)';
    x.fillRect(i, 0, 16, 256);
  }
  // faint horizontal chair-rail + grime streaks
  x.fillStyle = 'rgba(90,78,40,0.4)'; x.fillRect(0, 188, 256, 4);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(70,60,30,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * 256, 190, 1.5, Math.random() * 60);
  }
  grain(x, 256, 256, 20, 0.04);
  return tex(c, 1, 1);
}

/** Damp mottled yellow-brown carpet. */
export function carpet(): THREE.CanvasTexture {
  const [c, x] = cv(256, 256);
  x.fillStyle = '#9a8848'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const s = 90 + Math.random() * 60;
    x.fillStyle = `rgba(${s},${s * 0.86},${s * 0.42},0.12)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  // damp dark patches
  for (let i = 0; i < 6; i++) {
    const g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 4,
      Math.random() * 256, Math.random() * 256, 40 + Math.random() * 30);
    g.addColorStop(0, 'rgba(50,42,20,0.35)'); g.addColorStop(1, 'rgba(50,42,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  grain(x, 256, 256, 26, 0.02);
  return tex(c, 6, 6);
}

/** Off-white acoustic ceiling tiles with darker support grid. */
export function ceiling(): THREE.CanvasTexture {
  const [c, x] = cv(256, 256);
  x.fillStyle = '#d8d2b8'; x.fillRect(0, 0, 256, 256);
  // pinhole acoustic dots
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = 'rgba(120,116,96,0.25)';
    x.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  // support-beam grid (darker)
  x.fillStyle = '#8f8a70';
  x.fillRect(0, 0, 256, 8); x.fillRect(0, 0, 8, 256);
  x.fillRect(126, 0, 5, 256); x.fillRect(0, 126, 256, 5);
  grain(x, 256, 256, 14, 0.01);
  return tex(c, 1, 1);
}

/** Stone — for the pelican sculpture. Cool grey, chiselled speckle. */
export function stone(): THREE.CanvasTexture {
  const [c, x] = cv(256, 256);
  x.fillStyle = '#8d8b86'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 100 + Math.random() * 70;
    x.fillStyle = `rgba(${v},${v},${v * 0.98},0.10)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let i = 0; i < 26; i++) { // veins
    x.strokeStyle = `rgba(60,58,54,${0.05 + Math.random() * 0.06})`;
    x.lineWidth = 0.6 + Math.random();
    x.beginPath(); x.moveTo(Math.random() * 256, Math.random() * 256);
    x.lineTo(Math.random() * 256, Math.random() * 256); x.stroke();
  }
  grain(x, 256, 256, 18, 0.02);
  return tex(c, 1, 1);
}
