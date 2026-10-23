// The built-in drunk: an ELIZA-style pattern matcher with a big line library and a slurring filter.
// Runs entirely in the browser: no API, no server, no cost.

const STAGE_LEVEL = { sober: 0, buzzed: 0.15, tipsy: 0.35, drunk: 0.6, wasted: 0.85, blackout: 1, passedout: 1 };
const rand = (n) => Math.floor(Math.random() * n);
const chance = (p) => Math.random() < p;

// ---------- who they are tonight ----------

const BACKSTORIES = {
  job: [
    { text: "a wedding DJ", lines: ["I DJ weddings. I have played the Cha-Cha Slide four hundred times. I have seen things.", "I'm a wedding DJ. Every Saturday I watch an uncle do the worm. Every. Saturday."] },
    { text: "a night-shift ER nurse", lines: ["ER nurse, night shift. Tonight nobody gets stitches, especially me.", "I'm a nurse. I've seen what tequila does to people. And here I am!"] },
    { text: "a tattoo artist", lines: ["I'm a tattoo artist. I could draw a dolphin on you right now. Don't let me.", "Tattoo artist. Eleven years. My boss still calls my linework 'cute'."] },
    { text: "a high-school chemistry teacher", lines: ["I teach high-school chemistry. Technically this drink is a solution. Technically I am a problem.", "Chem teacher. Thirty sophomores and one fire extinguisher, every single day."] },
    { text: "a long-haul trucker on a week off", lines: ["I drive an eighteen-wheeler. Week off. I'm parked in this booth and I'm not moving.", "Trucker. Twelve years. Know every truck stop pie from here to Tulsa."] },
    { text: "a museum security guard", lines: ["I guard a museum. Mostly I stand next to a dinosaur and tell kids not to touch it.", "Museum security. Me and a T. rex, all night. He's a great listener."] },
    { text: "a startup founder who just got funded", lines: ["I run a startup. Uber, but for... honestly I've forgotten. We got funded though!", "I'm a founder. Which means I'm unemployed with a logo."] },
  ],
  from: ["Duluth", "Tucson", "a tiny town outside Nashville", "Queens", "Baton Rouge", "Winnipeg", "Boise", "Jersey"],
  quirk: [
    { text: "rates everything out of ten", lines: ["This bar? Seven out of ten. You? Solid eight. Climbing.", "I rate everything. That napkin? A four. Respectfully."] },
    { text: "is convinced birds are spying on people", lines: ["Don't look now, but that pigeon on the windowsill? Government.", "Birds aren't real. Okay, they're real. But they're WATCHING."] },
    { text: "knows way too much about the Roman Empire", lines: ["You know the Romans had bars? Tabernae. I think about Rome a normal amount. Daily.", "Fun fact: Romans watered down their wine. Cowards."] },
    { text: "keeps almost telling a story about a goat", lines: ["Remind me to tell you about the goat. Not now. The goat story needs fries.", "So there was this goat... no. No, you're not ready for the goat."] },
    { text: "has strong opinions about cereal", lines: ["Cereal is a soup. I will die on this hill.", "Raisin bran is cereal for people who have given up."] },
  ],
  secret: [
    { text: "got dumped last week and is pretending to be fine", lines: ["Okay. Truth? I got dumped last week. Over TEXT. I'm fine. I'm totally fine.", "My ex left me for a guy who owns a boat. A BOAT."] },
    { text: "is quitting their job on Monday", lines: ["Don't tell anyone, but Monday morning? I'm walking in and quitting. Boom. Done.", "I'm quitting Monday. I've already practiced the speech in the shower. Twice."] },
    { text: "secretly writes poetry", lines: ["I write poetry. Bad poetry. 'Oh moon, you round cheese.' That's one of them.", "Secret: I have a notebook full of poems about my cat."] },
    { text: "once panicked in front of a celebrity", lines: ["I met a celebrity once and said 'you too' when they said 'nice to meet you'. Then I ran.", "I spilled a smoothie on a famous chef. I won't say who. It was Gordon."] },
    { text: "is terrified of being boring", lines: ["Am I boring? Be honest. Wait, don't be honest.", "My biggest fear is being boring. That and geese."] },
  ],
};

