/* Spora demo: a scripted "live" walkthrough over real model outputs (window.DEMO).
   Interface = mock-up. Numbers, predictions and the 10 m map = exported by
   scripts/master_table/export_demo_data.py from the leave-one-site-out model. */
(() => {
  "use strict";
  const D = window.DEMO;
  if (!D) {
    document.body.innerHTML = "<p style='padding:20px'>demo/data/demo_data.js is missing. " +
      "Run scripts/master_table/export_demo_data.py first (see demo/README.md).</p>";
    return;
  }
  const $ = (id) => document.getElementById(id);
  const SM = D.site_map;
  const DEMO_SITE = SM.site;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = (x, d = 1) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- sequential ramp (blue 100 -> 700) ---------- */
  const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
                "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
  const VMAX = Math.max(10, Math.ceil(SM.vmax / 5) * 5);
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const RGB = RAMP.map(hex2rgb);
  function rampRGB(v) {
    const t = Math.max(0, Math.min(1, v / VMAX)) * (RGB.length - 1);
    const i = Math.min(Math.floor(t), RGB.length - 2), f = t - i;
    return RGB[i].map((c, k) => Math.round(c + (RGB[i + 1][k] - c) * f));
  }
  const rampHex = (v) => "#" + rampRGB(v).map((c) => c.toString(16).padStart(2, "0")).join("");

  /* ---------- tooltip ---------- */
  const tip = $("tip");
  function showTip(html, ev) {
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(ev.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- theme ---------- */
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  $("themeBtn").onclick = () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark";
    setBasemap(); redrawSite();
  };

  /* ---------- map ---------- */
  const map = L.map("map", { zoomControl: true, attributionControl: true }).setView([52.6, -1.6], 6);
  let base;
  function setBasemap() {
    if (base) map.removeLayer(base);
    const style = isDark() ? "World_Dark_Gray_Base" : "World_Light_Gray_Base";
    base = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${style}/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16, attribution: "Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    }).addTo(map);
  }
  setBasemap();

  const siteLayer = L.layerGroup().addTo(map);
  const sampleLayer = L.layerGroup().addTo(map);
  const plotLayer = L.layerGroup().addTo(map);
  let raster = null;

  function drawSiteMarkers() {
    siteLayer.clearLayers();
    D.sites.forEach((s) => {
      const m = L.circleMarker([s.lat, s.lon], {
        radius: 6, color: css("--ring"), weight: 2, fillColor: css("--text-secondary"), fillOpacity: 0.9,
      }).addTo(siteLayer);
      m.on("mouseover", (e) => showTip(`<b>${s.site}</b><br>${s.n} samples · ${s.n_woodland} woodland<br>held-out ρ ${fmt(s.rho, 2)}`, e.originalEvent));
      m.on("mouseout", hideTip);
      m.on("click", () => { $("sitePick").value = s.site; selectSite(s.site, true); });
    });
  }

  function buildRaster() {
    const cv = document.createElement("canvas");
    cv.width = SM.width; cv.height = SM.height;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(SM.width, SM.height);
    SM.values.forEach((v, i) => {
      if (v == null) return;
      const [r, g, b] = rampRGB(v);
      img.data.set([r, g, b, 235], i * 4);
    });
    ctx.putImageData(img, 0, 0);
    return L.imageOverlay(cv.toDataURL(), SM.bounds, { opacity: 0.85, interactive: false });
  }
  function rasterValue(latlng) {
    const [[s, w], [n, e]] = SM.bounds;
    if (latlng.lat < s || latlng.lat > n || latlng.lng < w || latlng.lng > e) return null;
    const r = Math.floor(((n - latlng.lat) / (n - s)) * SM.height);
    const c = Math.floor(((latlng.lng - w) / (e - w)) * SM.width);
    return SM.values[r * SM.width + c];
  }
  map.on("mousemove", (e) => {
    const box = $("hoverRead");
    if (!raster || !map.hasLayer(raster)) { box.hidden = true; return; }
    const v = rasterValue(e.latlng);
    if (v == null) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `Predicted here: <b>${fmt(v)}</b> EcM OTUs<br><span class="muted small">${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)} · 10 m pixel</span>`;
  });
  map.on("mouseout", () => { $("hoverRead").hidden = true; });

  function drawLegend() {
    $("ramp").style.background = `linear-gradient(90deg, ${RAMP.join(",")})`;
    const ticks = [0, VMAX / 4, VMAX / 2, (3 * VMAX) / 4, VMAX];
    $("rampTicks").innerHTML = ticks.map((t, i) => `<span>${Math.round(t)}${i === 4 ? "+" : ""}</span>`).join("");
  }

  function drawSamples(site) {
    sampleLayer.clearLayers();
    D.samples.filter((x) => x.site === site).forEach((x) => {
      const m = L.circleMarker([x.lat, x.lon], {
        radius: 5.5, color: css("--mark-ink"), weight: 1.5, fillColor: rampHex(x.ecm_richness), fillOpacity: 1,
      }).addTo(sampleLayer);
      m.on("mouseover", (e) => showTip(
        `<b>${x.sample}</b> · ${x.habitat}<br>Observed: <b>${x.ecm_richness}</b> EcM OTUs<br>Held-out prediction: <b>${fmt(x.pred_loso)}</b>`,
        e.originalEvent));
      m.on("mouseout", hideTip);
    });
  }

  function drawPlots() {
    plotLayer.clearLayers();
    SM.suggested.forEach((p, i) => {
      const icon = L.divIcon({
        className: "", iconSize: [16, 16], iconAnchor: [8, 8],
        html: `<div style="width:12px;height:12px;margin:2px;transform:rotate(45deg);border:2px solid ${css("--mark-ink")};background:${css("--ring")}"></div>`,
      });
      const m = L.marker([p.lat, p.lon], { icon }).addTo(plotLayer);
      m.on("mouseover", (e) => showTip(`<b>Suggested plot ${i + 1}</b> (${p.band} prediction)<br>Predicted ${fmt(p.pred)} EcM OTUs<br>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`, e.originalEvent));
      m.on("mouseout", hideTip);
    });
  }

  /* ---------- right panel ---------- */
  const siteOf = (name) => D.sites.find((s) => s.site === name);
  function statusFor(s) {
    const bias = s.pred_mean - s.obs_mean;
    const biasTxt = `${bias >= 0 ? "over" : "under"}-predicts the site mean by ${fmt(Math.abs(bias))} OTUs`;
    if (s.rho == null) return ["critical", "✕", "No signal to rank", `Almost no EcM fungi observed here; the model ${biasTxt}.`];
    if (s.rho >= 0.6) return ["good", "✓", "Transfers well here", `Ranks plots well (ρ ${fmt(s.rho, 2)}); ${biasTxt}.`];
    if (s.rho >= 0.3) return ["warning", "!", "Moderate: use as a prior", `Ranks plots roughly (ρ ${fmt(s.rho, 2)}), off by ${fmt(s.mae)} OTUs on average; ${biasTxt}.`];
    return ["critical", "✕", "Weak here: sample before trusting", `Ranking barely beats chance (ρ ${fmt(s.rho, 2)}); ${biasTxt}.`];
  }
  function renderPanel(site) {
    const s = siteOf(site);
    $("siteTitle").textContent = site;
    $("siteSub").textContent = `${s.n} soil samples (2023) · ${s.n_woodland} woodland · predictions from a model trained on the other ${D.sites.length - 1} sites`;
    const k = [
      [fmt(s.obs_mean), "observed mean EcM OTUs"],
      [fmt(s.pred_mean), "predicted mean (held-out)"],
      [fmt(s.mae), "mean abs. error (OTUs)"],
      [fmt(s.rho, 2), "rank agreement ρ"],
    ];
    $("kpis").innerHTML = k.map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    const [cls, ico, head, body] = statusFor(s);
    $("status").className = `status ${cls}`;
    $("status").innerHTML = `<span class="ico" aria-hidden="true">${ico}</span><div><b>${head}</b><br><span class="small">${body}</span></div>`;
    drawScatter(site);
  }

  /* scatter: observed (x) vs held-out predicted (y), single series + y=x */
  function drawScatter(site) {
    const pts = D.samples.filter((x) => x.site === site);
    const W = 330, H = 220, m = { l: 40, r: 10, t: 8, b: 30 };
    const mx = Math.max(5, ...pts.map((p) => Math.max(p.ecm_richness, p.pred_loso)));
    const top = Math.ceil(mx / 10) * 10;
    const X = (v) => m.l + (v / top) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v / top) * (H - m.t - m.b);
    const ticks = [0, top / 2, top];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Observed versus predicted EcM richness at ${site}">`;
    ticks.forEach((t) => {
      s += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/>`;
      s += `<text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`;
      s += `<text x="${X(t)}" y="${H - m.b + 14}" text-anchor="middle">${t}</text>`;
    });
    s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(top)}" y2="${Y(top)}" stroke="${css("--text-muted")}" stroke-width="1" stroke-dasharray="4 4"/>`;
    s += `<text x="${X(top) - 2}" y="${Y(top) + 12}" text-anchor="end">perfect</text>`;
    s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle">observed EcM OTUs</text>`;
    s += `<text transform="translate(9 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">predicted</text>`;
    pts.forEach((p, i) => {
      s += `<circle data-i="${i}" cx="${X(p.ecm_richness)}" cy="${Y(p.pred_loso)}" r="4.5" fill="${css("--series-1")}" stroke="${css("--surface-1")}" stroke-width="2"/>`;
    });
    s += "</svg>";
    const el = $("scatter");
    el.innerHTML = s;
    el.querySelectorAll("circle").forEach((c) => {
      const p = pts[+c.dataset.i];
      c.addEventListener("mousemove", (e) => showTip(`<b>${p.sample}</b> · ${p.habitat}<br>observed ${p.ecm_richness} · predicted ${fmt(p.pred_loso)}`, e));
      c.addEventListener("mouseleave", hideTip);
    });
  }

  /* bars: random 5-fold vs held-out site, three feature/subset groups */
  function drawBars() {
    const get = (subset, features, validation) =>
      D.metrics.find((r) => r.subset === subset && r.features === features && r.validation === validation);
    const groups = [
      ["Tessera · all habitats", "all", "tessera_3x3"],
      ["Habitat label only", "all", "habitat_only"],
      ["Tessera · woodland only", "woodland", "tessera_3x3"],
    ];
    const series = [["random_5fold", "Random split", "--series-1"], ["leave_one_site_out", "Held-out site", "--series-2"]];
    $("barLegend").innerHTML = series.map(([, n, c]) => `<span style="--c:var(${c})">${n}</span>`).join("");
    const W = 330, bh = 12, gap = 2, gH = 2 * bh + gap + 22, lw = 0, H = groups.length * gH + 6;
    const x0 = 4, x1 = W - 44, X = (v) => x0 + Math.max(0, v) / 0.7 * (x1 - x0);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="R squared by validation scheme">`;
    groups.forEach(([label, subset, feats], gi) => {
      const gy = gi * gH;
      s += `<text x="${x0}" y="${gy + 12}" style="fill:var(--text-secondary)">${label}</text>`;
      series.forEach(([val, name, c], si) => {
        const r = get(subset, feats, val);
        const y = gy + 18 + si * (bh + gap), w = X(r.r2) - x0;
        const rr = Math.min(4, w / 2);
        s += `<path data-t="${label} · ${name}: R² ${fmt(r.r2, 2)} (n=${r.n}, ${r.n_sites} sites)" fill="var(${c})" d="M${x0},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${bh - 2 * rr} a${rr},${rr} 0 0 1 -${rr},${rr} h-${w - rr} z"/>`;
        s += `<text class="lbl" x="${x0 + w + 5}" y="${y + bh - 2}">${fmt(r.r2, 2)}</text>`;
      });
    });
    s += "</svg>";
    $("bars").innerHTML = s;
    $("bars").querySelectorAll("path").forEach((p) => {
      p.addEventListener("mousemove", (e) => showTip(p.dataset.t, e));
      p.addEventListener("mouseleave", hideTip);
    });
    $("barNote").textContent = "Random splits look good because plots metres apart land in both train and test. " +
      "On a site the model has never seen, most of the skill is just 'is this woodland?'; within woodland, Tessera adds a modest signal.";
  }

  function drawTable() {
    const rows = [...D.sites].sort((a, b) => b.n_woodland - a.n_woodland);
    $("siteTable").innerHTML = `<table><thead><tr><th>Site</th><th>n</th><th>wood</th><th>obs</th><th>pred</th><th>MAE</th><th>ρ</th></tr></thead><tbody>` +
      rows.map((s) => `<tr><td>${s.site}</td><td>${s.n}</td><td>${s.n_woodland}</td><td>${fmt(s.obs_mean)}</td><td>${fmt(s.pred_mean)}</td><td>${fmt(s.mae)}</td><td>${fmt(s.rho, 2)}</td></tr>`).join("") +
      "</tbody></table>";
  }

  function nextSteps() {
    const s = siteOf(DEMO_SITE);
    $("nextSteps").classList.remove("hidden");
    $("nextSteps").innerHTML = `<h4>Suggested next step</h4>
      <div class="small">Sample ${SM.suggested.length} new plots spread across the predicted low / mid / high range
      (each ≥250 m from existing samples). Adding them to training tests whether the map's ranking holds,
      where the current held-out error is ${fmt(s.mae)} OTUs.</div>
      <ul class="small">${SM.suggested.map((p, i) => `<li>Plot ${i + 1}: ${p.band}, predicted ${fmt(p.pred)} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</li>`).join("")}</ul>
      <div class="small muted" style="margin-top:6px">Caveats: EcM is assigned by genus (FungalTraits); ~30% of a typical sample's reads have a guild.
      One survey year (2023). Treat the map as a prior for where to look, not a verdict.</div>`;
  }

  /* ---------- site selection ---------- */
  let current = null;
  function redrawSite() {
    drawSiteMarkers();
    if (current) { drawSamples(current); if (current === DEMO_SITE) drawPlots(); renderPanel(current); }
    drawBars();
  }
  function selectSite(site, fly) {
    current = site;
    drawSamples(site);
    renderPanel(site);
    const isDemo = site === DEMO_SITE;
    if (raster) map.removeLayer(raster);
    plotLayer.clearLayers();
    $("mapLegend").hidden = false;
    if (isDemo) {
      raster = raster || buildRaster();
      raster.addTo(map);
      drawPlots();
      $("overlayMsg").classList.add("hidden");
    } else {
      $("overlayMsg").textContent = `Showing held-out predictions at the ${siteOf(site).n} sample points. The 10 m wall-to-wall map is exported for ${DEMO_SITE} only in this demo.`;
      $("overlayMsg").classList.remove("hidden");
    }
    if (fly) {
      const pts = D.samples.filter((x) => x.site === site).map((x) => [x.lat, x.lon]);
      if (isDemo) map.flyToBounds(SM.bounds, { duration: 1.2 });
      else map.flyToBounds(L.latLngBounds(pts).pad(0.3), { duration: 1.2, maxZoom: 15 });
    }
  }

  /* ---------- scripted walkthrough ---------- */
  const s0 = siteOf(DEMO_SITE);
  const STEPS = [
    ["Locate site", `${DEMO_SITE} · ${s0.n} soil eDNA samples (2023) · ${s0.n_woodland} woodland`],
    ["Fetch Tessera 2023 embeddings", `128 numbers per 10 m pixel (Sentinel-1 radar + Sentinel-2 optical) · ${SM.width}×${SM.height} px`],
    ["Predict EcM richness", `Model trained on ${SM.n_train_sites} other sites (${SM.n_train} samples); ${DEMO_SITE} never seen`],
    ["Check against field samples", `${s0.n} plots: rank agreement ρ ${fmt(s0.rho, 2)}, mean error ${fmt(s0.mae)} OTUs`],
    ["Plan next sampling", `${SM.suggested.length} plots spread across predicted low / mid / high`],
  ];
  function renderSteps(active, done) {
    $("steps").innerHTML = STEPS.map(([t, d], i) => {
      const st = i < done ? "done" : i === active ? "active" : "";
      const ic = i < done ? "✓" : i === active ? '<span class="spin">◌</span>' : "·";
      return `<li class="${st}"><span class="ic">${ic}</span><span>${t}${st ? `<span class="detail">${d}</span>` : ""}</span></li>`;
    }).join("");
  }
  async function typeQuery(text) {
    const q = $("query"); q.value = "";
    for (const ch of text) { q.value += ch; await sleep(18); }
  }
  let playing = false;
  async function play() {
    if (playing) return;
    playing = true; $("playBtn").disabled = true;
    $("nextSteps").classList.add("hidden");
    if (raster) map.removeLayer(raster);
    sampleLayer.clearLayers(); plotLayer.clearLayers();
    map.setView([52.6, -1.6], 6);
    renderSteps(-1, 0);
    await typeQuery(`Where are mycorrhizal fungi doing well at ${DEMO_SITE}, and where should we sample next?`);
    await sleep(400);
    renderSteps(0, 0); await sleep(700);
    current = DEMO_SITE; $("sitePick").value = DEMO_SITE;
    map.flyToBounds(SM.bounds, { duration: 1.6 });
    await sleep(1700); renderSteps(1, 1);
    await sleep(1500); renderSteps(2, 2);
    raster = raster || buildRaster(); raster.setOpacity(0).addTo(map);
    for (let o = 0; o <= 0.85; o += 0.05) { raster.setOpacity(o); await sleep(40); }
    $("mapLegend").hidden = false; $("overlayMsg").classList.add("hidden");
    await sleep(500); renderSteps(3, 3);
    drawSamples(DEMO_SITE); renderPanel(DEMO_SITE);
    await sleep(1600); renderSteps(4, 4);
    drawPlots(); await sleep(900);
    renderSteps(-1, 5); nextSteps();
    playing = false; $("playBtn").disabled = false; $("playBtn").textContent = "↻ Replay";
  }
  $("playBtn").onclick = play;

  /* ---------- init ---------- */
  const pick = $("sitePick");
  pick.innerHTML = [...D.sites].sort((a, b) => a.site.localeCompare(b.site))
    .map((s) => `<option value="${s.site}">${s.site}${s.site === DEMO_SITE ? " (10 m map)" : ""}</option>`).join("");
  pick.value = DEMO_SITE;
  pick.onchange = () => selectSite(pick.value, true);
  drawLegend(); drawSiteMarkers(); drawBars(); drawTable(); renderSteps(-1, 0);
  renderPanel(DEMO_SITE);
  $("query").placeholder = "Press Play to watch a guided session";
  $("foot").innerHTML = `Simulated interface; all values are real outputs (generated ${D.generated}). Target: ${D.target}. ` +
    `Sources: ${D.sources.soil}; ${D.sources.guilds}; ${D.sources.satellite}.`;
  if (new URLSearchParams(location.search).has("autoplay")) play();
})();
