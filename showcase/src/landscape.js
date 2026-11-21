import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const REGIONS = [['amazon', 'Central Amazon'], ['budongo', 'Budongo, Uganda'], ['osa', 'Osa, Costa Rica']];
const SAMPLES = { 0: 10, 2: 30, 9: 100 };
const SIZE = 10;
const $ = (id) => document.getElementById(id);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function startLandscape() {
  const state = { key: 'amazon', layer: 'habitat', round: '0', showGrid: false, data: {} };
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(css('--panel'));
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 100);
  camera.position.set(0, 7.5, 9.5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minPolarAngle = Math.PI * 0.08; controls.maxPolarAngle = Math.PI * 0.36; controls.minDistance = 2.5; controls.maxDistance = 18;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334433, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-4, 8, 3); scene.add(sun);
  let mesh = null; const pins = new THREE.Group(); scene.add(pins);
  const loader = new THREE.TextureLoader(), cache = {};

  new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); frame();
  }).observe(canvas);
  // Fit the terrain to the view: wide enough to fill the frame, tilted ~48 degrees.
  function frame() {
    const d = state.data[state.key], depth = d ? (SIZE * d.h) / d.w : SIZE;
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max((SIZE / 2) / Math.tan(hf / 2), (depth * 0.62) / Math.tan(vf / 2)) * 0.98;
    const tilt = THREE.MathUtils.degToRad(48);
    camera.position.set(0, dist * Math.cos(tilt), dist * Math.sin(tilt)); controls.target.set(0, 0, 0); controls.update();
  }
  (function loop() {
    requestAnimationFrame(loop);
    if (document.body.dataset.tab !== 'landscape') return;
    controls.update(); renderer.render(scene, camera);
  })();

  const vscale = (d) => Math.min(0.9 / Math.max(d.relief_m, 1), 0.02);
  const heightAt = (d, r, c) => {
    const H = d.height, rr = Math.min(H.h - 1, Math.round((r / d.h) * (H.h - 1))), cc = Math.min(H.w - 1, Math.round((c / d.w) * (H.w - 1)));
    return H.v[rr * H.w + cc];
  };
  function smooth(d) {
    // Copernicus GLO-30 is a surface model (includes canopy): blur it so the terrain reads as ground.
    if (d.height.smoothed) return;
    const { w, h } = d.height; let v = Float32Array.from(d.height.v);
    for (let pass = 0; pass < 3; pass++) {
      const o = new Float32Array(v.length);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        let s = 0, n = 0;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue; s += v[rr * w + cc]; n++;
        }
        o[r * w + c] = s / n;
      }
      v = o;
    }
    d.height.v = v; d.height.smoothed = true;
  }
  function buildMesh(d) {
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    smooth(d);
    const H = d.height, g = new THREE.PlaneGeometry(SIZE, (SIZE * d.h) / d.w, H.w - 1, H.h - 1), s = vscale(d), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, H.v[i] * s);
    g.computeVertexNormals(); g.rotateX(-Math.PI / 2);
    mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff })); scene.add(mesh);
  }
  function tex(url) {
    if (!cache[url]) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache[url] = t; }
    return cache[url];
  }
  function applyLayer() {
    const d = state.data[state.key]; if (!d || !mesh) return;
    const t = d.tex, url = state.layer === 'habitat' ? t.habitat : state.layer === 'truth' ? t.truth : t[state.layer][state.round];
    mesh.material.map = tex(url); mesh.material.needsUpdate = true; legend();
  }
  function gridIdx(h, w, n) {
    const k = Math.ceil(Math.sqrt(n)), lin = (a, m) => Array.from({ length: m + 2 }, (_, i) => (a * i) / (m + 1)).slice(1, -1).map(Math.trunc);
    const out = []; for (const r of lin(h - 1, k)) for (const c of lin(w - 1, k)) out.push([r, c]); return out.slice(0, n);
  }
  function drawPins() {
    pins.clear(); const d = state.data[state.key]; if (!d) return;
    const n = SAMPLES[state.round], Hs = (SIZE * d.h) / d.w, s = vscale(d);
    const add = (pts, color, tall) => {
      const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
      for (const [r, c] of pts) {
        const x = ((c + 0.5) / d.w) * SIZE - SIZE / 2, z = ((r + 0.5) / d.h) * Hs - Hs / 2, y = heightAt(d, r, c) * s;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, tall, 6), mat); stem.position.set(x, y + tall / 2, z);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), mat); head.position.set(x, y + tall, z);
        pins.add(stem, head);
      }
    };
    add(d.pts.guided.slice(0, n), new THREE.Color(css('--guided')), 0.75);
    if (state.showGrid) add(gridIdx(d.h, d.w, n), new THREE.Color(css('--grid')), 0.38);
  }
  function legend() {
    const n = SAMPLES[state.round];
    const V = 'linear-gradient(90deg,#261840,#4a348c,#2b80a8,#5abe82,#f0e178)', U = 'linear-gradient(90deg,#14141c,#5a285a,#be4646,#f5a03c,#fff0c8)';
    const R = { truth: [V, 'low', 'high', 'Fungal richness (simulated)'], pred: [V, 'low', 'high', `Prediction from ${n} samplers`], unc: [U, 'sure', 'unsure', `Uncertainty after ${n} samplers`] };
    let h = state.layer === 'habitat' ? '<div>Satellite habitat</div><div class="rr"><span>similar colour = similar habitat</span></div>'
      : `<div>${R[state.layer][3]}</div><div class="ramp" style="background:${R[state.layer][0]}"></div><div class="rr"><span>${R[state.layer][1]}</span><span>${R[state.layer][2]}</span></div>`;
    h += `<div class="k"><i style="background:var(--guided)"></i>Guided samplers (${n})</div>`;
    if (state.showGrid) h += `<div class="k"><i style="background:var(--grid)"></i>Grid samplers (${n})</div>`;
    $('legend3d').innerHTML = h;
  }
  function chart(id, d, m) {
    const W = 360, H = 160, M = { l: 38, r: 10, t: 8, b: 24 };
    const xs = d.curves.guided[m].map((_, i) => (i + 1) * d.per_round);
    const all = ['guided', 'grid', 'random'].flatMap((k) => d.curves[k][m]);
    let lo = Math.min(...all), hi = Math.max(...all); const p = (hi - lo) * 0.1; lo -= p; hi += p;
    const X = (v) => M.l + ((v - xs[0]) / (xs.at(-1) - xs[0])) * (W - M.l - M.r), Y = (v) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b);
    const step = hi - lo > 0.6 ? 0.2 : 0.1, ticks = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(+t.toFixed(2));
    let s = ticks.map((t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${M.l - 6}" y="${Y(t) + 3}" text-anchor="end">${t.toFixed(1)}</text>`).join('');
    s += [10, 30, 50, 70, 100].map((v) => `<text x="${X(v)}" y="${H - 7}" text-anchor="middle">${v}</text>`).join('');
    const n = SAMPLES[state.round];
    s += `<line x1="${X(n)}" x2="${X(n)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--ink)" stroke-dasharray="3 3" opacity=".45"/>`;
    for (const [k, col, dash, w] of [['random', '--random', '4 3', 1.5], ['grid', '--grid', '', 2], ['guided', '--guided', '', 2.6]]) {
      const v = d.curves[k][m];
      s += `<polyline fill="none" stroke="var(${col})" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} points="${v.map((y, i) => `${X(xs[i])},${Y(y)}`).join(' ')}"/>`;
      s += `<circle cx="${X(n)}" cy="${Y(v[xs.indexOf(n)])}" r="3.5" fill="var(${col})"/>`;
    }
    $(id).innerHTML = s;
  }
  function verdict(d) {
    const g = d.curves.guided, gr = d.curves.grid, ra = d.curves.random, pct = (a, b) => Math.round((1 - a / b) * 100);
    const e10 = pct(g[1][0], Math.min(gr[1][0], ra[1][0])), e30 = pct(g[1][2], Math.min(gr[1][2], ra[1][2]));
    const r100 = g[0][9] - Math.max(gr[0][9], ra[0][9]);
    $('verdict').innerHTML = `<b>Guided is ${e10}% better with 10 samplers and ${e30}% better with 30.</b> By 100 samplers grid or random catch up and edge ahead on whole-map R² (guided ${r100 >= 0 ? '+' : ''}${r100.toFixed(2)}). Smart placement pays when samples are scarce, and in the tropics they always are.`;
  }
  function render() {
    const d = state.data[state.key]; if (!d) return;
    $('regionName').textContent = d.name;
    $('tileId').textContent = `TESSERA tile ${d.tile[1].toFixed(2)}°, ${d.tile[0].toFixed(2)}° · 2024`;
    $('fArea').textContent = `${((d.w * d.px_m) / 1000).toFixed(0)} × ${((d.h * d.px_m) / 1000).toFixed(0)} km`;
    $('fRelief').textContent = `${Math.round(d.relief_m)} m`;
    $('fPx').textContent = `${d.px_m} m`;
    chart('cMac', d, 1); chart('cR2', d, 0); verdict(d); drawPins(); applyLayer();
  }
  async function select(key) {
    state.key = key;
    document.querySelectorAll('#rtabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.k === key));
    if (!state.data[key]) state.data[key] = await (await fetch(`data/${key}.json`)).json();
    buildMesh(state.data[key]); frame(); render();
  }
  for (const [k, name] of REGIONS) {
    const b = document.createElement('button'); b.dataset.k = k; b.textContent = name; b.onclick = () => select(k); $('rtabs').append(b);
  }
  const seg = (id, attr, key) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', x === b));
    state[key] = b.dataset[attr]; render();
  });
  seg('layers', 'l', 'layer'); seg('rounds', 'r', 'round');
  $('showGrid').addEventListener('change', (e) => { state.showGrid = e.target.checked; drawPins(); legend(); });
  select('amazon');
  return { select };
}
