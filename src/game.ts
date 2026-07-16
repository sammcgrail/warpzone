import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { makeVHSPass } from './vhs';
import { buildWorld, type Cell, type Doorway, type World, DOOR_W, WALL } from './world';
import { Audio } from './audio';

const EYE = 1.7;          // eye height at scale 1
const SPEED = 3.4;        // walk speed (world u/s) at scale 1
const RADIUS = 0.34;      // collision radius at scale 1
const PITCH_MAX = Math.PI / 2 - 0.05;

export interface Hud { scale: number; depth: number; }

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cam: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private vhs = makeVHSPass();
  private world: World;
  private audio = new Audio();

  // player state
  private pos = new THREE.Vector3();
  private last = new THREE.Vector3();
  private yaw = 0; private pitch = 0;
  private scale = 1;
  private cell: Cell;
  private warp = 0;         // aberration flash after a teleport
  private bob = 0;
  private laps = 0;

  // input
  private keys: Record<string, boolean> = {};
  private look = { active: false, id: -1, x: 0, y: 0 };
  private stick = { active: false, id: -1, cx: 0, cy: 0, dx: 0, dy: 0 };
  private clock = new THREE.Clock();
  private raf = 0;
  started = false;

  constructor(mount: HTMLElement, private onHud: (h: Hud) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4)); // VHS softness + mobile perf
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121008);
    this.scene.fog = new THREE.FogExp2(0x14110a, 0.055); // hides the between-cell void

    this.cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 90);

    this.world = buildWorld();
    this.scene.add(this.world.root);

    // only the pelican is lit (env is unlit MeshBasic). Warm fill + a strip-lit
    // key from above so the sculpture reads as stone with real form.
    this.scene.add(new THREE.AmbientLight(0xe4d6a8, 2.6));
    this.scene.add(new THREE.HemisphereLight(0xfff4d6, 0x4a4022, 2.0));
    const key = new THREE.PointLight(0xfff2d0, 120, 60, 1.6);
    key.position.copy(this.world.pelican.position).add(new THREE.Vector3(0, 5, 0));
    this.scene.add(key);
    const fill = new THREE.PointLight(0xffe8c0, 70, 60, 1.6); // front fill so the beak reads
    fill.position.copy(this.world.pelican.position).add(new THREE.Vector3(3, 2.5, 6));
    this.scene.add(fill);

    this.cell = this.world.start.cell;
    this.pos.copy(this.world.start.pos);
    this.last.copy(this.pos);
    this.yaw = this.world.start.yaw;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.composer.addPass(this.vhs);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
    this.composer.setSize(innerWidth, innerHeight);

    (window as any).__wzGame = this;
    this.bind();
    addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  get ok() { return !!this.renderer.getContext(); }

  /** Headless-verifier hook — park the camera to inspect a spot. Harmless in prod. */
  setView(x: number, z: number, yaw: number, pitch: number) {
    this.pos.set(x, 0, z); this.last.copy(this.pos); this.yaw = yaw; this.pitch = pitch;
    this.started = true;
  }

  begin() {
    if (this.started) return;
    this.started = true;
    this.audio.start();
    if (!this.isTouch()) this.renderer.domElement.requestPointerLock?.();
  }

  private isTouch() { return matchMedia('(hover: none) and (pointer: coarse)').matches; }

  // ── input ──────────────────────────────────────────────────────────────────
  private bind() {
    addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { this.yaw -= e.movementX * 0.0022; this.addPitch(-e.movementY * 0.0022); }
    });
    const cv = this.renderer.domElement;
    cv.addEventListener('click', () => { if (this.started && !this.isTouch()) cv.requestPointerLock?.(); });

    // touch look (right half of screen) — drag to look
    const guard = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
    cv.addEventListener('touchstart', guard, { passive: false });
    cv.addEventListener('touchmove', guard, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      if (e.clientX > innerWidth * 0.42 && !this.look.active) {
        this.look = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.look.active && e.pointerId === this.look.id) {
        this.yaw -= (e.clientX - this.look.x) * 0.005;
        this.addPitch(-(e.clientY - this.look.y) * 0.005);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const rel = (e: PointerEvent) => { if (e.pointerId === this.look.id) this.look.active = false; };
    cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel);
  }

  private addPitch(d: number) { this.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch + d)); }

  bindStick(el: HTMLElement) {
    const nub = el.querySelector('.nub') as HTMLElement;
    const R = 52;
    el.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      this.stick = { active: true, id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dx: 0, dy: 0 };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.stick.active || e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.cx, dy = e.clientY - this.stick.cy;
      const m = Math.hypot(dx, dy) || 1; if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      this.stick.dx = dx / R; this.stick.dy = dy / R;
      nub.style.transform = `translate(${dx}px,${dy}px)`;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.active = false; this.stick.dx = this.stick.dy = 0;
      nub.style.transform = 'translate(0,0)';
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  // ── movement + collision + teleport ─────────────────────────────────────────
  private moveVec(): [number, number] {
    let f = 0, s = 0;
    const k = this.keys;
    if (k['w'] || k['arrowup']) f += 1;
    if (k['s'] || k['arrowdown']) f -= 1;
    if (k['a'] || k['arrowleft']) s -= 1;
    if (k['d'] || k['arrowright']) s += 1;
    f -= this.stick.dy; s += this.stick.dx;   // touch stick
    return [Math.max(-1, Math.min(1, f)), Math.max(-1, Math.min(1, s))];
  }

  private step(dt: number) {
    const [f, s] = this.moveVec();
    const sp = SPEED * this.scale * dt;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // forward = (-sinY, 0, -cosY); right = (cosY, 0, -sinY)
    let nx = this.pos.x + (-sinY * f + cosY * s) * sp;
    let nz = this.pos.z + (-cosY * f - sinY * s) * sp;
    const moving = (f || s) ? 1 : 0;

    const margin = WALL / 2 + RADIUS * this.scale;
    const c = this.cell;
    const openOn = (nrmZ: number, nrmX: number, coord: number) =>
      c.doorways.some(d =>
        Math.sign(d.normal.z) === nrmZ && Math.sign(d.normal.x) === nrmX &&
        Math.abs(coord - (nrmX ? d.pos.z : d.pos.x)) < DOOR_W / 2 - RADIUS * this.scale);

    if (nz > c.max.y - margin && !openOn(1, 0, nx)) nz = c.max.y - margin;
    if (nz < c.min.y + margin && !openOn(-1, 0, nx)) nz = c.min.y + margin;
    if (nx > c.max.x - margin && !openOn(0, 1, nz)) nx = c.max.x - margin;
    if (nx < c.min.x + margin && !openOn(0, -1, nz)) nx = c.min.x + margin;

    // the pelican is solid: orbit it, don't clip it. Its footprint is world-fixed
    // (~2.2u plinth); the player's radius scales, so you can get closer when tiny.
    if (c.id === 'room') {
      const px = this.world.pelican.position.x, pz = this.world.pelican.position.z;
      const pr = 2.2 + RADIUS * this.scale;
      let dx = nx - px, dz = nz - pz;
      const dl = Math.hypot(dx, dz);
      if (dl < pr && dl > 1e-4) { nx = px + dx / dl * pr; nz = pz + dz / dl * pr; }
    }

    this.last.copy(this.pos);
    this.pos.set(nx, 0, nz);
    this.checkTeleport();

    if (moving) this.bob += dt * 9 * (0.6 + 0.4);
  }

  private tmp = new THREE.Matrix4();
  private tmp2 = new THREE.Matrix4();
  private checkTeleport() {
    const up = new THREE.Vector3(0, 1, 0);
    for (const d of this.cell.doorways) {
      if (!d.link) continue;
      const curSide = this.pos.clone().sub(d.pos).dot(d.normal);
      const prevSide = this.last.clone().sub(d.pos).dot(d.normal);
      if (prevSide <= 0 && curSide > 0) {
        // within the opening width?
        const tangent = new THREE.Vector3().crossVectors(up, d.normal).normalize();
        const off = this.pos.clone().sub(d.pos).dot(tangent);
        if (Math.abs(off) > DOOR_W / 2 + 0.1) continue;
        this.teleport(d);
        return;
      }
    }
  }

  private frame3(pos: THREE.Vector3, fwd: THREE.Vector3, out: THREE.Matrix4) {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const rup = new THREE.Vector3().crossVectors(fwd, right).normalize();
    out.makeBasis(right, rup, fwd).setPosition(pos);
  }

  private teleport(d: Doorway) {
    const link = d.link!;
    // src frame: exit direction = d.normal ; dst frame: enter direction = -link.normal
    this.frame3(d.pos, d.normal.clone(), this.tmp);
    this.frame3(link.pos, link.normal.clone().negate(), this.tmp2);
    const rel = this.tmp2.multiply(this.tmp.invert()); // dst * inv(src)
    this.pos.applyMatrix4(rel);
    this.pos.y = 0;
    // remap yaw: rotate current forward by rel's rotation
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    fwd.transformDirection(rel);
    this.yaw = Math.atan2(-fwd.x, -fwd.z);
    // scale + bookkeeping
    this.scale *= d.scale;
    this.scale = Math.max(0.02, Math.min(1, this.scale));
    if (d.scale !== 1) { this.laps++; }
    this.cell = link.cell;
    this.last.copy(this.pos); // so we don't instantly re-cross
    this.warp = 1;
    this.audio.blip();
  }

  // ── loop ─────────────────────────────────────────────────────────────────
  private onResize = () => {
    this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight);
  };

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    let dt = this.clock.getDelta(); if (dt > 0.1) dt = 0.1;

    if (this.started) this.step(dt);

    // camera
    const eye = EYE * this.scale;
    const bobY = Math.sin(this.bob) * 0.035 * this.scale;
    this.cam.near = 0.02 * this.scale; this.cam.far = 90; this.cam.updateProjectionMatrix();
    this.cam.position.set(this.pos.x, this.pos.y + eye + bobY, this.pos.z);
    this.cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // pelican slow menace-turn of the head handled in world; here just breathe fog
    this.warp = Math.max(0, this.warp - dt * 1.6);
    this.vhs.uniforms.uTime.value = performance.now() / 1000;
    this.vhs.uniforms.uAberration.value = 0.15 + this.warp * 0.85;
    this.audio.setScale(this.scale);

    this.composer.render();
    (window as any).__wz = { scale: this.scale, cell: this.cell.id, x: +this.pos.x.toFixed(1), z: +this.pos.z.toFixed(1), laps: this.laps };
    this.onHud({ scale: this.scale, depth: this.laps });
  };

  dispose() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); this.audio.stop(); }
}
