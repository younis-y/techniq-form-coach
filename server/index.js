/**
 * TechnIQ credential proxy.
 *
 * The browser must never hold an ElevenLabs or Gemini key. The original build
 * shipped the ElevenLabs key as a client-side `xi-api-key` header and the Gemini
 * key in a URL query string, which makes both readable by anyone who opens
 * DevTools — and, for the query string, logs them in server access logs and
 * browser history too.
 *
 * This process holds the keys and forwards requests. The front end talks only to
 * these four endpoints and never sees a credential.
 *
 *   GET  /api/config     what is configured, so the UI can degrade gracefully
 *   POST /api/tts        ElevenLabs text-to-speech, returns audio/mpeg
 *   POST /api/coach      Gemini generateContent, returns the parsed text
 *   GET  /api/agent-url  signed WebSocket URL for a private conversational agent
 *
 * No dependencies. Requires Node 18+ for global fetch.
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_AGENT = process.env.ELEVENLABS_AGENT_ID || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// Only these voices may be requested. Without this the endpoint is an open
// relay: anyone could point it at any voice on the account and spend the quota.
const ALLOWED_VOICES = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'pNInz6obpgDQGcFmaJgB', // Adam
]);

const MAX_TTS_CHARS = 500;
const MAX_PROMPT_CHARS = 4000;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleTts(req, res) {
  if (!ELEVENLABS_KEY) return send(res, 503, { error: 'voice not configured' });

  const { text, voiceId, stability = 0.6, similarityBoost = 0.75, speed = 1.0 } =
    await readJson(req);

  if (typeof text !== 'string' || !text.trim()) {
    return send(res, 400, { error: 'text is required' });
  }
  if (text.length > MAX_TTS_CHARS) {
    return send(res, 413, { error: `text exceeds ${MAX_TTS_CHARS} characters` });
  }
  const voice = voiceId || [...ALLOWED_VOICES][0];
  if (!ALLOWED_VOICES.has(voice)) {
    return send(res, 400, { error: 'voice not allowed' });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          speed,
        },
      }),
    }
  );

  if (!upstream.ok) {
    // Deliberately terse: upstream errors can echo account detail.
    return send(res, 502, { error: `tts upstream ${upstream.status}` });
  }

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'no-store',
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}

async function handleCoach(req, res) {
  if (!GEMINI_KEY) return send(res, 503, { error: 'coach not configured' });

  const { prompt, temperature = 0.7, maxOutputTokens = 200 } = await readJson(req);
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return send(res, 400, { error: 'prompt is required' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return send(res, 413, { error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` });
  }

  const upstream = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY, // header, not query string
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    }
  );

  if (!upstream.ok) return send(res, 502, { error: `coach upstream ${upstream.status}` });

  const data = await upstream.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  send(res, 200, { text });
}

async function handleAgentUrl(res) {
  if (!ELEVENLABS_KEY || !ELEVENLABS_AGENT) {
    return send(res, 503, { error: 'agent not configured' });
  }
  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(ELEVENLABS_AGENT)}`,
    { headers: { 'xi-api-key': ELEVENLABS_KEY } }
  );
  if (!upstream.ok) return send(res, 502, { error: `agent upstream ${upstream.status}` });
  const { signed_url: signedUrl } = await upstream.json();
  send(res, 200, { signedUrl }, { 'Cache-Control': 'no-store' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      // Booleans only. The client is told what works, never what the keys are.
      return send(res, 200, {
        hasVoice: Boolean(ELEVENLABS_KEY),
        hasCoach: Boolean(GEMINI_KEY),
        hasAgent: Boolean(ELEVENLABS_KEY && ELEVENLABS_AGENT),
        agentId: ELEVENLABS_AGENT || null,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/tts') return await handleTts(req, res);
    if (req.method === 'POST' && url.pathname === '/api/coach') return await handleCoach(req, res);
    if (req.method === 'GET' && url.pathname === '/api/agent-url') return await handleAgentUrl(res);

    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('[proxy]', err.message);
    send(res, 500, { error: 'proxy error' });
  }
});

server.listen(PORT, () => {
  const missing = [
    !ELEVENLABS_KEY && 'ELEVENLABS_API_KEY',
    !GEMINI_KEY && 'GEMINI_API_KEY',
  ].filter(Boolean);
  console.log(`[proxy] listening on http://localhost:${PORT}`);
  if (missing.length) {
    console.log(`[proxy] not set: ${missing.join(', ')} — those features degrade to fallbacks`);
  }
});
