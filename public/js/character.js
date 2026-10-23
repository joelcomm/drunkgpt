import * as THREE from "three";

// Cel-shaded, ink-outlined cartoon characters built from sculpted procedural shapes.
// buildCharacter() returns the rig the Buddy animates: pivots for body/neck/head/arms/legs plus face controls.

// ---------- toon materials and ink outlines ----------

const GRADIENT = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([115, 165, 210, 240]), 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...extra });

// Inverted hull pushed out along view-space normals, so line weight is the same at any part scale.
const INK = new THREE.MeshBasicMaterial({ color: 0x1c100c, side: THREE.BackSide });
INK.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
     mvPosition.xyz += normalize( normalMatrix * normal ) * ( 0.0026 * -mvPosition.z );
     gl_Position = projectionMatrix * mvPosition;`
  );
};

function part(parent, geometry, material, { pos, rot, scale, ink = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (ink) {
    const hull = new THREE.Mesh(geometry, INK);
    hull.castShadow = false;
    m.add(hull);
  }
  parent.add(m);
  return m;
}

// ---------- sculpting helpers ----------

// Smooth body of revolution from [radius, y] pairs (bottom to top).
const lathe = (profile, segments = 32, phiStart = 0, phiLength = Math.PI * 2) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments, phiStart, phiLength);

// A limb hanging down -y from its pivot: rounded ends, tapering, with a slight muscle bulge.
function limb(rTop, rBottom, length, bulge = 0.08) {
  const pts = [];
  const steps = 14;
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([rBottom * Math.sin(a), -length - rBottom * Math.cos(a) + rBottom]);
  }
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const r = THREE.MathUtils.lerp(rBottom, rTop, t) * (1 + bulge * Math.sin(t * Math.PI));
    pts.push([r, -length + rBottom + t * (length - rBottom - rTop * 0.5)]);
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([rTop * Math.cos(a), -rTop * 0.5 + rTop * Math.sin(a) * 0.9]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  return lathe(pts, 20);
}

// A tube along a smooth curve whose radius tapers from r0 to r1 (hair locks, brows).
function taperTube(points, r0, r1, tubular = 28, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Heart-shaped (her) or square-jawed (him) head from a sphere.
function sculptHead(woman) {
  const r = 0.12;
  const geo = new THREE.SphereGeometry(r, 48, 36);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ny = y / r;
    if (ny < 0) {
      const t = Math.pow(-ny, 1.5);
      x *= 1 - t * (woman ? 0.4 : 0.18);
      z *= 1 - t * 0.1;
      if (z > 0) z += t * (woman ? 0.014 : 0.008);
      if (!woman && ny < -0.55) y *= 0.96; // flatter, squarer chin
    }
    const front = Math.max(0, z / r);
    x *= 1 + 0.06 * Math.exp(-(((ny + 0.05) / 0.25) ** 2)) * front; // cheekbones
    if (z > 0) z *= 0.92;
    if (z < 0 && ny > -0.3) z *= 1.08; // fuller back of the skull
    p.setXYZ(i, x, y * 1.08, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- palettes ----------

export const SKIN_TONES = [0xf6d6bd, 0xedc09a, 0xd29a6c, 0xa86d47, 0x76482c, 0xfbe2d0];
export const HAIR_COLORS = [0x1c120c, 0x3b2414, 0x6b3e1e, 0xb5371f, 0x7a2a12, 0xe0b45e, 0x8a8a8a];
export const JACKET_COLORS = [0x22314f, 0x2b2b30, 0x5a1d2b, 0x2d4a3a, 0x6b5434, 0x40336b];
export const DRESS_COLORS = [0xc8102e, 0x16121a, 0x0f6e52, 0x6e0f30, 0x2340b0, 0x8a2bc2];
export const GLOVE_COLORS = [0x6b2c91, 0x111014, 0xf0e8dc, 0xc8102e];
export const LIP_COLORS = [0xc4102f, 0xd81b60, 0xa3253a, 0xe0566e];
export const IRIS_COLORS = [0x2f73c9, 0x3b9a62, 0x7a4a22, 0x2b2b2b, 0x7fa7d9];

// ---------- the build ----------

export function buildCharacter({ gender, weightLbs, skin, hair, shirt, dress, gloves, lips, iris }) {
  const woman = gender === "woman";
  const w = Math.min(1.3, Math.max(0, (weightLbs - 100) / 200));
  const W = 1 + 0.35 * w;

  const mats = {
    skin: toon(skin),
    hair: toon(hair),
    outfit: toon(woman ? dress : shirt),
    accent: toon(woman ? gloves : 0xece8df),
    pants: toon(0x23242b),
    shoe: toon(woman ? dress : 0x1a1210),
    white: toon(0xffffff),
    iris: toon(iris),
    dark: new THREE.MeshBasicMaterial({ color: 0x14080a }),
    lip: toon(woman ? lips : new THREE.Color(skin).multiplyScalar(0.8).getHex()),
    gold: new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 1, roughness: 0.25 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    cheek: new THREE.MeshBasicMaterial({ color: 0xff4d6a, transparent: true, opacity: 0, depthWrite: false }),
  };

  const body = new THREE.Group();
  body.position.y = 0.48;

  // --- torso ---
  let shoulderX, shoulderY;
  if (woman) {
    const torso = [
      [0.0, -0.02], [0.14 * W, 0.02], [0.13 * W, 0.1], [0.088 * (1 + 0.6 * w), 0.21], [0.105 * W, 0.31],
      [0.112 * W, 0.38], [0.116 * W, 0.46], [0.118 * W, 0.51], [0.1 * W, 0.555], [0.05, 0.585], [0.0, 0.59],
    ];
    part(body, lathe(torso), mats.skin, { scale: [1.18, 1, 0.74] });
    // Strapless sweetheart gown over the torso, then a pencil skirt down to the knee.
    const gown = torso.slice(0, 7).map(([r, y]) => [r + 0.005, y]);
    gown.push([0.0, 0.46]);
    part(body, lathe(gown), mats.outfit, { scale: [1.18, 1, 0.74] });
    const bust = 0.056 + 0.024 * w;
    for (const s of [-1, 1]) {
      part(body, new THREE.SphereGeometry(bust, 28, 20), mats.outfit, { pos: [s * bust * 0.84, 0.445, 0.065 * W], scale: [1, 0.92, 0.86] });
    }
    part(body, lathe([[0.0, -0.44], [0.115 * W, -0.44], [0.12 * W, -0.3], [0.145 * W, -0.08], [0.142 * W, 0.04], [0.0, 0.04]]), mats.outfit, { scale: [1.15, 1, 0.8] });
    // Pendant on a fine chain.
    part(body, new THREE.TorusGeometry(0.052 + 0.008 * w, 0.0016, 6, 40), mats.gold, { pos: [0, 0.548, 0.02], rot: [Math.PI / 2 - 0.62, 0, 0], ink: false, shadow: false });
    part(body, new THREE.OctahedronGeometry(0.009), mats.gold, { pos: [0, 0.5, 0.072 * W], ink: false, shadow: false });
    shoulderX = 0.118 * W * 1.18 + 0.012;
    shoulderY = 0.51;
  } else {
    const torso = [
      [0.0, -0.02], [0.145 * W, 0.02], [0.148 * W, 0.18], [0.165 * W, 0.34], [0.172 * W, 0.46], [0.16 * W, 0.53],
      [0.11 * W, 0.575], [0.06 * W, 0.6], [0.0, 0.61],
    ];
    part(body, lathe(torso), mats.accent, { scale: [1.12, 1, 0.72] });
    // Open blazer: the same shape a touch larger, with the front left open.
    const jacket = torso.map(([r, y]) => [r + 0.006, y]);
    part(body, lathe(jacket, 32, 0.42, Math.PI * 2 - 0.84), new THREE.MeshToonMaterial({ color: mats.outfit.color, gradientMap: GRADIENT, side: THREE.DoubleSide }), { scale: [1.12, 1, 0.72] });
    const front = 0.172 * W * 0.72;
    for (const s of [-1, 1]) {
      // Lapels and shirt collar points.
      part(body, new THREE.BoxGeometry(0.05, 0.22, 0.008), mats.outfit, { pos: [s * 0.068, 0.43, front + 0.002], rot: [-0.15, s * 0.3, -s * 0.38] });
      part(body, new THREE.BoxGeometry(0.03, 0.045, 0.006), mats.accent, { pos: [s * 0.03, 0.565, front * 0.8], rot: [-0.5, s * 0.3, s * 0.5] });
      part(body, new THREE.SphereGeometry(0.008, 10, 8), mats.dark, { pos: [0, 0.3 - (s + 1) * 0.04, front + 0.004], ink: false });
    }
    shoulderX = 0.165 * W * 1.12 + 0.01;
    shoulderY = 0.52;
  }
  part(body, limb(woman ? 0.034 : 0.05 + 0.01 * w, woman ? 0.036 : 0.052 + 0.01 * w, 0.1, 0), mats.skin, { pos: [0, woman ? 0.655 : 0.68, -0.005] });

  // --- neck & head ---
  const neck = new THREE.Group();
  neck.position.set(0, 0.62, 0.01);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0);
  neck.add(head);
  part(head, sculptHead(woman), mats.skin, { shadow: false, scale: woman ? [0.94 + 0.08 * w, 1.04, 1] : [1.02 + 0.1 * w, 1.02, 1.02] });
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.022, 14, 12), mats.skin, { pos: [s * 0.112, 0.0, -0.005], scale: [0.5, 1.1, 0.9], shadow: false });

  // Nose: a soft bridge and a rounded tip.
  part(head, limb(0.008, 0.012, 0.035, 0), mats.skin, { pos: [0, 0.03, 0.106], rot: [0.35, 0, 0], ink: false, shadow: false });
  part(head, new THREE.SphereGeometry(woman ? 0.009 : 0.014, 14, 12), mats.skin, { pos: [0, -0.012, 0.117], scale: [1.15, 0.85, 1], ink: false, shadow: false });

  // --- eyes: eyeball (gazes), upper lid (blinks/droops), lower lid, liner and lashes ---
  const eyeR = woman ? 0.027 : 0.022;
  const eyes = [-1, 1].map((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.045, 0.024, 0.088);
    eye.rotation.y = s * 0.12;
    eye.scale.set(woman ? 1.22 : 1.1, woman ? 0.86 : 0.92, 1); // almond-shaped
    head.add(eye);
    const ball = new THREE.Group();
    eye.add(ball);
    part(ball, new THREE.SphereGeometry(eyeR, 24, 18), mats.white, { ink: false, shadow: false });
    part(ball, new THREE.SphereGeometry(eyeR * 0.62, 20, 14), mats.iris, { pos: [0, 0, eyeR * 0.84], scale: [1, 1, 0.35], ink: false, shadow: false });
    part(ball, new THREE.SphereGeometry(eyeR * 0.29, 14, 10), mats.dark, { pos: [0, 0, eyeR * 1.02], scale: [1, 1, 0.3], ink: false, shadow: false });
    part(ball, new THREE.SphereGeometry(eyeR * 0.12, 8, 6), mats.shine, { pos: [eyeR * 0.2, eyeR * 0.22, eyeR * 1.1], ink: false, shadow: false });

    const upper = new THREE.Group();
    eye.add(upper);
    part(upper, new THREE.SphereGeometry(eyeR * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.skin, { ink: false, shadow: false });
    // Liner along the lid edge, with a wing at the outer corner for her.
    part(upper, new THREE.TorusGeometry(eyeR * 1.08, woman ? 0.0022 : 0.0012, 6, 24, Math.PI), mats.dark, { rot: [Math.PI / 2, 0, 0], ink: false, shadow: false });
    if (woman) {
      part(upper, new THREE.ConeGeometry(0.0024, 0.014, 6), mats.dark, { pos: [s * eyeR * 1.08, 0.002, 0.004], rot: [0, 0, -s * 1.15], ink: false, shadow: false });
      for (let i = 0; i < 7; i++) {
        const a = -1.15 + (i / 6) * 2.3;
        const outer = Math.abs(a) / 1.15;
        const lash = part(upper, new THREE.ConeGeometry(0.0011, 0.011 + 0.005 * outer, 4), mats.dark, {
          pos: [Math.sin(a) * eyeR * 1.08, 0.001, Math.cos(a) * eyeR * 1.08],
          ink: false,
          shadow: false,
        });
        lash.lookAt(lash.position.clone().multiplyScalar(2).add(new THREE.Vector3(Math.sin(a) * 0.01, 0.022, 0)));
        lash.rotateX(Math.PI / 2);
      }
    }
    const lower = new THREE.Group();
    eye.add(lower);
    part(lower, new THREE.SphereGeometry(eyeR * 1.05, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.skin, { ink: false, shadow: false });
    lower.rotation.x = woman ? 0.95 : 1.15;
    return { eye, ball, upper, lower, side: s };
  });

  // --- brows: arched tapered strokes ---
  const brows = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.047, 0.064, 0.106);
    head.add(g);
    const pts = woman
      ? [[-s * 0.022, -0.004, 0.0], [-s * 0.004, 0.006, 0.003], [s * 0.016, 0.004, 0.0], [s * 0.026, -0.006, -0.006]]
      : [[-s * 0.022, -0.001, 0.0], [0, 0.004, 0.003], [s * 0.024, 0.0, -0.004]];
    part(g, taperTube(pts, woman ? 0.0034 : 0.0055, woman ? 0.0012 : 0.003, 20, 6), mats.hair, { ink: false, shadow: false });
    return g;
  });

  // --- mouth: lips, a smile line, and a mouth that opens ---
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.058, 0.103 + (woman ? 0.004 : 0));
  head.add(mouth);
  const smileLine = part(mouth, new THREE.TorusGeometry(woman ? 0.017 : 0.022, 0.0016, 6, 20, Math.PI), mats.dark, { rot: [0, 0, Math.PI], ink: false, shadow: false });
  const hole = part(mouth, new THREE.SphereGeometry(1, 16, 10), mats.dark, { pos: [0, -0.002, -0.003], scale: [0.016, 0.001, 0.006], ink: false, shadow: false });
  const upperLip = new THREE.Group();
  const lowerLip = new THREE.Group();
  mouth.add(upperLip, lowerLip);
  if (woman) {
    for (const s of [-1, 1]) {
      part(upperLip, new THREE.SphereGeometry(0.0115, 16, 12), mats.lip, { pos: [s * 0.0085, 0.0045, 0], scale: [1.25, 0.5, 0.6], ink: false, shadow: false });
    }
    part(lowerLip, new THREE.SphereGeometry(0.0165, 18, 12), mats.lip, { pos: [0, -0.0075, 0.001], scale: [1.12, 0.55, 0.62], ink: false, shadow: false });
    part(lowerLip, new THREE.SphereGeometry(0.0022, 8, 6), mats.shine, { pos: [0.004, -0.0045, 0.011], scale: [1.6, 0.8, 1], ink: false, shadow: false });
  } else {
    part(upperLip, new THREE.SphereGeometry(0.015, 14, 10), mats.lip, { pos: [0, 0.003, -0.002], scale: [1.3, 0.3, 0.5], ink: false, shadow: false });
    part(lowerLip, new THREE.SphereGeometry(0.014, 14, 10), mats.lip, { pos: [0, -0.005, -0.001], scale: [1.2, 0.38, 0.55], ink: false, shadow: false });
  }
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.026, 12, 10), mats.cheek, { pos: [s * 0.066, -0.026, 0.093], scale: [1, 0.6, 0.4], ink: false, shadow: false });
  }
  if (woman) part(head, new THREE.SphereGeometry(0.0022, 8, 6), mats.dark, { pos: [0.036, -0.044, 0.104], ink: false, shadow: false });

  // --- hair ---
  if (woman) {
    const hairOpts = { shadow: false };
    part(head, new THREE.SphereGeometry(0.14, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.hair, { ...hairOpts, pos: [0, 0.014, -0.012], rot: [-0.6, 0, 0], scale: [1.1, 1.14, 1.1] });
    part(head, new THREE.SphereGeometry(0.135, 32, 24), mats.hair, { ...hairOpts, pos: [0, -0.1, -0.075], scale: [1.3, 1.9, 0.76] });
    // Long waves cascading over the shoulders.
    for (const s of [-1, 1]) {
      for (const [dz, len, phase, r] of [[0.04, 0.95, 0, 0.04], [0.01, 1.05, 0.7, 0.046], [-0.025, 1.12, 1.4, 0.05], [-0.06, 1.1, 2.1, 0.05], [-0.095, 1.0, 2.8, 0.045]]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          pts.push([s * (0.11 + 0.035 * t + Math.sin(t * 9 + phase) * 0.026), 0.07 - t * 0.44 * len, dz + Math.cos(t * 7 + phase) * 0.014 - t * 0.012]);
        }
        part(head, taperTube(pts, r, 0.016, 40, 12), mats.hair, hairOpts);
      }
    }
    // The signature side-swept wave over one eye.
    part(head, taperTube([[-0.05, 0.135, 0.05], [0.0, 0.13, 0.115], [0.06, 0.09, 0.128], [0.09, 0.03, 0.118], [0.112, -0.04, 0.098], [0.128, -0.12, 0.072], [0.14, -0.2, 0.05]], 0.042, 0.018, 40, 14), mats.hair, hairOpts);
  } else {
    part(head, new THREE.SphereGeometry(0.132, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hair, { shadow: false, pos: [0, 0.012, -0.012], rot: [-0.45, 0, 0], scale: [1.04 + 0.08 * w, 1.1, 1.06] });
    // Pompadour swept up and back, with short sideburns.
    part(head, taperTube([[-0.075, 0.1, 0.06], [-0.03, 0.15, 0.1], [0.025, 0.168, 0.1], [0.07, 0.145, 0.07], [0.09, 0.11, 0.035]], 0.05, 0.032, 30, 14), mats.hair, { shadow: false });
    for (const s of [-1, 1]) {
      part(head, new THREE.BoxGeometry(0.012, 0.045, 0.02), mats.hair, { pos: [s * 0.111, 0.0, 0.03], ink: false, shadow: false });
    }
  }

  // --- arms: shoulder -> elbow -> hand -> holder ---
  const armTop = (woman ? 0.038 : 0.05) + 0.012 * w;
  const sleeve = woman ? mats.skin : mats.outfit;
  const forearm = woman ? mats.accent : mats.outfit;
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, shoulderY, 0);
    body.add(shoulder);
    part(shoulder, new THREE.SphereGeometry(armTop * 1.15, 18, 14), sleeve);
    part(shoulder, limb(armTop, armTop * 0.82, 0.26), sleeve);
    const elbow = new THREE.Group();
    elbow.position.y = -0.26;
    shoulder.add(elbow);
    part(elbow, limb(armTop * 0.86, armTop * 0.66, 0.22), forearm);
    if (!woman) part(elbow, new THREE.CylinderGeometry(armTop * 0.72, armTop * 0.72, 0.022, 16), mats.accent, { pos: [0, -0.205, 0] });
    const hand = new THREE.Group();
    hand.position.y = -0.24;
    elbow.add(hand);
    buildHand(hand, woman ? mats.accent : mats.skin, woman ? 0.85 : 1);
    const holder = new THREE.Group();
    hand.add(holder);
    return { shoulder, elbow, hand, holder, side };
  });

  // --- legs: hip -> knee, with shoes ---
  const legTop = (woman ? 0.058 : 0.068) * W;
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * (0.068 * W), 0.03, 0);
    body.add(hip);
    part(hip, limb(legTop, legTop * 0.7, 0.42), woman ? mats.skin : mats.pants);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    part(knee, limb(legTop * 0.72, legTop * 0.48, 0.4), woman ? mats.skin : mats.pants);
    if (woman) {
      // Pumps: a pointed shoe and a stiletto.
      part(knee, new THREE.SphereGeometry(0.03, 14, 10), mats.shoe, { pos: [0, -0.42, 0.045], scale: [0.8, 0.5, 1.9] });
      part(knee, new THREE.CylinderGeometry(0.004, 0.006, 0.06, 8), mats.shoe, { pos: [0, -0.43, -0.012] });
    } else {
      part(knee, new THREE.BoxGeometry(0.075, 0.045, 0.15), mats.shoe, { pos: [0, -0.425, 0.035] });
    }
    return { hip, knee, side: s };
  });

  // ---------- face controls ----------
  let gaze = { x: 0, y: 0 };
  const lidOpen = woman ? -0.6 : -1.15; // her resting lid is heavy and sultry
  return {
    body,
    neck,
    head,
    mouth,
    arms,
    legs,
    mats,
    baseSkin: new THREE.Color(skin),
    // open: 0 closed .. 1 normal .. 1.25 wide.
    setEyes(open) {
      const o = Math.min(1.3, Math.max(0, open));
      const angle = o <= 1 ? THREE.MathUtils.lerp(1.5, lidOpen, o) : THREE.MathUtils.lerp(lidOpen, -1.45, (o - 1) / 0.3);
      for (const e of eyes) {
        e.upper.rotation.x = angle;
        e.ball.rotation.set(-gaze.y, gaze.x, 0);
      }
    },
    setGaze(x, y) {
      gaze = { x, y };
    },
    setBrows(brow, browY, droop) {
      for (const [i, g] of brows.entries()) {
        const s = i === 0 ? -1 : 1;
        g.rotation.z = s * -brow * 0.5;
        g.position.y = 0.064 + browY - droop * 0.008;
      }
    },
    setMouth(smile, open) {
      smileLine.scale.set(1 + Math.max(0, smile) * 0.15, Math.abs(smile) < 0.05 ? 0.05 : smile, 1);
      smileLine.position.y = smile < 0 ? -0.008 : -0.001;
      hole.scale.y = 0.001 + open * 0.9;
      lowerLip.position.y = -open * 0.7;
      upperLip.position.y = open * 0.1;
      const curl = Math.max(-0.5, Math.min(1, smile)) * 0.12;
      upperLip.scale.x = lowerLip.scale.x = 1 + curl;
    },
  };
}

// Mitten palm with curled fingers and a thumb, sized to wrap a glass.
function buildHand(hand, material, size) {
  const g = new THREE.Group();
  g.scale.setScalar(size);
  hand.add(g);
  part(g, new THREE.SphereGeometry(0.03, 16, 12), material, { pos: [0, -0.012, 0], scale: [1, 1.25, 0.6] });
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group();
    finger.position.set(-0.018 + i * 0.012, -0.044, 0.004);
    finger.rotation.x = -0.7;
    g.add(finger);
    part(finger, limb(0.0072, 0.006, 0.03 - Math.abs(i - 1.5) * 0.004, 0), material, { ink: false });
  }
  const thumb = new THREE.Group();
  thumb.position.set(0.024, -0.02, 0.012);
  thumb.rotation.set(-0.5, 0, 0.7);
  g.add(thumb);
  part(thumb, limb(0.0085, 0.007, 0.028, 0), material, { ink: false });
}
