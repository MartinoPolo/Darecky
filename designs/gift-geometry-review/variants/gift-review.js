const variant = document.body.dataset.variant;
const ROOT = new URL('../../open-issue-review/assets/photos/', document.currentScript.src).href;
const icons = {
	heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>',
	more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
	grip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>',
};
const gifts = [
	{
		id: 'perfume',
		cs: 'Parfém Maison Margiela Replica — By the Fireplace, toaletní voda 100 ml',
		en: 'Maison Margiela Replica — By the Fireplace eau de toilette, 100 ml',
		price: '2 890 Kč',
		photo: 'g-parfem.jpg',
		links: ['notino.cz', 'douglas.cz'],
		priority: 'high',
		likes: 128,
		liked: true,
		status: 'available',
		qty: 1,
		desc: 'Dřevitá vůně s vanilkou, ideálně balení 100 ml.',
	},
	{
		id: 'guitar',
		cs: 'Elektroakustická kytara Yamaha APX600 v orientální modré',
		en: 'Yamaha APX600 electro-acoustic guitar in oriental blue',
		price: '8 590 Kč',
		photo: 'g-kytara.jpg',
		links: ['kytary.cz'],
		likes: 0,
		status: 'reserved',
		owner: true,
		qty: 1,
		reserver: 'Klára V.',
	},
	{
		id: 'catan',
		cs: 'CATAN — Big Box, české vydání pro společné herní večery',
		en: 'CATAN Big Box, Czech edition for game nights',
		price: '1 499 Kč',
		photo: 'g-catan.jpg',
		links: ['planetaher.cz', 'imago.cz', 'albi.cz'],
		priority: 'low',
		likes: 17,
		status: 'reserved',
		qty: 1,
		reserver: 'Petr K.',
	},
	{
		id: 'book',
		cs: 'Duna — kompletní ilustrované vydání v pevné vazbě',
		en: 'Dune — complete illustrated hardcover edition',
		price: '1 099 Kč',
		photo: 'g-dune.jpg',
		links: ['knihydobrovsky.cz'],
		likes: 4,
		liked: true,
		status: 'received',
		qty: 1,
		reserver: 'Babička Eva',
	},
	{
		id: 'course',
		cs: 'Víkendový kurz moderní české kuchyně pro dva',
		en: 'Weekend modern Czech cooking course for two',
		price: '2 400 Kč',
		photo: 'g-poukaz.jpg',
		links: ['chefparade.cz', 'slevomat.cz'],
		priority: 'high',
		likes: 9,
		status: 'partial',
		qty: 3,
		reserver: 'Jana N.',
	},
	{
		id: 'kindle',
		cs: 'Čtečka Kindle Paperwhite Signature Edition 32 GB bez reklam',
		en: 'Kindle Paperwhite Signature Edition 32 GB without ads',
		price: '4 690 Kč',
		photo: 'g-kindle.jpg',
		links: ['amazon.de', 'alza.cz'],
		likes: 3,
		status: 'available',
		qty: null,
		desc: 'Libovolná barevná varianta; více kusů je v pořádku.',
	},
	{
		id: 'atlas',
		cs: 'Atlas hub — kapesní vydání do lesa bez obrázku',
		en: 'Pocket mushroom atlas for forest trips without an image',
		price: '329 Kč',
		photo: null,
		links: [],
		likes: 101,
		status: 'available',
		qty: 2,
		desc: 'Záměrný stav bez obrázku a bez odkazu.',
	},
];
const text = {
	cs: {
		for: 'Pro: Martin Novák',
		title: 'Narozeniny Martina',
		shared: 'Sdílený seznam',
		count: '7 přání',
		wishes: 'Přání',
		reserve: 'Rezervovat',
		cancel: 'Zrušit rezervaci',
		received: 'Přijato',
		undo: 'Vrátit zpět',
		mark: 'Označit jako přijatý',
		unmark: 'Označit jako nepřijatý',
		reserved: 'Rezervováno',
		mine: 'Rezervováno vámi',
		partial: 'Volné 2 ze 3',
		got: 'Přijato',
		more: 'Další možnosti',
		pending: 'Ukládám…',
		error: 'Demo: změnu se nepodařilo uložit; předchozí stav zůstal zachován.',
		empty: 'Zatím žádná přání',
		loading: 'Načítání přání',
		noImage: 'Obrázek není k dispozici',
		noLink: 'Bez odkazu',
		multiple: 'Více kusů',
		reorder:
			'Změna pořadí: použijte 60×60 úchyt; šipky jsou alternativa. Ukazatelový drag není v prototypu implementován.',
		selection: 'Režim výběru',
		demo: 'Demo: změna proběhla pouze místně.',
	},
	en: {
		for: 'For: Martin Novák',
		title: "Martin's birthday",
		shared: 'Shared list',
		count: '7 wishes',
		wishes: 'Wishes',
		reserve: 'Reserve',
		cancel: 'Cancel reservation',
		received: 'Received',
		undo: 'Undo',
		mark: 'Mark as received',
		unmark: 'Mark as not received',
		reserved: 'Reserved',
		mine: 'Reserved by you',
		partial: '2 of 3 available',
		got: 'Received',
		more: 'More actions',
		pending: 'Saving…',
		error: 'Demo: the change could not be saved; the previous state was retained.',
		empty: 'No wishes yet',
		loading: 'Loading wishes',
		noImage: 'Image unavailable',
		noLink: 'No link',
		multiple: 'Multiple',
		reorder:
			'Reorder: use the 60×60 grip; arrows are an alternative. Pointer drag is not implemented in this prototype.',
		selection: 'Selection mode',
		demo: 'Demo: change applied locally only.',
	},
};
const state = {
	role: 'visitor',
	view: 'list',
	context: 'browse',
	fixture: 'default',
	theme: 'light',
	locale: 'cs',
	pending: null,
	error: null,
	selected: new Set(['perfume']),
};
const t = (k) => text[state.locale][k],
	name = (g) => (state.locale === 'cs' ? g.cs : g.en),
	esc = (s) =>
		String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
