// Every sound is synthesized with Web Audio, so there are no asset files to ship.

const MUTE_KEY = "drunkgpt-muted";

let ctx = null;
let master, sfxBus, ambienceBus;
let noiseBuffer, brownBuffer;
let voicePitch = 1;
let snoring = null;
let started = false;

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {}

const rand = (a, b) => a + Math.random() * (b - a);

function makeNoise(seconds, brown = false) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buf;
}

// Each source starts at a random point in the buffer so layered noise doesn't correlate.
function noiseSource(buffer = noiseBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const start = src.start.bind(src);
  src.start = (when = 0) => start(when, rand(0, buffer.duration - 0.1));
  return src;
}

const running = () => ctx && ctx.state === "running";

// Gain node with an attack/decay envelope starting at `t`.
function envelope(t, peak, attack, decay, dest = sfxBus) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function filter(type, frequency, Q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

function pan(value, dest) {
  if (!ctx.createStereoPanner) return dest; // Safari before 14.1
  const p = ctx.createStereoPanner();
  p.pan.value = value;
  p.connect(dest);
  return p;
}

// ---------- one-shot effects ----------

function clink(t, level = 0.25, dest = sfxBus, pitch = 1) {
  for (const [freq, decay] of [[2240, 1.1], [3410, 0.8], [4720, 0.55], [6150, 0.35]]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * pitch * rand(0.98, 1.02);
    osc.connect(envelope(t, level / 2, 0.002, decay, dest));
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

function thud(t, level = 0.4, freq = 120) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.12);
  osc.connect(envelope(t, level, 0.003, 0.14));
  osc.start(t);
  osc.stop(t + 0.2);
}

const sfx = {
  serve({ oz = 5, beer = false }) {
    const t = ctx.currentTime;
    // The pour: a stream of noise whose resonance climbs as the glass fills.
    const dur = Math.min(1.4, 0.35 + oz * 0.07);
    const src = noiseSource();
    const bp = filter("bandpass", 500, beer ? 3 : 6);
    bp.frequency.setValueAtTime(450, t);
    bp.frequency.exponentialRampToValueAtTime(beer ? 1500 : 2400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(pan(-0.5, sfxBus));
    src.start(t);
    src.stop(t + dur + 0.05);
    if (beer) {
      // Fizz settling.
      const fizz = noiseSource();
      fizz.connect(filter("highpass", 5000)).connect(envelope(t + dur * 0.6, 0.05, 0.1, 1.2, pan(-0.5, sfxBus)));
      fizz.start(t + dur * 0.6);
      fizz.stop(t + dur + 1.5);
    }
    // Slide across the table.
    const slideAt = t + dur;
    const slide = noiseSource();
    slide.connect(filter("bandpass", 900, 0.7)).connect(envelope(slideAt, 0.12, 0.05, 0.55));
    slide.start(slideAt);
    slide.stop(slideAt + 0.7);
    thud(slideAt + 0.62, 0.18, 160);
    clink(slideAt + 0.62, 0.05);
    return dur;
  },

  drink({ pace, hold }) {
    const t = ctx.currentTime;
    if (pace === "sip") {
      // A little slurp.
      const src = noiseSource();
      const bp = filter("bandpass", 1200, 4);
      bp.frequency.setValueAtTime(1200, t + 0.1);
      bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
      src.connect(bp).connect(envelope(t + 0.1, 0.12, 0.05, 0.35));
      src.start(t + 0.1);
      src.stop(t + 0.6);
      return;
    }
    const gap = pace === "chug" ? 0.26 : 0.45;
    for (let at = 0.1; at < hold - 0.1; at += gap * rand(0.85, 1.15)) {
      const s = t + at;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(rand(170, 210), s);
      osc.frequency.exponentialRampToValueAtTime(rand(80, 95), s + 0.09);
      osc.connect(envelope(s, 0.35, 0.008, 0.1));
      osc.start(s);
      osc.stop(s + 0.15);
    }
    if (pace === "chug" && Math.random() < 0.4) sfx.burp(t + hold + 0.9);
  },

  burp(t = ctx.currentTime) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(95 * voicePitch, t);
    osc.frequency.linearRampToValueAtTime(70 * voicePitch, t + 0.45);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 23;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    wobble.connect(depth).connect(osc.frequency);
    const formant = filter("bandpass", 450, 3);
    osc.connect(formant).connect(envelope(t, 0.5, 0.03, 0.5));
    osc.start(t);
    wobble.start(t);
    osc.stop(t + 0.6);
    wobble.stop(t + 0.6);
  },

  hiccup() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(330 * voicePitch, t);
    osc.frequency.exponentialRampToValueAtTime(720 * voicePitch, t + 0.06);
    osc.connect(filter("bandpass", 1100 * voicePitch, 2)).connect(envelope(t, 0.4, 0.01, 0.12));
    osc.start(t);
    osc.stop(t + 0.18);
    const air = noiseSource();
    air.connect(filter("highpass", 2500)).connect(envelope(t, 0.08, 0.005, 0.05));
    air.start(t);
    air.stop(t + 0.08);
  },

  setdown() {
    const t = ctx.currentTime;
    thud(t, 0.25, 140);
    clink(t + 0.005, 0.07, sfxBus, 0.8);
  },

  step() {
    const t = ctx.currentTime;
    thud(t, 0.22, rand(65, 85));
    const scuff = noiseSource();
    scuff.connect(filter("bandpass", 1800, 1)).connect(envelope(t, 0.03, 0.005, 0.06));
    scuff.start(t);
    scuff.stop(t + 0.1);
  },

  fries() {
    const t = ctx.currentTime;
    thud(t + 0.75, 0.35, 90);
    clink(t + 0.76, 0.06, sfxBus, 0.55);
  },

  snoreStart() {
    if (snoring) return;
    snoring = setInterval(snoreCycle, 3800);
    snoreCycle();
  },
};

