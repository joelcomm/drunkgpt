// Canned replies used when no Anthropic credentials are configured, so the bar is playable offline.

const LINES = {
  sober: [
    "[happy] Hey! Good to finally get out tonight. *settles into the booth* So what's your usual here?",
    "[neutral] Honestly, this place has the best jukebox in town. What are we celebrating?",
  ],
  buzzed: [
    "[happy] Ohh, that's nice. *leans back* I'm feeling good. You're easy to talk to, you know that?",
    "[laugh] Okay, that's actually hilarious. Tell me more, I'm listening.",
  ],
  tipsy: [
    "[laugh] OKAY okay okay. Hear me out. We should start a band. Right now. I play... nothing! Doesn't matter!",
    "[happy] You know what? You're GREAT. Like genuinely. *slaps table* Whoops, sorry, that was loud.",
  ],
  drunk: [
    "[love] I'm jusht saying... I love thish place. And you. I love you, man. *points vaguely* Wait what were we talkin about",
    "[laugh] Thass the funniest thing anyone's ever shaid. Ever. In hishtory. *wipes eye*",
  ],
  wasted: [
    "[sick] nooooo no no I'm fiiine *hic* wait did I already tell you about my... my thing? the thing?",
    "[sad] *hic* why is the table moving... tell the table to shtop...",
  ],
  blackout: ["[sleepy] mmh... jush resting my eyes... *hic* whosh... who're you again..."],
  passedout: ["[sleepy] thass... nnnot... zzz"],
};

export function demoReply(state = {}, turn = 0) {
  const options = LINES[state.stage] ?? LINES.sober;
  const line = options[turn % options.length];
  return `${line}\n\n*(Demo mode: add ANTHROPIC_API_KEY to .env for real conversation.)*`;
}
