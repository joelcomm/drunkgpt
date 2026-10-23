import * as THREE from "three";
import { buildCharacter, SKIN_TONES, HAIR_COLORS, JACKET_COLORS, DRESS_COLORS, GLOVE_COLORS, LIP_COLORS, IRIS_COLORS } from "./character.js";

const TABLE_Y = 0.74;
const BUDDY_Z = -0.62;

// ---------- small helpers ----------

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

const tweens = new Set();
// Background tabs get no animation frames, so tweens there finish instantly instead of stalling the game.
function tween(duration, onUpdate) {
  if (document.hidden) {
    onUpdate(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tw = { t: 0, duration, onUpdate, resolve };
    tweens.add(tw);
    // Some hidden panes stop animation frames while still reporting "visible"; timers still run.
    setTimeout(() => {
      if (!tweens.has(tw)) return;
      tweens.delete(tw);
      onUpdate(1);
      resolve();
    }, duration * 1000 + 400);
  });
}
function finishTweens() {
  for (const tw of tweens) {
    tw.onUpdate(1);
    tw.resolve();
  }
  tweens.clear();
}
document.addEventListener("visibilitychange", () => document.hidden && finishTweens());
function stepTweens(dt) {
  for (const tw of tweens) {
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    tw.onUpdate(tw.t);
    if (tw.t >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function mesh(geometry, material, { pos, rot, scale, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// ---------- glassware ----------

// Profiles are [radius, height] pairs; liquid profiles start at the bowl base.
const GLASS_SHAPES = {
  pint: { outer: [[0, 0], [0.032, 0], [0.034, 0.006], [0.042, 0.15]], base: 0.008, liquid: [[0, 0], [0.032, 0], [0.039, 0.125]] },
  highball: { outer: [[0, 0], [0.03, 0], [0.031, 0.006], [0.032, 0.15]], base: 0.008, liquid: [[0, 0], [0.029, 0], [0.03, 0.12]] },
  rocks: { outer: [[0, 0], [0.038, 0], [0.04, 0.085]], base: 0.012, liquid: [[0, 0], [0.036, 0], [0.037, 0.05]] },
  shot: { outer: [[0, 0], [0.019, 0], [0.023, 0.06]], base: 0.01, liquid: [[0, 0], [0.017, 0], [0.02, 0.042]] },
  wine: {
    outer: [[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.01], [0.004, 0.085], [0.03, 0.1], [0.04, 0.135], [0.033, 0.175]],
    base: 0.088,
    liquid: [[0, 0], [0.026, 0.012], [0.036, 0.04]],
  },
  flute: {
    outer: [[0, 0], [0.027, 0], [0.027, 0.004], [0.003, 0.01], [0.003, 0.075], [0.018, 0.095], [0.023, 0.18]],
    base: 0.08,
    liquid: [[0, 0], [0.016, 0.02], [0.02, 0.085]],
  },
  martini: {
    outer: [[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.01], [0.004, 0.085], [0.06, 0.14]],
    base: 0.088,
    liquid: [[0, 0], [0.043, 0.04]],
  },
};

// Cuts a liquid profile at fill height and caps it.
function liquidGeometry(profile, fill) {
  const top = profile[profile.length - 1][1] * fill;
  const pts = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    if (y <= top) {
      pts.push([r, y]);
      continue;
    }
    const [pr, py] = profile[i - 1];
    pts.push([lerp(pr, r, (top - py) / (y - py)), top]);
    break;
  }
  pts.push([0, top]);
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28);
}

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.22,
  side: THREE.DoubleSide,
  depthWrite: false,
});

class Glass {
  constructor(drink) {
    this.drink = drink;
    this.shape = GLASS_SHAPES[drink.glass];
    this.group = new THREE.Group();
    const outer = new THREE.LatheGeometry(this.shape.outer.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    this.glass = mesh(outer, glassMaterial, { shadow: false });
    this.glass.renderOrder = 2;
    this.liquidMaterial = std(drink.color, {
      transparent: true,
      opacity: drink.abv === 0 ? 0.35 : 0.85,
      roughness: 0.2,
      emissive: drink.color,
      emissiveIntensity: 0.12,
    });
    this.liquid = mesh(new THREE.BufferGeometry(), this.liquidMaterial, { pos: [0, this.shape.base, 0], shadow: false });
    this.liquid.renderOrder = 1;
    this.group.add(this.liquid, this.glass);
    if (drink.mood === "beer") {
      this.foam = mesh(new THREE.CylinderGeometry(1, 1, 1, 24), std(0xfff8e6, { roughness: 1 }), { shadow: false });
      this.group.add(this.foam);
    }
    if (drink.id === "martini") {
      this.olive = mesh(new THREE.SphereGeometry(0.009, 12, 8), std(0x5d7a2a), { pos: [0.01, this.shape.base + 0.012, 0] });
      this.group.add(this.olive);
    }
    this.height = this.shape.outer[this.shape.outer.length - 1][1];
    this.setFill(1);
  }

  setFill(fill) {
    this.fill = fill;
    this.liquid.visible = fill > 0.01;
    if (this.liquid.visible) {
      this.liquid.geometry.dispose();
      this.liquid.geometry = liquidGeometry(this.shape.liquid, fill);
    }
    if (this.foam) {
      const profile = this.shape.liquid;
      const top = profile[profile.length - 1][1] * fill;
      const r = lerp(profile[1][0], profile[2][0], fill) * 0.98;
      this.foam.visible = fill > 0.04;
      this.foam.scale.set(r, 0.012, r);
      this.foam.position.y = this.shape.base + top + 0.004;
    }
    if (this.olive) this.olive.visible = fill > 0.05;
  }
}

// ---------- the room ----------

function buildRoom(scene) {
  const floorTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#3a2216";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(22, 40%, ${14 + Math.random() * 8}%)`;
      g.fillRect(0, i * 64 + 2, w, 60);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = "rgba(0,0,0,0.12)";
        g.beginPath();
        const y = i * 64 + Math.random() * 60;
        g.moveTo(0, y);
        g.bezierCurveTo(w / 3, y + 3, (2 * w) / 3, y - 3, w, y);
        g.stroke();
      }
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 4);
  const floor = mesh(new THREE.PlaneGeometry(12, 12), std(0xffffff, { map: floorTex, roughness: 0.55 }), { rot: [-Math.PI / 2, 0, 0], shadow: false });
  scene.add(floor);

  const brickTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#2a1410";
    g.fillRect(0, 0, w, h);
    const bw = 64, bh = 28;
    for (let row = 0; row < h / bh; row++) {
      for (let col = -1; col < w / bw + 1; col++) {
        const x = col * bw + (row % 2 ? bw / 2 : 0);
        g.fillStyle = `hsl(${8 + Math.random() * 8}, 45%, ${16 + Math.random() * 8}%)`;
        g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  });
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
  brickTex.repeat.set(3, 1.5);
  const wallMat = std(0xffffff, { map: brickTex, roughness: 0.9 });
  scene.add(mesh(new THREE.PlaneGeometry(10, 4), wallMat, { pos: [0, 2, -3.6], shadow: false }));
  const sideL = mesh(new THREE.PlaneGeometry(10, 4), wallMat, { pos: [-3.2, 2, 0], rot: [0, Math.PI / 2, 0], shadow: false });
  const sideR = mesh(new THREE.PlaneGeometry(10, 4), wallMat, { pos: [3.2, 2, 0], rot: [0, -Math.PI / 2, 0], shadow: false });
  scene.add(sideL, sideR);
  scene.add(mesh(new THREE.PlaneGeometry(10, 10), std(0x140b08), { pos: [0, 3.2, 0], rot: [Math.PI / 2, 0, 0], shadow: false }));

  // Back bar: counter, shelves of glowing bottles, stools.
  const wood = std(0x4a2a18, { roughness: 0.45 });
  const darkWood = std(0x2b170d, { roughness: 0.5 });
  scene.add(mesh(new THREE.BoxGeometry(4.6, 1.05, 0.6), darkWood, { pos: [0, 0.525, -2.6] }));
  scene.add(mesh(new THREE.BoxGeometry(4.8, 0.06, 0.75), wood, { pos: [0, 1.08, -2.6] }));
  const brass = std(0xc9a14a, { metalness: 0.9, roughness: 0.3 });
  scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.6, 8), brass, { pos: [0, 0.2, -2.25], rot: [0, 0, Math.PI / 2] }));

  const shelfLight = new THREE.MeshBasicMaterial({ color: 0xffb86b });
  const bottleColors = [0x2f6b2a, 0x7a3b12, 0xc9d6e0, 0x8a1c1c, 0x1d3f6e, 0xd99a2b, 0x4b2a6a, 0x9fbf3a];
  for (const [i, y] of [1.35, 1.75, 2.15].entries()) {
    scene.add(mesh(new THREE.BoxGeometry(4.2, 0.03, 0.28), wood, { pos: [0, y, -3.42] }));
    scene.add(mesh(new THREE.BoxGeometry(4.2, 0.015, 0.02), shelfLight, { pos: [0, y - 0.02, -3.29], shadow: false }));
    for (let x = -1.95; x < 1.95; x += 0.13 + Math.random() * 0.06) {
      const h = 0.2 + Math.random() * 0.12;
      const color = bottleColors[Math.floor(Math.random() * bottleColors.length)];
      const mat = std(color, { roughness: 0.15, transparent: true, opacity: 0.8, emissive: color, emissiveIntensity: 0.35 });
      const bottle = new THREE.Group();
      bottle.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 12), mat, { pos: [0, h / 2, 0], shadow: false }));
      bottle.add(mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 10), mat, { pos: [0, h + 0.04, 0], shadow: false }));
      bottle.position.set(x, y + 0.015, -3.42 + (i % 2) * 0.03);
      scene.add(bottle);
    }
  }
  scene.add(mesh(new THREE.BoxGeometry(4.4, 1.2, 0.05), std(0x0b0605), { pos: [0, 1.75, -3.55], shadow: false }));

  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    const stool = new THREE.Group();
    stool.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 20), std(0x6b1b1b, { roughness: 0.5 }), { pos: [0, 0.76, 0] }));
    stool.add(mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.74, 10), brass, { pos: [0, 0.37, 0] }));
    stool.add(mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20), brass, { pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0] }));
    stool.position.set(x, 0, -2.05);
    scene.add(stool);
  }

  // Neon sign.
  const neonTex = canvasTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "italic 700 120px 'Brush Script MT', 'Segoe Script', cursive";
    g.shadowColor = "#ff3fa4";
    g.shadowBlur = 40;
    g.fillStyle = "#ffd1ea";
    g.fillText("The Tipsy Token", w / 2, h / 2 - 10);
    g.shadowBlur = 20;
    g.fillText("The Tipsy Token", w / 2, h / 2 - 10);
  });
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.55),
    new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, toneMapped: false, depthWrite: false })
  );
  neon.position.set(0, 2.7, -3.5);
  scene.add(neon);

  const gptTex = canvasTexture(512, 160, (g, w, h) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 92px 'Arial Rounded MT Bold', 'Helvetica Neue', sans-serif";
    g.shadowColor = "#38e1ff";
    g.shadowBlur = 30;
    g.fillStyle = "#d8f8ff";
    g.fillText("DrunkGPT", w / 2, h / 2);
    g.fillText("DrunkGPT", w / 2, h / 2);
  });
  const gpt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.28),
    new THREE.MeshBasicMaterial({ map: gptTex, transparent: true, toneMapped: false, depthWrite: false })
  );
  gpt.position.set(-2.4, 2.1, -1.2);
  gpt.rotation.y = Math.PI / 2.4;
  scene.add(gpt);

  // Booth behind the buddy.
  const leather = std(0x7a1f22, { roughness: 0.45 });
  scene.add(mesh(new THREE.BoxGeometry(1.6, 0.45, 0.5), leather, { pos: [0, 0.225, BUDDY_Z - 0.12] }));
  scene.add(mesh(new THREE.BoxGeometry(1.6, 0.75, 0.18), leather, { pos: [0, 0.82, BUDDY_Z - 0.38] }));
  for (let x = -0.6; x <= 0.61; x += 0.3) {
    scene.add(mesh(new THREE.BoxGeometry(0.02, 0.7, 0.02), std(0x4a1214), { pos: [x, 0.82, BUDDY_Z - 0.285], shadow: false }));
  }

  // Table.
  scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 48), wood, { pos: [0, TABLE_Y - 0.02, 0] }));
  scene.add(mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 48), brass, { pos: [0, TABLE_Y - 0.02, 0], rot: [Math.PI / 2, 0, 0] }));
  scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, TABLE_Y - 0.04, 12), darkWood, { pos: [0, (TABLE_Y - 0.04) / 2, 0] }));
  scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 24), darkWood, { pos: [0, 0.015, 0] }));

  // Candle in a jar.
  const candle = new THREE.Group();
  candle.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 20), glassMaterial, { pos: [0, 0.035, 0], shadow: false }));
  candle.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 16), std(0xf3e6c8), { pos: [0, 0.018, 0] }));
  const flame = mesh(new THREE.SphereGeometry(0.007, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc46b }), { pos: [0, 0.045, 0], scale: [1, 2, 1], shadow: false });
  candle.add(flame);
  candle.position.set(0.12, TABLE_Y, -0.05);
  scene.add(candle);

  // Lights.
  scene.add(new THREE.HemisphereLight(0xffcfa0, 0x1a0c08, 0.55));
  const pendant = new THREE.SpotLight(0xffe4c4, 18, 6, 0.75, 0.6, 1.6);
  pendant.position.set(0, 2.4, -0.2);
  pendant.target.position.set(0, TABLE_Y, -0.3);
  pendant.castShadow = true;
  pendant.shadow.mapSize.set(1024, 1024);
  pendant.shadow.bias = -0.0005;
  pendant.shadow.normalBias = 0.02; // no speckled acne on the cel-shaded skin
  scene.add(pendant, pendant.target);
  const shade = mesh(new THREE.ConeGeometry(0.18, 0.16, 24, 1, true), std(0x1a2a1a, { side: THREE.DoubleSide, metalness: 0.4 }), { pos: [0, 2.35, -0.2], shadow: false });
  scene.add(shade);
  scene.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), { pos: [0, 2.29, -0.2], shadow: false }));
  scene.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 6), std(0x111111), { pos: [0, 2.85, -0.2], shadow: false }));

  // Soft frontal key so faces read clearly in the cel-shaded bands; no shadows.
  const faceLight = new THREE.DirectionalLight(0xffe6cf, 0.6);
  faceLight.position.set(0.05, 1.45, 2.6);
  faceLight.target.position.set(0, 1.0, -0.6);
  scene.add(faceLight, faceLight.target);

  const barGlow = new THREE.PointLight(0xffa860, 8, 5, 1.5);
  barGlow.position.set(0, 1.9, -2.9);
  scene.add(barGlow);
  const neonLight = new THREE.PointLight(0xff3fa4, 5, 4, 1.6);
  neonLight.position.set(0, 2.6, -3.1);
  scene.add(neonLight);
  const candleLight = new THREE.PointLight(0xffa040, 0.6, 1.4, 2);
  candleLight.position.set(0.12, TABLE_Y + 0.08, -0.05);
  scene.add(candleLight);

  return { neon, neonLight, candleLight, flame, candle };
}

