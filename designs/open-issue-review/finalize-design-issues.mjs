import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (!process.argv.includes('--apply')) {
	throw new Error('GitHub mutation requires explicit --apply; review the issue mapping first.');
}
const repository = 'MartinoPolo/prejemesi';
const root = fileURLToPath(new URL('../../', import.meta.url));
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const folders = {
	settings: 'settings-control-review',
	commands: 'wishlist-command-review',
	gifts: 'gift-geometry-review',
};
const primary = {
	348: [
		'settings',
		'Picker Save/Cancel and picker-local draft → parent draft → existing global Save.',
	],
	349: ['settings', 'Compact centered palette choices and their selected/draft states.'],
	350: [
		'gifts',
		'Equal neighboring action heights, full hard-shadow containment, full-height square normal List images and text density, role-safe actions; includes the labelled enlarged-text stacking alternative and manager secondary-action placement.',
	],
	353: [
		'commands',
		'One categorized desktop Actions menu with persistent parent/cascading children; mobile category overview → options → Back with all bulk actions and current/mixed/pending/disabled states.',
	],
	354: [
		'gifts',
		'Continuous selected Card/List perimeter and separate keyboard focus; use the selection preview control.',
	],
	355: [
		'commands',
		'Display → Filters: compact checkbox spacing, reachable final rows, fixed navigation clearance and scrolling only when content genuinely overflows. This is filter spacing, not the bulk-sheet header.',
	],
	356: [
		'gifts',
		'High/low textual priority badges outside priority grouping; use varied-content and theme controls. Keep all required badges visible in real components, including manager action combinations; fixture omissions do not override production requirements.',
	],
	357: [
		'gifts',
		'Ghost Like over the image top-right in Grid and thumbnail top-right in List, count beside the heart, no circular background/extra image strip; independently centered readable status stickers and recipient privacy.',
	],
	358: [
		'commands',
		'Mobile bulk-sheet header: selected count once beside Actions, close at right, aligned targets with adequate top/separator clearance. Each current/mixed summary appears once. Hero Settings belongs to #359.',
	],
	359: [
		'commands',
		'Single Display beside the layout switcher, persistent desktop cascades/mobile sections, gear-only hero Settings beside separate icon-only More; preserve the accepted toolbar mask.',
	],
	360: [
		'gifts',
		'Bordered horizontal desktop List cards with existing information hierarchy, square thumbnails and contained actions; do not turn ordinary List into Grid.',
	],
	361: [
		'commands',
		'Grid/List remains switchable inside reorder; switching is not save/exit, Done stays explicit.',
	],
	362: [
		'gifts',
		'Top-left compact grip within a larger hit area in List/Grid; coherent corner inset, distinct focus and safe separation from other controls. Real drag/scroll verification and the sourced auto-loaded styling rule remain implementation work.',
	],
};
const supporting = {
	347: [
		'commands',
		'Context only: reorder entry/Done and layout controls. Fix authoritative order snapshots and real persistence; the static mockup proves neither.',
	],
	352: [
		'commands',
		'Context only: approved bulk hierarchy and failure/selection presentation. Diagnose and test actual mutations and persistence separately.',
	],
	363: [
		'commands',
		'Context only: Display grouping state. Preserve saved preferences and the settled priority fallback; no new visual choice is required.',
	],
	364: [
		'commands',
		'Context only: menu anchoring/cascades and settings popovers. Fix the actual positioning engine; do not copy prototype positioning code.',
	],
};
const fetchOpen = () =>
	JSON.parse(
		gh([
			'issue',
			'list',
			'--repo',
			repository,
			'--state',
			'open',
			'--limit',
			'100',
			'--json',
			'number,title,body,labels',
		]),
	);
