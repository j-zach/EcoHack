import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TAXA } from './taxa.js';
import { canvasTex } from './environment.js';

export const N_CART = 12;
const CART_R = 0.072;
const TAU = Math.PI * 2;

function makeLabel(text, sub) {
  const el = document.createElement('div');
  el.className = 'label';
  el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  return new CSS2DObject(el);
}

export function buildSampler() {
  const root = new THREE.Group();
  root.name = 'sampler';

  const M = {
    shell: new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.55, metalness: 0.1 }),
    body: new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.55, metalness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1f23, roughness: 0.6, metalness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x3fb68b, roughness: 0.35, metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb4bcc2, roughness: 0.3, metalness: 0.85 }),
    steelDS: new THREE.MeshStandardMaterial({ color: 0xb4bcc2, roughness: 0.28, metalness: 0.85, side: THREE.DoubleSide }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9aa3a9, roughness: 0.4, metalness: 0.7 }),
    hood: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 1 }),
    clear: new THREE.MeshStandardMaterial({ color: 0xa9cfe0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    cart: new THREE.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.5 }),
    cartRim: new THREE.MeshStandardMaterial({ color: 0x9fb0bb, roughness: 0.4, metalness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.8 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1f6f43, roughness: 0.5 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x0d0f10, roughness: 0.4 }),
    cell: new THREE.MeshStandardMaterial({ color: 0x2a7ab0, roughness: 0.4, metalness: 0.2 }),
  };

  const parts = [];
  const labels = [];
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const addPart = (obj, off) => { root.add(obj); parts.push({ obj, base: obj.position.clone(), off: new THREE.Vector3(...off) }); return obj; };
  const addLabel = (parent, text, sub, x, y, z, internal = false) => { const l = makeLabel(text, sub); l.position.set(x, y, z); l.userData.internal = internal; parent.add(l); labels.push(l); return l; };

  // ---------- stake + mount ----------
  root.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.78, 16), M.steel, 0, 0.565, 0));
  root.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 20), M.dark, 0, 1.4, 0));
  root.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.03, 16), M.dark, 0, 0.015, 0));

  // ---------- electronics housing ----------
  const housing = new THREE.Group(); housing.position.y = 1.52;
  const shell = mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.12, 48), M.shell);
  housing.add(shell);
  housing.add(mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.012, 48), M.dark, 0, -0.064, 0));
  const band = mesh(new THREE.TorusGeometry(0.1158, 0.0035, 8, 64), M.accent, 0, 0.052, 0); band.rotation.x = Math.PI / 2;
  housing.add(band);
  const decalTex = canvasTex(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#3fb68b'; g.beginPath(); g.arc(46, 64, 22, 0, TAU); g.fill();
    g.fillStyle = '#2b3238'; g.beginPath(); g.arc(46, 64, 10, 0, TAU); g.fill();
    g.fillStyle = '#e8f3ee'; g.font = '600 54px system-ui, sans-serif'; g.fillText('eDNA-01', 86, 74);
    g.fillStyle = '#8fa3a0'; g.font = '500 26px ui-monospace, monospace'; g.fillText('passive air sampler', 88, 110);
  });
  const decal = new THREE.Mesh(new THREE.CylinderGeometry(0.1182, 0.1192, 0.045, 32, 1, true, 0.05, 1.3),
    new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  decal.position.y = -0.008;
  housing.add(decal);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x00ff88, emissiveIntensity: 2 });
  housing.add(mesh(new THREE.SphereGeometry(0.0065, 12, 8), ledMat, 0.12 * Math.sin(1.55), 0.025, 0.12 * Math.cos(1.55)));
  // antenna on side boss
  housing.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), M.dark, -0.128, 0.0, 0));
  housing.add(mesh(new THREE.CylinderGeometry(0.0035, 0.005, 0.22, 8), M.rubber, -0.138, 0.125, 0));
  housing.add(mesh(new THREE.SphereGeometry(0.006, 8, 6), M.rubber, -0.138, 0.236, 0));
  const pulseTex = canvasTex(128, 128, (g) => { g.strokeStyle = '#7fd4ff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke(); });
  const pulseMat = new THREE.SpriteMaterial({ map: pulseTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pulse = new THREE.Sprite(pulseMat); pulse.position.set(-0.138, 0.236, 0); pulse.scale.setScalar(0.01);
  housing.add(pulse);
  addLabel(housing, 'MCU · LoRa · Li-ion', '≈1 mW average draw', 0.2, -0.01, 0.06);
  addLabel(housing, 'LoRa antenna', 'daily 51-byte uplink', -0.2, 0.25, 0);
  addPart(housing, [0, -0.17, 0]);

  // ---------- internals (revealed by x-ray / explode) ----------
  const internals = new THREE.Group(); internals.position.y = 1.52;
  internals.add(mesh(new THREE.BoxGeometry(0.15, 0.004, 0.1), M.pcb, 0, -0.018, 0));
  [[0.03, 0.02], [-0.035, -0.02], [0.0, -0.03]].forEach(([x, z]) => internals.add(mesh(new THREE.BoxGeometry(0.024, 0.005, 0.024), M.chip, x, -0.014, z)));
  internals.add(mesh(new THREE.BoxGeometry(0.032, 0.006, 0.022), M.alu, -0.05, -0.013, 0.03));
  [-0.024, 0.024].forEach((z) => { const b = mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.065, 16), M.cell, 0, -0.04, z); b.rotation.z = Math.PI / 2; internals.add(b); });
  internals.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.035, 20), M.steel, 0, 0.035, 0));
  internals.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), M.dark, 0, 0.012, 0));
  addLabel(internals, 'Indexing motor', 'moves 1 slot / week', -0.1, 0.04, 0.08, true);
  addPart(internals, [0, -0.07, 0]);

  // ---------- carousel ----------
  const carousel = new THREE.Group(); carousel.position.y = 1.592;
  carousel.add(mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.008, 48), M.dark));
  carousel.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 20), M.steel, 0, 0.012, 0));
  const cartridges = [];
  const membraneGeo = new THREE.CircleGeometry(0.0165, 24).rotateX(-Math.PI / 2);
  for (let i = 0; i < N_CART; i++) {
    const th = (i / N_CART) * TAU;
    const g = new THREE.Group(); g.position.set(CART_R * Math.cos(th), 0.004, -CART_R * Math.sin(th));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 24), M.cart, 0, 0.015, 0));
    const rim = mesh(new THREE.TorusGeometry(0.0185, 0.0022, 8, 24), M.cartRim, 0, 0.03, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
    const mem = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.9 });
    g.add(mesh(membraneGeo, mem, 0, 0.0305, 0));
    carousel.add(g);
    cartridges.push({ g, mem });
  }
  addPart(carousel, [0, 0, 0]);
  addLabel(root, 'Active filter cartridge', 'sealed after 7 days', 0.2, 1.6, 0.09);

  // ---------- drum + lid ----------
  const drum = new THREE.Group(); drum.position.y = 1.6425;
  const drumWall = mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.115, 48, 1, true), M.clear); drumWall.castShadow = false;
  drum.add(drumWall);
  const lidShape = new THREE.Shape(); lidShape.absarc(0, 0, 0.12, 0, TAU);
  const hole = new THREE.Path(); hole.absarc(CART_R, 0, 0.013, 0, TAU, true); lidShape.holes.push(hole);
  const lid = mesh(new THREE.ExtrudeGeometry(lidShape, { depth: 0.008, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2), M.body, 0, 0.0575, 0);
  drum.add(lid);
  const ring = mesh(new THREE.TorusGeometry(0.117, 0.004, 8, 64), M.dark, 0, -0.0575, 0); ring.rotation.x = Math.PI / 2; drum.add(ring);
  addLabel(drum, '12-cartridge carousel', '12 weeks unattended', -0.24, 0.0, 0.04);
  addPart(drum, [0, 0.12, 0]);

  // ---------- inlet funnel ----------
  const funnel = new THREE.Group(); funnel.position.set(CART_R, 1.708, 0);
  const prof = [[0.011, -0.016], [0.011, 0], [0.012, 0.01], [0.015, 0.022], [0.023, 0.042], [0.038, 0.07], [0.05, 0.085], [0.053, 0.09]].map(([x, y]) => new THREE.Vector2(x, y));
  funnel.add(mesh(new THREE.LatheGeometry(prof, 40), M.steelDS));
  const screenTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.strokeStyle = '#fff'; g.lineWidth = 1.4;
    for (let i = 0; i <= 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x8a9399, map: screenTex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, emissive: 0x000000, emissiveMap: screenTex, metalness: 0.6, roughness: 0.4 });
  const screen = mesh(new THREE.CircleGeometry(0.052, 32).rotateX(-Math.PI / 2), screenMat, 0, 0.088, 0); screen.castShadow = false;
  funnel.add(screen);
  addLabel(funnel, 'Passive inlet', 'insect screen · no pump', 0.1, 0.1, 0.04);
  addPart(funnel, [0, 0.25, 0]);
  const mouthLocal = new THREE.Vector3(0, 0.06, 0);

  // ---------- rain hood ----------
  const hood = new THREE.Group(); hood.position.y = 1.86;
  hood.add(mesh(new THREE.ConeGeometry(0.175, 0.09, 48, 1, true), M.hood, 0, 0.045, 0));
  const hrim = mesh(new THREE.TorusGeometry(0.175, 0.004, 8, 64), M.hood); hrim.rotation.x = Math.PI / 2; hood.add(hrim);
  hood.add(mesh(new THREE.SphereGeometry(0.012, 16, 10), M.accent, 0, 0.09, 0));
  [Math.PI / 3, Math.PI, (5 * Math.PI) / 3].forEach((a) => hood.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.152, 8), M.steel, 0.1 * Math.cos(a), -0.076, -0.1 * Math.sin(a))));
  addLabel(hood, 'Rain hood', 'drip edge keeps inlet dry', 0.24, 0.07, 0);
  addPart(hood, [0, 0.38, 0]);

  // ---------- solar ----------
  const solar = new THREE.Group(); solar.position.set(0, 1.35, 0);
  const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 10), M.steel, -0.1, 0, 0); arm.rotation.z = Math.PI / 2; solar.add(arm);
  const panel = new THREE.Group(); panel.position.set(-0.24, 0.05, 0); panel.rotation.z = 0.3;
  panel.add(mesh(new THREE.BoxGeometry(0.21, 0.01, 0.15), M.alu));
  const cellTex = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#0d1b33'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = '#18315c'; g.fillRect(4 + x * 42, 4 + y * 47, 38, 43);
      g.strokeStyle = 'rgba(180,200,230,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(4 + x * 42, 25 + y * 47); g.lineTo(42 + x * 42, 25 + y * 47); g.stroke();
    }
  });
  panel.add(mesh(new THREE.PlaneGeometry(0.2, 0.14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.2, metalness: 0.4 }), 0, 0.0056, 0));
  panel.add(mesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), M.dark, 0.05, -0.028, 0));
  solar.add(panel);
  addLabel(panel, 'Solar trickle panel', '~5% of sun reaches understory', -0.05, 0.08, 0.08);
  addPart(solar, [-0.2, -0.06, 0]);

  // ---------- T/RH shield ----------
  const trh = new THREE.Group(); trh.position.set(0, 1.28, 0);
  const tarm = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), M.steel, 0, 0, -0.07); tarm.rotation.x = Math.PI / 2; trh.add(tarm);
  for (let k = 0; k < 5; k++) trh.add(mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.005, 24), M.hood, 0, 0.02 - k * 0.012, -0.155));
  trh.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), M.dark, 0, -0.005, -0.155));
  addLabel(trh, 'T / RH sensor', 'humidity drives sporulation', 0, -0.05, -0.2);
  addPart(trh, [0, -0.06, -0.15]);

  // ---------- soil probe + cable ----------
  const probe = new THREE.Group(); probe.position.set(0.3, 0.02, 0.18);
  probe.add(mesh(new THREE.BoxGeometry(0.07, 0.035, 0.03), M.body));
  probe.add(mesh(new THREE.BoxGeometry(0.05, 0.004, 0.032), M.accent, 0, 0.018, 0));
  root.add(probe);
  addLabel(probe, 'Soil moisture probe', 'ground truth for NDMI', 0.08, 0.06, 0.06);
  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.27, 0.025, 0.17), new THREE.Vector3(0.14, 0.02, 0.1), new THREE.Vector3(0.04, 0.06, 0.025),
    new THREE.Vector3(0.027, 0.4, 0.004), new THREE.Vector3(0.027, 1.2, 0.0), new THREE.Vector3(0.04, 1.45, 0.0),
  ]);
  root.add(mesh(new THREE.TubeGeometry(cablePath, 80, 0.004, 6), M.rubber));

  // ---------- state ----------
  let explode = 0, explodeTarget = 0, xray = false, xrayAmt = 0, labelsOn = true;
  let carouselAngle = 0, carouselTarget = 0;
  let pulseT = 0, flashT = 0, time = 0;
  const flashColor = new THREE.Color();
  const white = new THREE.Color(0xf6f4ee), mix = new THREE.Color(), tmp = new THREE.Color();
  const taxonColors = TAXA.map((t) => new THREE.Color(t.color));

  return {
    root, labels, cartridges,
    setExplode(on) { explodeTarget = on ? 1 : 0; },
    toggleExplode() { explodeTarget = explodeTarget ? 0 : 1; return !!explodeTarget; },
    toggleXray() { xray = !xray; return xray; },
    setXray(on) { xray = on; },
    setLabels(on) { labelsOn = on; },
    explodeAmount: () => explode,
    isIndexing: () => Math.abs(carouselAngle - carouselTarget) > 0.004,
    mouthWorld(out) { return funnel.localToWorld(out.copy(mouthLocal)); },
    setCartridge(idx, snap = false) {
      carouselTarget = -(idx / N_CART) * TAU;
      if (snap) carouselAngle = carouselTarget;
    },
    pulseUplink() { pulseT = 1; },
    flash(taxon) { flashT = 1; flashColor.copy(taxonColors[taxon]); },

    update(dt, counts) {
      time += dt;
      explode += (explodeTarget - explode) * Math.min(1, dt * 4);
      const e = explode * explode * (3 - 2 * explode);
      for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.off, e);

      xrayAmt += ((xray ? 1 : 0) - xrayAmt) * Math.min(1, dt * 5);
      const xt = xrayAmt > 0.01;
      M.shell.transparent = xt; M.shell.opacity = 1 - 0.82 * xrayAmt; M.shell.depthWrite = !xt;
      M.hood.opacity = 1 - 0.7 * xrayAmt; M.hood.depthWrite = !xt;
      M.body.transparent = xt; M.body.opacity = 1 - 0.6 * xrayAmt;
      M.clear.opacity = 0.22 - 0.12 * xrayAmt;
      decal.visible = xrayAmt < 0.5;
      const showInternal = xrayAmt > 0.5 || explode > 0.5;
      for (const l of labels) l.visible = labelsOn && (!l.userData.internal || showInternal);

      const d = carouselTarget - carouselAngle;
      carouselAngle += Math.sign(d) * Math.min(Math.abs(d), dt * 0.9);
      carousel.rotation.y = carouselAngle;

      // membranes: tint by what they caught
      for (let i = 0; i < N_CART; i++) {
        const c = counts[i];
        const total = c[0] + c[1] + c[2] + c[3];
        const m = cartridges[i].mem;
        if (total <= 0) { m.color.copy(white); m.emissive.setRGB(0, 0, 0); continue; }
        mix.setRGB(0, 0, 0);
        for (let k = 0; k < 4; k++) mix.add(tmp.copy(taxonColors[k]).multiplyScalar(c[k] / total));
        const fill = 1 - Math.exp(-total / 2500);
        m.color.copy(white).lerp(tmp.copy(mix).multiplyScalar(0.8), fill * 0.9);
        m.emissive.copy(mix).multiplyScalar(0.35 * fill);
      }

      // capture flash on the inlet screen
      flashT = Math.max(0, flashT - dt * 3);
      screenMat.emissive.copy(flashColor).multiplyScalar(flashT * 2.5);

      // uplink pulse
      if (pulseT > 0) {
        pulseT = Math.max(0, pulseT - dt * 1.2);
        const k = 1 - pulseT;
        pulse.scale.setScalar(0.02 + k * 0.28); pulseMat.opacity = pulseT * 0.9;
      } else pulseMat.opacity = 0;

      // status LED
      if (pulseT > 0) { ledMat.emissive.set(0x3aa8ff); ledMat.emissiveIntensity = 3; }
      else if (this.isIndexing()) { ledMat.emissive.set(0xffb020); ledMat.emissiveIntensity = 2.5; }
      else { ledMat.emissive.set(0x00ff88); ledMat.emissiveIntensity = (time % 2) < 0.12 ? 4 : 0.15; }
    },
  };
}
