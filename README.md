# DrunkGPT

Sit across a table from a cartoon drinking buddy in a 3D bar. Chat, order them drinks, tell them to drink, and watch their speech and body get sloppier until they pass out (or storm out if you're rude).

## Play it

Everything the game needs is in `public/`. It's plain static files with no server, API key or build step, and the drunk character's brain runs in the player's browser.

To try it locally, serve the `public` folder with any static server, for example:

```bash
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000.

## Post it publicly

Upload the contents of `public/` to any static host: GitHub Pages, Netlify, Cloudflare Pages, or your own site. All paths are relative, so it also works from a subfolder. Players need nothing installed and it costs you nothing to run.

## Optional: Claude mode (local only, uses your API key)

For smarter, unscripted conversation on your own machine:

```bash
npm install
sh ./set-key.sh   # stores your Anthropic key in .env (never commit it)
npm start
```

Then open http://localhost:5173/?claude. Without `?claude` the game uses the free built-in brain. Never put your API key in `public/` or anything you publish.

## How it works

- `public/js/bartalk.js` is the built-in drunk: ELIZA-style pattern matching, a line library for every booze type and pace, a backstory per night, and a slur filter that gets worse with every drink.
- `public/js/engine.js` is the drink menu and BAC model: the Widmark formula with the chosen gender and weight, front-loaded absorption, food slowing absorption, and elimination of 0.015%/hr.
- `public/js/character.js` builds the cel-shaded, ink-outlined cartoon characters.
- `public/js/scene.js` is the Three.js bar, IK drinking, sway, pass-out and walk-out animations.
- `public/js/audio.js` synthesizes all sound (bar ambience, pours, glugs, hiccups, snoring) with Web Audio.
- `public/js/main.js` handles game flow, chat and the HUD.
- `server.mjs` and `prompt.mjs` are only for the optional Claude mode.

The BAC model is an estimate for a game, not medical advice. Three.js is MIT licensed (`public/vendor/three/LICENSE`).