const before = fetchOpen();
const backup = new URL('./issue-bodies-before-finalization.json', import.meta.url);
if (!existsSync(backup)) {
	writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
}
const changes = [];
const begin = '<!-- approved-design-handoff:start -->';
const end = '<!-- approved-design-handoff:end -->';
for (const [number, [kind, scope]] of Object.entries({ ...primary, ...supporting })) {
	const issue = JSON.parse(
		gh(['issue', 'view', number, '--repo', repository, '--json', 'body,title,labels,state']),
	);
	if (issue.state !== 'OPEN') {
		throw Error(`Issue ${number} is no longer open; re-audit required`);
	}
	const kinds = [kind];
	if (Number(number) === 362 || Number(number) === 361) {
		kinds.push(kind === 'gifts' ? 'commands' : 'gifts');
	}
	if (Number(number) === 364) {
		kinds.push('settings');
	}
	const paths = kinds.flatMap((key) => {
		const folder = folders[key];
		return [
			`designs/${folder}/refined.html`,
			`designs/${folder}/SUMMARY.md`,
			`designs/${folder}/DESIGN_BRIEF_${folder.toUpperCase().replaceAll('-', '_')}.md`,
		];
	});
	for (const relative of paths) {
		if (!existsSync(path.join(root, relative))) {
			throw Error(`Missing artifact ${relative}`);
		}
	}
	const block = `${begin}\n## Approved design handoff\n\n**Design status:** ${primary[number] ? 'Approved and complete.' : 'No new design decision required; implementation/regression work only.'} ${scope}\n\n**Repository-relative references:**\n${paths.map((relative) => '- `' + relative + '`').join('\n')}\n\n${kind === 'gifts' ? 'Gift Variant C is approved, including its explicitly presented accessibility and manager cases. Historical A/B are retired.' : 'Refined Variant A is approved within the named controls only.'} These references supersede historical layout exploration, not authorization, data-integrity requirements or unchecked implementation acceptance criteria. Preserve the existing app shell, settings tabs/modal, layout-switcher styling and accepted toolbar mask unless this issue explicitly scopes a change.\n\nPrototype interactions and raw Playwright results are design evidence, not proof of production correctness. This issue stays open for implementation and verification. Published design branch: [design/open-issue-review](https://github.com/MartinoPolo/prejemesi/tree/design/open-issue-review). The exact repository-relative paths above live on that branch pending integration into dev.\n${end}`;
	let body = issue.body;
	if (body.includes(begin)) {
		const start = body.indexOf(begin);
		const finish = body.indexOf(end, start);
		if (finish < 0 || body.indexOf(begin, start + begin.length) >= 0) {
			throw Error('Ambiguous existing handoff');
		}
		body = body.slice(0, start) + block + body.slice(finish + end.length);
	} else {
		body = body.trimEnd() + '\n\n' + block + '\n';
	}
	if (Number(number) === 357) {
		const old =
			'- REQ-1: Place the heart at the gift card’s top-right, independent of image badge layout, without the current circular background or outline.';
		const replacement =
			'- REQ-1: Overlay the ghost heart at the image top-right in Grid and thumbnail top-right in List, independent of image badge layout, without a circular background, outline, separate header strip, or reduction of image height (approved Variant C).';
		if (!body.includes(old) && !body.includes(replacement)) {
			throw Error('Unexpected #357 REQ-1');
		}
		body = body.replace(old, replacement);
	}
	gh(['issue', 'edit', number, '--repo', repository, '--body', body]);
	changes.push({
		number: Number(number),
		title: issue.title,
		kind: primary[number] ? 'approved-design' : 'implementation-context',
		scope,
		paths,
		removedLabels: [],
	});
	console.log(`#${number}: ${paths.filter((p) => p.endsWith('.html')).join(', ')}`);
}
const linked = fetchOpen();
for (const change of changes) {
	const issue = linked.find((item) => item.number === change.number);
	if (!issue) {
		throw Error('Missing open issue after update');
	}
	for (const relative of change.paths) {
		if (!issue.body.includes('`' + relative + '`')) {
			throw Error(`Body reference missing on ${change.number}`);
		}
	}
}
const gate = linked.find((issue) => issue.number === 350);
for (const name of gate.labels
	.map((label) => label.name)
	.filter((name) => name === 'design needed' || name === 'HITL')) {
	gh(['issue', 'edit', '350', '--repo', repository, '--remove-label', name]);
	changes.find((issue) => issue.number === 350).removedLabels.push(name);
}
const approvalBody =
	'## Design approved and finalized — Variant C\n\nThe user reviewed the focused gift mockup, found no remaining design mistakes and explicitly requested finalization. The accepted layout is preserved in `designs/gift-geometry-review/refined.html`; `SUMMARY.md`, `variants/DECISION.md` and the design brief record approval, including the labelled enlarged-text alternative and manager secondary-action placement.\n\nThe refined artifact passes raw Playwright role/layout/content and interaction checks at 320/390/768/1440px. Related issue descriptions now contain exact repository-relative mockup and brief paths, not just comment-only references.\n\nRemoved `design needed` and `HITL`: design review was the only human gate. Implementation criteria, actual drag/persistence and production tests remain outstanding; no issue is closed. The handoff is published on design/open-issue-review pending integration into dev.';
const comments = JSON.parse(
	gh(['issue', 'view', '350', '--repo', repository, '--json', 'comments']),
).comments;
const existing = comments.find((comment) => comment.body === approvalBody);
const approvalComment =
	existing?.url || gh(['issue', 'comment', '350', '--repo', repository, '--body', approvalBody]);
const remainingGates = fetchOpen()
	.filter((issue) => issue.labels.some((label) => /design needed|HITL/i.test(label.name)))
	.map(({ number, title, labels }) => ({
		number,
		title,
		labels: labels.map((label) => label.name),
	}));
writeFileSync(
	new URL('./issue-design-links.json', import.meta.url),
	JSON.stringify({ changes, approvalComment, remainingGates }, null, 2) + '\n',
);
console.log(approvalComment);
console.log('Remaining design/HITL gates:', remainingGates);
