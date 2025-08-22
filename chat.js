// Default bot knowledge and persona; will be overlaid by data/bot-knowledge.json if available
const defaultBot = {
	persona: {
		name: "Assistant",
		tone: "friendly, concise, helpful",
		style: "Use short sentences. Be upbeat and encouraging."
	},
	knowledge: [
		"This site is about Fat Hacks 2025 tour.",
		"We have sections for flights, accommodation, and golf events."
	],
	model: {
		provider: "openai",
		model: "gpt-4o-mini"
	},
	api: {
		baseUrl: "/api/chat"
	}
};

async function loadBotKnowledge() {
	if (location.protocol === 'file:') {
		console.warn('[chat] file:// context; using default bot knowledge.');
		return structuredClone(defaultBot);
	}
	try {
		const res = await fetch(`data/bot-knowledge.json?_cb=${Date.now()}`, { cache: 'no-store' });
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const remote = await res.json();
		return overlay(defaultBot, remote);
	} catch (err) {
		console.warn('[chat] Failed to load bot-knowledge.json; using defaults', err);
		return structuredClone(defaultBot);
	}
}

function overlay(base, extra) {
	const out = structuredClone(base);
	if (!extra || typeof extra !== 'object') return out;
	for (const [k, v] of Object.entries(extra)) {
		if (Array.isArray(v)) out[k] = v.slice();
		else if (v && typeof v === 'object') out[k] = overlay(out[k] || {}, v);
		else if (v !== undefined) out[k] = v;
	}
	return out;
}

function buildSystemPrompt(bot) {
	const persona = bot?.persona || {};
	const knowledge = bot?.knowledge || [];
	return [
		`You are ${persona.name || 'Assistant'}.`,
		persona.tone ? `Tone: ${persona.tone}.` : '',
		persona.style ? `Style: ${persona.style}.` : '',
		'Use the following facts as authoritative context. If unsure, ask a brief follow-up.',
		...knowledge.map(k => `- ${k}`)
	].filter(Boolean).join('\n');
}

function appendMessage(root, role, text) {
	const div = document.createElement('div');
	div.className = `chat-msg ${role}`;
	div.textContent = text;
	root.appendChild(div);
	root.scrollTop = root.scrollHeight;
}

async function sendChat(apiBase, messages) {
	const res = await fetch(apiBase, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ messages })
	});
	if (!res.ok) throw new Error('Chat API error ' + res.status);
	const data = await res.json();
	return data.reply || '';
}

(async function initChat() {
	const toggle = document.getElementById('chat-toggle');
	const panel = document.getElementById('chat-panel');
	const closeBtn = document.getElementById('chat-close');
	const log = document.getElementById('chat-log');
	const form = document.getElementById('chat-form');
	const input = document.getElementById('chat-input');

	const bot = await loadBotKnowledge();
	const apiBase = bot?.api?.baseUrl || '/api/chat';
	const systemPrompt = buildSystemPrompt(bot);

	toggle.addEventListener('click', () => {
		const expanded = toggle.getAttribute('aria-expanded') === 'true';
		toggle.setAttribute('aria-expanded', String(!expanded));
		panel.hidden = expanded;
		if (!expanded) input.focus();
	});
	closeBtn.addEventListener('click', () => {
		panel.hidden = true; toggle.setAttribute('aria-expanded', 'false');
	});

	appendMessage(log, 'bot', `Hi! I'm ${bot?.persona?.name || 'your assistant'}. How can I help?`);

	let history = [{ role: 'system', content: systemPrompt }];

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const text = input.value.trim();
		if (!text) return;
		input.value = '';
		appendMessage(log, 'user', text);
		const pending = document.createElement('div');
		pending.className = 'chat-msg bot'; pending.textContent = '…'; log.appendChild(pending);
		try {
			const messages = [...history, { role: 'user', content: text }];
			const reply = await sendChat(apiBase, messages);
			pending.remove();
			appendMessage(log, 'bot', reply);
			history = [...messages, { role: 'assistant', content: reply }];
		} catch (err) {
			pending.textContent = 'Error contacting chat API.';
			console.error(err);
		}
	});
})();


