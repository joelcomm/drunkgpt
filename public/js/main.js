import { createBar, randomLook, isValidLook } from "./scene.js";
import { DRINKS, PACES, MOOD_LABELS, Night, findDrinkInText, pourGlass } from "./engine.js";
import { audio } from "./audio.js";
import { createBarTalk, makeBackstory } from "./bartalk.js";

// The built-in drunk brain runs in the browser for free. Add ?claude to the URL to use Claude through the local server instead.
const USE_CLAUDE = new URLSearchParams(location.search).has("claude");
let talk = null;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bar = createBar($("scene"), {
  onEvent(name, data) {
    if (name === "passout") {
      audio.duck();
      audio.play("snoreStart");
    } else audio.play(name, data);
  },
});

// A drink command has to read like an instruction, not just mention drinking.
const COMMAND_RE = /\b(drink up|drink (it|that|this|your \w+)|have a (drink|sip|swig|gulp|shot)|take a (drink|sip|swig|gulp|shot(?! at))|do (a|the|your) shot|chug|chug it|bottoms up|down (it|that|the \w+|your \w+)|slam (it|that)|knock (it|that) back|sip (it|that|your \w+)|cheers|salud|kanpai|skol|prost|sl[aá]inte|shots shots shots)\b/i;
const BARE_COMMAND_RE = /^\s*(drink|sip|chug|shots?)\s*[!.]*\s*$/i;
const QUESTION_RE = /\?\s*$/;
const NEGATED_RE = /\b(never|don'?t|do not|won'?t|wouldn'?t|shouldn'?t|not|no more|stop)\b[\w\s']{0,16}\b(drink|sip|chug|shot|down|slam)/i;
const CHUG_RE = /\b(chug|slam|down (it|that|the|your)|bottoms up|knock (it|that) back|all of it|in one go)\b/i;
const SIP_RE = /\b(sip|taste|little)\b/i;
const STAGE_DIRECTION_RE = /\(\s*stage direction[^)]*\)?/gi;
const EXPRESSION_TAG = /^\s*\[(\w+)\]\s*/;
const LEAVE_TAG = /\[leave\]/i;
const SAVED_KEY = "drunkgpt-persona";


const persona = { name: "Sam", userName: "", gender: "man", weightLbs: 170, look: randomLook() };
let night = null;
let history = [];
let glass = null; // { drink, fullOz, remainingOz }
let lastDrink = null; // what "another one" means
let pour = "standard";
let pace = "normal";
let busy = false;
let over = false;
let sheet = "chat";
let lastTurnStage = null;
let leaving = false; // the buddy said goodbye with [leave]

// ---------- layout: keep the buddy in the unobstructed part of the screen ----------

const mobile = () => window.matchMedia("(max-width: 900px)").matches;
function updateFrame() {
  const w = window.innerWidth, h = window.innerHeight;
  const rect = { left: 0, right: w, top: 0, bottom: h };
  // offsetParent is always null for position:fixed, so check rendered boxes instead.
  const visible = (id) => !$(id).hidden && $(id).getClientRects().length > 0;
  if (!$("setup").hidden) {
    const card = $("setup").querySelector(".card").getBoundingClientRect();
    if (mobile()) rect.bottom = card.top;
    else rect.left = card.right;
  } else if (mobile()) {
    rect.top = visible("hud") ? $("hud").getBoundingClientRect().bottom : 0;
    rect.bottom = $("sheet-tabs").getBoundingClientRect().top;
  } else {
    if (visible("bar-panel") && !$("bar-panel").classList.contains("collapsed")) rect.left = $("bar-panel").getBoundingClientRect().right;
    if (visible("chat")) rect.right = $("chat").getBoundingClientRect().left;
  }
  bar.setFrame(rect);
  // Subtitles sit inside the same gap.
  const sub = $("subtitle");
  sub.style.left = `${rect.left + 16}px`;
  sub.style.width = `${Math.max(0, rect.right - rect.left - 32)}px`;
  sub.style.bottom = `${h - rect.bottom + 20}px`;
}
window.addEventListener("resize", updateFrame);

