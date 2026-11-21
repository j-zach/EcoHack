import * as THREE from 'three';
import { TAXA } from './taxa.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const UP = new THREE.Vector3(0, 1, 0);

const LOOK = [
  { cap: 0xb8612a, stem: 0xd9b48a, gill: 0xe8c9a0, emissive: 0x000000 }, // saprotroph bracket
  { cap: 0xd4a03a, stem: 0xefe3c8, gill: 0xf3e6c4, emissive: 0x000000 }, // ectomycorrhizal
  { cap: 0x8a4f9e, stem: 0xd8c8e0, gill: 0xc9b3d6, emissive: 0x000000 }, // pathogen
  { cap: 0xcfe8d8, stem: 0xe7efe9, gill: 0xd9efe2, emissive: 0x37ff9e }, // mycena-like
];

function build(taxon, mats, rng) {
  const inner = new THREE.Group();
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; inner.add(m); return m; };
  let capTop;
  if (taxon === 0) { // shelf bracket, flat side against the wood, protruding +x
    const r = 0.07 + rng() * 0.06;
    add(new THREE.CylinderGeometry(r, r * 0.9, r * 0.22, 18, 1, false, 0, Math.PI), mats.cap);
    add(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.002, 18, 1, false, 0, Math.PI), mats.gill, -r * 0.115);
    capTop = new THREE.Vector3(r * 0.5, -r * 0.12, 0);
  } else if (taxon === 1) { // classic cap
    const h = 0.08 + rng() * 0.06, sr = 0.012 + rng() * 0.006, cr = 0.045 + rng() * 0.03;
    add(new THREE.CylinderGeometry(sr * 0.8, sr, h, 10), mats.stem, h / 2);
    const cap = add(new THREE.SphereGeometry(cr, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.cap, h * 0.95); cap.scale.y = 0.55;
    add(new THREE.CircleGeometry(cr * 0.97, 20).rotateX(Math.PI / 2), mats.gill, h * 0.95);
    capTop = new THREE.Vector3(0, h * 0.9, 0);
  } else if (taxon === 2) { // small conical
    const h = 0.05 + rng() * 0.03;
    add(new THREE.CylinderGeometry(0.004, 0.005, h, 6), mats.stem, h / 2);
    add(new THREE.ConeGeometry(0.018 + rng() * 0.008, 0.032, 14), mats.cap, h + 0.012);
    capTop = new THREE.Vector3(0, h, 0);
  } else { // mycena bell
    const h = 0.04 + rng() * 0.035, cr = 0.012 + rng() * 0.005;
    add(new THREE.CylinderGeometry(0.002, 0.0028, h, 6), mats.stem, h / 2);
    const cap = add(new THREE.SphereGeometry(cr, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.cap, h * 0.97); cap.scale.y = 0.95;
    capTop = new THREE.Vector3(0, h * 0.95, 0);
  }
  return { inner, capTop };
}

export class Patch {
  constructor(taxon, rng) {
    this.taxon = taxon; this.cfg = TAXA[taxon]; this.rng = rng;
    this.group = new THREE.Group();
    this.items = [];
    const L = LOOK[taxon];
    this.mats = {
      cap: new THREE.MeshStandardMaterial({ color: L.cap, roughness: 0.6, emissive: L.emissive, emissiveIntensity: 0 }),
      stem: new THREE.MeshStandardMaterial({ color: L.stem, roughness: 0.7 }),
      gill: new THREE.MeshStandardMaterial({ color: L.gill, roughness: 0.8, side: THREE.DoubleSide, emissive: L.emissive, emissiveIntensity: 0 }),
    };
    this.baseCap = new THREE.Color(L.cap);
    this.decay = new THREE.Color(0x3b2a1c);
    this.phase = 'idle'; this.phaseT = 0; this.phaseDur = 0;
    this.moisture = 0; this.emitAcc = 0;
    this._v = new THREE.Vector3();
  }

  add(pos, quat, scale) {
    const { inner, capTop } = build(this.taxon, this.mats, this.rng);
    const obj = new THREE.Group();
    obj.position.copy(pos); obj.quaternion.copy(quat); obj.add(inner);
    obj.visible = false;
    this.group.add(obj);
    this.items.push({ obj, inner, capTop, base: scale * 1.6, delay: this.rng() * 0.4, tilt: (this.rng() - 0.5) * 2, g: 0 });
  }

  // helper for orienting along a surface normal
  static quatFromNormal(n, blend = 1) {
    return new THREE.Quaternion().setFromUnitVectors(UP, UP.clone().lerp(n, blend).normalize());
  }
  static quatBracket(n) {
    const x = n.clone().normalize();
    const y = UP.clone().addScaledVector(x, -UP.dot(x)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  setPhase(p, dur) { this.phase = p; this.phaseT = 0; this.phaseDur = dur; }

  step(dtDays, rain) {
    const c = this.cfg, r = this.rng;
    const rr = (a) => a[0] + r() * (a[1] - a[0]);
    this.moisture = this.moisture * Math.exp(-0.5 * dtDays) + rain * dtDays * 3.2;
    this.phaseT += dtDays;
    const done = this.phaseT >= this.phaseDur;
    switch (this.phase) {
      case 'idle': if (this.moisture > c.thr) this.setPhase('pending', rr(c.lag)); break;
      case 'pending': if (done) { this.setPhase('emerge', c.emerge); this.mats.cap.color.copy(this.baseCap); } break;
      case 'emerge': if (done) this.setPhase('spore', rr(c.spore)); break;
      case 'spore': if (done) this.setPhase('collapse', c.collapse); break;
      case 'collapse': if (done) { this.setPhase('cooldown', rr(c.cooldown)); this.moisture *= 0.3; } break;
      case 'cooldown': if (done) this.setPhase('idle', 0); break;
    }
  }

  get visibleNow() { return this.phase === 'emerge' || this.phase === 'spore' || this.phase === 'collapse'; }

  emissionStrength() {
    if (this.phase !== 'spore') return 0;
    return Math.pow(Math.sin(Math.PI * clamp01(this.phaseT / this.phaseDur)), 0.6);
  }

  emitPoint(out) {
    if (!this.items.length) return false;
    const it = this.items[Math.floor(this.rng() * this.items.length)];
    if (it.g < 0.6) return false;
    out.copy(it.capTop);
    it.inner.localToWorld(out);
    return true;
  }

  updateVisual(daylight) {
    const x = this.phaseDur > 0 ? clamp01(this.phaseT / this.phaseDur) : 0;
    let sum = 0;
    for (const it of this.items) {
      let g = 0, droop = 0;
      if (this.phase === 'emerge') g = clamp01((x - it.delay) / 0.6);
      else if (this.phase === 'spore') g = 1;
      else if (this.phase === 'collapse') { g = 1 - 0.75 * x; droop = x; }
      it.g = g; sum += g;
      it.obj.visible = g > 0.002;
      if (!it.obj.visible) continue;
      const eg = 1 - Math.pow(1 - g, 3);
      const s = it.base * (0.05 + 0.95 * eg);
      it.inner.scale.set(s, s * (1 - 0.45 * droop), s);
      it.inner.rotation.z = it.tilt * droop * 0.8;
    }
    if (this.phase === 'collapse') this.mats.cap.color.copy(this.baseCap).lerp(this.decay, x);
    if (this.taxon === 3) {
      const glow = (1 - daylight * 0.9) * (this.items.length ? sum / this.items.length : 0) * 2.4;
      this.mats.cap.emissiveIntensity = glow;
      this.mats.gill.emissiveIntensity = glow;
    }
  }
}