document.body.innerHTML = `<aside class="prototype-tools"><div class="prototype-head"><strong>Variant ${variant} · ${variant === 'A' ? 'full-width mobile footer' : 'content-column mobile actions'}</strong><span>Prototype controls · local simulation · neither variant approved</span><span class="prototype-links"><a href="./variant-a.html">A</a> · <a href="./variant-b.html">B</a> · <a href="../../open-issue-review/index.html">Comparison index</a></span></div><div class="controls" id="controls"></div></aside><div id="app" class="app-shell"><header class="app-nav"><div class="brand"><span class="brand-mark">🎁</span>Přejeme si</div><nav class="nav-links"><a href="#lists">Moje seznamy</a><a href="#managed">Spravované</a><a href="#followed">Sledované</a></nav><button class="icon-button" aria-label="Přepnout motiv">☼</button><button class="icon-button" aria-label="Účet Martina Nováka">MN</button></header><main class="page"><section class="hero"><p class="recipient" id="for"></p><h1 id="title"></h1><div class="chips"><span class="chip" id="shared"></span><span class="chip" id="count"></span><span class="chip" id="archive" hidden>Archivováno</span></div><figure class="polaroid"><img src="${ROOT}wl-bday.jpg" alt="Narozeninová oslava"></figure></section><div class="sticky"><div class="mask"></div><nav class="toolbar"><div class="view-buttons"><button class="app-button" data-app-view="cards" aria-label="Karty">▦</button><button class="app-button" data-app-view="list" aria-label="Seznam">☷</button></div><button class="app-button">Řazení</button><button class="app-button">Seskupení</button><span class="spacer"></span><button class="app-button primary" id="add">＋ Přidat přání</button></nav></div><h2 class="collection-title" id="wishes"></h2><p class="mode-help" id="help" hidden></p><div class="gift-list" id="list"></div><section class="legend"><h2>Evidence · Variant ${variant}</h2><p>${variant === 'A' ? 'Only below 640 px, List actions span the whole card footer.' : 'Only below 640 px, List actions stay in the content column beside the thumbnail.'} Both use identical fixtures, chrome, Card view and desktop List geometry.</p><p>Actions share row height and More remains adjacent. Reorder proposes a 60×60 grip plus arrow alternative; pointer drag and production persistence are not implemented. Desktop before/after measurements remain pending implementation verification.</p></section></main></div><div id="toast" class="toast" role="status" hidden></div>`;
const controls = {
	role: ['visitor', 'gifter', 'recipient', 'manager'],
	view: ['list', 'cards'],
	context: ['browse', 'selection', 'reorder'],
	fixture: ['default', 'archived', 'pending', 'error', 'loading', 'empty'],
	theme: ['light', 'dark'],
	locale: ['cs', 'en'],
};
controlsEl = document.querySelector('#controls');
controlsEl.innerHTML = Object.entries(controls)
	.map(
		([key, vals]) =>
			`<fieldset class="control"><legend>${key}</legend><div class="choices" data-control="${key}">${vals.map((v) => `<button class="choice" data-value="${v}">${v}</button>`).join('')}</div></fieldset>`,
	)
	.join('');