// ---------- setup screen ----------

try {
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null");
  if (saved) Object.assign(persona, saved);
} catch {}
if (!isValidLook(persona.look)) persona.look = randomLook();
if (persona.gender !== "man" && persona.gender !== "woman") persona.gender = "man";
$("buddy-name").value = persona.name === "Sam" ? "" : persona.name;
$("user-name").value = persona.userName;
$("weight").value = persona.weightLbs;
segSelect($("gender"), persona.gender);
updateWeight();
applyLook();
updateFrame();

function segSelect(seg, value) {
  for (const b of seg.querySelectorAll("button")) {
    const on = b.dataset.value === value;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}
function onSeg(seg, handler) {
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.preventDefault();
    segSelect(seg, b.dataset.value);
    handler(b.dataset.value);
  });
}
function updateWeight() {
  persona.weightLbs = Number($("weight").value);
  $("weight-out").textContent = `${persona.weightLbs} lb · ${Math.round(persona.weightLbs * 0.4536)} kg`;
}
function applyLook() {
  bar.setLook({ gender: persona.gender, weightLbs: persona.weightLbs, ...persona.look });
}

onSeg($("gender"), (v) => {
  persona.gender = v;
  applyLook();
});
$("weight").addEventListener("input", () => {
  updateWeight();
  applyLook();
});
$("shuffle").addEventListener("click", () => {
  persona.look = randomLook();
  applyLook();
});
$("start").addEventListener("click", startNight);
$("again").addEventListener("click", () => location.reload());
$("restart").addEventListener("click", () => {
  if (!over && !confirm(`Leave ${persona.name} at the bar and start a new night?`)) return;
  location.reload();
});

function startNight() {
  // Sound is a nicety; never let it block the game from starting.
  try {
    audio.start();
    audio.setVoice(persona.gender);
  } catch (err) {
    console.warn("audio unavailable:", err);
  }
  persona.name = $("buddy-name").value.trim() || "Sam";
  persona.userName = $("user-name").value.trim();
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(persona));
  } catch {}
  persona.backstory = makeBackstory();
  persona.bio = persona.backstory.text;
  talk = createBarTalk(persona);
  night = new Night(persona);
  $("setup").hidden = true;
  for (const id of ["hud", "bar-panel", "chat", "sheet-tabs"]) $(id).hidden = false;
  showSheet("chat");
  updateHud();
  addEvent(`🪑 You slide into the booth across from ${persona.name}. It's ${night.clock}.`);
  const who = persona.userName || "Someone new";
  locked(() => runTurn(`(Stage direction: ${who} just sat down across the table from you for a night out. Say hi.)`, { event: { type: "greet" } }));
  if (!mobile()) $("input").focus();
}

// ---------- sound ----------

// Two toggles (setup card and HUD) share one state; aria-pressed carries it, the label stays put.
const muteButtons = [$("mute"), $("setup-mute")];
function renderMute() {
  for (const b of muteButtons) {
    b.textContent = audio.muted ? "🔇" : "🔊";
    b.setAttribute("aria-pressed", String(audio.muted));
    b.title = "Mute sound (M)";
  }
}
for (const b of muteButtons) {
  b.addEventListener("click", () => {
    audio.toggleMute();
    renderMute();
  });
}
// M only applies when nothing in particular has focus, so it can't fire while using a control or typing.
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "m" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (document.activeElement && document.activeElement !== document.body) return;
  audio.toggleMute();
  renderMute();
});
renderMute();

// ---------- mobile sheet tabs ----------

