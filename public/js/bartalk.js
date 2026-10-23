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
const reflect = (s) => s.replace(/[.!?]+$/, "").split(/\s+/).map((w) => REFLECT[w.toLowerCase()] ?? (w === "I" ? "you" : w)).join(" ");

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
  if (level >= 0.55 && chance(level * 0.14) && out.length >= 5) {
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

const MORE = {
  crude: [
    "[angry] *raises an eyebrow* Eyes up here, pal. My face is the one doing the talking.",
    "[angry] Wow. Smooth. Real smooth. Do you talk to your mother with that mouth?",
    "[laugh] *snorts* Oh, you did NOT just say that. Strike one, {you}.",
    "[angry] Easy, tiger. Keep it classy or keep it moving.",
  ],
  crudeLast: [
    "[angry] *flicks the rest of the drink at you* Nope. We are DONE here.",
    "[angry] That's two. I don't do three. Enjoy drinking alone, {you}.",
  ],
  apology: [
    "[happy] Apology accepted. Buy me a drink and it's water under the bridge. Vodka under the bridge.",
    "[love] Aww. Okay. You're forgiven. Mostly. Like eighty percent.",
  ],
  noNeedSorry: ["[laugh] Sorry for what? You're doing great. I'm the one who's three drinks in.", "[happy] Don't be sorry! Be thirsty."],
  confused: {
    sober: ["[laugh] Ha, sorry. My brain wandered off for a second. What were we talking about?", "[neutral] Was that weird? I get weird when I'm nervous. Ask me again, I'll do better."],
    drunk: ["[laugh] Weird? I've had {drinks} drinks, {you}. You're lucky I'm using WORDS.", "[laugh] It made sense in my head. EVERYTHING makes sense in my head.", "[sad] Sorry, sorry. My thoughts took the scenic route. Ask me again."],
  },
  bot: ["[laugh] A robot? Robots don't get hiccups. *hic* See? Flesh and bone. Mostly tequila.", "[surprised] Am I REAL? Pinch me. No, don't pinch me. I bruise like a peach.", "[laugh] I'm about as artificial as this cheese dip, and that's... okay, fair point."],
  drunkAccused: {
    sober: ["[laugh] Drunk? I've barely started. Give me time.", "[neutral] Not yet! The night is young and so is my liver."],
    tipsy: ["[laugh] I'm not drunk. I'm... festive.", "[happy] Tipsy, maybe. A little. A smidge. A smidge and a half."],
    drunk: ["[laugh] I'm not drunk. You're drunk. And there's two of you.", "[love] I'm not drunk, I'm FLAVORED."],
    wasted: ["[sick] Who's drunk? *points at the wrong person* That guy.", "[sleepy] I'm... perfectly... fine... *slides down the booth a little*"],
  },
  live: ["[happy] I live in {from}. Above a laundromat. Everything I own smells like dryer sheets.", "[neutral] Little place in {from}. Two rooms, one plant, zero idea how to keep the plant alive."],
  age: ["[laugh] Old enough to drink, young enough to regret it tomorrow.", "[neutral] A lady never tells. A drunk lady might. Ask me in two drinks."],
  pets: ["[love] I have a cat named Meatball. He hates me. I love him.", "[happy] Dogs! Every dog. All of them. I would die for a corgi."],
  hobbies: ["[happy] For fun? Karaoke. Badly. And reorganizing my spice rack when I'm sad.", "[laugh] I collect snow globes. I've never seen real snow. It's complicated."],
  travel: ["[love] I went to Italy once. Ate pasta for nine days straight. Best week of my life.", "[happy] I want to see the Northern Lights. Or Vegas. Either one, honestly."],
  movies: ["[happy] I cry at every movie. Pixar? Destroyed. Car commercials? Destroyed.", "[laugh] My comfort movie is a heist movie. I've seen it forty times. I could pull off that heist."],
  sports: ["[laugh] Sports? I like the snacks. And the yelling. Mostly the yelling.", "[happy] I'll root for whoever has the cutest mascot."],
  weather: ["[neutral] The weather? Wow. Are we THAT kind of conversation? Okay. It's... weathery.", "[laugh] It's always nice weather in a bar. No windows. No consequences."],
  politics: ["[laugh] Oh no. No no. Not after this many drinks. I'll start a war.", "[neutral] House rule: no politics, no religion, no talking about my ex. Two out of three, anyway."],
  dream: ["[love] My dream? Open a little bar. Just like this. But the candles actually smell nice.", "[happy] I want to be on a game show. Any game show. I'd crush it."],
  likeMe: ["[love] Do I like you? You're buying the drinks. So far? Yes.", "[happy] I like you! You've got a good face for a bar."],
  userLeaving: ["[sad] Nooo! One more. ONE more. Then you can go.", "[surprised] You're leaving? But who will I tell about the goat?"],
  bored: ["[neutral] Bored? Okay, okay. Ask me anything. Anything! I'm an open book. A slightly sticky book.", "[laugh] Let's play a game. I say a word, you say the first thing you think of. Ready? Pickles."],
  ack: ["[happy] Ha! I like that.", "[neutral] Huh. Okay, I can see that.", "[laugh] You're funny. You know that?", "[happy] Mm-hm, mm-hm."],
  doYou: ["[happy] Do I {1}? Absolutely. Every chance I get.", "[laugh] Do I {1}? Not since the incident.", "[neutral] Do I {1}? Only on weekends. And Wednesdays.", "[love] Do I {1}? With my whole heart."],
  areYou: ["[laugh] Am I {1}? Depends who's asking. You're asking. So... maybe!", "[happy] Me? {1}? Ha! Little bit.", "[neutral] Am I {1}? My mom would say yes."],
  canYou: ["[laugh] Can I {1}? Watch me. Actually, don't watch me.", "[happy] Can I {1}? Probably not. Will I try? Yes."],
  haveYou: ["[laugh] Have I ever {1}? Twice. Once on purpose.", "[surprised] Have I {1}? ...I'm not legally allowed to answer that.", "[neutral] Never! But it's on the list."],
  wouldYou: ["[laugh] Would I {1}? For a basket of fries? Yes.", "[neutral] Would I {1}? Ask me after the next round."],
  favorite: ["[happy] My favorite {1}? Whatever's closest to me right now.", "[laugh] Favorite {1}? Ooh. Tough. I'm gonna say... yes."],
};

// Questions the buddy asks to keep the conversation going; the next reply is taken as the answer.
const ASKS = {
  job: { q: ["[happy] So what do you do, {you}?", "[neutral] Wait, what do you do for work? I never asked!"], react: ["[surprised] {a}? No way! That's way cooler than what I do.", "[happy] {a}! I knew it. You have total {A} energy."] },
  from: { q: ["[happy] Where are you from, anyway?", "[neutral] Are you from around here?"], react: ["[happy] {a}! I've always wanted to go there. Don't tell me about it, I'm picturing it.", "[laugh] {a}? I knew a guy from there. He owed me twenty bucks."] },
  pets: { q: ["[neutral] Important question. Cats or dogs?", "[happy] Do you have any pets? Tell me everything."], react: ["[love] {a}! Okay, you're officially a good person.", "[laugh] {a}. Interesting. I'm judging you a little. Lovingly."] },
  worstDate: { q: ["[laugh] What's the worst date you've ever been on?", "[neutral] Okay, worst date. Go. I need this."], react: ["[laugh] {a}? Oh no. Oh NO. *wheezes* Okay, mine was worse, but still.", "[surprised] {a}?! I'm so sorry. That's legendary, though."] },
  karaoke: { q: ["[happy] What's your karaoke song? Everybody has one.", "[laugh] If I dragged you to karaoke, what are you singing?"], react: ["[laugh] {a}?! Okay, you're singing it later. That's the rule.", "[love] {a}. Great choice. Tears will be shed."] },
  fun: { q: ["[happy] What do you do for fun?", "[neutral] When you're not here, what are you up to?"], react: ["[happy] {a}! Okay, I'm into that.", "[laugh] {a}? I mostly do... this. *gestures at drink*"] },
  dream: { q: ["[love] If you could quit everything tomorrow, what would you do?", "[neutral] What's your big dream, {you}? The real one."], react: ["[love] {a}... I can see it. I can totally see it.", "[happy] {a}! Do it. I'll be your first customer. Or fan. Or whatever."] },
};
const ASK_ORDER = ["job", "from", "pets", "fun", "karaoke", "worstDate", "dream"];
const WRONG_RECALL = ["a dentist", "a dolphin trainer", "an astronaut", "a mime", "from the moon"];

const RE = {
  crude: /\b(boobs?|tits?|titties|breasts?|rack|butt|booty|ass|nipples?|cleavage|naked|nude|strip|take (it|that|your \w+) off|sleep with me|hook up|bang|sex|horny|dtf|thicc|f+u+c+k me)\b/i,
  insult: /\b(you('?re| are)|you look|ur)\b.{0,12}\b(ugly|boring|stupid|dumb|annoying|lame|gross|loser|idiot|terrible|awful|a mess|pathetic|fat|a bitch|a slut|trash)\b|shut up|i hate you|nobody likes you|you suck|screw you|f+u+c+k (you|off)/i,
  apology: /\b(sorry|apologi[sz]e|my bad|didn'?t mean (it|that))\b/i,
  goHome: /\b(go home|leave|get out|beat it|scram|call it a night|go to bed|head home|get lost|go away)\b/i,
  dontLeave: /\b(don'?t|do not|never|please don'?t)\b.{0,10}\b(leave|go)\b/i,
  userLeaving: /\b(i (have|need|gotta|got) to go|i'?m (leaving|heading out|going home)|gotta go|good ?night|bye|see ya|later)\b/i,
  bot: /\b(are you|you'?re|you are|is this)\b.{0,12}\b(an? )?(ai|bot|robot|computer|chat ?gpt|program|machine|npc|real person|real)\b/i,
  confused: /\b(weird|random|makes no sense|doesn'?t make sense|nonsense|not listening|didn'?t answer|answer the question|what are you talking about|huh|wtf|that'?s not what i)\b|^\s*what\??\s*$|^\s*\?+\s*$/i,
  drunkAccused: /\b(you('?re| are)|ur|you seem|you look)\b.{0,10}\b(drunk|wasted|tipsy|hammered|smashed|plastered|buzzed|lit|trashed)\b/i,
  hello: /^\s*(hi|hey|hello|yo|sup|howdy|hiya|heya|what'?s up|good evening)\b/i,
  howAreYou: /how (are|r) (you|u|ya)|how('?s| is) it going|how (do|d'?ya) (you )?feel|are you (ok|okay|alright|good)|how you doing|how'?re you/i,
  name: /what'?s your name|who are you|your name/i,
  job: /what do you do|your job|for (a )?living|where do you work|what'?s your work|what kind of work/i,
  live: /where do you (live|stay)|your (place|apartment|house)|live around here/i,
  from: /where.*\bfrom\b|hometown|where did you grow up|where are you based/i,
  age: /how old|your age|what age|born in/i,
  secret: /secret|confess|tell me something|tell me a truth|something about you|tell me about (yourself|you)/i,
  love: /\b(boyfriend|girlfriend|husband|wife|married|single|dating|date|love life|crush|\bex\b|relationship|partner)\b/i,
  likeMe: /do you like me|am i (cute|hot|your type)|do you think i'?m/i,
  compliment: /\b(you('?re| are)|you look|ur|your (eyes|hair|smile|dress|outfit))\b.{0,14}\b(pretty|beautiful|cute|hot|gorgeous|handsome|funny|cool|great|awesome|amazing|stunning|smart|nice|sweet|lovely|the best)\b/i,
  flirt: /\b(sexy|kiss|marry me|go out with me|your number|date me|wink|flirt)\b/i,
  joke: /\bjoke|make me laugh|something funny|funny story/i,
  sing: /\bsing|karaoke/i,
  dance: /\bdanc/i,
  drive: /\b(drive|driving|car keys|my car|keys|behind the wheel)\b/i,
  laugh: /\b(ha(ha)+|lol|lmao|rofl|hehe)\b|😂|🤣|^\s*ha+\s*!*$/i,
  thanks: /\b(thanks|thank you|thx|ty)\b/i,
  sad: /\bi('?m| am| feel)\b.{0,10}\b(sad|lonely|tired|depressed|stressed|upset|down|awful|bad|anxious)\b/i,
  happy: /\bi('?m| am| feel)\b.{0,10}\b(happy|great|good|amazing|awesome|fantastic)\b/i,
  bored: /\b(bored|boring night|this is boring)\b/i,
  pets: /\b(pets?|cats?|dogs?|kitten|puppy)\b/i,
  hobbies: /\bfor fun|hobb(y|ies)|free time|weekends?\b/i,
  travel: /\b(travel|vacation|trip|been to|visit)\b/i,
  movies: /\b(movie|film|tv|show|netflix|series)\b/i,
  sports: /\b(sports?|game|team|football|baseball|basketball|soccer|hockey)\b/i,
  weather: /\b(weather|rain|snow|hot out|cold out)\b/i,
  politics: /\b(politic\w*|election|president|religion|god|church)\b/i,
  dream: /\b(dream|goal|ambition|bucket list)\b/i,
  family: /\b(mom|mother|dad|father|sister|brother|family|kids|son|daughter|parents)\b/i,
  money: /\b(money|rich|broke|salary|bills)\b/i,
  music: /\b(music|band|jukebox|concert|song)\b/i,
  food: /\b(food|hungry|eat|pizza|burger|nachos|tacos|fries)\b/i,
  favoriteDrink: /favou?rite drink|what (do you|would you) (want|like) to drink|what('?s| is) your drink|what are you drinking/i,
  favorite: /what'?s your fav(ou?rite)? (\w+(?: \w+)?)/i,
  doYou: /^\s*do you (.+?)\??$/i,
  areYou: /^\s*are you (.+?)\??$/i,
  canYou: /^\s*can you (.+?)\??$/i,
  haveYou: /^\s*have you( ever)? (.+?)\??$/i,
  wouldYou: /^\s*would you (.+?)\??$/i,
  yes: /^\s*(yes|yeah|yep|yup|sure|definitely|totally|absolutely|of course)\b/i,
  no: /^\s*(no|nope|nah|never)\b/i,
  why: /^\s*why\b/i,
  andYou: /^\s*(and )?(you|what about you|how about you|and you|u)\s*\??\s*$/i,
  myName: /\b(?:my name is|call me|i'?m called)\s+([a-z][\w'-]*)/i,
};

// Pulls a short answer out of a reply ("I'm a nurse, why?" -> "a nurse").
function extractAnswer(text) {
  let a = text.trim().replace(/[.!?]+$/, "");
  a = a.replace(/^(well|um+|uh+|honestly|haha|lol|oh|so)[, ]+/i, "");
  a = a.replace(/^(i'?m|i am|i work as|i work in|i work at|i do|i'?m from|i live in|i grew up in|it'?s|it was|my|mine is|probably|definitely)\s+/i, "");
  a = a.split(/[,;]| but | and then | because /i)[0];
  const words = a.split(/\s+/).slice(0, 7).join(" ");
  return words.length > 1 ? words : null;
}

export function createBarTalk(persona) {
  const bio = persona.backstory;
  const memory = {
    strikes: 0,
    leaveAsks: 0,
    told: new Set(),
    recent: [],
    userName: persona.userName,
    user: {}, // what the player told us: job, from, pets, ...
    asked: new Set(),
    expecting: null, // the question we just asked, if any
    turns: 0,
    lastTangent: -9,
    drinks: {}, // drink id -> count
  };

  const draw = (pool) => {
    const fresh = pool.filter((l) => !memory.recent.includes(l));
    const line = pick(fresh.length ? fresh : pool);
    memory.recent.push(line);
    if (memory.recent.length > 30) memory.recent.shift();
    return line;
  };

  const totalDrinks = () => Object.values(memory.drinks).reduce((a, b) => a + b, 0);
  const fill = (line, captured = "", answer = "") =>
    line
      .replaceAll("{you}", memory.userName || "pal")
      .replaceAll("{me}", persona.name)
      .replaceAll("{from}", bio.from)
      .replaceAll("{drinks}", String(Math.max(1, totalDrinks())))
      .replaceAll("{1}", captured)
      .replaceAll("{a}", answer)
      .replaceAll("{A}", answer.replace(/^(a|an|the)\s+/i, ""));

  const stageLine = (group, stage) => draw(STAGE_LINES[group][stage] ?? STAGE_LINES[group].drunk ?? STAGE_LINES[group].tipsy);
  const byStage = (table, stage) => table[stage] ?? (STAGE_LEVEL[stage] >= 0.85 ? table.wasted ?? table.drunk : table.drunk ?? table.sober);

  // Sometimes the buddy drives the conversation with a question of their own.
  function maybeAsk(force = false) {
    if (memory.expecting || (!force && !chance(0.4))) return "";
    const topic = ASK_ORDER.find((t) => !memory.asked.has(t));
    if (!topic) return "";
    memory.asked.add(topic);
    memory.expecting = topic;
    return " " + draw(ASKS[topic].q).replace(/^\[\w+\]\s*/, "");
  }

  // Bringing up what the player said earlier; wasted, they get it hilariously wrong.
  function recall(level) {
    const known = Object.entries(memory.user);
    if (!known.length || !chance(0.5)) return null;
    const [topic, value] = pick(known);
    if (level >= 0.85) return `[love] Wait wait wait. You're ${pick(WRONG_RECALL)}, right? No? ...I was close.`;
    const phrasing = {
      job: `[love] I can't believe you're ${value}. I'm gonna tell everyone I know ${value}.`,
      from: `[happy] ${value}! I keep thinking about ${value}. Is everyone there as fun as you?`,
      pets: `[love] Tell me more about ${value}. I'm emotionally invested now.`,
      karaoke: `[laugh] I'm still thinking about you singing ${value}. It's happening tonight.`,
      worstDate: `[laugh] I can't stop thinking about your date. ${value}! *wheezes*`,
      fun: `[happy] So you're into ${value}. You're full of surprises, {you}.`,
      dream: `[love] Promise me you'll do the ${value} thing. Promise!`,
    }[topic];
    return phrasing ?? null;
  }

  function backstoryTangent(level) {
    if (memory.turns - memory.lastTangent < 4) return null;
    memory.lastTangent = memory.turns;
    if (level >= 0.35 && !memory.told.has("secret") && chance(0.5)) {
      memory.told.add("secret");
      return "[sad] Can I tell you something? " + draw(bio.secret.lines);
    }
    if (!memory.told.has("job") && chance(0.4)) {
      memory.told.add("job");
      return "[happy] " + draw(bio.job.lines);
    }
    if (level >= 0.6 && memory.told.size && chance(0.5)) {
      return `[love] Did I tell you this? ${memory.told.has("secret") ? draw(bio.secret.lines) : draw(bio.job.lines)}`;
    }
    return "[laugh] " + draw(bio.quirk.lines);
  }

  function moodFlavor(mood, level) {
    if (!mood || level < 0.15 || !chance(0.2 + level * 0.35)) return "";
    return " " + pick(MOOD_TAGS[mood] ?? []);
  }

  function finish(line, stage, mood) {
    const level = STAGE_LEVEL[stage] ?? 0;
    const m = line.match(/^\[(\w+)\]\s*/);
    const expression = m ? m[1] : "neutral";
    let text = m ? line.slice(m[0].length) : line;
    text = text.replace(/^(\*[^*]+\*\s*)?([a-z])/, (_, act = "", c) => act + c.toUpperCase());
    text += moodFlavor(mood, level);
    return { text: drunkify(text, stage).trim(), expression: level >= 1 ? "sleepy" : expression };
  }

  // Answering a question the buddy asked last turn.
  function takeAnswer(text, stage) {
    const topic = memory.expecting;
    memory.expecting = null;
    if (RE.andYou.test(text)) return null;
    const isQuestion = /\?\s*$/.test(text) || /^\s*(what|where|who|why|how|when|do|does|are|is|can|could|would|will|have|did)\b/i.test(text);
    const isOtherIntent = ["bot", "confused", "drunkAccused", "howAreYou", "secret", "joke", "sing", "dance", "compliment", "flirt", "drive"].some((k) => RE[k].test(text));
    if (isQuestion || isOtherIntent) return null;
    if (topic === "pets") {
      const a = /\bcats?\b/i.test(text) && /\bdogs?\b/i.test(text) ? "both" : /\bcats?\b/i.test(text) ? "cats" : /\bdogs?\b/i.test(text) ? "dogs" : extractAnswer(text);
      if (!a) return null;
      memory.user.pets = a === "both" ? "your cats and dogs" : a;
      return a === "both" ? "[laugh] Both?! Greedy. I respect it." : a === "cats" ? "[love] A cat person. Mysterious. Aloof. I like it." : a === "dogs" ? "[happy] Dog person! Loyal. Excitable. Like me after three drinks." : fill(draw(ASKS.pets.react), "", a);
    }
    const a = extractAnswer(text);
    if (!a || (RE.no.test(text) && text.split(/\s+/).length <= 2)) return "[laugh] Mysterious! Fine, keep your secrets.";
    memory.user[topic] = a;
    return fill(draw(ASKS[topic].react), "", a);
  }

  function respondToText(raw, stage, mood) {
    const text = raw.trim();
    const level = STAGE_LEVEL[stage] ?? 0;
    memory.turns++;

    // Things that matter more than anything else.
    if (RE.crude.test(text)) {
      memory.strikes++;
      memory.expecting = null;
      return memory.strikes >= 2 ? { line: draw(MORE.crudeLast), leave: true, bye: true } : { line: draw(MORE.crude) };
    }
    if (RE.insult.test(text)) {
      memory.strikes++;
      memory.expecting = null;
      return memory.strikes >= 2 ? { line: draw(LINES.insultAgain), leave: true } : { line: draw(LINES.insult) };
    }
    if (RE.apology.test(text)) {
      if (memory.strikes > 0) {
        memory.strikes--;
        return { line: draw(MORE.apology) };
      }
      return { line: draw(MORE.noNeedSorry) };
    }
    if (RE.goHome.test(text) && !RE.dontLeave.test(text) && !RE.userLeaving.test(text)) {
      memory.leaveAsks++;
      const ready = memory.strikes >= 1 || memory.leaveAsks >= 3 || (level >= 0.85 && memory.leaveAsks >= 2);
      return ready ? { line: draw(LINES.goodbye), leave: true, bye: true } : { line: draw(LINES.refuseLeave) };
    }

    // An answer to the question we just asked.
    if (memory.expecting) {
      const reaction = takeAnswer(text, stage);
      if (reaction) return { line: reaction + maybeAsk() };
    }

    const nameMatch = text.match(RE.myName);
    if (nameMatch) {
      memory.userName = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1);
      return { line: `[happy] ${memory.userName}! Great name. I'm gonna yell it later. Fair warning.` };
    }

    const simple = [
      ["bot", MORE.bot],
      ["confused", null],
      ["drunkAccused", null],
      ["userLeaving", MORE.userLeaving],
      ["drive", LINES.drive],
      ["howAreYou", null],
      ["name", LINES.name],
      ["job", null],
      ["live", MORE.live],
      ["from", LINES.from],
      ["age", MORE.age],
      ["secret", null],
      ["favoriteDrink", null],
      ["likeMe", MORE.likeMe],
      ["flirt", LINES.flirt],
      ["compliment", LINES.compliment],
    ];
    const topics = [
      ["love", null],
      ["joke", LINES.joke],
      ["sing", LINES.sing],
      ["dance", LINES.dance],
      ["sad", LINES.sad],
      ["happy", LINES.happy],
      ["bored", MORE.bored],
      ["laugh", LINES.laugh],
      ["thanks", LINES.thanks],
      ["politics", MORE.politics],
      ["pets", MORE.pets],
      ["hobbies", MORE.hobbies],
      ["travel", MORE.travel],
      ["movies", MORE.movies],
      ["sports", MORE.sports],
      ["weather", MORE.weather],
      ["dream", MORE.dream],
      ["family", LINES.family],
      ["money", LINES.money],
      ["music", LINES.music],
      ["food", LINES.food],
    ];
    for (const [key, pool] of simple) {
      if (!RE[key].test(text)) continue;
      switch (key) {
        case "confused":
          return { line: draw(level < 0.35 ? MORE.confused.sober : MORE.confused.drunk) + maybeAsk(true) };
        case "drunkAccused":
          return { line: draw(byStage(MORE.drunkAccused, stage)) };
        case "howAreYou":
          return { line: stageLine("howAreYou", stage) + maybeAsk() };
        case "job":
          memory.told.add("job");
          return { line: "[happy] " + draw(bio.job.lines) + (memory.asked.has("job") ? "" : " What about you?"), expect: memory.asked.has("job") ? null : "job" };
        case "secret":
          if (level < 0.35) return { line: draw(LINES.secretTooSober) };
          memory.told.add("secret");
          return { line: "[sad] " + draw(bio.secret.lines) };
        case "favoriteDrink":
          return { line: `[happy] ${mood === "tequila" ? "TEQUILA. Obviously." : mood ? "Whatever you just gave me. More of that." : "Surprise me! But make it strong."}` };
        case "love":
          return { line: draw(level >= 0.6 ? LINES.loveDrunk : LINES.love) };
        default:
          return { line: draw(pool) + (["howAreYou", "live", "from", "pets", "hobbies", "travel", "movies", "music"].includes(key) ? maybeAsk() : "") };
      }
    }

    // Questions shaped like "do you / are you / can you ... ?" get answers built from the player's own words.
    for (const [key, group] of [["favorite", 2], ["doYou", 1], ["areYou", 1], ["canYou", 1], ["haveYou", 2], ["wouldYou", 1]]) {
      const m = text.match(RE[key]);
      if (m) return { line: draw(MORE[key]), captured: reflect(m[group]).slice(0, 50) };
    }

    for (const [key, pool] of topics) {
      if (!RE[key].test(text)) continue;
      switch (key) {
        case "confused":
          return { line: draw(level < 0.35 ? MORE.confused.sober : MORE.confused.drunk) + maybeAsk(true) };
        case "drunkAccused":
          return { line: draw(byStage(MORE.drunkAccused, stage)) };
        case "howAreYou":
          return { line: stageLine("howAreYou", stage) + maybeAsk() };
        case "job":
          memory.told.add("job");
          return { line: "[happy] " + draw(bio.job.lines) + (memory.asked.has("job") ? "" : " What about you?"), expect: memory.asked.has("job") ? null : "job" };
        case "secret":
          if (level < 0.35) return { line: draw(LINES.secretTooSober) };
          memory.told.add("secret");
          return { line: "[sad] " + draw(bio.secret.lines) };
        case "favoriteDrink":
          return { line: `[happy] ${mood === "tequila" ? "TEQUILA. Obviously." : mood ? "Whatever you just gave me. More of that." : "Surprise me! But make it strong."}` };
        case "love":
          return { line: draw(level >= 0.6 ? LINES.loveDrunk : LINES.love) };
        default:
          return { line: draw(pool) + (["howAreYou", "live", "from", "pets", "hobbies", "travel", "movies", "music"].includes(key) ? maybeAsk() : "") };
      }
    }

    if (RE.andYou.test(text)) return { line: "[happy] Me? " + draw(bio.job.lines) };

    if (RE.hello.test(text)) return { line: draw(LINES.hello) + maybeAsk(true) };
    if (RE.why.test(text)) return { line: draw(LINES.why) };
    if (RE.yes.test(text)) return { line: draw(LINES.yes) + maybeAsk() };
    if (RE.no.test(text)) return { line: draw(LINES.no) + maybeAsk() };

    for (const [re, pool] of ELIZA) {
      const m = text.match(re);
      if (m) return { line: draw(pool), captured: reflect(m[1]).slice(0, 60) };
    }

    // Nothing matched: remember something they said, tell a story, or ask them something. Never pure filler twice.
    const remembered = level >= 0.35 ? recall(level) : null;
    if (remembered) return { line: remembered };
    const tangent = chance(0.5) ? backstoryTangent(level) : null;
    if (tangent) return { line: tangent };
    const ask = maybeAsk(true);
    if (ask) return { line: draw(MORE.ack) + ask };
    return { line: draw(/\?\s*$/.test(text) ? QUESTION_FALLBACK : FALLBACK) };
  }

  return {
    // event: { type: "greet" | "say" | "drink" | "fries" | "wait" | "beat" | "passout", ... }
    respond(event, { stage, mood, sobering = false }) {
      let line;
      let leave = false;
      let bye = false;
      let captured = "";
      switch (event.type) {
        case "greet":
          line = draw(LINES.greet);
          break;
        case "drink": {
          const id = event.drink.id ?? event.drink.name;
          const n = (memory.drinks[id] = (memory.drinks[id] ?? 0) + 1);
          const pool = event.drink.abv === 0 ? DRINK_LINES.water : DRINK_LINES[event.drink.mood] ?? DRINK_LINES.beer;
          const reaction = draw(pool);
          const tag = reaction.match(/^\[\w+\]\s*/)?.[0] ?? "";
          line = `${tag}${pick(PACE_OPENERS[event.pace])} ${reaction.slice(tag.length)}`;
          if (n === 3) line += ` That's ${event.drink.name.toLowerCase()} number three. Who's counting? Me. Badly.`;
          else if (n >= 5 && chance(0.5)) line += ` How many is that? ${n}? ${n + 2}? Numbers are fake.`;
          else if (event.pace === "chug" && chance(0.4)) line += " " + draw(CHUG_EXTRAS).replace(/^\[\w+\]\s*/, "");
          if (event.text) {
            const said = respondToText(event.text, stage, mood);
            if (said.leave) ({ line, leave, bye = false } = said);
          }
          break;
        }
        case "fries":
          line = draw(["[love] FRIES! *grabs a handful* Okay. I love you. I mean, I love fries. Both.", "[happy] *eats fries* These are the best fries I've ever had. I say that every time.", "[laugh] Fries! Now I can tell you about the goat. Kidding. Maybe."]);
          break;
        case "wait":
          line = sobering ? draw(STAGE_LINES.sobering) : stageLine("wait", stage);
          line += maybeAsk();
          break;
        case "beat":
          line = stageLine("beat", stage);
          break;
        case "passout":
          return { text: draw(STAGE_LINES.passout).replace(/^\[\w+\]\s*/, ""), expression: "sleepy", leave: false };
        default: {
          const said = respondToText(event.text ?? "", stage, mood);
          ({ line, leave = false, bye = false, captured = "" } = said);
          if (said.expect) memory.expecting = said.expect;
        }
      }
      if (leave) {
        // Storming off still ends with a goodbye; lines that already are one stand alone.
        if (!bye) line += " " + draw(LINES.goodbye).replace(/^\[\w+\]\s*/, "");
        return { ...finish(fill(line, captured), stage, mood), leave: true };
      }
      return { ...finish(fill(line, captured), stage, mood), leave: false };
    },
  };
}
