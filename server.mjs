import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./prompt.mjs";
import { demoReply } from "./demo.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const MODEL = "claude-opus-5-5";
const MAX_HISTORY = 40;
const PRICE_PER_MTOK = { input: 4, output: 20 }; // Claude Opus 5.5, USD
let nightTotal = 0;
const DEMO = process.env.DRUNKGPT_DEMO === "1" || (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// Everything the game needs lives in public/, so it can also be hosted as plain static files.
const STATIC_ROOTS = [["/", path.join(here, "public/")]];

let client;
const getClient = () => (client ??= new Anthropic());

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname === "/") pathname = "/index.html";
  for (const [prefix, dir] of STATIC_ROOTS) {
    if (!pathname.startsWith(prefix)) continue;
    const file = path.join(dir, pathname.slice(prefix.length));
    if (!file.startsWith(dir)) break;
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      return res.end(body);
    } catch {
      break;
    }
  }
  res.writeHead(404).end("Not found");
}

// Keeps the most recent turns, starts on a user turn, and merges any same-role neighbors.
function trimHistory(messages) {
  const recent = messages.slice(-MAX_HISTORY).filter((m) => m && (m.role === "user" || m.role === "assistant"));
  while (recent.length && recent[0].role !== "user") recent.shift();
  const merged = [];
  for (const { role, content } of recent) {
    const prev = merged[merged.length - 1];
    if (prev?.role === role) prev.content += `\n\n${content}`;
    else merged.push({ role, content: String(content) });
  }
  return merged;
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API. Give it a few seconds and try again.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`;
  if (/auth|api key|apiKey/i.test(err?.message ?? "")) return "No Anthropic API key found. Copy .env.example to .env, add your key, and restart the server.";
  return err?.message ?? String(err);
}

async function handleChat(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let state, messages;
  try {
    ({ state, messages } = JSON.parse(raw));
  } catch {
    return res.writeHead(400).end("Bad JSON");
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
  if (DEMO) {
    // Trickle the canned line out so the typing and talking animations still play.
    for (const word of demoReply(state, messages.length).split(/(?<= )/)) {
      res.write(word);
      await new Promise((r) => setTimeout(r, 35));
    }
    return res.end();
  }
  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: buildSystemPrompt(state),
      messages: trimHistory(messages),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    const { input_tokens: inTok = 0, output_tokens: outTok = 0 } = final.usage ?? {};
    const cost = (inTok * PRICE_PER_MTOK.input + outTok * PRICE_PER_MTOK.output) / 1e6;
    nightTotal += cost;
    console.log(`turn: ${inTok} in / ${outTok} out = $${cost.toFixed(4)} (server total $${nightTotal.toFixed(3)})`);
    if (final.stop_reason === "refusal") res.write("[neutral] *stares into the glass and says nothing*");
  } catch (err) {
    console.error(err);
    res.write(`\n[[error]] ${describeError(err)}`);
  }
  res.end();
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405).end();
  })
  .listen(PORT, () => {
    console.log(`DrunkGPT is open for business at http://localhost:${PORT}`);
    if (DEMO) console.warn("Demo mode: canned replies. Add ANTHROPIC_API_KEY to .env (see .env.example) for the real thing.");
  });
