import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const { smoothstep, lerp } = THREE.MathUtils;

// Terrain: flat pad around the sampler, gentle undulation beyond.
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const k = smoothstep(r, 1.2, 5);
  return k * (
    0.35 * Math.sin(0.13 * x + 0.7) * Math.cos(0.11 * z - 0.4) +
    0.12 * Math.sin(0.47 * x + 1.3) * Math.sin(0.39 * z + 0.2) +
    0.04 * Math.sin(1.7 * x) * Math.cos(1.3 * z)
  );
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const leafTex = () => canvasTex(64, 128, (g) => {
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(32, 4);
  g.bezierCurveTo(62, 40, 56, 100, 32, 124);
  g.bezierCurveTo(8, 100, 2, 40, 32, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(32, 8); g.lineTo(32, 122); g.stroke();
});

const fernTex = () => canvasTex(128, 512, (g) => {
  g.fillStyle = '#fff';
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const y = 502 - t * 490;
    const len = 8 + 52 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05));
    const a = 0.45;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(64 + s * (len / 2) * Math.cos(a), y - (len / 2) * Math.sin(a), len / 2, 5.5, -s * a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 6); g.stroke();
});

const gradTex = () => canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, h, 0, 0); // bottom -> top
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(120,120,120,1)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

const puffTex = () => canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

