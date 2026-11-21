import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildEnvironment } from './environment.js';
import { buildSampler } from './sampler.js';
import { Simulation } from './sim.js';
import { Hud } from './hud.js';
import './style.css';

export function startSampler(app, isActive) {
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(app.clientWidth, app.clientHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, app.clientWidth / Math.max(1, app.clientHeight), 0.01, 1500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.12; controls.maxDistance = 260;
controls.zoomToCursor = true;      // scroll zooms toward what's under the mouse
controls.zoomSpeed = 1.15;
controls.screenSpacePanning = true; // right-drag / shift-drag pans

const env = buildEnvironment(scene);
const sampler = buildSampler();
scene.add(sampler.root);
const sim = new Simulation(scene, env, sampler);
const hud = new Hud(sim, sampler);

// marker seen from orbit
const pinEl = document.createElement('div');
pinEl.className = 'pin';
pinEl.innerHTML = '<b>eDNA sampler</b><span>~30 m below, under canopy &amp; cloud</span>';
const pin = new CSS2DObject(pinEl); pin.position.set(0, 36, 0); pin.visible = false;
scene.add(pin);

// ---------- views ----------
const VIEWS = {
  sampler: { pos: [1.3, 1.78, 1.55], target: [-0.05, 1.5, 0], fog: 0.03, size: 0.045 },
  flow: { pos: [1.0, 2.7, 4.3], target: [0.4, 1.1, -0.6], fog: 0.028, size: 0.06 },
  log: { pos: [4.5, 1.35, 0.7], target: [2.6, 0.55, -1.8], fog: 0.032, size: 0.05 },
  forest: { pos: [8.5, 4.2, 10.5], target: [0, 1.2, 0], fog: 0.026, size: 0.08 },
  far: { pos: [26, 9, 33], target: [0, 2.5, 0], fog: 0.01, size: 0.12 },
  canopy: { pos: [62, 72, 80], target: [0, 12, 0], fog: 0.005, size: 0.2 },
  orbit: { pos: [0.4, 105, 6], target: [0, 0, 0], fog: 0.0025, size: 0.3 },
};
let view = 'sampler', tween = null, labelsOn = true, dayLock = false;
const actionsLater = [];
const satNote = document.getElementById('satNote');
function goView(name, instant = false) {
  view = name;
  const v = VIEWS[name];
  const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
  if (instant) { camera.position.copy(to.pos); controls.target.copy(to.target); tween = null; }
  else tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t: 0, dur: 1.8 };
  if (instant) env.setFogTarget(fogFor(to.pos.distanceTo(to.target)), true);
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
}
const qs = new URLSearchParams(location.search);
if (qs.get('speed')) document.getElementById('speed').value = qs.get('speed');
if (qs.get('ff')) { // fast-forward N simulated days
  const days = Number(qs.get('ff')); sim.speed = 1;
  for (let i = 0; i < days / 0.05; i++) { sim.update(0.05); sampler.update(0.05, sim.counts); }
  while (sim.toasts.length > 3) sim.toasts.shift();
}
goView(VIEWS[qs.get('view')] ? qs.get('view') : 'sampler', true);
if (qs.get('explode')) actionsLater.push('explode');
if (qs.get('xray')) actionsLater.push('xray');

// ---------- controls ----------
const btn = (id) => document.getElementById(id);
const setOn = (id, on) => btn(id).classList.toggle('on', on);
const actions = {
  play() { sim.paused = !sim.paused; btn('play').textContent = sim.paused ? '▶ Play' : '❚❚ Pause'; },
  explode() { setOn('explode', sampler.toggleExplode()); },
  xray() { setOn('xray', sampler.toggleXray()); },
  labels() { labelsOn = !labelsOn; setOn('labels', labelsOn); },
  rain() { sim.makeItRain(); },
  air() { setAir(!sim.showAir); },
  day() { dayLock = !dayLock; setOn('day', dayLock); },
  tour() { tour ? endTour() : startTour(); },
};
function setAir(on) { sim.setAirflow(on); setOn('air', on); }
function setSpeed(v) { speed.value = v; syncSpeed(); }
function setExplode(on) { sampler.setExplode(on); setOn('explode', on); }
function setXray(on) { sampler.setXray(on); setOn('xray', on); }
Object.keys(actions).forEach((k) => btn(k).addEventListener('click', actions[k]));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
const speed = btn('speed'), speedOut = btn('speedOut');
const syncSpeed = () => { sim.speed = Number(speed.value); speedOut.textContent = `${sim.speed.toFixed(2)} days/s`; };
speed.addEventListener('input', syncSpeed); syncSpeed();
setOn('labels', true);
actionsLater.forEach((a) => actions[a]());

addEventListener('keydown', (e) => {
  if (!isActive() || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); actions.play(); }
  else if (k === 'e') actions.explode();
  else if (k === 'x') actions.xray();
  else if (k === 'l') actions.labels();
  else if (k === 'r') actions.rain();
  else if (k === '1') goView('sampler');
  else if (k === '2') goView('forest');
  else if (k === '3') goView('far');
  else if (k === '4') goView('canopy');
  else if (k === '5') goView('orbit');
  else if (k === '=' || k === '+') zoomBy(1 / 1.35);
  else if (k === '-' || k === '_') zoomBy(1.35);
  else if (k === 'f') actions.air();
  else if (k === 'd') actions.day();
  else if (k === 't') actions.tour();
  else if (tour && k === 'arrowright') tourStep(tour.i + 1);
  else if (tour && k === 'arrowleft') tourStep(tour.i - 1);
  else if (tour && k === 'escape') endTour();
});

