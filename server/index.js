import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import pg from 'pg';

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

const ALLOWED = new Set(['Robbie','Ronnie','Seko','Marty','Stork','Buzza','Bear','Tosca']);

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
