// Photo generator front-end logic
(async function initPhotoGen(){
	const fileInput = document.getElementById('photo-file');
	const golferSelect = document.getElementById('photo-golfer');
	const generateBtn = document.getElementById('photo-generate');
	const statusEl = document.getElementById('photo-status');
	const resultEl = document.getElementById('photo-result');
	if (!fileInput || !golferSelect || !generateBtn) return;

	// Reuse existing config loader
	let config;
	try {
		const cacheBust = Date.now();
		const isGithubRepoView = location.hostname === 'github.com' || location.hostname === 'www.github.com';
		const configUrl = isGithubRepoView
			? 'https://raw.githubusercontent.com/GaryBary/WebAppFH25/main/data/config.json'
			: `data/config.json?_cb=${cacheBust}`;
		const res = await fetch(configUrl, { cache: 'no-store' });
		config = await res.json();
	} catch (e) {
		config = {};
	}

	const photoCfg = config.photoGen || {};
	const apiBase = photoCfg.apiBase || 'https://webappfh25.onrender.com';
	const listA = photoCfg.topGolfers || [
		"Scottie Scheffler","Rory McIlroy","Xander Schauffele","Russell Henley","Collin Morikawa"
	];
	const listB = photoCfg.altGolfers || [
		"Greg Norman","Tiger Woods","John Daly","Phil Mickelson","Bubba Watson","Bryson DeChambeau"
	];

	const options = [
		{label: 'Today\'s Favourites', values: listA},
		{label: 'Alternative Favourites', values: listB}
	];
	golferSelect.innerHTML = '';
	options.forEach(group => {
		const optGroup = document.createElement('optgroup');
		optGroup.label = group.label;
		group.values.forEach(name => {
			const opt = document.createElement('option');
			opt.value = name; opt.textContent = name; optGroup.appendChild(opt);
		});
		golferSelect.appendChild(optGroup);
	});

	function updateButtonState(){
		generateBtn.disabled = !(fileInput.files && fileInput.files[0] && golferSelect.value);
	}
	fileInput.addEventListener('change', updateButtonState);
	golferSelect.addEventListener('change', updateButtonState);

	generateBtn.addEventListener('click', async () => {
		const file = fileInput.files && fileInput.files[0];
		const golfer = golferSelect.value;
		if (!file || !golfer) return;
		statusEl.textContent = 'Uploading and generating…';
		resultEl.innerHTML = '';
		generateBtn.disabled = true;
		try {
			const form = new FormData();
			form.append('image', file);
			form.append('golfer', golfer);
			const res = await fetch(`${apiBase}/api/photo/generate`, { method: 'POST', body: form});
			if (!res.ok) {
				const detail = await res.text().catch(()=>'');
				throw new Error(`HTTP ${res.status} ${res.statusText} ${detail || ''}`.trim());
			}
			const data = await res.json().catch(async () => {
				const txt = await res.text();
				throw new Error('Invalid JSON: ' + txt.slice(0,200));
			});
			const url = data?.imageUrl;
			if (url) {
				const img = document.createElement('img');
				img.src = url; img.alt = `You with ${golfer}`; img.style.maxWidth = '100%'; img.style.borderRadius = '12px';
				resultEl.appendChild(img);
				statusEl.textContent = 'Done!';
			} else {
				statusEl.textContent = 'No image returned.';
			}
		} catch (err) {
			console.error(err);
			statusEl.textContent = 'Generation failed: ' + (err?.message || 'Unknown error');
		} finally {
			generateBtn.disabled = false;
		}
	});
})();