function showSheet(which) {
  sheet = which;
  if (which === "chat") document.querySelector('#sheet-tabs [data-sheet="chat"]').classList.remove("unread");
  document.body.dataset.sheet = which;
  for (const b of $("sheet-tabs").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.sheet === which));
  updateFrame();
  if (which === "chat") scrollLog();
}
$("sheet-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) showSheet(b.dataset.sheet);
});

// ---------- one lock for every action that touches the night ----------

// Every action (and its animations) finishes before anything else, including passing out, can start.
async function locked(action) {
  if (busy || over) return false;
  busy = true;
  setControls();
  try {
    await action();
    if (!over && leaving) await leave();
    else if (!over && night.passingOut) await crashMontage();
  } finally {
    busy = false;
    setControls();
  }
  return true;
}

// Too much went down too fast: let it hit stage by stage so the player still sees the whole slide.
async function crashMontage() {
  const BEATS = {
    tipsy: "(Stage direction: a few minutes pass. That last drink is kicking in and you suddenly feel very loud and very confident.)",
    drunk: "(Stage direction: a few more minutes pass. The room has a gentle tilt to it now and your words are getting slippery.)",
    wasted: "(Stage direction: it's hitting you hard. You knock your elbow on the table and everything is very funny or very sad.)",
    blackout: "(Stage direction: you're fighting to keep your eyes open and can barely hold your head up.)",
  };
  while (night.bac < 0.3 && night.rising) {
    const minutes = night.advanceToNextStage();
    updateHud();
    const beat = BEATS[night.stage.key];
    if (!beat) continue;
    addEvent(`🌀 ${minutes} minutes later, the drinks are hitting ${persona.name} hard. (${night.clock})`);
    await runTurn(beat, { event: { type: "beat" } });
    if (leaving) return leave();
    await sleep(1500);
  }
  if (!night.passingOut) return; // the body handled it after all
  if (lastTurnStage !== "passedout") await runTurn("(Stage direction: the room is spinning and your eyes won't stay open.)", { final: true, event: { type: "passout" } });
  await passOut();
}

// ---------- bartender panel ----------

const menu = $("menu");
for (const drink of DRINKS) {
  const b = document.createElement("button");
  b.dataset.id = drink.id;
  b.title = `${drink.name}: ${drink.oz} oz at ${drink.abv}% ABV`;
  b.setAttribute("aria-label", `Order ${drink.name}, ${drink.abv ? `${drink.abv}% alcohol` : "no alcohol"}`);
  b.innerHTML = `<span class="emoji" aria-hidden="true">${drink.emoji}</span><span>${drink.name}</span><span class="abv">${drink.abv ? `${drink.abv}%` : "H₂O"}</span>`;
  b.addEventListener("click", () => locked(() => serveDrink(drink)));
  menu.append(b);
}
onSeg($("pour"), (v) => (pour = v));
onSeg($("pace"), (v) => {
  pace = v;
  setControls();
});
$("drink-btn").addEventListener("click", () => drinkUp(pace, null));
$("fries").addEventListener("click", () =>
  locked(async () => {
    night.eat();
    bar.serveFries();
    addEvent(`🍟 A basket of fries lands on the table. Food slows the booze down. (${night.clock})`);
    updateHud();
    await runTurn("(Stage direction: a basket of fries just arrived and you dig in.)", { event: { type: "fries" } });
  })
);
$("wait").addEventListener("click", () =>
  locked(async () => {
    const bacBefore = night.bac;
    night.advance(15);
    addEvent(`⏳ 15 minutes drift by. (${night.clock})`);
    updateHud();
    await runTurn("(Stage direction: about fifteen minutes pass. The jukebox changes songs. Pick the conversation back up, or start something new.)", {
      event: { type: "wait", sobering: night.bac < bacBefore - 0.005 },
    });
  })
);
$("bar-toggle").addEventListener("click", () => {
  const collapsed = $("bar-panel").classList.toggle("collapsed");
  $("bar-toggle").textContent = collapsed ? "Show" : "Hide";
  $("bar-toggle").setAttribute("aria-expanded", String(!collapsed));
  updateFrame();
});