export function makeBackstory() {
  const job = BACKSTORIES.job[rand(BACKSTORIES.job.length)];
  const from = BACKSTORIES.from[rand(BACKSTORIES.from.length)];
  const quirk = BACKSTORIES.quirk[rand(BACKSTORIES.quirk.length)];
  const secret = BACKSTORIES.secret[rand(BACKSTORIES.secret.length)];
  return {
    job,
    from,
    quirk,
    secret,
    text: `You're ${job.text} from ${from}. You ${quirk.text}. Something you'd only admit after a few drinks: you ${secret.text}.`,
  };
}

// ---------- the line library ----------
// Each line can start with an [expression] tag; {you} is the player's name, {me} the buddy's.

const DRINK_LINES = {
  beer: ["[happy] *wipes foam off lip* Ahh. Cold beer, warm company.", "[happy] That's the stuff. Tastes like a Saturday afternoon.", "[laugh] Beer! The official drink of telling the same story twice."],
  wine: ["[love] *swirls glass* Notes of... grape. And feelings. Mostly feelings.", "[happy] Wine makes me want to call my mom. Or a lawyer. Haven't decided.", "[love] This wine is like a hug from a vineyard."],
  champagne: ["[laugh] *giggles* The bubbles went up my NOSE!", "[happy] Bubbles! We're celebrating! What are we celebrating? Doesn't matter!", "[laugh] Champagne makes me feel rich. I am not rich. Shh."],
  whiskey: ["[neutral] *exhales slowly* That one tasted like my grandpa's den.", "[neutral] Whiskey's for telling the truth. So here's one: your eyebrows are incredible.", "[happy] *growls* Ohh, that warms you right down to the boots."],
  tequila: ["[laugh] WOOO! That one had TEETH!", "[surprised] *shudders violently* Oh, that's a bad decision in a glass. Pour another.", "[laugh] TEQUILA! Somebody hold my earrings!", "[surprised] My eyes are watering. My soul is watering. WOOO!"],
  vodka: ["[surprised] *blinks rapidly* Oh, that's just liquid winter.", "[laugh] Vodka! Clear, like my conscience. Which is not clear.", "[surprised] Whoa. That went straight to my eyebrows."],
  gin: ["[sad] *sniffs* Gin always makes me a little sad. In a nice way.", "[neutral] Tastes like a Christmas tree that's been through some things.", "[sad] Gin is just sad vodka with a fancy hat."],
  rum: ["[laugh] Rum! Arr! I don't know why I said arr.", "[happy] This tastes like a vacation I can't afford.", "[laugh] Yo ho ho and a bottle of... this. Arr."],
  chaos: ["[surprised] That had EVERYTHING in it. I can taste the whole bar.", "[laugh] Long Island Iced Tea. There's no tea in it. That's the first lie of the night.", "[surprised] *coughs* Who MADE that? A wizard? A criminal?"],
  water: ["[neutral] Water? Wow. Okay, Mom.", "[happy] *sips water* Look at me. Hydrating. Responsibly. Gross.", "[neutral] This is the worst drink I've ever had. It tastes like nothing. Like a cloud's sweat."],
};
const PACE_OPENERS = {
  sip: ["*takes a dainty sip*", "*sips with pinky out*", "*little sip*"],
  normal: ["*takes a big swig*", "*drinks*", "*knocks some back*"],
  chug: ["*CHUGS* ...", "*slams it down* AHH!", "*chugs the whole thing, eyes watering*", "*glug glug glug* ...HAH!"],
};
const CHUG_EXTRAS = ["[laugh] Did you SEE that?! Olympic. Gold. Medal.", "[surprised] Oh. Oh no. Oh that's going to hit me in about four minutes.", "[laugh] Again! No. Wait. Give me a second. Okay AGAIN!"];

