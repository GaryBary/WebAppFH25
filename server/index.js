import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch, { FormData, Blob } from 'node-fetch';
import pg from 'pg';
import multer from 'multer';
import Jimp from 'jimp';

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Database (optional locally; required for persistence on Render)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    })
  : null;

async function ensureTables() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
ensureTables().catch(console.error);

// Message board allowed names (keep in sync with frontend dropdown)
const ALLOWED = new Set(['Robbie','Ronnie','Seko','Marty','Stork','Buzza']);
const DELETE_TOKEN = process.env.DELETE_TOKEN || process.env.ADMIN_DELETE_TOKEN;

// Messages API
app.get('/api/messages', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'db_not_configured' });
  try {
    const { rows } = await pool.query(
      'SELECT id, author, body, created_at FROM messages ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ messages: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/api/messages', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'db_not_configured' });
  try {
    const author = String(req.body?.author || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!ALLOWED.has(author)) return res.status(400).json({ error: 'invalid_author' });
    if (!body) return res.status(400).json({ error: 'empty_message' });
    const { rows } = await pool.query(
      'INSERT INTO messages(author, body) VALUES ($1, $2) RETURNING id, author, body, created_at',
      [author, body]
    );
    res.json({ message: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

// Admin-only deletion routes
app.delete('/api/messages/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'db_not_configured' });
  if (!DELETE_TOKEN) return res.status(500).json({ error: 'delete_token_not_configured' });
  const token = req.headers['x-admin-token'];
  if (token !== DELETE_TOKEN) return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  try {
    await pool.query('DELETE FROM messages WHERE id=$1', [id]);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
});

app.get('/api/messages/delete', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'db_not_configured' });
  if (!DELETE_TOKEN) return res.status(500).json({ error: 'delete_token_not_configured' });
  const token = String(req.query.token || '');
  if (token !== DELETE_TOKEN) return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  try {
    await pool.query('DELETE FROM messages WHERE id=$1', [id]);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// --- Fan Photo Generator (MVP compositing) ---
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const TOP_GOLFERS = [
  'Scottie Scheffler','Rory McIlroy','Xander Schauffele','Russell Henley','Collin Morikawa'
];
const ALT_GOLFERS = [
  'Greg Norman','Tiger Woods','John Daly','Phil Mickelson','Bubba Watson','Bryson DeChambeau'
];

function isAllowedGolfer(name) {
  return TOP_GOLFERS.includes(name) || ALT_GOLFERS.includes(name);
}

app.post('/api/photo/generate', upload.single('image'), async (req, res) => {
  try {
    const golfer = String(req.body?.golfer || '').trim();
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'image_required' });
    }
    if (!isAllowedGolfer(golfer)) {
      return res.status(400).json({ error: 'invalid_golfer' });
    }

    // Prefer OpenAI automatically when key is present; otherwise try Stability; then fallback
    const stabilityKey = process.env.STABILITY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        // Attempt an image edit using the uploaded photo as a base, asking the model to add the golfer.
        const prompt = `Edit this photo to add ${golfer} next to the person on a golf putting green at golden hour, sharing beers, laughing, best pals, natural skin tones, highly realistic, 35mm lens, shallow depth of field, no text, no logos.`;
        const mime = req.file.mimetype || 'image/png';
        // Use a valid OpenAI size - options are: '1024x1024', '1024x1536', '1536x1024', or 'auto'
        const size = '1024x1024';
        const blob = new Blob([req.file.buffer], { type: mime });
        const form = new FormData();
        form.append('model', 'dall-e-2');
        // OpenAI edits API expects images under 'image'
        form.append('image', blob, 'input.png');
        form.append('prompt', prompt);
        form.append('size', size);
        form.append('response_format', 'b64_json');
        const r = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: form
        });
        if (!r.ok) {
          const detail = await r.text();
          return res.status(502).json({ error: 'openai_error', detail });
        }
        const data = await r.json();
        console.log('OpenAI response data:', JSON.stringify(data, null, 2));
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) {
          console.log('No b64_json found in response');
          return res.status(502).json({ error: 'openai_no_image', debug: data });
        }
        const dataUrl = `data:image/png;base64,${b64}`;
        return res.json({ imageUrl: dataUrl, provider: 'openai' });
      } catch (e) {
        console.error('openai_failed', e);
        // fall through to other providers/fallback
      }
    }
    if (stabilityKey) {
      try {
        const prompt = `A photorealistic candid photograph of the user and ${golfer} on a golf putting green at golden hour, sharing beers, laughing, best pals, natural skin tones, 35mm lens, shallow depth of field, no text, no logos.`;
        const form = new FormData();
        const mime = req.file.mimetype || 'image/jpeg';
        const blob = new Blob([req.file.buffer], { type: mime });
        form.append('image', blob, 'input');
        form.append('prompt', prompt);
        form.append('output_format', 'png');
        form.append('strength', '0.45');

        const r = await fetch('https://api.stability.ai/v2beta/stable-image/image-to-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${stabilityKey}`, Accept: 'image/*' },
          body: form
        });
        if (!r.ok) {
          const detail = await r.text();
          return res.status(502).json({ error: 'stability_error', detail });
        }
        const arrayBuf = await r.arrayBuffer();
        const outBuf = Buffer.from(arrayBuf);
        const dataUrl = `data:image/png;base64,${outBuf.toString('base64')}`;
        return res.json({ imageUrl: dataUrl, provider: 'stability' });
      } catch (e) {
        console.error('stability_failed', e);
        // fall through to local composite
      }
    }

    // Local MVP composite fallback (no keys required)
    const width = 1024;
    const height = 768;
    const bg = await new Jimp(width, height, 0xff1f6d2a);
    const vignette = await new Jimp(width, height, 0x00000040);
    vignette.blur(50);
    bg.composite(vignette, 0, 0, { mode: Jimp.BLEND_MULTIPLY });
    const userImg = await Jimp.read(req.file.buffer);
    const targetH = Math.min(520, userImg.getHeight());
    userImg.scaleToFit(Math.floor(width * 0.45), targetH);
    const userX = Math.floor(width * 0.06);
    const userY = Math.floor(height * 0.18);
    bg.composite(userImg, userX, userY);
    const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const caption = `You & ${golfer}`;
    bg.print(fontTitle, Math.floor(width * 0.52), Math.floor(height * 0.22), caption);
    bg.print(fontSmall, Math.floor(width * 0.52), Math.floor(height * 0.22) + 80, 'On the green • beers • good times');
    const out = await bg.getBufferAsync(Jimp.MIME_PNG);
    const dataUrl = `data:image/png;base64,${out.toString('base64')}`;
    const reason = !process.env.OPENAI_API_KEY
      ? 'missing_openai_key'
      : 'upstream_failed_or_disabled';
    return res.json({ imageUrl: dataUrl, provider: 'fallback', reason });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Existing chat proxy
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.OPENAI_BASE || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';

app.post('/api/chat', async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
    }
    const r = await fetch(OPENAI_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 500 })
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream', detail: await r.text() });
    const data = await r.json();
    res.json({ reply: data?.choices?.[0]?.message?.content || '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Chat API listening on :${port}`));