async function serveDrink(drink) {
  const leftover = glass && glass.remainingOz > glass.fullOz * 0.05 ? glass : null;
  glass = pourGlass(drink, pour);
  lastDrink = drink;
  for (const b of menu.children) b.classList.toggle("served", b.dataset.id === drink.id);
  const pourNote = glass.label ? ` (${glass.label})` : "";
  const aside = leftover ? ` The unfinished ${leftover.drink.name} gets pushed aside.` : "";
  addEvent(`${drink.emoji} The bartender sets a ${drink.name}${pourNote} in front of ${persona.name}.${aside}`);
  const pourSeconds = audio.play("serve", { oz: glass.fullOz, beer: drink.mood === "beer" }) ?? 0;
  await bar.serve(drink, { delay: pourSeconds });
}

function drinkUp(paceKey, userText) {
  return locked(async () => {
    if (userText) addMessage("you", userText);
    const named = userText ? findDrinkInText(userText) : null;
    if (!glass || (named && named.id !== glass.drink.id)) await serveDrink(named ?? lastDrink ?? DRINKS[0]);

    const g = glass;
    const before = g.remainingOz / g.fullOz;
    const result = night.drink(g, paceKey);
    const after = g.remainingOz / g.fullOz;
    if (result.emptied) {
      glass = null;
      for (const b of menu.children) b.classList.remove("served");
    }
    const amount = result.emptied && before > 0.99 ? "all of" : result.emptied ? "the rest of" : result.fraction > 0.45 ? "about half of" : "a bit of";
    const who = persona.userName || "The user";
    const direction = `(Stage direction: ${who} told you to drink, so you ${PACES[paceKey].verb} ${amount} your ${g.drink.name}${result.emptied ? ". The glass is empty now" : ""}.)`;
    addEvent(`${userText ? "" : '🥂 "Drink up!" '}${persona.name} ${PACES[paceKey].verb} ${amount} the ${g.drink.name}. (${night.clock})`);
    updateHud();
    await Promise.all([bar.drink(paceKey, before, after), runTurn(userText ? `${userText}\n\n${direction}` : direction, { event: { type: "drink", drink: g.drink, pace: paceKey, text: userText } })]);
  });
}

// ---------- chat ----------

function isDrinkCommand(text) {
  if (BARE_COMMAND_RE.test(text)) return true;
  if (NEGATED_RE.test(text)) return false;
  if (QUESTION_RE.test(text) && !/\b(drink up|bottoms up|chug)\b/i.test(text)) return false;
  return COMMAND_RE.test(text);
}

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("input");
  const text = input.value.replace(STAGE_DIRECTION_RE, "").trim();
  if (!text || over) return;
  if (busy) {
    // Keep the draft and nudge the player instead of silently eating Enter.
    input.classList.remove("nudge");
    void input.offsetWidth;
    input.classList.add("nudge");
    return;
  }
  input.value = "";
  if (isDrinkCommand(text)) {
    const p = CHUG_RE.test(text) ? "chug" : SIP_RE.test(text) ? "sip" : pace;
    drinkUp(p, text);
  } else {
    locked(() => {
      addMessage("you", text);
      night.advance(3);
      updateHud();
      return runTurn(text, { event: { type: "say", text } });
    });
  }
});

function addMessage(kind, text) {
  const el = document.createElement("div");
  el.className = `msg ${kind}`;
  el.textContent = text;
  $("log").append(el);
  scrollLog();
  return el;
}
const addEvent = (text) => addMessage("event", text);
function scrollLog() {
  $("log").scrollTop = $("log").scrollHeight;
}

function renderBuddy(el, text) {
  el.replaceChildren();
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = persona.name;
  el.append(who);
  // *actions* render in italics.
  for (const [i, part] of text.split(/(\*[^*]+\*)/g).entries()) {
    if (!part) continue;
    if (i % 2) {
      const em = document.createElement("em");
      em.textContent = part;
      el.append(em);
    } else el.append(part);
  }
}