const STAGE_LINES = {
  howAreYou: {
    sober: ["[happy] Good! Ready for a fun night.", "[happy] Honestly? Great. Long week, but this booth fixes everything."],
    buzzed: ["[happy] I'm feeling nice. Warm. Like a toaster.", "[happy] Pretty good! Things are getting... cozier."],
    tipsy: ["[laugh] I feel GREAT. Unusually great. Suspiciously great!", "[happy] Okay okay okay, I feel amazing. Is it hot in here? It's hot in here."],
    drunk: ["[love] I feel like a warm blanket. A warm, loud blanket.", "[laugh] I can't feel my face. Is my face still there? Thank you for checking."],
    wasted: ["[sick] The floor and I are getting to know each other.", "[sad] I feel... the room is doing a little spin. Tell it to stop."],
    blackout: ["[sleepy] mm... fine... sho fine..."],
  },
  wait: {
    sober: ["[neutral] *people-watches* That guy at the bar has been on the same date for three hours.", "[happy] Love this song. Hate that I know all the words."],
    buzzed: ["[happy] This song! I know this song. I don't know any of the words, but I KNOW it.", "[neutral] *stretches* Time flies when you're in a booth."],
    tipsy: ["[laugh] Did you see that couple? They're arguing about parking. In a BAR.", "[happy] I feel like the jukebox gets me. Spiritually."],
    drunk: ["[love] You know what? This is a good night. A really good night. I mean that.", "[sleepy] *rests chin on hand* I could live here. In this booth."],
    wasted: ["[sleepy] *stares at the candle* ...it's so pretty...", "[sick] I'm just gonna... sit very still for a minute."],
    blackout: ["[sleepy] zzz... *jolts awake* I'm up! I'm up."],
  },
  sobering: ["[neutral] Ooh. I'm coming back down. Gently. Like a leaf.", "[sad] Is it just me or is everything getting less funny? Need a drink."],
  beat: {
    tipsy: ["[laugh] Whoa. Okay! That last one's kicking in. I feel LOUD.", "[happy] Is it me or did everybody get way more interesting?"],
    drunk: ["[surprised] When did the floor get wavy? Was it always wavy?", "[laugh] Everything is funny now. That napkin is hilarious."],
    wasted: ["[sick] *knocks elbow on the table* OW. Who put that there.", "[sad] I love you, man. I really do. Do you love me? Don't answer."],
    blackout: ["[sleepy] my eyes... are heavy... like... bricks... heavy bricks...", "[sleepy] *head bobs* I'm... resting... my face..."],
  },
  passout: ["[sleepy] thass... nnnot... zzz", "[sleepy] jus'... five... minutes... zzz", "[sleepy] tell my... goat... zzz", "[sleepy] I'm fiiine... *thunk* ...zzz"],
};

