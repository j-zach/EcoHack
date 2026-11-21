import * as THREE from 'three';
import { TAXA } from './taxa.js';
import { mulberry32 } from './rng.js';
import { Patch } from './fungi.js';
import { groundHeight, canvasTex } from './environment.js';
import { N_CART } from './sampler.js';

const MAX_SPORES = 12000;
const MAX_AIR = 3000;
const READS_PER_PARTICLE = 40;   // each rendered particle stands for many spores
const BASE_SPEED = 0.12;         // sim days per real second
const PULL_R = 1.8;              // visual capture zone (exaggerated)
const BATTERY_MWH = 25900;       // 2 x 18650
const LOAD_MW = 1.1;

const { smoothstep } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);

export class Simulation {
  constructor(scene, env, sampler) {
    this.scene = scene; this.env = env; this.sampler = sampler;
    this.rng = mulberry32(20261121);
    this.t = 0.27; this.speed = BASE_SPEED; this.paused = false;
    this.realT = 0;
    this.day = 0;
    this.kind = 'rain'; this.rainStart = 0.55; this.rainEnd = 0.68;
    this.cloud = 0.7; this.cloudTarget = 0.95; this.rain = 0; this.humidity = 0.85;
    this.windAngle = 0.9; this.windSpeed = 0.5; this.windTarget = 0.55;
    this.cart = 0; this.week = 0;
    this.counts = Array.from({ length: N_CART }, () => [0, 0, 0, 0]);
    this.history = []; this.weekS2 = [];
    this.s2 = { passes: 0, clear: 0 };
    this.battery = 0.78; this.harvest = 0; this.load = LOAD_MW; this.lastUplink = null;
    this.toasts = [];
    this.daylight = 0.5; this.elev = 0;
    this.patches = this.buildPatches();
    this.patches.forEach((p) => scene.add(p.group));
    this.initSpores();
    this._p = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.toast('Day 1 · deployment: sampler on station, carousel loaded (12 × 7-day cartridges)', 'service');
  }

  toast(text, kind = '') { this.toasts.push({ text, kind }); }