// ---------- the drinking buddy ----------

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const isValidLook = (look) =>
  Boolean(look) &&
  SKIN_TONES.includes(look.skin) &&
  HAIR_COLORS.includes(look.hair) &&
  JACKET_COLORS.includes(look.shirt) &&
  DRESS_COLORS.includes(look.dress) &&
  GLOVE_COLORS.includes(look.gloves) &&
  LIP_COLORS.includes(look.lips) &&
  IRIS_COLORS.includes(look.iris);

export function randomLook() {
  const dress = pick(DRESS_COLORS);
  return {
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_COLORS.slice(0, 6)),
    shirt: pick(JACKET_COLORS),
    dress,
    gloves: pick(GLOVE_COLORS.filter((c) => c !== dress)),
    lips: pick(LIP_COLORS),
    iris: pick(IRIS_COLORS),
  };
}

const EXPRESSIONS = {
  neutral: { smile: 0.25, brow: 0, browY: 0, eye: 1, mouth: 0 },
  happy: { smile: 0.9, brow: 0.1, browY: 0.004, eye: 0.85, mouth: 0.15 },
  laugh: { smile: 1, brow: 0.15, browY: 0.008, eye: 0.45, mouth: 0.8 },
  sad: { smile: -0.7, brow: -0.45, browY: 0.004, eye: 0.75, mouth: 0 },
  angry: { smile: -0.5, brow: 0.5, browY: -0.006, eye: 0.8, mouth: 0.1 },
  love: { smile: 0.8, brow: -0.2, browY: 0.006, eye: 0.6, mouth: 0 },
  surprised: { smile: 0, brow: -0.1, browY: 0.014, eye: 1.25, mouth: 0.9 },
  sick: { smile: -0.5, brow: -0.3, browY: 0, eye: 0.55, mouth: 0.2 },
  sleepy: { smile: 0, brow: -0.15, browY: -0.004, eye: 0.3, mouth: 0.1 },
};

