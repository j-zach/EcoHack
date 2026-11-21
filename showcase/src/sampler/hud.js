import { TAXA } from './taxa.js';
import { N_CART } from './sampler.js';

const $ = (id) => document.getElementById(id);
const COMPASS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const SHOW_WEEKS = 16;

export class Hud {
  constructor(sim, sampler) {
    this.sim = sim; this.sampler = sampler;
    this.el = Object.fromEntries(['clock', 'weather', 'wind', 'cart', 'power', 'uplink', 's2', 'fruiting', 'toasts'].map((k) => [k, $(k)]));
    this.canvas = $('chart');
    this.ctx = this.canvas.getContext('2d');
    this.tText = 0; this.tChart = 0;
    $('legend').innerHTML = TAXA.map((t) => `<span><i style="background:${t.css}"></i>${t.short}</span>`).join('');
  }

  update(dt) {
    const s = this.sim;
    while (s.toasts.length) this.toast(s.toasts.shift());
    this.tText -= dt; this.tChart -= dt;
    if (this.tText <= 0) { this.tText = 0.1; this.text(); }
    if (this.tChart <= 0) { this.tChart = 0.3; this.chart(); }
  }

  toast({ text, kind }) {
    const d = document.createElement('div');
    d.className = `toast ${kind}`; d.textContent = text;
    this.el.toasts.prepend(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 4200);
    setTimeout(() => d.remove(), 4800);
  }

  text() {
    const s = this.sim, e = this.el;
    const frac = s.t - Math.floor(s.t);
    const mins = Math.floor(frac * 24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    e.clock.textContent = `Day ${s.day + 1} · ${hh}:${mm} · Week ${s.week + 1}${s.paused ? ' · paused' : ''}`;
    const w = s.rain > 0.05 ? '🌧 Rain' : s.cloud > 0.7 ? '☁️ Overcast' : s.daylight > 0.2 ? '⛅ Broken cloud' : '🌙 Night';
    e.weather.textContent = `${w} · cloud ${Math.round(s.cloud * 100)}% · RH ${Math.round(s.humidity * 100)}%`;
    const a = ((s.windAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    e.wind.textContent = `${s.windSpeed.toFixed(1)} m/s toward ${COMPASS[Math.round(a / (Math.PI / 4)) % 8]}`;
    const c = s.counts[s.cart], tot = c.reduce((x, y) => x + y, 0);
    const st = this.sampler.explodeAmount() > 0.02 ? 'inlet closed (exploded view)' : this.sampler.isIndexing() ? 'indexing…' : 'sampling';
    e.cart.textContent = `#${s.cart + 1} / ${N_CART} · ${Math.round(tot).toLocaleString()} reads · ${st}`;
    e.power.textContent = `${(s.battery * 100).toFixed(1)}% · solar ${s.harvest.toFixed(0)} mW · load ${s.load.toFixed(1)} mW`;
    e.uplink.textContent = s.lastUplink === null ? 'none yet (daily 18:00)' : `Day ${s.lastUplink + 1} 18:00 · LoRa 51 B`;
    const pct = s.s2.passes ? Math.round((100 * s.s2.clear) / s.s2.passes) : 0;
    e.s2.textContent = `${s.s2.passes} overpasses · ${s.s2.clear} clear (${pct}%)`;
    const active = TAXA.map((t, i) => ({ t, n: s.patches.filter((p) => p.taxon === i && p.phase === 'spore').length })).filter((x) => x.n);
    e.fruiting.innerHTML = active.length
      ? active.map(({ t, n }) => `<span class="chip"><i style="background:${t.css}"></i>${t.short} ×${n}</span>`).join('')
      : '<span class="muted">none sporulating; waiting on rain</span>';
  }

  chart() {
    const cv = this.canvas, g = this.ctx, dpr = Math.min(devicePixelRatio, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const s = this.sim;
    const cols = [...s.history.slice(-(SHOW_WEEKS - 1)), { week: s.week, counts: s.counts[s.cart], s2: s.weekS2, live: true }];
    const L = 118, R = 8, top = 6, barH = H - 74, cw = (W - L - R) / SHOW_WEEKS;
    const max = Math.max(2000, ...cols.map((c) => c.counts.reduce((a, b) => a + b, 0)));
    const nice = Math.pow(10, Math.floor(Math.log10(max)));
    const ymax = Math.ceil(max / nice) * nice;

    g.font = '10px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
    // gridlines
    for (let k = 0; k <= 2; k++) {
      const y = top + barH - (barH * k) / 2;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke();
      g.fillStyle = 'rgba(220,235,230,0.55)'; g.textAlign = 'right';
      if (k) g.fillText(((ymax * k) / 2).toLocaleString(), L - 6, y);
    }
    g.textAlign = 'left'; g.fillStyle = 'rgba(220,235,230,0.85)';
    g.fillText('eDNA reads/week', 4, top + barH - 22);
    g.fillStyle = 'rgba(220,235,230,0.5)'; g.fillText('ground sampler', 4, top + barH - 8);

    cols.forEach((c, i) => {
      const x = L + i * cw + cw * 0.15, w = cw * 0.7;
      let y = top + barH;
      c.counts.forEach((v, k) => {
        const h = (v / ymax) * barH;
        g.globalAlpha = c.live ? 0.6 : 0.95;
        g.fillStyle = TAXA[k].css; g.fillRect(x, y - h, w, h); y -= h;
      });
      g.globalAlpha = 1;
      if (c.live) { g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.strokeRect(x - 1, top + 2, w + 2, barH - 2); g.setLineDash([]); }
      g.fillStyle = 'rgba(220,235,230,0.5)'; g.textAlign = 'center';
      g.fillText(`W${c.week + 1}`, x + w / 2, top + barH + 10);
      // Sentinel-2 row
      const ys2 = top + barH + 30;
      const n = c.s2.length;
      c.s2.forEach((clear, j) => {
        const cx = x + w / 2 + (j - (n - 1) / 2) * 11;
        g.beginPath(); g.arc(cx, ys2, 4, 0, Math.PI * 2);
        if (clear) { g.fillStyle = '#e8f3ee'; g.fill(); }
        else { g.strokeStyle = 'rgba(255,120,120,0.9)'; g.lineWidth = 1.2; g.stroke(); g.beginPath(); g.moveTo(cx - 2.5, ys2 - 2.5); g.lineTo(cx + 2.5, ys2 + 2.5); g.moveTo(cx + 2.5, ys2 - 2.5); g.lineTo(cx - 2.5, ys2 + 2.5); g.stroke(); }
      });
    });
    g.textAlign = 'left';
    const ys2 = top + barH + 30, yA = top + barH + 52;
    g.fillStyle = 'rgba(220,235,230,0.85)'; g.fillText('Sentinel-2 pass', 4, ys2);
    g.fillStyle = 'rgba(220,235,230,0.85)'; g.fillText('Annual embedding', 4, yA);
    g.fillStyle = 'rgba(150,170,165,0.35)'; g.fillRect(L + cw * 0.15, yA - 7, SHOW_WEEKS * cw - cw * 0.3, 14);
    g.fillStyle = 'rgba(220,235,230,0.75)';
    g.fillText('1 composite / year: no weekly signal', L + cw * 0.15 + 6, yA);
  }
}