  buildPatches() {
    const rng = this.rng, env = this.env, out = [];
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    env.logs.forEach((log, li) => {
      const sap = new Patch(0, rng);
      const side = li % 2 ? 1 : -1;
      const s0 = (rng() - 0.5) * log.len * 0.4;
      const n = 6 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const s = s0 + (rng() - 0.5) * 1.3, phi = -0.2 + rng() * 0.9;
        const nrm = log.perp.clone().multiplyScalar(side * Math.cos(phi)).addScaledVector(UP, Math.sin(phi)).normalize();
        const pos = log.center.clone().addScaledVector(log.axis, s).addScaledVector(nrm, log.r * 0.97);
        sap.add(pos, Patch.quatBracket(nrm), 0.7 + rng() * 0.7);
      }
      out.push(sap);
      const myc = new Patch(3, rng);
      const s1 = (rng() - 0.5) * log.len * 0.6;
      const m = 9 + Math.floor(rng() * 6);
      for (let i = 0; i < m; i++) {
        const s = s1 + (rng() - 0.5) * 0.55, phi = Math.PI / 2 + (rng() - 0.5) * 1.1;
        const nrm = log.perp.clone().multiplyScalar(-side * Math.cos(phi)).addScaledVector(UP, Math.sin(phi)).normalize();
        const pos = log.center.clone().addScaledVector(log.axis, s).addScaledVector(nrm, log.r);
        myc.add(pos, Patch.quatFromNormal(nrm, 0.6), 0.8 + rng() * 0.6);
      }
      out.push(myc);
    });
    [[1.5, 1.1], [-1.8, 1.6], [4.2, 1.2], [-0.6, -2.6], [-5.5, -1.5], [2.2, 4.4]].forEach(([cx, cz]) => {
      const p = new Patch(1, rng);
      const n = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = 0.08 + rng() * 0.32;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        p.add(v(x, groundHeight(x, z), z), Patch.quatFromNormal(v(rng() - 0.5, 4, rng() - 0.5).normalize()), 0.75 + rng() * 0.6);
      }
      out.push(p);
    });
    const near = [...env.trees].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 4);
    near.forEach((t) => {
      const p = new Patch(2, rng);
      const a0 = Math.atan2(-t.z, -t.x); // side facing the sampler
      const n = 6 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = a0 + (rng() - 0.5) * 1.0, r = t.baseR + 0.05 + rng() * 0.25;
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
        p.add(v(x, groundHeight(x, z), z), Patch.quatFromNormal(v(Math.cos(a), 3, Math.sin(a)).normalize()), 0.8 + rng() * 0.6);
      }
      out.push(p);
    });
    // stagger initial state so the first days are lively
    out.forEach((p) => {
      p.moisture = rng() * 0.6;
      if (rng() < 0.3) p.setPhase('pending', rng() * 1.2);
    });
    return out;
  }

  initSpores() {
    const dot = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    this.sporeMat = new THREE.PointsMaterial({ size: 0.05, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.sp = this.makePool(MAX_SPORES, 0.45, this.sporeMat);
    this.air = this.makePool(MAX_AIR, 0.6, null);
    this.showAir = false;
    this.taxCol = TAXA.map((t) => new THREE.Color(t.color));
    this.airCol = new THREE.Color(0x9fd8ff);
  }

  // A particle pool rendered as glowing heads (optional) + comet-tail streaks showing flow direction.
  makePool(N, trail, pointMat) {
    const pool = {
      N, trail, cursor: 0,
      pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), col: new Float32Array(N * 3),
      life: new Float32Array(N), maxLife: new Float32Array(N), tax: new Uint8Array(N), seed: new Float32Array(N),
      seg: new Float32Array(N * 6), segCol: new Float32Array(N * 6),
    };
    for (let i = 0; i < N; i++) { pool.pos[i * 3 + 1] = -999; pool.seg[i * 6 + 1] = -999; pool.seg[i * 6 + 4] = -999; }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pool.seg, 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(pool.segCol, 3).setUsage(THREE.DynamicDrawUsage));
    pool.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.lines.frustumCulled = false;
    this.scene.add(pool.lines);
    if (pointMat) {
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(pool.pos, 3).setUsage(THREE.DynamicDrawUsage));
      pg.setAttribute('color', new THREE.BufferAttribute(pool.col, 3).setUsage(THREE.DynamicDrawUsage));
      pool.points = new THREE.Points(pg, pointMat);
      pool.points.frustumCulled = false;
      this.scene.add(pool.points);
    }
    return pool;
  }

  alloc(pool) {
    let i = pool.cursor;
    for (let k = 0; k < 64; k++) { const j = (pool.cursor + k) % pool.N; if (pool.life[j] <= 0) { i = j; break; } }
    pool.cursor = (i + 1) % pool.N;
    return i;
  }

  spawn(x, y, z, taxon) {
    const s = this.sp, i = this.alloc(s);
    s.pos[i * 3] = x; s.pos[i * 3 + 1] = y; s.pos[i * 3 + 2] = z;
    s.vel.fill(0, i * 3, i * 3 + 3);
    s.life[i] = s.maxLife[i] = 22 + this.rng() * 14; s.tax[i] = taxon; s.seed[i] = this.rng();
    this.taxCol[taxon].toArray(s.col, i * 3);
  }

  spawnAir(i) {
    const a = this.air, r = this.rng;
    // seed upwind of the sampler so the streams visibly pass it
    const ux = Math.cos(this.windAngle), uz = Math.sin(this.windAngle);
    const along = -2.5 - r() * 4, across = (r() - 0.5) * 7;
    const x = ux * along - uz * across, z = uz * along + ux * across;
    a.pos[i * 3] = x; a.pos[i * 3 + 1] = groundHeight(x, z) + 0.3 + r() * 3; a.pos[i * 3 + 2] = z;
    a.vel.fill(0, i * 3, i * 3 + 3);
    a.life[i] = a.maxLife[i] = 6 + r() * 6; a.seed[i] = r();
  }

  setAirflow(on) {
    this.showAir = on;
    if (on) for (let i = 0; i < this.air.N; i++) { this.spawnAir(i); this.air.life[i] *= this.rng(); }
    else { this.air.life.fill(0); this.air.seg.fill(-999); this.air.lines.geometry.attributes.position.needsUpdate = true; }
  }

  // Get some fungi fruiting right now (used by the guided tour).
  forceFruiting() {
    this.patches.forEach((p, i) => {
      if (i < 2 || this.rng() < 0.35) { p.setPhase('emerge', 0.25); p.mats.cap.color.copy(p.baseCap); }
    });
  }

  makeItRain() {
    this.kind = 'rain'; this.rainStart = this.t; this.rainEnd = this.t + 0.15; this.cloudTarget = 0.95;
    this.toast('Rain event: moisture pulse → fruiting will follow in 1–5 days', 'rain');
  }

  rollWeather() {
    const r = this.rng(), prevRain = this.kind === 'rain';
    const pRain = prevRain ? 0.55 : 0.38;
    this.kind = r < pRain ? 'rain' : r < pRain + 0.35 ? 'cloudy' : 'clear';
    if (this.kind === 'rain') {
      const night = this.rng() < 0.2;
      this.rainStart = this.day + (night ? this.rng() * 5 : 11 + this.rng() * 6) / 24;
      this.rainEnd = this.rainStart + (1.5 + this.rng() * 4) / 24;
    }
    this.cloudTarget = this.kind === 'rain' ? 0.95 : this.kind === 'cloudy' ? 0.8 : 0.35;
    this.windTarget = 0.3 + this.rng() * 0.6 + (this.kind === 'rain' ? 0.4 : 0);
  }

  crossed(prevT, t, frac, every = 1, offset = 0) {
    for (let d = Math.floor(prevT); d <= Math.floor(t); d++) {
      const x = d + frac;
      if (prevT < x && x <= t && (d - offset) % every === 0) return d;
    }
    return -1;
  }

  advanceWeek(wk) {
    this.history.push({ week: this.week, counts: this.counts[this.cart].slice(), s2: this.weekS2.slice() });
    this.weekS2 = [];
    this.week = wk;
    this.cart++;
    if (this.cart >= N_CART) {
      this.cart = 0;
      this.counts = Array.from({ length: N_CART }, () => [0, 0, 0, 0]);
      this.sampler.setCartridge(0, true);
      this.toast(`Day ${this.day + 1} · field visit: 12 sealed cartridges out to the lab, fresh carousel in`, 'service');
    } else {
      this.sampler.setCartridge(this.cart);
      this.toast(`Week ${wk} done · cartridge #${this.cart} sealed, indexing to #${this.cart + 1}`, 'index');
    }
  }

  update(dt) {
    if (this.paused) return;
    this.realT += dt;
    const dDays = dt * this.speed;
    const prevT = this.t;
    this.t += dDays;

    const newDay = Math.floor(this.t);
    if (newDay !== this.day) { this.day = newDay; this.rollWeather(); }

    // events
    const s2Day = this.crossed(prevT, this.t, 10.5 / 24, 5, 2);
    if (s2Day >= 0) {
      const clear = this.kind !== 'rain' && this.rng() > this.cloud * 0.95;
      this.s2.passes++; if (clear) this.s2.clear++;
      this.weekS2.push(clear);
      this.toast(clear
        ? 'Sentinel-2 overpass 10:30 · clear pixel, but it sees canopy only; no fungi visible'
        : 'Sentinel-2 overpass 10:30 · cloud-obscured: no usable pixel', clear ? 's2ok' : 's2bad');
    }
    if (this.crossed(prevT, this.t, 0.75) >= 0) { this.lastUplink = Math.floor(this.t); this.sampler.pulseUplink(); }

    // weather
    const frac = this.t - Math.floor(this.t);
    this.elev = Math.sin(2 * Math.PI * (frac - 0.25));
    this.daylight = smoothstep(this.elev, -0.12, 0.3);
    let rainTarget = 0;
    if (this.kind === 'rain' && this.t >= this.rainStart && this.t <= this.rainEnd) {
      const u = (this.t - this.rainStart) / (this.rainEnd - this.rainStart);
      rainTarget = Math.min(1, Math.sin(Math.PI * u) * 1.6);
    }
    const k = Math.min(1, dDays * 40 + dt * 0.5);
    this.rain += (rainTarget - this.rain) * k;
    this.cloud += (Math.max(this.cloudTarget, rainTarget > 0 ? 0.95 : 0) - this.cloud) * Math.min(1, dDays * 6);
    this.humidity = Math.min(1, Math.max(0.5, 0.72 + 0.2 * (1 - this.daylight) + 0.25 * this.rain + 0.1 * this.cloud - 0.12 * this.daylight));
    this.windAngle += (this.rng() - 0.5) * 6 * Math.sqrt(dDays) + (this.rng() - 0.5) * 0.02;
    this.windSpeed += (this.windTarget - this.windSpeed) * Math.min(1, dDays * 3);

    // fungi
    for (const p of this.patches) { p.step(dDays, this.rain); p.updateVisual(this.daylight); }

    // weekly cartridge cycle
    const wk = Math.floor(this.t / 7);
    if (wk !== this.week) this.advanceWeek(wk);

    // power budget
    this.harvest = 5600 * 0.05 * Math.max(0, this.elev) * (1 - 0.75 * this.cloud);
    this.battery = Math.min(1, Math.max(0, this.battery + ((this.harvest - this.load) * dDays * 24) / BATTERY_MWH));

    this.updateSpores(dt);
  }

  updateSpores(dt) {
    const rng = this.rng;
    for (const p of this.patches) {
      const str = p.emissionStrength();
      if (str <= 0) continue;
      p.emitAcc += p.cfg.rate * str * (0.5 + 0.7 * this.humidity) * dt;
      while (p.emitAcc >= 1) {
        p.emitAcc -= 1;
        if (p.emitPoint(this._p)) this.spawn(this._p.x + (rng() - 0.5) * 0.03, this._p.y + rng() * 0.02, this._p.z + (rng() - 0.5) * 0.03, p.taxon);
      }
    }
    const P = this.sampler.mouthWorld(this._v);
    const open = !this.sampler.isIndexing() && this.sampler.explodeAmount() < 0.02;
    this.advect(this.sp, dt, P, open, true);
    if (this.showAir) this.advect(this.air, dt, P, open, false);
  }

  advect(pool, dt, P, open, isSpore) {
    const N = pool.N, s = pool;
    const wx0 = Math.cos(this.windAngle) * this.windSpeed, wz0 = Math.sin(this.windAngle) * this.windSpeed;
    const T = this.realT, rainDown = isSpore ? this.rain * 0.6 : 0, thermal = this.daylight * 0.03;
    const weight = (this.speed / BASE_SPEED) * READS_PER_PARTICLE;
    const R2 = PULL_R * PULL_R, trail = pool.trail;
    const counts = this.counts[this.cart];
    const ac = this.airCol;
    for (let i = 0; i < N; i++) {
      const o = i * 3, q = i * 6;
      if (s.life[i] <= 0) {
        if (!isSpore && this.showAir) this.spawnAir(i); else continue;
      }
      s.life[i] -= dt;
      let px = s.pos[o], py = s.pos[o + 1], pz = s.pos[o + 2];
      const ph = s.seed[i] * 6.283;
      const hf = 0.35 + 0.65 * Math.min(1, Math.max(0, py) / 8);
      let ux = wx0 * hf + 0.32 * Math.sin(0.9 * py + T * 0.8 + ph) + 0.18 * Math.sin(1.7 * pz + T * 1.3 + ph * 0.5);
      let uz = wz0 * hf + 0.32 * Math.cos(0.8 * px + T * 0.7 + ph * 1.7) + 0.18 * Math.cos(1.5 * px - T * 1.1);
      let uy = 0.11 * Math.sin(1.1 * px + T * 0.9 + ph * 2.3) + 0.05 * Math.cos(0.7 * pz + T) - (isSpore ? 0.012 : 0) + thermal - rainDown;
      if (open) {
        const dx = P.x - px, dy = P.y - py, dz = P.z - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R2) {
          const d = Math.sqrt(d2);
          if (d < 0.045) {
            if (isSpore) { const t = s.tax[i]; counts[t] += weight; this.sampler.flash(t); }
            s.life[i] = 0; s.pos[o + 1] = -999; s.seg[q + 1] = s.seg[q + 4] = -999;
            continue;
          }
          const kk = (isSpore ? 1.7 : 0.8) * (1 - d / PULL_R) + (isSpore ? 0.25 : 0.05);
          ux += (dx / d) * kk; uy += (dy / d) * kk; uz += (dz / d) * kk;
        }
      }
      px += ux * dt; py += uy * dt; pz += uz * dt;
      if (s.life[i] <= 0 || py < groundHeight(px, pz) + 0.005 || Math.abs(px) > 45 || Math.abs(pz) > 45 || py > 30) {
        s.life[i] = 0; s.pos[o + 1] = -999; s.seg[q + 1] = s.seg[q + 4] = -999; continue;
      }
      s.pos[o] = px; s.pos[o + 1] = py; s.pos[o + 2] = pz;
      // smooth velocity for the tail so streaks don't jitter
      const vx = (s.vel[o] += (ux - s.vel[o]) * 0.15), vy = (s.vel[o + 1] += (uy - s.vel[o + 1]) * 0.15), vz = (s.vel[o + 2] += (uz - s.vel[o + 2]) * 0.15);
      s.seg[q] = px; s.seg[q + 1] = py; s.seg[q + 2] = pz;
      s.seg[q + 3] = px - vx * trail; s.seg[q + 4] = py - vy * trail; s.seg[q + 5] = pz - vz * trail;
      // fade in/out over life; tail vertex stays black (= transparent under additive blending)
      const age = s.maxLife[i] - s.life[i];
      const f = Math.min(1, age / 0.6, s.life[i] / 1.5);
      if (isSpore) { s.segCol[q] = s.col[o] * f; s.segCol[q + 1] = s.col[o + 1] * f; s.segCol[q + 2] = s.col[o + 2] * f; }
      else { const g = f * 0.6; s.segCol[q] = ac.r * g; s.segCol[q + 1] = ac.g * g; s.segCol[q + 2] = ac.b * g; }
    }
    pool.lines.geometry.attributes.position.needsUpdate = true;
    pool.lines.geometry.attributes.color.needsUpdate = true;
    if (pool.points) {
      pool.points.geometry.attributes.position.needsUpdate = true;
      pool.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
