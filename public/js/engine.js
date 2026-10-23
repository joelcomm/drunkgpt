// Drink menu and blood-alcohol model (Widmark formula, simulated minute by minute).

export const DRINKS = [
  { id: "lager", name: "Light Lager", emoji: "🍺", oz: 12, abv: 4.2, glass: "pint", color: 0xf2c14e, mood: "beer", words: ["lager", "beer"] },
  { id: "ipa", name: "IPA", emoji: "🍻", oz: 16, abv: 6.5, glass: "pint", color: 0xd98a1f, mood: "beer", words: ["ipa"] },
  { id: "wine", name: "Red Wine", emoji: "🍷", oz: 5, abv: 13.5, glass: "wine", color: 0x7a1026, mood: "wine", words: ["wine", "merlot", "cabernet"] },
  { id: "champagne", name: "Champagne", emoji: "🥂", oz: 5, abv: 12, glass: "flute", color: 0xf3df96, mood: "champagne", words: ["champagne", "bubbly", "prosecco"] },
  { id: "whiskey", name: "Whiskey, neat", emoji: "🥃", oz: 2, abv: 40, glass: "rocks", color: 0xb8641c, mood: "whiskey", words: ["whiskey", "whisky", "bourbon", "scotch"] },
  { id: "tequila", name: "Tequila Shot", emoji: "🌵", oz: 1.5, abv: 40, glass: "shot", color: 0xf2e9c4, mood: "tequila", words: ["tequila"] },
  { id: "vodka", name: "Vodka Shot", emoji: "❄️", oz: 1.5, abv: 40, glass: "shot", color: 0xe6f2ff, mood: "vodka", words: ["vodka"] },
  { id: "martini", name: "Gin Martini", emoji: "🍸", oz: 3, abv: 32, glass: "martini", color: 0xe4ecd0, mood: "gin", words: ["martini", "gin"] },
  { id: "margarita", name: "Margarita", emoji: "🍹", oz: 6, abv: 13, glass: "rocks", color: 0xc6e36a, mood: "tequila", words: ["margarita"] },
  { id: "rumcoke", name: "Rum & Coke", emoji: "🥤", oz: 8, abv: 8, glass: "highball", color: 0x4a1e0f, mood: "rum", words: ["rum", "cuba libre"] },
  { id: "longisland", name: "Long Island Iced Tea", emoji: "🧉", oz: 8, abv: 22, glass: "highball", color: 0x9a5a22, mood: "chaos", words: ["long island"] },
  { id: "water", name: "Water", emoji: "💧", oz: 12, abv: 0, glass: "highball", color: 0xd6ecff, mood: null, words: ["water"] },
];

// portion: share of a full glass per "drink" command. halfLife: minutes for half of what's in the stomach to reach the blood.
// ozPerMin and minMinutes set how much clock time a pull takes, so volume costs time.
export const PACES = {
  sip: { label: "Sip", portion: 1 / 3, ozPerMin: 0.35, minMinutes: 4, halfLife: 11, verb: "sipped" },
  normal: { label: "Normal", portion: 1 / 2, ozPerMin: 0.8, minMinutes: 3, halfLife: 7, verb: "drank" },
  chug: { label: "Chug", portion: 1, ozPerMin: 3, minMinutes: 2, halfLife: 4, verb: "chugged" },
};

export const POURS = {
  light: { label: "Short", factor: 0.75 },
  standard: { label: "Standard", factor: 1 },
  double: { label: "Double", factor: 2 },
};

const KIND = { pint: "beer", wine: "wine", flute: "wine", shot: "spirit", martini: "spirit" };
const COCKTAILS = new Set(["margarita", "rumcoke", "longisland"]);
const EXTRA_SPIRIT_OZ = 1.5;