const UPPER_ARM = 0.26;
const FOREARM = 0.24;
const HOLD_OFFSET = new THREE.Vector3(0, -0.03, 0.035); // glass origin relative to the hand
const X_AXIS = new THREE.Vector3(1, 0, 0);
const _v = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
const _q = [0, 1, 2].map(() => new THREE.Quaternion());
const _m = new THREE.Matrix4();

class Buddy {
  constructor(scene, emit) {
    this.emit = emit;
    this.root = new THREE.Group();
    this.root.position.set(0, 0, BUDDY_Z);
    scene.add(this.root);
    this.bac = 0;
    this.expression = "neutral";
    this.face = { ...EXPRESSIONS.neutral };
    this.talking = false;
    this.passedOut = false;
    this.out = 0; // 0..1 blend into the passed-out pose
    this.stand = 0; // 0 seated .. 1 standing
    this.walk = 0; // 0..1 walking blend
    this.walkPhase = 0;
    this.pose = { raise: 0, tilt: 0 };
    this.blinkTimer = 2;
    this.blink = 0;
    this.hiccup = 0;
    this.time = 0;
    this.glass = null;
    this.mouthOpen = 0;
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, timer: 1 };
    this.build({ gender: "man", weightLbs: 170, ...randomLook() });
  }

  build(look) {
    if (this.body) this.root.remove(this.body);
    const rig = (this.rig = buildCharacter(look));
    this.root.add(rig.body);
    Object.assign(this, { body: rig.body, neck: rig.neck, head: rig.head, mouth: rig.mouth, arms: rig.arms, legs: rig.legs, mats: rig.mats, baseSkin: rig.baseSkin });
    this.drinkArm = this.arms[0]; // their right hand, on the viewer's left
    if (this.glass) this.holdGlass(this.glass);
  }

  holdGlass(glass) {
    this.glass = glass;
    const holder = this.drinkArm.holder;
    holder.clear();
    glass.group.position.copy(HOLD_OFFSET);
    glass.group.rotation.set(0, 0, 0);
    holder.add(glass.group);
  }

  releaseGlass() {
    const g = this.glass;
    this.glass = null;
    return g;
  }

  setLook(look) {
    this.build(look);
  }

  setExpression(name) {
    if (EXPRESSIONS[name]) this.expression = name;
  }

  // Root-space point (unaffected by sway) -> body space.
  rootToBody(x, y, z, out) {
    out.set(x, y, z);
    this.root.localToWorld(out);
    return this.body.worldToLocal(out);
  }

  // Two-bone IK in body space; the glass holder gets `glassQuat` (body-space orientation).
  solveArm(arm, target, glassQuat) {
    const [d, p, u, e, f] = _v;
    const S = arm.shoulder.position;
    d.subVectors(target, S);
    const dist = Math.min(UPPER_ARM + FOREARM - 0.002, Math.max(0.08, d.length()));
    d.normalize();
    const cosA = (UPPER_ARM ** 2 + dist ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * dist);
    const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
    // Elbows hang down and out.
    p.set(arm.side * 0.7, -1, -0.25);
    p.addScaledVector(d, -p.dot(d)).normalize();
    u.copy(d).multiplyScalar(Math.cos(a)).addScaledVector(p, Math.sin(a));
    e.copy(S).addScaledVector(u, UPPER_ARM);
    f.copy(S).addScaledVector(d, dist).sub(e).normalize();
    const y = _v[5].copy(u).negate();
    const z = f.clone().addScaledVector(y, -f.dot(y));
    if (z.lengthSq() < 1e-6) z.copy(p);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    _m.makeBasis(x, y, z);
    arm.shoulder.quaternion.setFromRotationMatrix(_m);
    arm.elbow.rotation.set(-Math.acos(Math.min(1, Math.max(-1, u.dot(f)))), 0, 0);
    _q[0].copy(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert();
    arm.holder.quaternion.copy(_q[0]).multiply(glassQuat);
  }

  poseArms() {
    this.root.updateMatrixWorld(true);
    const out = this.out;
    const upright = _q[1].copy(this.body.quaternion).invert();

    for (const arm of this.arms) {
      const s = arm.side;
      // Rest on the table, or folded under the head when passed out.
      const rest = this.rootToBody(
        lerp(s * 0.19, s * 0.1, out),
        lerp(TABLE_Y + 0.03, TABLE_Y + 0.05, out),
        lerp(0.32, 0.5, out),
        new THREE.Vector3()
      );
      if (arm !== this.drinkArm || this.pose.raise < 0.001 || !this.glass) {
        this.solveArm(arm, rest, upright);
        continue;
      }
      // Glass rim at the lips, tipped toward the face.
      const raise = this.pose.raise;
      const alpha = 1.05 + this.pose.tilt;
      const tilted = _q[2].setFromAxisAngle(X_AXIS, -alpha);
      const glassQuat = upright.clone().slerp(tilted, raise);
      const lips = this.mouth.getWorldPosition(_v[4]);
      this.body.worldToLocal(lips);
      // Rim stops just in front of the lips instead of sinking into the face.
      lips.z += 0.028;
      lips.y -= 0.006;
      const rim = HOLD_OFFSET.clone().add(new THREE.Vector3(0, this.glass.height, 0.0)).applyQuaternion(tilted);
      const atMouth = lips.sub(rim);
      this.solveArm(arm, rest.lerp(atMouth, easeInOut(raise)), glassQuat);
    }
    // Standing up: arms drop to the sides and swing as they walk.
    if (this.stand > 0.001) {
      for (const arm of this.arms) {
        const swing = Math.sin(this.walkPhase + (arm.side > 0 ? Math.PI : 0)) * 0.4 * this.walk;
        _q[0].setFromEuler(new THREE.Euler(swing, 0, arm.side * 0.12));
        arm.shoulder.quaternion.slerp(_q[0], this.stand);
        arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.2, this.stand);
      }
    }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const bac = this.bac;
    const drunk = smooth(0.03, 0.28, bac);
    this.out = approach(this.out, this.passedOut ? 1 : 0, 1.6, dt);
    const out = this.out;
    const awake = 1 - out;
    const target = EXPRESSIONS[this.passedOut ? "sleepy" : this.expression];
    for (const k of Object.keys(this.face)) this.face[k] = approach(this.face[k], target[k], 6, dt);

    // Sway grows with BAC and stops once they're out.
    const sway = drunk * 0.16 * awake;
    const slump = smooth(0.2, 0.3, bac) * 0.3;
    this.hiccup = Math.max(0, this.hiccup - dt * 4);
    if (!this.passedOut && bac > 0.08 && Math.random() < dt * 0.04 * (bac / 0.15)) {
      this.hiccup = 1;
      this.emit("hiccup");
    }
    const hic = Math.sin(this.hiccup * Math.PI) * 0.02;
    const breathe = Math.sin(t * (this.passedOut ? 0.9 : 1.6)) * (this.passedOut ? 0.006 : 0.004);
    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.02 * this.walk;
    this.body.position.y = lerp(0.48, 0.9, this.stand) + breathe + hic + bob;
    for (const leg of this.legs) {
      const swing = Math.sin(this.walkPhase + (leg.side > 0 ? Math.PI : 0)) * 0.45 * this.walk;
      leg.hip.rotation.x = lerp(-Math.PI / 2, 0, this.stand) + swing;
      leg.knee.rotation.x = lerp(Math.PI / 2, 0, this.stand) + Math.max(0, -swing) * 1.2;
    }
    this.body.rotation.z = Math.sin(t * 0.8) * sway + Math.sin(t * 2.1) * sway * 0.25;
    this.body.rotation.x = lerp(slump + Math.sin(t * 0.6 + 1) * sway * 0.4, 0.78, out);
    this.neck.rotation.x = lerp(0, 0.85, out);

    // Head: wobble while awake; resting sideways on the arms when out.
    const awakeHeadX = smooth(0.15, 0.3, bac) * 0.25 + Math.sin(t * 0.9) * sway * 0.5 - this.pose.raise * 0.3;
    this.head.rotation.x = lerp(awakeHeadX, -0.95, out);
    this.head.rotation.z = lerp(Math.sin(t * 1.1 + 0.7) * sway * 1.3, 1.0, out);
    this.head.rotation.y = lerp(Math.sin(t * 0.45) * 0.12 * (1 - drunk) + Math.sin(t * 0.7) * sway, 0, out);
    if (this.expression === "laugh" && !this.passedOut) this.head.rotation.x -= Math.abs(Math.sin(t * 12)) * 0.06;

    // Eyes: drunk droop, expression, blinking.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2 + Math.random() * 4 - drunk * 1.5;
    }
    this.blink = Math.max(0, this.blink - dt * (8 - drunk * 5));
    const droop = 1 - smooth(0.06, 0.3, bac) * 0.75;
    const open = lerp(Math.max(0.04, this.face.eye * droop * (1 - Math.sin(this.blink * Math.PI))), 0, out);
    // Eyes wander a little between glances back at you; drunk eyes drift more.
    const g = this.gaze;
    g.timer -= dt;
    if (g.timer <= 0) {
      const away = Math.random() < 0.35 + drunk * 0.3;
      g.tx = away ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 0.06;
      g.ty = away ? (Math.random() - 0.5) * 0.25 - drunk * 0.1 : 0;
      g.timer = 0.8 + Math.random() * 2.5;
    }
    g.x = approach(g.x, g.tx, 14, dt);
    g.y = approach(g.y, g.ty, 14, dt);
    this.rig.setGaze(g.x, g.y);
    this.rig.setEyes(open);
    this.rig.setBrows(this.face.brow, this.face.browY, 1 - droop);

    // Mouth: smile curve plus talking flap.
    const smile = this.face.smile * (1 - drunk * 0.3) + (drunk > 0.4 && !this.passedOut ? 0.2 : 0);
    const talk = this.talking ? 0.004 + Math.abs(Math.sin(t * 17)) * 0.012 + Math.abs(Math.sin(t * 7.3)) * 0.006 : 0;
    const slack = drunk * 0.004 + out * 0.006;
    this.mouthOpen = approach(this.mouthOpen, this.face.mouth * 0.012 + talk + slack, 20, dt);
    this.rig.setMouth(smile, this.mouthOpen);

    // Flushed cheeks and a sick green tint.
    this.mats.cheek.opacity = smooth(0.02, 0.14, bac) * 0.7;
    const green = (bac > 0.24 ? smooth(0.2, 0.3, bac) * 0.35 : 0) + (this.expression === "sick" ? 0.15 : 0);
    this.mats.skin.color.copy(this.baseSkin).lerp(new THREE.Color(0xa8c890), green);

    this.poseArms();
  }
}