let subtitleTimer;
function showSubtitle(text) {
  const sub = $("subtitle");
  // Subtitles show only the tail of a long line so they never bury the scene; the chat has the rest.
  let line = text.replace(/\*[^*]+\*/g, "").replace(/\s+/g, " ").trim();
  if (line.length > 140) {
    const sentences = line.match(/[^.!?]+[.!?]*\s*/g) ?? [line];
    line = "";
    while (sentences.length && (line.length + sentences.at(-1).length <= 140 || !line)) line = sentences.pop() + line;
    if (line.length > 160) line = "…" + line.slice(-150);
  }
  sub.textContent = line.trim();
  sub.classList.toggle("show", Boolean(sub.textContent));
  clearTimeout(subtitleTimer);
  subtitleTimer = setTimeout(() => sub.classList.remove("show"), 4000 + sub.textContent.length * 60);
}

// One exchange with the buddy. Callers hold the lock.
async function runTurn(content, { final = false, event = { type: "say", text: content } } = {}) {
  lastTurnStage = final ? "passedout" : night.stage.key;
  history.push({ role: "user", content });

  for (const old of document.querySelectorAll(".msg.buddy.latest")) old.classList.remove("latest");
  const el = addMessage("buddy typing latest", "");
  renderBuddy(el, "");
  let raw = "";
  let reply = "";
  let failed = null;
  try {
    const chunks = USE_CLAUDE ? claudeReply() : builtInReply(event);
    bar.setTalking(true);
    for await (const value of chunks) {
      raw += value;
      const errAt = raw.indexOf("[[error]]");
      if (errAt !== -1) {
        failed = raw.slice(errAt + 9).trim();
        raw = raw.slice(0, errAt);
      }
      reply = displayText(raw);
      renderBuddy(el, reply);
      scrollLog();
    }
  } catch (err) {
    failed = USE_CLAUDE ? `Couldn't reach the bar's server (${err.message}). Is it still running?` : `Something went wrong: ${err.message}`;
  }
  bar.setTalking(false);
  el.classList.remove("typing");

  if (!reply.trim()) {
    el.remove();
    history.pop(); // keep roles alternating so the next turn still works
  } else {
    history.push({ role: "assistant", content: raw.trim() });
    if (LEAVE_TAG.test(raw)) leaving = true;
    showSubtitle(reply);
    if (sheet !== "chat") document.querySelector('#sheet-tabs [data-sheet="chat"]').classList.add("unread");
    $("announce").textContent = `${persona.name}: ${reply.replace(/\*[^*]+\*/g, "")}`;
  }
  if (failed) addMessage("error", failed);
}