// ---------- zoom: close / mid / far, all continuous ----------
const ZMIN = 0.15, ZMAX = 240;
const zoomEl = btn('zoom'), zoomOut = btn('zoomOut'), hazeEl = btn('haze');
const dir = new THREE.Vector3();
let zoomDragging = false;
// haze thins as you pull back, so distant forest stays visible at every scale
function fogFor(dist) { return (0.024 / (1 + dist / 9)) * Number(document.getElementById('haze').value); }
function setDistance(d) {
  d = THREE.MathUtils.clamp(d, ZMIN, ZMAX);
  tween = null;
  dir.subVectors(camera.position, controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, d);
}
function zoomBy(f) { setDistance(camera.position.distanceTo(controls.target) * f); }
const sliderToDist = (v) => ZMIN * Math.pow(ZMAX / ZMIN, v);
const distToSlider = (d) => Math.log(d / ZMIN) / Math.log(ZMAX / ZMIN);
zoomEl.addEventListener('input', () => { zoomDragging = true; setDistance(sliderToDist(Number(zoomEl.value))); });
zoomEl.addEventListener('change', () => { zoomDragging = false; });
btn('zoomIn').addEventListener('click', () => zoomBy(1 / 1.5));
btn('zoomOutBtn').addEventListener('click', () => zoomBy(1.5));
const fmtDist = (d) => (d < 1 ? `${Math.round(d * 100)} cm` : d < 10 ? `${d.toFixed(1)} m` : `${Math.round(d)} m`);
function updateZoomUi(dist) {
  if (!zoomDragging) zoomEl.value = distToSlider(dist);
  const band = camera.position.y > 38 ? 'above canopy' : dist < 2.5 ? 'close-up' : dist < 20 ? 'mid' : 'far';
  zoomOut.textContent = `${fmtDist(dist)} · ${band}`;
}