export function buildEnvironment(scene) {
  const rng = mulberry32(7);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  scene.fog = new THREE.FogExp2(0x6f9886, 0.04);
  scene.background = new THREE.Color(0x6f9886);

  // ---------- ground ----------
  const gGeo = new THREE.PlaneGeometry(440, 440, 220, 220);
  gGeo.rotateX(-Math.PI / 2);
  const p = gGeo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundHeight(x, z));
    if (rng() < 0.15) col.setHSL(0.24, 0.35, 0.1 + 0.05 * rng());
    else col.setHSL(0.06 + 0.04 * rng(), 0.35 + 0.2 * rng(), 0.09 + 0.07 * rng());
    col.toArray(colors, i * 3);
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- leaf litter ----------
  const LITTER = 4500;
  const litter = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.05, 0.1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    LITTER,
  );
  for (let i = 0; i < LITTER; i++) {
    const a = rng() * Math.PI * 2, r = 0.25 + 13 * Math.sqrt(rng());
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    dummy.position.set(x, groundHeight(x, z) + 0.004 + rng() * 0.01, z);
    dummy.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.4);
    const s = 0.7 + rng() * 1.2; dummy.scale.set(s, s, s);
    dummy.updateMatrix(); litter.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.05 + rng() * 0.08, 0.45 + rng() * 0.3, 0.16 + rng() * 0.2);
    litter.setColorAt(i, col);
  }
  litter.receiveShadow = true;
  scene.add(litter);

  // keep camera presets' lines of sight to the sampler open
  const CORRIDORS = [[8.5, 10.5, 2.6], [30, 38, 3.2]];
  const inSightline = (x, z) => CORRIDORS.some(([cx, cz, w]) => {
    const L2 = cx * cx + cz * cz, t = Math.max(0, Math.min(1.15, (x * cx + z * cz) / L2));
    return Math.hypot(x - cx * t, z - cz * t) < w;
  });

  // ---------- trees ----------
  const trees = [{ x: -6.2, z: 2.6, r: 0.9, h: 34, big: true }];
  while (trees.length < 420) {
    const a = rng() * Math.PI * 2, r = 5.5 + Math.pow(rng(), 0.75) * 140;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inSightline(x, z)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
    const big = rng() < 0.3;
    trees.push({ x, z, big, r: big ? 0.6 + rng() * 0.5 : 0.18 + rng() * 0.25, h: big ? 26 + rng() * 10 : 12 + rng() * 12 });
  }
  const trunkMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 1, 1, 12).translate(0, 0.5, 0), trunkMat, trees.length);
  const bigTrees = trees.filter((t) => t.big);
  const buttress = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 1, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), bigTrees.length);
  const blobs = [];
  trees.forEach((t, i) => {
    t.y = groundHeight(t.x, t.z) - 0.1;
    t.baseR = t.big ? t.r * 2.6 : t.r;
    dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, rng() * 6, 0); dummy.scale.set(t.r, t.h, t.r);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.08 + rng() * 0.04, 0.12 + rng() * 0.12, 0.22 + rng() * 0.22); trunks.setColorAt(i, col);
    const n = t.big ? 6 : 3;
    for (let k = 0; k < n; k++) {
      const spread = t.big ? 6 : 2.8;
      blobs.push({
        x: t.x + (rng() - 0.5) * spread * 1.6, z: t.z + (rng() - 0.5) * spread * 1.6,
        y: t.y + t.h * (0.82 + rng() * 0.2), s: (t.big ? 5 : 2.6) + rng() * (t.big ? 2.5 : 1.5),
      });
    }
  });
  bigTrees.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, rng() * 6, 0);
    dummy.scale.set(t.baseR, 1.4 + t.r * 1.1, t.baseR); dummy.updateMatrix(); buttress.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.08, 0.15, 0.2 + rng() * 0.08); buttress.setColorAt(i, col);
  });
  trunks.castShadow = trunks.receiveShadow = true;
  buttress.castShadow = buttress.receiveShadow = true;
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), blobs.length);
  blobs.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(rng(), rng(), rng()); dummy.scale.set(b.s, b.s * 0.6, b.s);
    dummy.updateMatrix(); canopy.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.27 + rng() * 0.07, 0.45 + rng() * 0.15, 0.12 + rng() * 0.1); canopy.setColorAt(i, col);
  });
  scene.add(trunks, buttress, canopy);

  // lianas
  const LIANA = 120;
  const lianas = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, -0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x3a3022, roughness: 1 }), LIANA);
  for (let i = 0; i < LIANA; i++) {
    const t = trees[1 + Math.floor(rng() * (trees.length - 1))];
    const len = 8 + rng() * 14;
    dummy.position.set(t.x + (rng() - 0.5) * 3, t.y + t.h * 0.85, t.z + (rng() - 0.5) * 3);
    dummy.rotation.set((rng() - 0.5) * 0.15, 0, (rng() - 0.5) * 0.15);
    dummy.scale.set(0.03, len, 0.03); dummy.updateMatrix(); lianas.setMatrixAt(i, dummy.matrix);
  }
  scene.add(lianas);

  // ---------- understory: ferns + palms ----------
  const frondGeo = new THREE.PlaneGeometry(0.4, 1, 1, 6).translate(0, 0.5, 0);
  { const fp = frondGeo.attributes.position; for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setZ(i, 0.35 * y * y); } frondGeo.computeVertexNormals(); }
  const fronds = [];
  const palms = [];
  for (let i = 0; i < 320; i++) {
    const a = rng() * Math.PI * 2, r = 2.2 + Math.pow(rng(), 1.1) * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inSightline(x, z)) continue;
    const y = groundHeight(x, z);
    const n = 7 + Math.floor(rng() * 4), L = 0.5 + rng() * 0.8, hue = 0.26 + rng() * 0.08;
    for (let k = 0; k < n; k++) fronds.push({ x, y, z, ang: (k / n) * Math.PI * 2 + rng() * 0.4, pitch: 0.55 + rng() * 0.5, L, w: L * 0.8, hue });
  }
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2, r = 3.5 + rng() * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 2 + rng() * 2.8;
    if (inSightline(x, z)) continue;
    palms.push({ x, z, y: groundHeight(x, z), h });
    const n = 9, L = 1.6 + rng() * 0.8;
    for (let k = 0; k < n; k++) fronds.push({ x, y: groundHeight(x, z) + h, z, ang: (k / n) * Math.PI * 2 + rng() * 0.3, pitch: 1.0 + rng() * 0.45, L, w: L * 0.9, hue: 0.24 + rng() * 0.06 });
  }
  const frondMesh = new THREE.InstancedMesh(frondGeo,
    new THREE.MeshStandardMaterial({ map: fernTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }), fronds.length);
  fronds.forEach((f, i) => {
    dummy.position.set(f.x, f.y, f.z); dummy.rotation.set(f.pitch, f.ang, 0, 'YXZ'); dummy.scale.set(f.w, f.L, f.L);
    dummy.updateMatrix(); frondMesh.setMatrixAt(i, dummy.matrix);
    col.setHSL(f.hue, 0.5 + rng() * 0.2, 0.16 + rng() * 0.12); frondMesh.setColorAt(i, col);
  });
  frondMesh.castShadow = true; frondMesh.receiveShadow = true;
  const palmTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x4d4030, roughness: 1 }), palms.length);
  palms.forEach((pl, i) => { dummy.position.set(pl.x, pl.y, pl.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, pl.h, 1); dummy.updateMatrix(); palmTrunks.setMatrixAt(i, dummy.matrix); });
  palmTrunks.castShadow = true;
  scene.add(frondMesh, palmTrunks);

  // ---------- fallen logs ----------
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4b3f30, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 });
  const logDefs = [
    { x: 2.6, z: -1.9, ang: 0.4, len: 4.5, r: 0.32 },
    { x: -2.4, z: -3.8, ang: -0.9, len: 5.5, r: 0.42 },
    { x: 5.8, z: 3.6, ang: 1.8, len: 4, r: 0.28 },
    { x: -3.2, z: 4.6, ang: 2.6, len: 3.6, r: 0.3 },
  ];
  const logs = logDefs.map((d) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 1.06, d.len, 18).rotateZ(Math.PI / 2), [barkMat, woodMat, woodMat]);
    const center = new THREE.Vector3(d.x, groundHeight(d.x, d.z) + d.r * 0.8, d.z);
    m.position.copy(center); m.rotation.y = d.ang;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return {
      center, r: d.r, len: d.len,
      axis: new THREE.Vector3(Math.cos(d.ang), 0, -Math.sin(d.ang)),
      perp: new THREE.Vector3(Math.sin(d.ang), 0, Math.cos(d.ang)),
    };
  });

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xcfe8da, 0x2b2117, 0.8);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 1.2, 0);
  const moon = new THREE.DirectionalLight(0x8fb3ff, 0.3);
  moon.position.set(20, 30, -10);
  const fill = new THREE.DirectionalLight(0x9ad1ff, 0.25);
  fill.position.set(6, 4, 8);
  scene.add(hemi, sun, sun.target, moon, fill);

  // ---------- light shafts ----------
  const rayMat = new THREE.MeshBasicMaterial({ map: gradTex(), color: 0xfff0c0, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const rays = [[1.4, -0.8, 0.9], [-4, 3, 1.6], [6, -5, 2.2], [-8, -7, 1.8]].map(([x, z, r]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r, 30, 24, 1, true), rayMat);
    m.position.set(x, 15, z); m.rotation.z = 0.12; scene.add(m); return m;
  });

  // ---------- clouds (seen from orbit) ----------
  const cloudMat = new THREE.SpriteMaterial({ map: puffTex(), color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(cloudMat);
    s.position.set((rng() - 0.5) * 140, 40 + rng() * 6, (rng() - 0.5) * 140);
    const sc = 22 + rng() * 30; s.scale.set(sc, sc * 0.7, 1);
    clouds.push(s); scene.add(s);
  }
  // clouds directly over the sampler, so orbit view hides it when cloudy
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(cloudMat);
    s.position.set((rng() - 0.5) * 14, 42, (rng() - 0.5) * 14);
    s.scale.set(30, 20, 1); clouds.push(s); scene.add(s);
  }

  // ---------- rain ----------
  const DROPS = 2600;
  const rainPos = new Float32Array(DROPS * 6);
  for (let i = 0; i < DROPS; i++) {
    const x = (rng() - 0.5) * 22, y = rng() * 22, z = (rng() - 0.5) * 22;
    rainPos.set([x, y, z, x + 0.02, y - 0.45, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xb8d8e8, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  const dayFog = new THREE.Color(), nightFog = new THREE.Color(0x1a2c38), wetFog = new THREE.Color(0x4f625c);
  const skyDay = new THREE.Color(0x2a5a86), skyNight = new THREE.Color(0x0e1a2c);
  const hemiDay = new THREE.Color(0xcfe8da), hemiNight = new THREE.Color(0x7d96c8);
  let fogTarget = 0.04;

  return {
    logs, trees,
    setFogTarget(d, instant = false) { fogTarget = d; if (instant) scene.fog.density = d; },
    update(dt, s, focus) {
      const { dayFrac, cloud, rain: rainI, satView } = s;
      const elev = Math.sin(2 * Math.PI * (dayFrac - 0.25));
      const daylight = smoothstep(elev, -0.12, 0.3);
      const az = 2 * Math.PI * (dayFrac - 0.25);
      sun.position.set(-Math.cos(az) * 40, Math.max(elev, 0.08) * 45, 14);
      sun.intensity = 2.4 * daylight * (1 - 0.8 * cloud);
      hemi.intensity = 0.6 + 0.65 * daylight * (1 - 0.45 * cloud);
      hemi.color.copy(hemiNight).lerp(hemiDay, daylight);
      moon.intensity = 0.9 * (1 - daylight);
      fill.intensity = 0.1 + 0.25 * daylight;

      dayFog.set(0x7aa392).lerp(wetFog, Math.min(1, cloud * 0.5 + rainI * 0.5));
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight);
      scene.fog.density = lerp(scene.fog.density, fogTarget, Math.min(1, dt * 6));
      if (satView) scene.background.copy(skyNight).lerp(skyDay, daylight);
      else scene.background.copy(scene.fog.color);

      rayMat.opacity = 0.11 * daylight * Math.max(0, 1 - 1.25 * cloud) * (satView ? 0 : 1);
      rays.forEach((r) => { r.rotation.z = 0.35 * Math.cos(az); });
      cloudMat.opacity = Math.min(0.95, cloud * 1.0);
      cloudMat.color.setScalar(0.25 + 0.75 * daylight);

      rainMat.opacity = rainI * 0.45;
      if (rainI > 0.01) {
        const a = rainGeo.attributes.position.array;
        const fall = 11 * dt;
        for (let i = 0; i < DROPS; i++) {
          const o = i * 6;
          let y = a[o + 1] - fall;
          if (y < focus.y - 2) {
            y += 22;
            a[o] = focus.x + (Math.random() - 0.5) * 22; a[o + 2] = focus.z + (Math.random() - 0.5) * 22;
            a[o + 3] = a[o] + 0.02; a[o + 5] = a[o + 2];
          }
          a[o + 1] = y; a[o + 4] = y - 0.45;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      return daylight;
    },
  };
}
