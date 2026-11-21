import './shell.css';
import { startSampler } from './sampler/main.js';
import { startLandscape } from './landscape.js';

const TABS = ['field', 'pitch', 'landscape', 'evidence'];
const $ = (id) => document.getElementById(id);
let current = null, sampler = null, landscape = null, toured = false;

async function show(tab) {
  if (!TABS.includes(tab)) tab = 'field';
  current = tab;
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.body.dataset.tab = tab;
  if (tab === 'field' && !sampler) {
    sampler = startSampler($('app'), () => current === 'field');
    if (!toured && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      toured = true; setTimeout(() => current === 'field' && sampler.startTour(), 1400);
    }
  }
  if (tab === 'landscape' && !landscape) landscape = startLandscape();
  if (tab === 'evidence') fillEvidence();
}

document.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.tab; }));
addEventListener('hashchange', () => show(location.hash.slice(1)));

$('gTour').addEventListener('click', () => sampler.startTour());
$('gStats').addEventListener('click', () => { $('glance').classList.add('hidden'); $('info').classList.remove('hidden'); });
$('gBack').addEventListener('click', () => { $('info').classList.add('hidden'); $('glance').classList.remove('hidden'); });
$('gCtl').addEventListener('click', (e) => { const on = $('controls').classList.toggle('hidden'); e.target.classList.toggle('on', !on); });

let filled = false;
show(location.hash.slice(1));
async function fillEvidence() {
  if (filled) return; filled = true;
  const get = (k) => fetch(`data/${k}.json`).then((r) => r.json());
  const [uk, ...regions] = await Promise.all(['uk', 'amazon', 'budongo', 'osa'].map(get));
  const t = uk.targets, cap = (s) => s[0].toUpperCase() + s.slice(1);
  $('ukTable').querySelector('tbody').innerHTML = Object.keys(t.shannon_entropy).map((k) =>
    `<tr><td>${cap(k)}</td><td class="n">${t.shannon_entropy[k].r2.toFixed(2)}</td><td class="n">${t.funguild_chao1[k].r2.toFixed(2)}</td></tr>`).join('');
  const pct = (g, best) => `${Math.round((1 - g / best) * 100)}% lower`;
  $('simTable').querySelector('tbody').innerHTML = regions.map((d) => {
    const c = d.curves, best = (m, i, f) => f(c.grid[m][i], c.random[m][i]);
    const r = c.guided[0][9] - best(0, 9, Math.max);
    const sg = Math.round(d.value.guided.species[0]), sb = Math.round(Math.max(d.value.grid.species[0], d.value.random.species[0]));
    return `<tr><td>${d.name}</td><td class="n win">${sg} vs ${sb}</td><td class="n win">${pct(c.guided[1][0], best(1, 0, Math.min))}</td><td class="n win">${pct(c.guided[1][2], best(1, 2, Math.min))}</td><td class="n">${r >= 0 ? '+' : ''}${r.toFixed(2)}</td></tr>`;
  }).join('');
}
