# Fat Hacks 2025 – Mobile-first Web App

A slick, mobile-friendly static site for the Fat Hacks 2025 tour. All content is controlled by a single JSON file (`data/config.json`) that only you edit. There is no public UI for changing details.

## Quick start

- Open this folder in your editor
- Serve the folder with any static server (e.g., VS Code Live Server)
- Visit the served URL (e.g., `http://127.0.0.1:5500`)

> Opening `index.html` directly via `file://` works, but the app won’t fetch `data/config.json`. It will use built-in defaults and log a console warning. Serve locally to see live config changes.

## Editing content (owner-only)

All data lives in `data/config.json`:

```json
{
  "site": {
    "title": "Fat Hacks 2025",
    "tourLabel": "until the Fat Hacks 2025 Tour",
    "tourDate": "2025-06-15T09:00:00Z",
    "hero": { "headline": "Fat Hacks 2025", "subheadline": "Adventure. Golf. Good times." }
  },
  "flights": {
    "departure": { "airportFrom": "JFK", "airportTo": "LAX", "flightNumber": "FH2025", "datetime": "2025-06-10T12:00:00-04:00" },
    "return":    { "airportFrom": "LAX", "airportTo": "JFK", "flightNumber": "FH2025R", "datetime": "2025-06-20T17:00:00-07:00" }
  },
  "accommodation": {
    "name": "The Grand Coastal Hotel",
    "address": "500 Seaview Blvd, Santa Monica, CA",
    "checkIn": "2025-06-10",
    "checkOut": "2025-06-20",
    "mapUrl": "https://maps.google.com"
  },
  "golfEvents": [
    { "course": "Trump National LA", "dateTime": "2025-06-12T08:00:00-07:00", "address": "1 Trump National Dr, Rancho Palos Verdes, CA" },
    { "course": "Rustic Canyon", "dateTime": "2025-06-14T07:30:00-07:00", "address": "15100 Happy Camp Canyon Rd, Moorpark, CA" },
    { "course": "Sandpiper Golf Club", "dateTime": "2025-06-17T09:15:00-07:00", "address": "7925 Hollister Ave, Goleta, CA" }
  ]
}
```

- Set `site.tourDate` using ISO 8601 (e.g., `2025-06-15T09:00:00Z` or with timezone like `-07:00`).
- Countdown shows days, minutes, and seconds, with the text “until the Fat Hacks 2025 Tour”.
- No public inputs exist. Only the repo owner edits this JSON.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder’s contents
2. Commit a `.nojekyll` file at the repo root (already included)
3. In Settings → Pages, set Source to your default branch, folder `/ (root)`
4. Visit your `https://<user>.github.io/<repo>/` URL

`data/config.json` loads with cache-busting so updates appear after refresh.

## Notes

- Falls back to inline defaults if `data/config.json` is unreachable
- Timezones are respected when you include an offset in ISO strings
- Modern glassmorphic UI, mobile-first responsive layout

## Chatbot

- Edit `data/bot-knowledge.json` to control the bot’s persona (name, tone, style) and knowledge facts. Changes are cache-busted on refresh.
- Frontend loads this JSON and sends messages to a backend proxy at `/api/chat`.
- Backend lives in `server/` (Express). Set `OPENAI_API_KEY` as an env var.

### Local API

1. Open a terminal in `server/`
2. Run `npm install` then `npm start`
3. The API will listen on `http://localhost:3000`. If your frontend is not served from the same origin, update `api.baseUrl` in `data/bot-knowledge.json` to `http://localhost:3000/api/chat`.

### Deploy API to Render

- Use `server/render.yaml` → New Web Service → connect repo → add `OPENAI_API_KEY` in Render’s dashboard → deploy.
