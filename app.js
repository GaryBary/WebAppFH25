// Inline defaults ensure the site renders even if config.json fails to load
const defaultData = {
	site: {
		title: "Fat Hacks 2025",
		tourLabel: "until the Fat Hacks 2025 Tour:   13–16 Nov 2025",
		tourDate: "2025-11-13T00:00:00Z",
		hero: {
			headline: "Fat Hacks 2025",
			subheadline: "Golf, Good Times, Booze & Shrooms"
		}
	},
	flights: {
		departure: {
			airportFrom: "Home",
			airportTo: "Destination",
			flightNumber: "FH2025",
			datetime: "2025-06-10T12:00:00Z"
		},
		return: {
			airportFrom: "Destination",
			airportTo: "Home",
			flightNumber: "FH2025R",
			datetime: "2025-06-20T17:00:00Z"
		}
	},
	accommodation: {
		name: "Burleigh Beach House",
		address: "3 Albert St , Burleigh Heads",
		checkIn: "2025-06-10",
		checkOut: "2025-06-20",
		mapUrl: "https://www.google.com/maps/place/3+Albert+St,+Burleigh+Heads+QLD+4220/@-28.0925148,153.4537638,1064m/data=!3m2!1e3!4b1!4m6!3m5!1s0x6b91039684789c47:0x816dbddd617d2b51!8m2!3d-28.0925196!4d153.4563387!16s%2Fg%2F11c14pwjkm?entry=ttu&g_ep=EgoyMDI1MDgxOS4wIKXMDSoASAFQAw%3D%3D"
	},
	golfEvents: [
		{ course: "Ocean Dunes", dateTime: "2025-06-12T08:00:00", address: "", notes: "Front nine warm-up" },
		{ course: "Valley Links", dateTime: "2025-06-14T07:30:00", address: "", notes: "Early tee time" }
	]
};

function deepMerge(target, source) {
	if (typeof source !== 'object' || source === null) return target;
	for (const key of Object.keys(source)) {
		const srcVal = source[key];
		if (Array.isArray(srcVal)) {
			target[key] = srcVal.slice();
		} else if (typeof srcVal === 'object' && srcVal !== null) {
			if (!target[key] || typeof target[key] !== 'object') target[key] = {};
			deepMerge(target[key], srcVal);
		} else if (srcVal !== undefined) {
			target[key] = srcVal;
		}
	}
	return target;
}