function snoreCycle() {
  if (!running()) return;
  const t = ctx.currentTime + 0.05;
  // Inhale: a raspy buzz through a nasal formant.
  const buzz = ctx.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.setValueAtTime(58 * voicePitch, t);
  buzz.frequency.linearRampToValueAtTime(72 * voicePitch, t + 1.3);
  const rasp = noiseSource();
  const nasal = filter("bandpass", 380 * voicePitch, 2.5);
  const inhale = ctx.createGain();
  inhale.gain.setValueAtTime(0.0001, t);
  inhale.gain.exponentialRampToValueAtTime(0.3, t + 1.0);
  inhale.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  const raspGain = ctx.createGain();
  raspGain.gain.value = 0.4;
  buzz.connect(nasal);
  rasp.connect(raspGain).connect(nasal);
  nasal.connect(inhale).connect(sfxBus);
  buzz.start(t);
  rasp.start(t);
  buzz.stop(t + 1.6);
  rasp.stop(t + 1.6);
  // Exhale: a soft "pfff".
  const out = noiseSource();
  out.connect(filter("bandpass", 1600, 0.8)).connect(envelope(t + 1.8, 0.07, 0.3, 1.2));
  out.start(t + 1.8);
  out.stop(t + 3.4);
}

// ---------- ambience ----------

function startAmbience() {
  // Room tone.
  const room = noiseSource(brownBuffer);
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.18;
  room.connect(filter("lowpass", 220)).connect(roomGain).connect(ambienceBus);
  room.start();

  // Crowd murmur: a few formant bands of noise, each breathing at its own rate.
  for (const [freq, side] of [[480, -0.6], [950, 0.5], [1500, -0.2], [700, 0.8]]) {
    const src = noiseSource();
    const bp = filter("bandpass", freq, 1.4);
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(0.15, 0.6);
    const depth = ctx.createGain();
    depth.gain.value = 0.025;
    lfo.connect(depth).connect(g.gain);
    src.connect(bp).connect(g).connect(pan(side, ambienceBus));
    src.start();
    lfo.start();
  }

  // Distant glasses around the room.
  const distantClink = () => {
    if (!ctx) return;
    if (!running()) return void setTimeout(distantClink, 2000);
    const t = ctx.currentTime + 0.05;
    const dest = pan(rand(-0.9, 0.9), ambienceBus);
    clink(t, rand(0.02, 0.05), dest, rand(0.8, 1.2));
    if (Math.random() < 0.4) clink(t + rand(0.05, 0.12), rand(0.02, 0.04), dest, rand(0.8, 1.2));
    setTimeout(distantClink, rand(2500, 8000));
  };
  setTimeout(distantClink, 1500);

  startJukebox();
}