// Streams Claude's reply through the local server (opt-in with ?claude).
async function* claudeReply() {
  const res = await fetch("api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: { ...night.promptState(persona), stage: lastTurnStage, bio: persona.bio }, messages: history }),
  });
  if (!res.ok || !res.body) throw new Error(`server said ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    yield value;
  }
}

// The built-in brain answers instantly; "type" it out word by word, slower the drunker they are.
async function* builtInReply(event) {
  const { text, expression, leave } = talk.respond(event, { stage: lastTurnStage, mood: night.mood, sobering: event.sobering });
  await sleep(350 + Math.random() * 400);
  yield `[${expression}] `;
  const delay = 45 + (night.stage.key === "sober" ? 0 : 25) + Math.min(60, night.bac * 250);
  for (const word of text.split(/(?<= )/)) {
    yield word;
    await sleep(delay);
  }
  if (leave) yield " [leave]";
}

// Strips the leading [expression] tag and drives the avatar's face with it.
function displayText(raw) {
  // Hide the [leave] tag, including a half-streamed one at the very end.
  const trimmed = raw.replace(LEAVE_TAG, "").replace(/\s*\[[a-z]{0,5}$/i, "").trimStart();
  if (trimmed.startsWith("[")) {
    const m = trimmed.match(EXPRESSION_TAG);
    if (m) {
      bar.setExpression(m[1].toLowerCase());
      return trimmed.slice(m[0].length);
    }
    if (!trimmed.includes("]") && trimmed.length < 14) return "";
  }
  return trimmed;
}

// ---------- state + HUD ----------

function updateHud() {
  const stage = night.stage;
  bar.setBac(night.bac);
  document.body.dataset.stage = stage.key;
  document.documentElement.style.setProperty("--stage", stage.color);
  $("bac").textContent = night.bac.toFixed(3);
  $("bac-fill").style.width = `${Math.min(100, (night.bac / 0.3) * 100)}%`;
  $("bac-ghost").style.width = over ? "0" : `${Math.min(100, (night.projectedBac / 0.3) * 100)}%`;
  $("bac-ghost").title = `Still kicking in: heading toward ${night.projectedBac.toFixed(3)}%`;
  $("stage").textContent = stage.label;
  $("trend").hidden = over || !night.rising;
  $("clock").textContent = night.clock;
  $("std-drinks").textContent = night.standardDrinks.toFixed(1);
  $("mood").textContent = MOOD_LABELS[night.mood] ?? "-";
}

function setControls() {
  const lock = busy || over;
  document.body.classList.toggle("busy", busy && !over);
  $("drink-btn").disabled = lock;
  $("send").disabled = lock;
  $("input").disabled = over;
  $("input").placeholder = over ? (leaving ? `${persona.name} went home.` : `${persona.name} is out cold.`) : busy ? `${persona.name} is busy…` : "Say something… or tell them to drink";
  for (const b of menu.children) b.disabled = lock;
  for (const id of ["fries", "wait"]) $(id).disabled = lock;
  $("drink-btn").textContent = pace === "chug" ? "🥂 Chug it!" : pace === "sip" ? "🥂 Take a sip" : "🥂 Drink up!";
}

async function passOut() {
  if (over) return;
  over = true;
  setControls();
  updateHud();
  $("stage").textContent = "Passed Out";
  document.documentElement.style.setProperty("--stage", "#8a6cff");
  addEvent(`💤 ${persona.name} slumps onto the table. Out cold at ${night.clock}.`);
  await bar.passOut();
  showEndCard(
    "💤 Out cold",
    `${persona.name} passed out at ${night.clock} after ${night.standardDrinks.toFixed(1)} standard drinks, peaking at ${night.peak.toFixed(3)}% BAC.`,
    true
  );
}

// They said goodbye, so they actually get up and go.
async function leave() {
  if (over) return;
  over = true;
  setControls();
  updateHud();
  $("trend").hidden = true;
  addEvent(`🚪 ${persona.name} grabs their things and heads out the door. (${night.clock})`);
  await bar.leave();
  showEndCard(
    "👋 Gone home",
    night.standardDrinks < 0.05
      ? `${persona.name} walked out at ${night.clock} before you even bought a round.`
      : `${persona.name} called it a night at ${night.clock} after ${night.standardDrinks.toFixed(1)} standard drinks, peaking at ${night.peak.toFixed(3)}% BAC.`,
    false
  );
}

function showEndCard(title, summary, poisoningNote) {
  $("go-title").textContent = title;
  $("go-summary").textContent = summary;
  $("go-fine").hidden = !poisoningNote;
  const showCard = () => {
    clearTimeout(timer);
    removeEventListener("pointerdown", showCard);
    removeEventListener("keydown", showCard);
    $("gameover").hidden = false;
    $("again").focus();
  };
  const timer = setTimeout(showCard, 4000);
  addEventListener("pointerdown", showCard);
  addEventListener("keydown", showCard);
}

setControls();