// ---------- public API ----------

export function createBar(canvas, { onEvent = () => {} } = {}) {
  const emit = (name, data) => onEvent(name, data);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0705);
  scene.fog = new THREE.Fog(0x0d0705, 3.5, 9);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 30);
  const camBase = new THREE.Vector3(0, 1.22, 0.95);
  const lookAt = new THREE.Vector3(0, 1.06, -0.52);
  const viewDist = camBase.distanceTo(lookAt);
  const PASSED_OUT_CAM = new THREE.Vector3(0.55, 1.42, 0.7);
  const PASSED_OUT_LOOK = new THREE.Vector3(-0.02, 0.86, -0.18);

  const room = buildRoom(scene);
  const buddy = new Buddy(scene, emit);

  // Your own beer, near-side right.
  const myGlass = new Glass({ id: "mine", glass: "pint", color: 0xe0a83a, abv: 5, mood: "beer" });
  myGlass.setFill(0.6);
  myGlass.group.position.set(0.24, TABLE_Y, 0.28);
  scene.add(myGlass.group);
  scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.004, 24), std(0xe8dcc0), { pos: [0.24, TABLE_Y + 0.002, 0.28], shadow: false }));

  // Empties pile up on the buddy's right side of the table.
  const empties = [];
  function retireGlass(glass) {
    const slot = empties.length;
    scene.attach(glass.group);
    const row = Math.floor(slot / 4);
    const target = new THREE.Vector3(-0.42 + (slot % 4) * 0.085 + (row % 2) * 0.04, TABLE_Y, -0.02 - row * 0.085);
    if (slot >= 12) target.set(0.32 + Math.random() * 0.08, TABLE_Y, -0.32 + Math.random() * 0.12);
    const from = glass.group.position.clone();
    const fromQuat = glass.group.quaternion.clone();
    const upright = new THREE.Quaternion();
    empties.push(glass);
    setTimeout(() => emit("setdown"), 550);
    return tween(0.6, (t) => {
      const e = easeInOut(t);
      glass.group.position.lerpVectors(from, target, e);
      glass.group.position.y += Math.sin(e * Math.PI) * 0.08;
      glass.group.quaternion.slerpQuaternions(fromQuat, upright, e);
    });
  }

  let fries = null;
  function serveFries() {
    if (fries) scene.remove(fries);
    fries = new THREE.Group();
    fries.add(mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.02, 24), std(0xf4f0e6, { roughness: 0.4 })));
    const fryMat = std(0xe8b04a, { roughness: 0.8 });
    for (let i = 0; i < 26; i++) {
      fries.add(mesh(new THREE.BoxGeometry(0.01, 0.01, 0.08), fryMat, {
        pos: [(Math.random() - 0.5) * 0.11, 0.015 + Math.random() * 0.03, (Math.random() - 0.5) * 0.09],
        rot: [Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6],
      }));
    }
    scene.add(fries);
    return tween(0.8, (t) => fries.position.set(lerp(1.2, 0.2, easeInOut(t)), TABLE_Y + 0.01, lerp(0.0, 0.08, t)));
  }

  // Zzz sprites when passed out.
  const zTex = canvasTexture(128, 128, (g) => {
    g.font = "700 96px sans-serif";
    g.fillStyle = "#e6e0ff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("z", 64, 64);
  });
  const zs = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.phase = i / 3;
    scene.add(s);
    return s;
  });

  const mouse = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  });

  // `frame` is the unobstructed screen rect (px) between the UI panels; the buddy is fitted into it.
  let frame = null;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const f = frame ?? { left: 0, right: w, top: 0, bottom: h };
    const gw = Math.max(160, f.right - f.left), gh = Math.max(160, f.bottom - f.top);
    // Visible height (m) at the buddy so ~1.15 m wide and ~0.9 m tall fit inside the gap.
    const needH = Math.max(1.15 * (h / gw), 1.0 * (h / gh), 2 * viewDist * Math.tan(THREE.MathUtils.degToRad(19)));
    camera.fov = Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(needH / (2 * viewDist))));
    camera.setViewOffset(w, h, w / 2 - (f.left + f.right) / 2, h / 2 - (f.top + f.bottom) / 2, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", layout);
  layout();

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;
    stepTweens(dt);
    buddy.update(dt);

    camera.position.set(camBase.x + mouse.x * 0.1, camBase.y - mouse.y * 0.04, camBase.z);
    camera.lookAt(lookAt);

    const flicker = 0.85 + Math.sin(t * 30) * 0.05 + (Math.random() < 0.01 ? -0.4 : 0);
    room.neon.material.opacity = flicker;
    room.neonLight.intensity = 5 * flicker;
    room.candleLight.intensity = 0.5 + Math.sin(t * 11) * 0.08 + Math.random() * 0.05;
    room.flame.scale.y = 2 + Math.sin(t * 13) * 0.25;

    const headPos = buddy.head.getWorldPosition(_v[3]);
    for (const z of zs) {
      const p = (t * 0.35 + z.userData.phase) % 1;
      z.material.opacity = buddy.out * Math.sin(p * Math.PI) * 0.9;
      z.position.set(headPos.x + 0.12 + p * 0.12, headPos.y + 0.12 + p * 0.3, headPos.z + 0.05);
      z.scale.setScalar(0.05 + p * 0.06);
    }

    renderer.render(scene, camera);
  });

  return {
    setLook(look) {
      buddy.setLook(look);
    },
    setBac(bac) {
      buddy.bac = bac;
    },
    setExpression(name) {
      buddy.setExpression(name);
    },
    setTalking(on) {
      buddy.talking = on;
    },
    setFrame(rect) {
      frame = rect;
      layout();
    },

    // Bartender slides a fresh drink in; an unfinished glass gets pushed aside first.
    // `delay` lets the pour sound play before the glass slides in.
    async serve(drink, { delay = 0 } = {}) {
      if (buddy.glass) await retireGlass(buddy.releaseGlass());
      if (delay) await tween(delay, () => {});
      const glass = new Glass(drink);
      buddy.holdGlass(glass);
      const from = HOLD_OFFSET.clone().add(new THREE.Vector3(-0.9, 0, 0.35));
      await tween(0.7, (t) => glass.group.position.lerpVectors(from, HOLD_OFFSET, easeInOut(t)));
    },

    async drink(paceKey, fromFill, toFill) {
      const glass = buddy.glass;
      if (!glass) return;
      const [up, hold, down, tilt] = { sip: [0.8, 1.0, 0.7, 0.1], normal: [0.6, 1.3, 0.6, 0.35], chug: [0.45, 2.0, 0.5, 0.75] }[paceKey];
      await tween(up, (t) => (buddy.pose.raise = t));
      emit("drink", { pace: paceKey, hold });
      await tween(hold, (t) => {
        buddy.pose.tilt = tilt * easeInOut(Math.min(1, t * 2)) + Math.sin(t * Math.PI * 6) * 0.03;
        glass.setFill(lerp(fromFill, toFill, t));
      });
      await tween(down, (t) => {
        buddy.pose.raise = 1 - t;
        buddy.pose.tilt = tilt * (1 - t);
      });
      buddy.pose.tilt = 0;
      buddy.pose.raise = 0;
      if (toFill <= 0.001 && buddy.glass === glass) await retireGlass(buddy.releaseGlass());
    },

    serveFries() {
      emit("fries");
      return serveFries();
    },

    // They actually go: glass down, scoot along the booth, stand, turn and wobble off to the right.
    async leave() {
      buddy.talking = false;
      buddy.setExpression("happy");
      if (buddy.glass) await retireGlass(buddy.releaseGlass());
      const root = buddy.root;
      await tween(1.2, (t) => (root.position.x = lerp(0, 0.58, easeInOut(t))));
      const lookY = lookAt.y;
      await tween(0.9, (t) => {
        const e = easeInOut(t);
        buddy.stand = e;
        root.position.z = lerp(BUDDY_Z, -0.12, e);
        lookAt.y = lerp(lookY, 1.22, e); // tilt up to keep their face in frame once standing
      });
      await tween(0.5, (t) => (root.rotation.y = lerp(0, Math.PI / 2, easeInOut(t))));
      const lookFrom = lookAt.x;
      let lastStep = 0;
      await tween(3.2, (t) => {
        buddy.walk = Math.min(1, t * 4);
        buddy.walkPhase = t * 3.2 * 7;
        root.position.x = lerp(0.58, 3.4, t);
        lookAt.x = lerp(lookFrom, 0.55, easeInOut(Math.min(1, t * 1.5)));
        const step = Math.floor(buddy.walkPhase / Math.PI);
        if (step !== lastStep) {
          lastStep = step;
          emit("step");
        }
      });
      root.visible = false;
    },

    async passOut() {
      buddy.talking = false;
      if (buddy.glass) await retireGlass(buddy.releaseGlass());
      buddy.passedOut = true;
      emit("passout");
      // Slide the candle out of the way and pull the camera up to look down on them slumped over the table.
      const fromPos = camBase.clone(), fromLook = lookAt.clone();
      await tween(2.5, (t) => {
        const e = easeInOut(t);
        room.candle.position.x = lerp(0.12, 0.34, e);
        room.candleLight.position.x = room.candle.position.x;
        camBase.lerpVectors(fromPos, PASSED_OUT_CAM, e);
        lookAt.lerpVectors(fromLook, PASSED_OUT_LOOK, e);
      });
    },
  };
}