const LINES = {
  greet: ["[happy] Hey {you}! You made it! *slides you a coaster* First round's on you, right?", "[happy] {you}! Sit, sit. I saved us the good booth. The candle even works.", "[happy] There you are! I've been people-watching for twenty minutes. That pigeon has been staring at me."],
  hello: ["[happy] Hey hey! What are we drinking?", "[happy] Hiya! Okay, this is officially a night out.", "[happy] Hello yourself!"],
  name: ["[happy] I'm {me}! Pleased to meetcha.", "[laugh] {me}. Like the famous one. There's no famous one. Yet."],
  job: "job",
  from: ["[happy] I'm from {from}. Best place on earth. Also the worst. Both.", "[neutral] {from}, born and raised. Don't judge."],
  secretTooSober: ["[laugh] Ha! A secret? Buy me a couple more and maybe.", "[neutral] Oh, I've got secrets. You'll need to get me drunker than this."],
  love: ["[sad] My love life? It's a dumpster. A cute dumpster. With a bow on it.", "[love] I'm single. Fully, aggressively single.", "[laugh] Dating is just interviewing strangers to see who'll share fries with you."],
  loveDrunk: ["[sad] I'm gonna be honest. I miss my ex. Don't let me text them. Take my phone. TAKE IT.", "[love] I just want someone who looks at me the way I look at nachos."],
  compliment: ["[love] Stop it! *fans face* No, keep going.", "[happy] Aww! You're sweet. Sweeter than this drink, and this drink is basically candy.", "[laugh] Flattery will get you everywhere. Mostly to the bar to buy me another."],
  flirt: ["[love] *blushes* Well, aren't you smooth. Is it the lighting? It's the lighting.", "[laugh] Easy there, tiger. Buy me a drink first. Oh wait, you did."],
  insult: ["[angry] Wow. Okay. *sips aggressively*", "[sad] Rude! I'm telling the bartender.", "[angry] Excuse me? I'll have you know my mother thinks I'm delightful."],
  insultAgain: ["[angry] You know what? I don't need this. I've had enough people telling me I'm not worth the bother this week.", "[sad] Seriously? Twice? That's it. I'm done."],
  refuseLeave: ["[laugh] Leave? The night is YOUNG. Like me. Spiritually.", "[neutral] Nice try. I'm not going anywhere until somebody buys fries.", "[happy] Go home? And miss THIS? *gestures at everything*"],
  goodbye: ["[sad] Fine. Enjoy your night, {you}. I'm out. *grabs jacket*", "[angry] I'm going home. Don't follow me. Unless you're a cab.", "[sleepy] Okay. Okay, okay. I'm calling it. Good night, {you}. Get home safe."],
  joke: [
    "[laugh] Why did the bartender become a gardener? He was good at making things grow... on the tab! HA! ...I'll workshop it.",
    "[laugh] What do you call a fake noodle? An impasta! *slaps table* I'm sorry. I'm not sorry.",
    "[laugh] I told my wife she was drawing her eyebrows too high. She looked surprised! Wait. I don't have a wife. I stole that one.",
    "[laugh] A skeleton walks into a bar and says 'Gimme a beer. And a mop.' ...Get it? Because he's... it goes through... never mind.",
    "[laugh] Why don't scientists trust atoms? Because they make up EVERYTHING. Just like my ex.",
  ],
  sing: [
    "[happy] ♪ Oh the jukebox is my friend, la la la, it never judges me ♪",
    "[love] ♪ Pour me one more, baby, pour me one more, I lost my shoes but I found the dance floor ♪",
    "[laugh] ♪ Tequila in the morning, tequila in the night, tequila's not my boyfriend but he treats me right ♪",
  ],
  dance: ["[laugh] *attempts a dance move, knocks over a napkin* Nailed it.", "[happy] *shimmies in the booth* This is my sit-down dancing. It's very advanced.", "[laugh] I can't dance. But I can CONVINCE you I can dance. *does the sprinkler*"],
  drive: ["[angry] Whoa whoa whoa. Nobody's driving. Cab. Rideshare. Piggyback. Not driving.", "[neutral] Keys. Hand 'em over. I'm serious. Friends don't let friends drive like this."],
  laugh: ["[laugh] RIGHT?! *cackles*", "[laugh] Hahaha! See, you get me.", "[laugh] *snorts* Oh no, I snorted. That's a level four laugh."],
  thanks: ["[happy] Anytime! That's what booth friends are for.", "[love] Aww. No, thank YOU."],
  sad: ["[love] Aw, come here. *pats your hand* We're gonna fix it. With fries. Fries fix everything.", "[sad] That sucks. Really. You wanna talk about it, or you want me to say something stupid to distract you?"],
  happy: ["[happy] Yes! Good! That's the energy I need tonight.", "[laugh] Love that for you!"],
  family: ["[love] Tell me about your family. Are they loud? Mine are SO loud.", "[happy] I love my mom. I should call her. Don't let me call her right now."],
  money: ["[laugh] Money? I have exactly enough money for one more drink and a bad decision.", "[neutral] Money comes and goes. Mostly goes. Mostly here."],
  music: ["[happy] Music! What's your karaoke song? Mine's a power ballad. Every time.", "[laugh] I'm a shower singer. Shower AND bar. Wherever there's echo."],
  food: ["[happy] Are we talking FOOD? Because I would commit crimes for fries right now.", "[love] Food is the best part of any night. After this. And you."],
  favoriteDrink: "favoriteDrink",
  yes: ["[happy] Yes! Exactly!", "[laugh] See, we agree on everything.", "[happy] Love a yes."],
  no: ["[neutral] No? Hm. Bold.", "[laugh] No?! Okay, okay. Respect.", "[surprised] Well THAT'S a twist."],
  why: ["[neutral] Why? Because the universe is weird, {you}. That's why.", "[laugh] Why does anybody do anything? For the story."],
};

// ELIZA reflections and catch-alls.
const REFLECT = { i: "you", me: "you", my: "your", mine: "yours", am: "are", "i'm": "you're", "i've": "you've", "i'll": "you'll", "i'd": "you'd", myself: "yourself", you: "I", your: "my", yours: "mine", "you're": "I'm", yourself: "myself", are: "am" };
const reflect = (s) => s.toLowerCase().replace(/[.!?]+$/, "").split(/\s+/).map((w) => REFLECT[w] ?? w).join(" ");