function roleStatus(g) {
	if (g.owner && g.status === 'reserved') {
		return state.role === 'gifter' || state.role === 'manager' ? 'own' : 'reserved';
	}
	return g.status;
}
function overlay(g) {
	if (state.role === 'recipient') {
		return roleStatus(g) === 'received'
			? `<span class="state-sticker received">${t('got')}</span>`
			: '';
	}
	const s = roleStatus(g);
	if (s === 'own') {
		return `<span class="state-sticker own">${t('mine')}</span>`;
	}
	if (s === 'reserved') {
		return `<span class="state-sticker unavailable">${t('reserved')}</span>`;
	}
	if (s === 'partial') {
		return `<span class="state-sticker">${t('partial')}</span>`;
	}
	if (s === 'received') {
		return `<span class="state-sticker received">${t('got')}</span>`;
	}
	return '';
}
function like(g) {
	return state.role === 'recipient'
		? ''
		: `<button class="like" data-like="${g.id}" aria-label="${g.liked ? 'Unlike' : 'Like'}: ${esc(name(g))}" aria-pressed="${!!g.liked}">${icons.heart}<span>${g.likes}</span></button>`;
}
function actionSpecs(g) {
	const s = roleStatus(g),
		archived = state.fixture === 'archived';
	if (state.role === 'recipient') {
		return archived
			? []
			: [
					{
						kind: 'received',
						label: s === 'received' ? t('undo') : t('received'),
						aria: (s === 'received' ? t('unmark') : t('mark')) + ': ' + name(g),
					},
				];
	}
	const out = [];
	if (s === 'own') {
		out.push({
			kind: 'cancel',
			label: t('cancel'),
			aria: t('cancel') + ': ' + name(g),
			cancel: true,
		});
	} else if (!archived && (s === 'available' || s === 'partial')) {
		out.push({ kind: 'reserve', label: t('reserve'), aria: t('reserve') + ': ' + name(g) });
	}
	if (state.role === 'manager' && !archived) {
		out.push({
			kind: 'received',
			label: s === 'received' ? t('undo') : t('received'),
			aria: (s === 'received' ? t('unmark') : t('mark')) + ': ' + name(g),
		});
	}
	return out;
}
function actions(g) {
	if (state.context !== 'browse') {
		return '';
	}
	const specs = actionSpecs(g);
	if (!specs.length && state.role === 'recipient') {
		return '';
	}
	return `<div class="actions">${specs.map((a) => `<button class="action primary-action ${a.cancel ? 'cancel' : ''}" data-action="${a.kind}" data-id="${g.id}" aria-label="${esc(a.aria)}" ${state.pending === g.id ? 'disabled aria-busy="true"' : ''}>${state.pending === g.id ? `<span class="spinner"></span>${t('pending')}` : a.label}</button>`).join('')}<button class="action more" data-more="${g.id}" aria-label="${t('more')}: ${esc(name(g))}">${icons.more}</button></div>`;
}
function mode(g, i) {
	if (state.context === 'selection') {
		return `<button class="selection" data-select="${g.id}" aria-label="${t('selection')}: ${esc(name(g))}" aria-pressed="${state.selected.has(g.id)}">${state.selected.has(g.id) ? '✓' : ''}</button>`;
	}
	if (state.context === 'reorder') {
		return `<div class="reorder"><span>${i + 1}/${gifts.length}</span><button class="grip" aria-label="Grip: ${esc(name(g))}" title="${t('reorder')}">${icons.grip}</button><button class="action move" data-move="-1" data-id="${g.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="action move" data-move="1" data-id="${g.id}" aria-label="Move down" ${i === gifts.length - 1 ? 'disabled' : ''}>↓</button></div>`;
	}
	return '';
}
function card(g, i) {
	const s = roleStatus(g),
		dim = state.role !== 'recipient' && (s === 'reserved' || s === 'received');
	const photo = g.photo
		? `<img src="${ROOT + g.photo}" alt="${esc(name(g))}">`
		: `<div class="fallback" role="img" aria-label="${t('noImage')}">🎁<br>${t('noImage')}</div>`;
	const links = g.links.length
		? g.links.map((x) => `<a class="gift-link" href="#store-${x}">↗ ${x}</a>`).join('')
		: `<span>${t('noLink')}</span>`;
	return `<article class="gift ${state.view === 'list' ? 'list-item' : 'card-item'} ${dim ? 'dimmed' : ''} ${state.context === 'selection' && state.selected.has(g.id) ? 'selected' : ''} ${state.context === 'reorder' ? 'reorder-active' : ''}" tabindex="0"><div class="gift-photo">${photo}${overlay(g)}</div><div class="gift-content"><div class="gift-title-lane"><h3 class="gift-title">${esc(name(g))}</h3><span class="quantity">${g.qty === null ? t('multiple') : g.qty + ' ks'}</span></div><div class="meta"><span class="price">${g.price}</span>${g.priority ? `<span class="priority ${g.priority}">${g.priority === 'high' ? 'Vysoká priorita' : 'Nízká priorita'}</span>` : ''}</div><div class="links">${links}</div>${g.desc ? `<p class="description">${g.desc}</p>` : ''}${state.role === 'manager' && g.reserver ? `<p class="reserver">Rezervoval/a: ${g.reserver}</p>` : ''}</div>${like(g)}${actions(g)}${state.error === g.id ? `<p class="local-error" role="alert">${t('error')}</p>` : ''}${mode(g, i)}</article>`;
}
function toast(msg) {
	const el = document.querySelector('#toast');
	el.textContent = msg;
	el.hidden = false;
	clearTimeout(toast.timer);
	toast.timer = setTimeout(() => (el.hidden = true), 1800);
}
function render() {
	document.documentElement.lang = state.locale;
	document.documentElement.classList.toggle('dark', state.theme === 'dark');
	document.querySelector('#app').classList.toggle('recipient-mode', state.role === 'recipient');
	for (const [id, key] of [
		['for', 'for'],
		['title', 'title'],
		['shared', 'shared'],
		['count', 'count'],
		['wishes', 'wishes'],
	]) {
		document.querySelector('#' + id).textContent = t(key);
	}
	document.querySelector('#archive').hidden = state.fixture !== 'archived';
	document.querySelector('#add').hidden = !['recipient', 'manager'].includes(state.role);
	document
		.querySelectorAll('[data-app-view]')
		.forEach((b) => b.setAttribute('aria-pressed', b.dataset.appView === state.view));
	document
		.querySelectorAll('[data-control]')
		.forEach((g) =>
			g
				.querySelectorAll('button')
				.forEach((b) =>
					b.setAttribute('aria-pressed', state[g.dataset.control] === b.dataset.value),
				),
		);
	const help = document.querySelector('#help');
	help.hidden = state.context === 'browse';
	help.textContent = state.context === 'reorder' ? t('reorder') : t('selection');
	const list = document.querySelector('#list');
	list.className = 'gift-list ' + state.view;
	if (state.fixture === 'empty') {
		list.innerHTML = `<div class="status"><h3>${t('empty')}</h3></div>`;
	} else if (state.fixture === 'loading') {
		list.innerHTML =
			'<div class="gift skeleton"></div><div class="gift skeleton"></div><div class="gift skeleton"></div>';
	} else {
		list.innerHTML = gifts.map(card).join('');
	}
	bind();
}
function mutate(id, kind) {
	const g = gifts.find((x) => x.id === id),
		before = { status: g.status };
	state.error = null;
	state.pending = id;
	render();
	setTimeout(() => {
		state.pending = null;
		if (state.fixture === 'error') {
			Object.assign(g, before);
			state.error = id;
			render();
			return;
		}
		if (kind === 'reserve') {
			g.status = 'reserved';
			g.owner = true;
		}
		if (kind === 'cancel') {
			g.status = 'available';
			g.owner = false;
		}
		if (kind === 'received') {
			g.status = g.status === 'received' ? 'available' : 'received';
		}
		render();
		toast(t('demo'));
	}, 500);
}
function bind() {
	document
		.querySelectorAll('[data-action]')
		.forEach((b) => (b.onclick = () => mutate(b.dataset.id, b.dataset.action)));
	document.querySelectorAll('[data-like]').forEach(
		(b) =>
			(b.onclick = () => {
				const g = gifts.find((x) => x.id === b.dataset.like);
				g.liked = !g.liked;
				g.likes += g.liked ? 1 : -1;
				render();
				toast(t('demo'));
			}),
	);
	document.querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => toast(t('demo'))));
	document.querySelectorAll('[data-select]').forEach(
		(b) =>
			(b.onclick = () => {
				if (state.selected.has(b.dataset.select)) {
					state.selected.delete(b.dataset.select);
				} else {
					state.selected.add(b.dataset.select);
				}
				render();
			}),
	);
	document.querySelectorAll('[data-move]').forEach(
		(b) =>
			(b.onclick = () => {
				const i = gifts.findIndex((x) => x.id === b.dataset.id),
					n = i + Number(b.dataset.move);
				if (n >= 0 && n < gifts.length) {
					[gifts[i], gifts[n]] = [gifts[n], gifts[i]];
					render();
				}
			}),
	);
}
document.querySelectorAll('[data-control] button').forEach(
	(b) =>
		(b.onclick = () => {
			const key = b.closest('[data-control]').dataset.control;
			state[key] = b.dataset.value;
			if (
				key === 'context' &&
				state.context !== 'browse' &&
				!['recipient', 'manager'].includes(state.role)
			) {
				state.role = 'manager';
			}
			render();
		}),
);
document.querySelectorAll('[data-app-view]').forEach(
	(b) =>
		(b.onclick = () => {
			state.view = b.dataset.appView;
			render();
		}),
);
render();
