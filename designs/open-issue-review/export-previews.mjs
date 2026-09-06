import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.MPX_AI_GENERATED) {
	throw new Error('MPX_AI_GENERATED must be configured.');
}
const designs = fileURLToPath(new URL('../', import.meta.url));
const parent = path.join(process.env.MPX_AI_GENERATED, 'prejemesi');
const destination = path.join(
	parent,
	`open-issue-review-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
await mkdir(parent, { recursive: true });
await mkdir(destination);
for (const folder of [
	'open-issue-review',
	'gift-geometry-review',
	'wishlist-command-review',
	'settings-control-review',
]) {
	await cp(path.join(designs, folder), path.join(destination, folder), { recursive: true });
}
await cp(path.join(designs, 'tokens.css'), path.join(destination, 'tokens.css'));
const index = path.join(destination, 'open-issue-review', 'index.html');
const location = `${JSON.stringify({ destination, index }, null, 2)}\n`;
await writeFile(new URL('./export-location.json', import.meta.url), location);
await writeFile(path.join(destination, 'open-issue-review', 'export-location.json'), location);
console.log(index);