// ---------- guided tour: the story in ~70 seconds ----------
const chartPanel = btn('chartPanel');
const TOUR = [
  { view: 'sampler', dur: 8, title: 'The device',
    text: 'A passive airborne eDNA sampler on a stake in the forest understory. No pump. It draws about 1 mW and runs off a palm-sized solar panel.',
    enter() { setSpeed(0.08); } },
  { view: 'sampler', dur: 9, title: 'Inside',
    text: 'Twelve sealed filter cartridges, one per week. A tiny indexing motor, two Li-ion cells, a LoRa radio. Twelve weeks unattended.',
    enter() { setExplode(true); setXray(true); }, exit() { setExplode(false); setXray(false); } },
  { view: 'forest', dur: 8, title: 'Rain is the trigger',
    text: 'Tropical fungi fruit within days of a soaking. And when it rains, optical satellites see nothing: the sky is closed.',
    enter() { sim.makeItRain(); setSpeed(0.12); } },
  { view: 'log', dur: 11, title: 'Here today, gone next week',
    text: 'Fruiting bodies emerge, shed spores for a day or two, then collapse. Each species leaves an eDNA trace in the air.',
    enter() { sim.forceFruiting(); setSpeed(0.1); } },
  { view: 'flow', dur: 13, title: 'The air carries the signal',
    text: 'Wind (faint blue streams) carries spores past the inlet. What lands is sealed into this week\'s cartridge: a time series of who was here.',
    enter() { setAir(true); setSpeed(0.06); }, exit() { setAir(false); } },
  { view: 'orbit', dur: 9, title: 'What orbit sees',
    text: 'Optical satellites like Sentinel-2 get canopy tops and, on most tropical days, cloud. Radar sees through cloud, but not fungi. The fungi are 30 m below and gone within a week.',
    enter() { setSpeed(0.12); } },
  { view: 'sampler', dur: 11, title: 'Ground + orbit = the dataset',
    text: 'Weekly signal from the ground against one annual composite from orbit (chart). Fused, they become labels nobody else has.',
    enter() { chartPanel.classList.add('highlight'); setSpeed(0.6); }, exit() { chartPanel.classList.remove('highlight'); } },
];
const tourEl = btn('tour-panel');
let tour = null;
function tourStep(i) {
  if (!tour) return;
  TOUR[tour.i]?.exit?.();
  if (i < 0) i = 0;
  if (i >= TOUR.length) { endTour(); return; }
  tour.i = i; tour.t = 0;
  const st = TOUR[i];
  goView(st.view);
  st.enter?.();
  tourEl.querySelector('.step').textContent = `${i + 1} / ${TOUR.length}`;
  tourEl.querySelector('h2').textContent = st.title;
  tourEl.querySelector('p').textContent = st.text;
}
function startTour() {
  if (sim.paused) actions.play();
  tour = { i: 0, t: 0 };
  document.getElementById('sampler').classList.add('touring'); tourEl.classList.remove('hidden'); setOn('tour', true);
  tourStep(0);
}
function endTour() {
  if (!tour) return;
  TOUR[tour.i]?.exit?.();
  tour = null;
  document.getElementById('sampler').classList.remove('touring'); tourEl.classList.add('hidden'); setOn('tour', false);
  setSpeed(0.12); goView('sampler');
}
tourEl.querySelector('.prev').addEventListener('click', () => tourStep(tour.i - 1));
tourEl.querySelector('.next').addEventListener('click', () => tourStep(tour.i + 1));
tourEl.querySelector('.close').addEventListener('click', endTour);
const tourBar = tourEl.querySelector('.bar i');
function updateTour(dt) {
  if (!tour || sim.paused) return;
  tour.t += dt;
  const st = TOUR[tour.i];
  tourBar.style.width = `${Math.min(100, (100 * tour.t) / st.dur)}%`;
  if (tour.t >= st.dur) tourStep(tour.i + 1);
}
if (qs.get('tour')) startTour();
if (qs.get('air')) setAir(true);
if (qs.get('day')) actions.day();

new ResizeObserver(() => {
  const w = app.clientWidth, h = app.clientHeight; if (!w || !h) return;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); labelRenderer.setSize(w, h);
}).observe(app);

// ---------- loop ----------
const clock = new THREE.Clock();
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!isActive()) return;
  sim.update(dt);
  const dist = camera.position.distanceTo(controls.target);
  const high = camera.position.y > 38;
  env.setFogTarget(fogFor(dist));
  sim.sporeMat.size = THREE.MathUtils.clamp(0.03 + dist * 0.004, 0.04, 0.35);
  sampler.setLabels(labelsOn && dist < 4.5);
  pin.visible = high;
  satNote.classList.toggle('hidden', !high);
  updateZoomUi(dist);
  env.update(dt, { dayFrac: dayLock ? 0.45 : sim.t % 1, cloud: sim.cloud, rain: sim.rain, satView: high }, controls.target);
  sampler.update(dt, sim.counts);
  hud.update(dt);
  updateTour(dt);
  if (tween) {
    tween.t += dt / tween.dur;
    const k = ease(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, k);
    controls.target.lerpVectors(tween.from.target, tween.to.target, k);
    if (tween.t >= 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
frame();
return { startTour, endTour, isTouring: () => !!tour };
}
