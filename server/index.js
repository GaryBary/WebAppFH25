import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
		const payload = {
			model: MODEL,
			messages: messages.map(m => ({ role: m.role, content: String(m.content) })),
			temperature: 0.7,
			max_tokens: 500
		};
		const r = await fetch(OPENAI_BASE, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});
		if (!r.ok) {
			const text = await r.text();
			return res.status(502).json({ error: 'upstream', detail: text });
		}
		const data = await r.json();
		const reply = data?.choices?.[0]?.message?.content || '';
		return res.json({ reply });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'internal' });
	}
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Chat API listening on :${port}`));