const ELIZA = [
  [/\bi(?:'m| am) (.+)/i, ["[neutral] You're {1}? How long have you been {1}?", "[surprised] Why are you {1}? Tell me everything.", "[happy] You're {1}! Me too. Wait. Am I? Probably."]],
  [/\bi feel (.+)/i, ["[love] You feel {1}? Feelings are like drinks. Better shared.", "[neutral] Why do you feel {1}, {you}?"]],
  [/\bi (?:want|need) (.+)/i, ["[neutral] What would it mean to you to get {1}? Deep question. Heavy. Like this glass.", "[laugh] We all want {1}. I want fries."]],
  [/\bi (?:think|believe) (.+)/i, ["[neutral] Do you really think {1}?", "[laugh] You think {1}? Bold. I like it."]],
  [/\bbecause (.+)/i, ["[neutral] Is that the REAL reason? *squints*", "[laugh] Because {1}. Sure. Sure sure sure."]],
  [/\bi (?:hate|can't stand) (.+)/i, ["[angry] Ugh, {1}. Don't get me started on {1}.", "[laugh] Hate is a strong word. I hate geese. So. I get it."]],
  [/\bi (?:love|like) (.+)/i, ["[love] You love {1}? That's beautiful. I'm emotional now.", "[happy] {1}! Great taste. Like me."]],
  [/\byou(?:'re| are) (.+)/i, ["[surprised] I'm {1}? Nobody's ever told me that. Well. Once.", "[laugh] Me? {1}? Takes one to know one!"]],
];
const FALLBACK = [
  "[neutral] Tell me more about that.",
  "[happy] Huh! I never thought about it like that.",
  "[neutral] And how does that make you feel?",
  "[laugh] That's wild. That's genuinely wild.",
  "[neutral] Mm-hm. Mm-HM. Go on.",
  "[happy] See, this is why I like you. You say things.",
];
const QUESTION_FALLBACK = ["[neutral] Ooh. Good question. Great question. Next question.", "[laugh] You're asking ME? I can't even remember where I parked.", "[neutral] Honestly? No idea. But I'll pretend I do. Yes. The answer is yes."];

const MOOD_TAGS = {
  tequila: ["WOOO!", "*slaps table*", "Let's do SHOTS!"],
  wine: ["*sighs dreamily*", "Life is beautiful, you know?"],
  whiskey: ["*swirls glass*", "Back in my day..."],
  gin: ["*sniffles*", "Everything is so beautiful and sad."],
  vodka: ["Anyway anyway ANYWAY!", "*talking fast*"],
  rum: ["Arr.", "*does a little pirate voice*"],
  champagne: ["*giggles*", "Cheers to that!"],
  chaos: ["*laughs, then cries a little, then laughs*", "WHO AM I."],
  beer: ["*clinks your glass*", "Good times."],
};

// ---------- the slur filter ----------

function slurWord(w, level) {
  if (!/[a-z]/i.test(w)) return w;
  let out = w;
  if (level >= 0.5 && chance(level * 0.55)) out = out.replace(/s(?!h)/gi, (m) => (m === "S" ? "SH" : "sh"));
  if (level >= 0.5 && chance(0.7)) out = out.replace(/ing\b/gi, "in'");
  if (level >= 0.55 && chance(level * 0.14) && out.length > 3) {
    const i = 1 + rand(out.length - 2);
    // Swap two neighbouring lowercase letters; never punctuation or a capital.
    if (/[a-z]{2}/.test(out.slice(i, i + 2))) out = out.slice(0, i) + out[i + 1] + out[i] + out.slice(i + 2);
  }
  if (level >= 0.6 && chance(level * 0.12)) out = out.replace(/([aeiou])/i, "$1$1$1");
  if (level >= 0.3 && level < 0.85 && chance(0.05) && out.length > 3) out = out.toUpperCase();
  return out;
}

export function drunkify(text, stage) {
  const level = STAGE_LEVEL[stage] ?? 0;
  if (level === 0) return text;
  // Keep *actions* readable; slur only the spoken parts.
  const parts = text.split(/(\*[^*]+\*)/g);
  const spoken = parts.map((part, i) => {
    if (i % 2) return part;
    let s = part;
    if (level >= 0.35) s = s.replace(/\byou know\b/gi, "y'know").replace(/\bgoing to\b/gi, "gonna").replace(/\bwant to\b/gi, "wanna").replace(/\bkind of\b/gi, "kinda");
    if (level >= 0.6) s = s.replace(/\bthat's\b/gi, "thash").replace(/\bit's\b/gi, "ish").replace(/\band\b/gi, "an'");
    s = s.split(/(\s+)/).map((w) => (/\s/.test(w) ? w : slurWord(w, level))).join("");
    if (level >= 0.85) s = s.replace(/\. /g, "... ").replace(/\.$/, "...");
    return s;
  });
  let out = spoken.join("");
  if (level >= 0.6 && chance(level * 0.5)) {
    const cut = out.search(/[.!?] /);
    out = cut > 0 ? out.slice(0, cut + 1) + " *hic* " + out.slice(cut + 2) : out + " *hic*";
  }
  if (level >= 0.35 && level < 0.85 && chance(0.25)) out = pick(["Okay okay okay. ", "Listen. LISTEN. ", "Honestly? ", "Hahaha ", "Oh man. "]) + out;
  if (level >= 1) {
    const words = out.replace(/\*[^*]+\*/g, "").split(/\s+/).filter(Boolean);
    out = words.slice(0, 3 + rand(4)).join(" ") + "... " + pick(["mmh...", "zzz...", "wha...", "*hic*..."]);
  }
  return out;
}

function pick(list) {
  return list[rand(list.length)];
}

// ---------- the brain ----------

const RE = {
  hello: /^\s*(hi|hey|hello|yo|sup|howdy|hiya|heya|what'?s up)\b/i,
  howAreYou: /how (are|r) (you|u|ya)|how('?s| is) it going|how (do|d'?ya) (you )?feel|you (ok|okay|alright|good)\??$/i,
  name: /what'?s your name|who are you|your name/i,
  job: /what do you do|your job|for (a )?living|where do you work|what'?s your work/i,
  from: /where.*\bfrom\b|hometown|where did you grow up/i,
  secret: /secret|confess|tell me something|tell me a truth|something about you/i,
  love: /\b(boyfriend|girlfriend|husband|wife|married|single|dating|date|love life|crush|\bex\b|relationship)/i,
  compliment: /\b(you('?re| are)|you look|ur)\b.{0,12}\b(pretty|beautiful|cute|hot|gorgeous|handsome|funny|cool|great|awesome|amazing|stunning|smart|nice|sweet|the best)\b/i,
  flirt: /\b(sexy|kiss|marry me|go out with me|your place|my place|date me|wink)\b/i,
  insult: /\b(you('?re| are)|you look|ur)\b.{0,12}\b(ugly|boring|stupid|dumb|annoying|lame|gross|loser|idiot|terrible|awful|a mess|pathetic|fat)\b|shut up|i hate you|nobody likes you|you suck|get lost|screw you/i,
  goHome: /\b(go home|leave|get out|beat it|scram|time to go|call it a night|go to bed|head home|get lost)\b/i,
  dontLeave: /\b(don'?t|do not|never|please don'?t)\b.{0,10}\b(leave|go)\b/i,
  joke: /\bjoke|make me laugh|something funny|funny story/i,
  sing: /\bsing|song|karaoke/i,
  dance: /\bdanc/i,
  drive: /\b(drive|driving|car keys|my car|keys|behind the wheel)\b/i,
  laugh: /\b(ha(ha)+|lol|lmao|rofl|hehe|😂|🤣)\b|^\s*ha+\s*$/i,
  thanks: /\b(thanks|thank you|thx|ty)\b/i,
  sad: /\bi('?m| am| feel)\b.{0,10}\b(sad|lonely|tired|depressed|stressed|upset|down|awful|bad)\b/i,
  happy: /\bi('?m| am| feel)\b.{0,10}\b(happy|great|good|amazing|awesome|fantastic)\b/i,
  family: /\b(mom|mother|dad|father|sister|brother|family|kids|son|daughter)\b/i,
  money: /\b(money|rich|broke|pay|salary|bills)\b/i,
  music: /\b(music|band|jukebox|concert)\b/i,
  food: /\b(food|hungry|eat|pizza|burger|nachos|tacos)\b/i,
  favoriteDrink: /favou?rite drink|what (do you|would you) (want|like) to drink|what('?s| is) your drink|what are you drinking/i,
  yes: /^\s*(yes|yeah|yep|yup|sure|definitely|totally|absolutely)\b/i,
  no: /^\s*(no|nope|nah|never)\b/i,
  why: /^\s*why\b/i,
  myName: /\b(?:my name is|call me|i'?m called)\s+([a-z][\w'-]*)/i,
};

export function createBarTalk(persona) {
  const bio = persona.backstory;
  const memory = { insults: 0, leaveAsks: 0, told: new Set(), recent: [], userName: persona.userName, topics: [] };

  // Draws from a pool while avoiding the last few lines used.
  const draw = (pool) => {
    const fresh = pool.filter((l) => !memory.recent.includes(l));
    const line = pick(fresh.length ? fresh : pool);
    memory.recent.push(line);
    if (memory.recent.length > 24) memory.recent.shift();
    return line;
  };

  const fill = (line, captured = "") =>
    line
      .replaceAll("{you}", memory.userName || "pal")
      .replaceAll("{me}", persona.name)
      .replaceAll("{from}", bio.from)
      .replaceAll("{1}", captured);

  function stageLine(group, stage) {
    const pool = STAGE_LINES[group][stage] ?? STAGE_LINES[group].drunk ?? STAGE_LINES[group].tipsy;
    return draw(pool);
  }

  function backstoryTangent(level) {
    if (level >= 0.35 && !memory.told.has("secret") && chance(0.35)) {
      memory.told.add("secret");
      return draw(bio.secret.lines).replace(/^/, "[sad] ");
    }
    if (!memory.told.has("job") && chance(0.25)) {
      memory.told.add("job");
      return "[happy] " + draw(bio.job.lines);
    }
    if (chance(0.3)) return "[laugh] " + draw(bio.quirk.lines);
    // Drunk people repeat themselves.
    if (level >= 0.6 && memory.told.size && chance(0.5)) {
      const again = memory.told.has("secret") ? draw(bio.secret.lines) : draw(bio.job.lines);
      return `[love] Did I tell you this? ${again}`;
    }
    return null;
  }

  function moodFlavor(mood, level) {
    if (!mood || level < 0.15 || !chance(0.25 + level * 0.4)) return "";
    return " " + pick(MOOD_TAGS[mood] ?? []);
  }

  // Turns a line into { text, expression }, applying slur and booze flavor.
  function finish(line, stage, mood) {
    const level = STAGE_LEVEL[stage] ?? 0;
    const m = line.match(/^\[(\w+)\]\s*/);
    const expression = m ? m[1] : "neutral";
    let text = m ? line.slice(m[0].length) : line;
    text += moodFlavor(mood, level);
    return { text: drunkify(text, stage).trim(), expression: level >= 1 ? "sleepy" : expression };
  }

  function respondToText(raw, stage, mood) {
    const text = raw.trim();
    const level = STAGE_LEVEL[stage] ?? 0;
    const nameMatch = text.match(RE.myName);
    if (nameMatch) {
      memory.userName = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1);
      return { line: `[happy] ${memory.userName}! Great name. I'm gonna yell it later. Fair warning.` };
    }
    if (RE.insult.test(text)) {
      memory.insults++;
      if (memory.insults >= 2) return { line: draw(LINES.insultAgain), leave: true };
      return { line: draw(LINES.insult) };
    }
    if (RE.goHome.test(text) && !RE.dontLeave.test(text)) {
      memory.leaveAsks++;
      const ready = memory.insults >= 1 || memory.leaveAsks >= 3 || (level >= 0.85 && memory.leaveAsks >= 2);
      return ready ? { line: draw(LINES.goodbye), leave: true } : { line: draw(LINES.refuseLeave) };
    }
    if (RE.drive.test(text)) return { line: draw(LINES.drive) };
    if (RE.howAreYou.test(text)) return { line: stageLine("howAreYou", stage) };
    if (RE.name.test(text)) return { line: draw(LINES.name) };
    if (RE.job.test(text)) {
      memory.told.add("job");
      return { line: "[happy] " + draw(bio.job.lines) };
    }
    if (RE.from.test(text)) return { line: draw(LINES.from) };
    if (RE.secret.test(text)) {
      if (level < 0.35) return { line: draw(LINES.secretTooSober) };
      memory.told.add("secret");
      return { line: "[sad] " + draw(bio.secret.lines) };
    }
    if (RE.favoriteDrink.test(text)) return { line: `[happy] ${mood === "tequila" ? "TEQUILA. Obviously." : mood ? "Whatever you just gave me. More of that." : "Surprise me! But make it strong."}` };
    if (RE.flirt.test(text)) return { line: draw(LINES.flirt) };
    if (RE.compliment.test(text)) return { line: draw(LINES.compliment) };
    if (RE.love.test(text)) return { line: draw(level >= 0.6 ? LINES.loveDrunk : LINES.love) };
    if (RE.joke.test(text)) return { line: draw(LINES.joke) };
    if (RE.sing.test(text)) return { line: draw(LINES.sing) };
    if (RE.dance.test(text)) return { line: draw(LINES.dance) };
    if (RE.sad.test(text)) return { line: draw(LINES.sad) };
    if (RE.happy.test(text)) return { line: draw(LINES.happy) };
    if (RE.laugh.test(text)) return { line: draw(LINES.laugh) };
    if (RE.thanks.test(text)) return { line: draw(LINES.thanks) };
    if (RE.hello.test(text)) return { line: draw(LINES.hello) };
    if (RE.family.test(text)) return { line: draw(LINES.family) };
    if (RE.money.test(text)) return { line: draw(LINES.money) };
    if (RE.music.test(text)) return { line: draw(LINES.music) };
    if (RE.food.test(text)) return { line: draw(LINES.food) };
    if (RE.why.test(text)) return { line: draw(LINES.why) };
    if (RE.yes.test(text)) return { line: draw(LINES.yes) };
    if (RE.no.test(text)) return { line: draw(LINES.no) };
    for (const [re, pool] of ELIZA) {
      const m = text.match(re);
      if (m) return { line: draw(pool), captured: reflect(m[1]).slice(0, 60) };
    }
    const tangent = backstoryTangent(level);
    if (tangent && chance(0.6)) return { line: tangent };
    return { line: draw(/\?\s*$/.test(text) ? QUESTION_FALLBACK : FALLBACK) };
  }

  return {
    // event: { type: "greet" | "say" | "drink" | "fries" | "wait" | "beat" | "passout", ... }
    respond(event, { stage, mood, sobering = false }) {
      let line;
      let leave = false;
      let captured = "";
      switch (event.type) {
        case "greet":
          line = draw(LINES.greet);
          break;
        case "drink": {
          const pool = event.drink.abv === 0 ? DRINK_LINES.water : DRINK_LINES[event.drink.mood] ?? DRINK_LINES.beer;
          const reaction = draw(pool);
          const tag = reaction.match(/^\[\w+\]\s*/)?.[0] ?? "";
          line = `${tag}${pick(PACE_OPENERS[event.pace])} ${reaction.slice(tag.length)}`;
          if (event.pace === "chug" && chance(0.5)) line += " " + draw(CHUG_EXTRAS).replace(/^\[\w+\]\s*/, "");
          if (event.text) {
            const said = respondToText(event.text, stage, mood);
            if (said.leave) ({ line, leave } = said);
          }
          break;
        }
        case "fries":
          line = draw(["[love] FRIES! *grabs a handful* Okay. I love you. I mean, I love fries. Both.", "[happy] *eats fries* These are the best fries I've ever had. I say that every time.", "[laugh] Fries! Now I can tell you about the goat. Kidding. Maybe."]);
          break;
        case "wait":
          line = sobering ? draw(STAGE_LINES.sobering) : stageLine("wait", stage);
          break;
        case "beat":
          line = stageLine("beat", stage);
          break;
        case "passout":
          line = draw(STAGE_LINES.passout);
          return { text: line.replace(/^\[\w+\]\s*/, ""), expression: "sleepy", leave: false };
        default: {
          const said = respondToText(event.text ?? "", stage, mood);
          ({ line, leave = false, captured = "" } = said);
        }
      }
      if (leave) {
        // Storming off after an insult still ends with a goodbye; a plain goodbye already is one.
        if (!LINES.goodbye.includes(line)) line += " " + draw(LINES.goodbye).replace(/^\[\w+\]\s*/, "");
        return { ...finish(fill(line, captured), stage, mood), leave: true };
      }
      return { ...finish(fill(line, captured), stage, mood), leave: false };
    },
  };
}
