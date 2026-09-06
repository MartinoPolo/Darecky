(() => {
	const photos = new URL('../../open-issue-review/assets/photos/', document.currentScript.src)
		.href;
	const icons = {
		more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
		heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
		grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
		gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H7a3 3 0 1 1 3-3l2 3Zm0 0h5a3 3 0 1 0-3-3l-2 3Z"/>',
	};
	const icon = (name) =>
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
	const select = (selector) => document.querySelector(selector);
	const state = {
		view: 'list',
		reorderLayout: 'list',
		role: 'mixed',
		content: 'normal',
		english: false,
		archived: false,
		large: false,
		selection: false,
		busy: false,
		gifts: new Map(),
		order: [0, 1, 2],
	};
	const translate = (czech, english) => (state.english ? english : czech);
	const product = {
		title: 'Citrusový parfém, dárková lahvička 50 ml',
		englishTitle: 'Citrus perfume, 50 ml gift bottle',
		description:
			'Lehká citrusová vůně pro každodenní nošení. Prosím o modrou variantu v lahvičce o objemu 50 ml.',
		englishDescription:
			'A light citrus fragrance for everyday wear. Please choose the blue 50 ml bottle.',
		image: 'g-parfem.jpg',
		price: '2 990 Kč',
		quantity: 3,
		store: 'notino.cz',
		links: ['notino.cz', 'douglas.cz'],
		priority: '',
	};
	const variedProducts = [
		{
			...product,
			title: 'Elektrická kytara včetně pouzdra a příslušenství pro začátečníky',
			englishTitle: 'Electric guitar with a complete beginner accessory kit and padded case',
			description:
				'Červená elektrická kytara. Hodilo by se i měkké pouzdro a sada náhradních strun.',
			englishDescription:
				'A red electric guitar with a padded case and a set of spare strings for a beginner.',
			image: 'g-kytara.jpg',
			price: '3 490 Kč',
			store: 'kytary.cz',
			links: ['kytary.cz', 'muziker.cz', 'thomann.de'],
			priority: 'high',
		},
		{
			...product,
			title: 'Kurz vaření italské kuchyně pro dva',
			englishTitle: 'Italian cooking workshop for two people',
			description:
				'Společný zážitek pro dva. Termín kurzu si domluvíme později podle volných míst.',
			englishDescription:
				'A shared cooking experience for two. We will arrange the date later, subject to availability.',
			image: null,
			price: '2 490 Kč',
			quantity: null,
			store: null,
			links: [],
			priority: 'low',
		},
		{
			...product,
			title: 'Dřevěná šachová souprava s velkou hrací deskou',
			englishTitle: 'Wooden chess set with a large playing board',
			description: 'Dřevěná hrací deska a dobře rozlišitelné figurky pro rodinné večery.',
			englishDescription:
				'A wooden board with clearly distinguishable pieces for family game nights.',
			image: 'g-catan.jpg',
			price: '899 Kč',
			store: 'alza.cz',
			links: ['alza.cz'],
			priority: '',
		},
	];
	function fixtures() {
		const records =
			state.view === 'grid'
				? [
						{ id: 'grid-free', role: 'visitor', number: 0 },
						{
							id: 'grid-received',
							role: 'manager',
							number: 1,
							received: true,
							unavailable: true,
						},
					]
				: state.view === 'reorder'
					? state.order.slice(0, 2).map((number) => ({
							id: `reorder-${number}`,
							role: 'recipient',
							number,
						}))
					: [
							{ id: 'reserve', role: 'visitor', number: 0 },
							{ id: 'cancel', role: 'gifter', number: 1, own: true },
							{ id: 'received', role: 'recipient', number: 2 },
						];
		return records.map((record) => {
			if (!state.gifts.has(record.id)) {
				state.gifts.set(record.id, {
					own: !!record.own,
					received: !!record.received,
					liked: record.number === 1,
					count: record.number === 1 ? 999 : 0,
				});
			}
			return {
				...record,
				...(state.content === 'varied' ? variedProducts[record.number] : product),
				...state.gifts.get(record.id),
				role: state.role === 'mixed' ? record.role : state.role,
			};
		});
	}
	function action(kind, gift, extraClass = '') {
		const labels = {
			reserve: translate('Rezervovat', 'Reserve'),
			cancel: translate('Zrušit rezervaci', 'Cancel reservation'),
			receive: translate('Přijato', 'Received'),
			undo: translate('Vrátit zpět', 'Undo received'),
		};
		const fullLabels = {
			receive: translate('Označit jako přijatý', 'Mark as received'),
			undo: translate('Označit jako nepřijatý', 'Mark as not received'),
		};
		return `<button class="action ${kind} ${extraClass}" data-action="${kind}" data-gift="${gift.id}" aria-label="${fullLabels[kind] || labels[kind]}: ${gift.title}" ${state.busy ? 'disabled' : ''}>${labels[kind]}</button>`;
	}
	function giftMarkup(gift) {
		const recipient = gift.role === 'recipient';
		const manager = gift.role === 'manager';
		const manages = recipient || manager;
		const own = !recipient && gift.own;
		const canReserve =
			!recipient && !own && !gift.received && !gift.unavailable && !state.archived;
		const canCancel = !recipient && own;
		const reservationAction = canCancel ? 'cancel' : canReserve ? 'reserve' : null;
		const primaryAction =
			manages && !state.archived ? (gift.received ? 'undo' : 'receive') : reservationAction;
		const title = state.english ? gift.englishTitle : gift.title;
		const description = state.english ? gift.englishDescription : gift.description;
		const tag = gift.received
			? translate('Přijato', 'Received')
			: !recipient && (own || gift.unavailable)
				? translate('Rezervováno', 'Reserved')
				: null;
		const quantity =
			gift.quantity === null
				? `<span aria-label="${translate('Neomezeně kusů', 'Unlimited quantity')}">${translate('∞ kusů', '∞ pieces')}</span>`
				: translate(`${gift.quantity} kusy`, `${gift.quantity} pieces`);
		const reservationCount =
			!recipient && (own || gift.unavailable)
				? translate(' · 1 rezervováno', ' · 1 reserved')
				: '';
		const role = {
			visitor: 'Návštěvník',
			gifter: 'Dárce · vlastní rezervace',
			recipient: 'Obdarovaný · bez spoilerů',
			manager: 'Správce',
		}[gift.role];
		const scene =
			state.view === 'reorder'
				? 'Úchyt vlevo nahoře'
				: primaryAction === 'reserve'
					? 'Rezervovat + Více'
					: primaryAction === 'cancel'
						? 'Zrušit rezervaci + Více'
						: gift.received
							? 'Vrátit zpět + Více'
							: 'Přijato + Více';
		return `<section class="specimen" data-specimen="${gift.id}"><div class="specimen-label"><strong>${scene}</strong><span>${role}</span></div><article class="gift ${manager ? 'manager' : ''} ${state.selection ? 'selected' : ''}" data-gift-card="${gift.id}" data-role="${gift.role}" aria-busy="${state.busy}">
<div class="photo">${gift.image ? `<img class="product-image" src="${photos}${gift.image}" alt="${title}">` : `<div class="no-image">${icon('gift')}<span>${translate('Bez obrázku', 'No image')}</span></div>`}
${!recipient && state.view !== 'reorder' ? `<button class="like" data-like="${gift.id}" aria-label="${translate('Líbí se mi', 'Like')}: ${title}" aria-pressed="${gift.liked}" ${state.busy ? 'disabled' : ''}>${icon('heart')}<span>${gift.count}</span></button>` : ''}
${tag && state.view !== 'reorder' ? `<span class="state-sticker" data-state="${gift.received ? 'received' : 'reserved'}">${tag}</span>` : ''}
${gift.priority && state.view !== 'reorder' ? `<span class="priority ${gift.priority === 'low' ? 'low' : ''}">${gift.priority === 'low' ? translate('Nízká priorita', 'Low priority') : translate('Nejvíc si přeji', 'High priority')}</span>` : ''}
${manager && reservationAction && primaryAction !== reservationAction && state.view !== 'reorder' ? action(reservationAction, gift, 'image-action') : ''}
${state.view === 'reorder' ? `<button class="reorder-handle" data-grip="${gift.id}" aria-label="Změnit pořadí: ${title}" aria-describedby="question-copy">${icon('grip')}</button>` : ''}
</div>
<div class="gift-content"><h3><button class="detail-link" data-detail="${gift.id}" title="${title}">${title}</button></h3><p class="description">${description}</p><div class="price">${gift.price}</div><div class="quantity">${quantity}${reservationCount}</div>
${manager && (own || gift.unavailable) ? `<p class="manager-identity">${translate('Rezervoval: Petr', 'Reserved by: Petr')}</p>` : ''}
<button class="store" data-links="${gift.id}">${gift.store ? `↗ ${gift.store}${gift.links.length > 1 ? ` +${gift.links.length - 1}` : ''}` : translate('Bez odkazu', 'No link')}</button>
${state.view !== 'reorder' ? `<div class="actions">${primaryAction ? action(primaryAction, gift, 'primary-action') : ''}<button class="action more" data-more="${gift.id}" aria-label="${translate('Více akcí', 'More actions')}: ${title}">${icon('more')}</button></div>` : ''}
</div></article></section>`;
	}
	function render() {
		const questions = {
			list: [
				'1 · Výška, hustota a sousední tlačítka',
				'Obrázek je čtvercový a vyplňuje celou výšku řádku. Má text ještě dost prostoru? Zkontrolujte stejně vysoké akce a volný okraj kolem jejich stínů.',
			],
			grid: [
				'2 · Srdce patří na obrázek',
				'Bez bílého pruhu nad fotografií. Zkontrolujte srdce s počtem vedle něj, celý stavový štítek a okraje spodních akcí.',
			],
			reorder: [
				'3 · Malý úchyt, větší cíl',
				'Úchyt zůstává vlevo nahoře. Tab jej zvýrazní; šipky nahoru/dolů změní pouze místní pořadí. Přetahování prstem a uložení nejsou součástí této ukázky.',
			],
		};
		select('#question-title').textContent = questions[state.view][0];
		select('#question-copy').textContent = questions[state.view][1];
		select('#accessibility-note').hidden = !state.large;
		select('#reorder-layout').hidden = state.view !== 'reorder';
		document
			.querySelectorAll('[data-reorder-layout]')
			.forEach((button) =>
				button.setAttribute(
					'aria-pressed',
					String(button.dataset.reorderLayout === state.reorderLayout),
				),
			);
		const container = select('#specimens');
		container.className = `specimens ${state.view === 'grid' || (state.view === 'reorder' && state.reorderLayout === 'grid') ? 'grid-preview' : ''} ${state.view === 'reorder' ? 'reorder-preview' : ''} ${state.large ? 'large-text' : ''}`;
		if (state.content === 'empty') {
			container.innerHTML =
				'<div class="empty"><h2>Zatím žádné dárky</h2><p>Až přidáte první přání, zobrazí se zde.</p></div>';
		} else if (state.content === 'loading') {
			container.innerHTML =
				'<div role="status">Načítání dárků…</div>' +
				[0, 1]
					.map(
						() =>
							'<div class="specimen skeleton" aria-hidden="true"><div class="gift"><div class="photo"></div><div class="gift-content"><h3>Načítání přání</h3><p>Popis produktu</p><p>2 990 Kč</p></div></div></div>',
					)
					.join('');
		} else {
			container.innerHTML = fixtures().map(giftMarkup).join('');
		}
		document.querySelectorAll('[data-view]').forEach((button) => {
			button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
			button.disabled = state.busy;
		});
		document
			.querySelectorAll('.test-tools input,.test-tools select,.test-tools button')
			.forEach((control) => (control.disabled = state.busy));
	}
	function announce(text) {
		select('#announcement').textContent = text;
	}
	function openDialog(gift, kind) {
		select('#dialog-title').textContent =
			kind === 'menu'
				? translate('Více akcí', 'More actions')
				: kind === 'links'
					? translate('Odkazy na obchody', 'Store links')
					: state.english
						? gift.englishTitle
						: gift.title;
		const description = state.english ? gift.englishDescription : gift.description;
		select('#dialog-body').innerHTML =
			kind === 'menu'
				? `<button class="control" data-detail="${gift.id}">${translate('Zobrazit detail', 'Show details')}</button><button class="control" data-dialog-links="${gift.id}">${translate('Odkazy na obchody', 'Store links')}</button>`
				: kind === 'links'
					? gift.links.length
						? `<ul>${gift.links.map((domain) => `<li><a href="https://${domain}" target="_blank" rel="noopener noreferrer">${domain}</a></li>`).join('')}</ul><p>Ukázkové domény; nejde o ověřené produktové odkazy.</p>`
						: '<p>Toto přání nemá odkaz na obchod.</p>'
					: `${gift.image ? `<img src="${photos}${gift.image}" alt="">` : ''}<p>${description}</p><p><strong>${gift.price}</strong></p><p>${gift.quantity === null ? translate('Neomezeně kusů', 'Unlimited quantity') : translate(`${gift.quantity} kusy`, `${gift.quantity} pieces`)}</p>${gift.role === 'manager' && (gift.own || gift.unavailable) ? '<p>Rezervoval: Petr Svoboda</p>' : ''}<button class="control" data-dialog-links="${gift.id}">${translate('Odkazy na obchody', 'Store links')}</button>`;
		if (!select('#gift-dialog').open) {
			select('#gift-dialog').showModal();
		}
	}
	async function mutate(gift, kind) {
		if (state.busy) {
			return;
		}
		const shouldFail = select('#fail').checked;
		select('#fail').checked = false;
		state.busy = true;
		render();
		announce(translate('Ukládání ukázky…', 'Updating preview…'));
		await new Promise((resolve) => setTimeout(resolve, 600));
		if (!shouldFail) {
			const value = state.gifts.get(gift.id);
			if (kind === 'receive' || kind === 'undo') {
				value.received = kind === 'receive';
			} else if (kind === 'reserve' || kind === 'cancel') {
				value.own = kind === 'reserve';
			} else if (kind === 'like') {
				value.liked = !value.liked;
				value.count += value.liked ? 1 : -1;
			}
		}
		state.busy = false;
		render();
		announce(
			shouldFail
				? translate(
						'Změna se nezdařila. Původní stav zůstal zachován.',
						'Update failed. Previous state retained.',
					)
				: translate(
						'Náhled změněn. Nic se neuložilo na server.',
						'Preview updated. Nothing was saved to a server.',
					),
		);
		select(
			`[data-gift-card="${gift.id}"] .primary-action,[data-gift-card="${gift.id}"] .more`,
		)?.focus({ preventScroll: true });
	}
	document.addEventListener('click', (event) => {
		const button = event.target.closest('button');
		if (!button) {
			return;
		}
		if (button.dataset.view) {
			state.view = button.dataset.view;
			render();
			return;
		}
		if (button.dataset.reorderLayout) {
			state.reorderLayout = button.dataset.reorderLayout;
			render();
			return;
		}
		const key = button.dataset.action
			? button.dataset.gift
			: button.dataset.like ||
				button.dataset.detail ||
				button.dataset.links ||
				button.dataset.more ||
				button.dataset.dialogLinks;
		if (!key) {
			return;
		}
		const gift = fixtures().find((item) => item.id === key);
		if (!gift) {
			return;
		}
		if (button.dataset.action) {
			mutate(gift, button.dataset.action);
		} else if (button.dataset.like) {
			mutate(gift, 'like');
		} else {
			openDialog(
				gift,
				button.dataset.more
					? 'menu'
					: button.dataset.links || button.dataset.dialogLinks
						? 'links'
						: 'detail',
			);
		}
	});
	document.addEventListener('keydown', (event) => {
		const grip = event.target.closest('[data-grip]');
		if (!grip || !['ArrowDown', 'ArrowUp'].includes(event.key)) {
			return;
		}
		event.preventDefault();
		const number = Number(grip.dataset.grip.split('-')[1]);
		const position = state.order.indexOf(number);
		const target = position + (event.key === 'ArrowDown' ? 1 : -1);
		if (target < 0 || target >= 2) {
			return;
		}
		[state.order[position], state.order[target]] = [state.order[target], state.order[position]];
		render();
		select(`[data-grip="${grip.dataset.grip}"]`).focus();
		announce('Místní pořadí změněno. Neuloženo.');
	});
	for (const [id, key] of [
		['role', 'role'],
		['content', 'content'],
		['archived', 'archived'],
		['english', 'english'],
		['large-text', 'large'],
		['selection', 'selection'],
	]) {
		select(`#${id}`).addEventListener('change', (event) => {
			state[key] =
				event.target.type === 'checkbox' ? event.target.checked : event.target.value;
			render();
		});
	}
	select('#dark').addEventListener('change', (event) =>
		document.documentElement.classList.toggle('dark', event.target.checked),
	);
	select('#reset').onclick = () => {
		state.gifts.clear();
		state.order = [0, 1, 2];
		render();
		announce('Stavy ukázek obnoveny.');
	};
	select('#gift-dialog').addEventListener('click', (event) => {
		if (event.target === select('#gift-dialog')) {
			const bounds = event.target.getBoundingClientRect();
			if (
				event.clientX < bounds.left ||
				event.clientX > bounds.right ||
				event.clientY < bounds.top ||
				event.clientY > bounds.bottom
			) {
				event.target.close();
			}
		}
	});
	render();
})();