// A poured glass. Doubles add spirit (not volume) to cocktails and mean a large pour for beer and wine.
export function pourGlass(drink, pourKey) {
  let oz = drink.oz, abv = drink.abv, label = "";
  if (drink.abv > 0 && pourKey !== "standard") {
    const kind = COCKTAILS.has(drink.id) ? "cocktail" : KIND[drink.glass] ?? "spirit";
    if (kind === "cocktail") {
      const spirit = pourKey === "double" ? EXTRA_SPIRIT_OZ : -EXTRA_SPIRIT_OZ / 3;
      abv = (oz * abv + spirit * 40) / (oz + spirit);
      oz += spirit;
      label = pourKey === "double" ? "with a double shot" : "made weak";
    } else if (kind === "spirit") {
      oz *= POURS[pourKey].factor;
      label = pourKey === "double" ? "double" : "short pour";
    } else {
      oz *= pourKey === "double" ? 1.5 : 0.75;
      label = pourKey === "double" ? "large pour" : "short pour";
    }
  }
  return { drink, abv, fullOz: oz, remainingOz: oz, label };
}

export const STAGES = [
  { key: "sober", below: 0.02, label: "Sober", color: "#7fd18b" },
  { key: "buzzed", below: 0.05, label: "Buzzed", color: "#c4e06a" },
  { key: "tipsy", below: 0.08, label: "Tipsy", color: "#f2c14e" },
  { key: "drunk", below: 0.15, label: "Drunk", color: "#f08a3c" },
  { key: "wasted", below: 0.22, label: "Wasted", color: "#e8504a" },
  { key: "blackout", below: 0.3, label: "Barely Conscious", color: "#c03a8a" },
  { key: "passedout", below: Infinity, label: "Passed Out", color: "#8a6cff" },
];

export const MOOD_LABELS = {
  beer: "Chummy (beer)",
  wine: "Sappy (wine)",
  whiskey: "Confessional (whiskey)",
  tequila: "Rowdy (tequila)",
  vodka: "Hyper (vodka)",
  gin: "Weepy (gin)",
  rum: "Goofy (rum)",
  champagne: "Giggly (bubbly)",
  chaos: "Chaos (Long Island)",
};

// Alcohol already in the stomach this far past the line means they're going down.
const PASS_OUT_PROJECTED = 0.34;

const WIDMARK_R = { man: 0.68, woman: 0.55 };
const ELIMINATION_PER_MIN = 0.015 / 60; // % BAC per minute
const GRAMS_PER_OZ_ETHANOL = 29.5735 * 0.789;
const FOOD_WINDOW_MIN = 120;
const FED_SLOWDOWN = 2.2;
const START_HOUR = 21;

// Whole-word match so "beginnings" isn't gin and "drum" isn't rum.
const DRINK_WORD_RES = DRINKS.map((d) => [d, new RegExp(`\\b(${d.words.join("|")})s?\\b`, "i")]);
export const findDrinkInText = (text) => DRINK_WORD_RES.find(([, re]) => re.test(text))?.[0] ?? null;

export function stageFor(bac) {
  return STAGES.find((s) => bac < s.below);
}

export class Night {
  constructor({ gender, weightLbs }) {
    this.r = WIDMARK_R[gender] ?? WIDMARK_R.man;
    this.bodyGrams = weightLbs * 453.592;
    this.minutes = 0;
    this.bac = 0;
    this.peak = 0;
    this.doses = []; // { grams, start, duration, mood }
    this.lastFoodAt = -Infinity;
    this.water = 0;
    this.consumed = new Map(); // drink name -> glasses (fractional)
  }

  get fed() {
    return this.minutes - this.lastFoodAt < FOOD_WINDOW_MIN;
  }

  get stage() {
    return stageFor(this.bac);
  }

  get standardDrinks() {
    return this.doses.reduce((sum, d) => sum + d.rawGrams, 0) / 14;
  }

  // BAC once everything already drunk is absorbed (ignoring elimination).
  get projectedBac() {
    const pending = this.doses.reduce((sum, d) => sum + d.remaining, 0);
    return this.bac + (pending / (this.bodyGrams * this.r)) * 100;
  }

  get passingOut() {
    return this.bac >= 0.3 || this.projectedBac >= PASS_OUT_PROJECTED;
  }

  get rising() {
    return this.doses.some((d) => d.remaining > 0.25);
  }

