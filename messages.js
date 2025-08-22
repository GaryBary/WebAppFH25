const API_BASE = "https://webappfh25.onrender.com/api/messages"; // your Render URL

function renderMessages(list, root) {
  root.innerHTML = "";
  list.forEach(m => {
    const div = document.createElement("div");
    div.className = "card msg-item";
    const when = new Date(m.created_at).toLocaleString();
    div.innerHTML = `<div class="msg-meta"><strong>${m.author}</strong> · ${when}</div><div>${m.body}</div>`;
    root.appendChild(div);
  });
}

(async function initMessages() {
  const listEl = document.getElementById("msg-list");
  const form = document.getElementById("msg-form");
  const authorEl = document.getElementById("msg-author");
  const textEl = document.getElementById("msg-text");

  async function refresh() {
    try {
      const r = await fetch(API_BASE);
      const data = await r.json();
      renderMessages(data.messages || [], listEl);
    } catch (e) {
      console.warn("Failed to load messages", e);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const author = authorEl.value;
    const body = textEl.value.trim();
    if (!author || !body) return;
    textEl.value = "";
    try {
      const r = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, body })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert("Failed to post" + (err.error ? `: ${err.error}` : ""));
      }
      await refresh();
    } catch {
      alert("Failed to post");
    }
  });

  await refresh();
})();