// A muffled jukebox through the wall: soft electric-piano chords and a bass line.
function startJukebox() {
  const out = ctx.createGain();
  out.gain.value = 0.11;
  const muffle = filter("lowpass", 950, 0.7);
  muffle.connect(out).connect(pan(0.35, ambienceBus));
  const beat = 60 / 76;
  const progression = [
    [57, [60, 64, 69]], // Am
    [53, [60, 65, 69]], // F
    [48, [60, 64, 67]], // C
    [55, [59, 62, 67]], // G
  ];
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  let bar = 0;
  let next = ctx.currentTime + 0.2;

  const note = (freq, t, len, level, type = "sine") => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g).connect(muffle);
    osc.start(t);
    osc.stop(t + len + 0.05);
  };

  const schedule = () => {
    if (!ctx) return;
    if (!running()) return void setTimeout(schedule, 500);
    // After a stall or a suspend, skip the missed bars instead of firing them all at once.
    if (next < ctx.currentTime) next = ctx.currentTime + 0.1;
    while (next < ctx.currentTime + 1.5) {
      const [bass, chord] = progression[bar % progression.length];
      for (let b = 0; b < 4; b++) {
        const t = next + b * beat;
        note(midi(bass - 12), t, beat * 0.9, 0.5, "triangle");
        if (b % 2 === 0) for (const n of chord) note(midi(n), t + 0.01 * Math.random(), beat * 1.8, 0.12, "sine");
        if (b === 3 && Math.random() < 0.5) note(midi(chord[2] + 12), t + beat / 2, beat * 0.8, 0.06, "triangle");
      }
      next += beat * 4;
      bar++;
    }
    setTimeout(schedule, 500);
  };
  schedule();
}

// ---------- public API ----------

// Muted (or hidden) means suspended, so nothing renders and the battery is spared.
function applyMute() {
  if (!ctx) return;
  master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  if (muted) setTimeout(() => muted && ctx.suspend(), 250);
  else if (!document.hidden) ctx.resume();
}

document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (!muted) ctx.resume();
});

// iOS can leave the context suspended or "interrupted" after a call or screen lock.
addEventListener("pointerdown", () => {
  if (ctx && !muted && !document.hidden && ctx.state !== "running") ctx.resume();
});

export const audio = {
  // Must run inside a user gesture (browsers block audio until then).
  start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    started = true;
    ctx = new AC();
    if (navigator.audioSession) navigator.audioSession.type = "playback"; // play even with the ringer off
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    master.connect(limiter).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    ambienceBus = ctx.createGain();
    ambienceBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambienceBus.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 1.5);
    ambienceBus.connect(master);
    noiseBuffer = makeNoise(3);
    brownBuffer = makeNoise(4, true);
    startAmbience();
    if (muted) ctx.suspend();
    else ctx.resume();
  },

  setVoice(gender) {
    voicePitch = gender === "woman" ? 1.35 : 1;
  },

  play(name, data = {}) {
    if (!sfx[name]) return;
    // Snoring keeps its own timer and resumes on unmute; one-shots are dropped rather than queued.
    if (name === "snoreStart" ? !ctx : !running()) return;
    try {
      return sfx[name](data);
    } catch (err) {
      console.warn("audio:", err);
    }
  },

  // Dim the bar while they're out cold so the snoring carries.
  duck() {
    if (ambienceBus) ambienceBus.gain.setTargetAtTime(0.35, ctx.currentTime, 1.5);
  },

  get muted() {
    return muted;
  },

  toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {}
    applyMute();
    return muted;
  },
};