  get clock() {
    const total = START_HOUR * 60 + this.minutes;
    const h24 = Math.floor(total / 60) % 24;
    const m = String(total % 60).padStart(2, "0");
    return `${h24 % 12 || 12}:${m} ${h24 < 12 ? "AM" : "PM"}`;
  }

  // Strongest recent booze influence; drinks in the last hour count double.
  get mood() {
    const weights = {};
    for (const d of this.doses) {
      if (!d.mood) continue;
      weights[d.mood] = (weights[d.mood] ?? 0) + d.rawGrams * (this.minutes - d.start < 60 ? 2 : 1);
    }
    return Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  // Drinks part of `glass` ({ drink, fullOz, remainingOz }) at the given pace.
  drink(glass, paceKey) {
    const pace = PACES[paceKey];
    const portion = glass.drink.glass === "shot" && paceKey !== "sip" ? 1 : pace.portion;
    let oz = Math.min(glass.remainingOz, glass.fullOz * portion);
    if (glass.remainingOz - oz < glass.fullOz * 0.05) oz = glass.remainingOz;
    glass.remainingOz -= oz;

    const rawGrams = oz * GRAMS_PER_OZ_ETHANOL * (glass.abv / 100);
    if (rawGrams > 0) {
      // Empty stomach: absorption is front-loaded, so a chugged double hits within minutes.
      // Food slows it and trims the peak (first-pass metabolism).
      const fed = this.fed;
      this.doses.push({
        rawGrams,
        remaining: rawGrams * (fed ? 0.8 : 1),
        halfLife: pace.halfLife * (fed ? FED_SLOWDOWN : 1),
        slowed: fed,
        start: this.minutes,
        mood: glass.drink.mood,
      });
    } else {
      this.water += oz / glass.fullOz;
    }
    const name = glass.drink.name;
    this.consumed.set(name, (this.consumed.get(name) ?? 0) + oz / (glass.drink.oz));
    this.advance(Math.max(pace.minMinutes, Math.ceil(oz / pace.ozPerMin)));
    return { oz, fraction: oz / glass.fullOz, emptied: glass.remainingOz <= 0.0001 };
  }

  // Lets the drinks already in the stomach land, stopping when the stage changes. Returns minutes passed.
  advanceToNextStage(maxMinutes = 60) {
    const from = this.stage.key;
    let i = 0;
    for (; i < maxMinutes && this.rising && this.stage.key === from; i++) this.advance(1);
    return i;
  }

  eat() {
    // Food also slows whatever is still sitting in the stomach.
    for (const d of this.doses) {
      if (d.slowed || d.remaining <= 0) continue;
      Object.assign(d, { remaining: d.remaining * 0.85, halfLife: d.halfLife * FED_SLOWDOWN, slowed: true });
    }
    this.lastFoodAt = this.minutes;
    this.advance(10);
  }

  advance(minutes) {
    for (let i = 0; i < minutes; i++) {
      let absorbed = 0;
      for (const d of this.doses) {
        if (d.remaining <= 0) continue;
        const step = d.remaining < 0.05 ? d.remaining : d.remaining * (1 - 2 ** (-1 / d.halfLife));
        d.remaining -= step;
        absorbed += step;
      }
      this.bac += (absorbed / (this.bodyGrams * this.r)) * 100;
      this.bac = Math.max(0, this.bac - ELIMINATION_PER_MIN);
      this.peak = Math.max(this.peak, this.bac);
      this.minutes++;
    }
  }

  promptState(persona) {
    const drinks = [...this.consumed.entries()].map(([name, n]) => {
      const count = Math.round(n * 10) / 10;
      return `${name} x${count}`;
    });
    return {
      name: persona.name,
      gender: persona.gender,
      weightLbs: persona.weightLbs,
      userName: persona.userName,
      bac: this.bac,
      stage: this.stage.key,
      rising: this.rising,
      mood: this.mood,
      drinks,
      fed: this.fed,
      water: Math.round(this.water),
      clock: this.clock,
    };
  }
}