async function loadConfig() {
	// If opened via file:// protocol, skip fetch to avoid CORS errors
	if (location.protocol === 'file:') {
		console.warn('[config] Running from file://, using inline defaults. Serve locally for live config.json.');
		return structuredClone(defaultData);
	}
	try {
		const cacheBust = Date.now();
		const isGithubRepoView = location.hostname === 'github.com' || location.hostname === 'www.github.com';
		const configUrl = isGithubRepoView
			? 'https://raw.githubusercontent.com/GaryBary/WebAppFH25/main/data/config.json'
			: `data/config.json?_cb=${cacheBust}`;
		if (isGithubRepoView) console.warn('[config] GitHub repo viewer detected; loading config from raw.githubusercontent.com');
		const res = await fetch(configUrl, { cache: 'no-store' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const remote = await res.json();
		return deepMerge(structuredClone(defaultData), remote);
	} catch (err) {
		console.warn('[config] Failed to load config.json. Using defaults.', err);
		return structuredClone(defaultData);
	}
}

function formatDateTime(isoString) {
	if (!isoString) return '';
	const d = new Date(isoString);
	if (isNaN(d.getTime())) return isoString;
	return d.toLocaleString(undefined, {
		weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
		hour: '2-digit', minute: '2-digit'
	});
}

function renderFlights(flights) {
	const root = document.getElementById('flights-cards');
	root.innerHTML = '';
	const items = [
		{ label: 'Departure', data: flights?.departure },
		{ label: 'Return', data: flights?.return }
	];
	for (const item of items) {
		const card = document.createElement('div');
		card.className = 'card';
		card.innerHTML = `
			<div class="kicker">${item.label}</div>
			<div class="title">${(item.data?.airportFrom || '')} ➜ ${(item.data?.airportTo || '')}</div>
			<div class="meta">${formatDateTime(item.data?.datetime)}${item.data?.flightNumber ? ` · <span class="badge">${item.data.flightNumber}</span>` : ''}</div>
		`;
		root.appendChild(card);
	}
}

function renderAccommodation(accommodation) {
	const root = document.getElementById('accommodation-card');
	root.innerHTML = '';
	const card = document.createElement('div');
	card.className = 'card';
	const when = [accommodation?.checkIn, accommodation?.checkOut].filter(Boolean).join(' → ');
	card.innerHTML = `
		<div class="kicker">Where we're staying</div>
		<div class="title">${accommodation?.name || ''}</div>
		<div class="meta">${accommodation?.address || ''}${when ? ` · ${when}` : ''}</div>
		${accommodation?.mapUrl ? `<div style="margin-top:8px"><a class="link" target="_blank" rel="noopener" href="${accommodation.mapUrl}">View on Map</a></div>` : ''}
	`;
	root.appendChild(card);
}

function renderGolfEvents(events) {
	const root = document.getElementById('golf-list');
	root.innerHTML = '';
	(events || []).forEach((ev, idx) => {
		const card = document.createElement('div');
		card.className = 'card';
		card.innerHTML = `
			<div class="row">
				<div class="badge">Round ${idx + 1}</div>
				<div class="title" style="margin:0">${ev.course || 'TBA'}</div>
			</div>
			<div class="meta">${formatDateTime(ev.dateTime)}${ev.address ? ` · ${ev.address}` : ''}${ev.notes ? ` · ${ev.notes}` : ''}</div>
		`;
		root.appendChild(card);
	});
}

function startCountdown(targetIso, label) {
	const daysEl = document.getElementById('cd-days');
	const hoursEl = document.getElementById('cd-hours');
	const minsEl = document.getElementById('cd-minutes');
	const secsEl = document.getElementById('cd-seconds');
	const labelEl = document.getElementById('countdown-label');
	labelEl.textContent = label || 'until the Fat Hacks 2025 Tour:   13–16 Nov 2025';
	const target = new Date(targetIso);
	function tick() {
		const now = new Date();
		let diff = Math.max(0, target.getTime() - now.getTime());
		const dayMs = 1000 * 60 * 60 * 24;
		const hourMs = 1000 * 60 * 60;
		const minMs = 1000 * 60;
		const days = Math.floor(diff / dayMs);
		diff -= days * dayMs;
		const hours = Math.floor(diff / hourMs);
		diff -= hours * hourMs;
		const minutes = Math.floor(diff / minMs);
		diff -= minutes * minMs;
		const seconds = Math.floor(diff / 1000);
		daysEl.textContent = String(days);
		if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
		minsEl.textContent = String(minutes).padStart(2, '0');
		secsEl.textContent = String(seconds).padStart(2, '0');
	}
		
	if (!isNaN(target.getTime())) {
		tick();
		setInterval(tick, 1000);
	}
}

function initUI(data) {
	document.title = data.site?.title || 'Fat Hacks';
	document.getElementById('year').textContent = String(new Date().getFullYear());

	const heroHeadline = document.getElementById('hero-headline');
	const heroSub = document.getElementById('hero-subheadline');
	if (data.site?.hero?.headline) heroHeadline.textContent = data.site.hero.headline;
	if (data.site?.hero?.subheadline) heroSub.textContent = data.site.hero.subheadline;

	startCountdown(data.site?.tourDate, data.site?.tourLabel);

	// Players
	if (Array.isArray(data.players)) {
		const root = document.getElementById('players-list');
		if (root) {
			root.innerHTML = '';
			[...data.players]
				.sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999))
				.forEach((p) => {
					const card = document.createElement('div');
					card.className = 'card';
					const name = p.name || 'Player';
					const rank = p.ranking != null ? Number(p.ranking) : '';
					const hcap = p.handicap != null ? Number(p.handicap) : '';
					const id = `player-${(name+rank+hcap).toString().replace(/\W+/g,'-')}`;
					card.innerHTML = `
						<div class="player-row">
							<div class="player-summary"><span class="title" style="margin:0">${name}</span></div>
							<div class="pill rank">Rank ${rank}</div>
							<div class="pill hcap">+ Hcp ${hcap}</div>
						</div>
						<div class="player-details" id="${id}" hidden>${p.profile || ''}</div>
						<div style="margin-top:8px"><button class="collapse-toggle" data-target="${id}">Profile</button></div>
					`;
					root.appendChild(card);
				});

			root.addEventListener('click', (e) => {
				const btn = e.target.closest('button.collapse-toggle');
				if (!btn) return;
				const target = document.getElementById(btn.getAttribute('data-target'));
				if (target) target.hidden = !target.hidden;
			});
		}
	}
	renderFlights(data.flights);
	renderAccommodation(data.accommodation);
	renderGolfEvents(data.golfEvents);
}

loadConfig().then(initUI);


