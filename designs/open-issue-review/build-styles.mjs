import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
await build({
	configFile: false,
	root,
	plugins: [tailwindcss()],
	build: {
		outDir: fileURLToPath(new URL('./assets', import.meta.url)),
		emptyOutDir: false,
		lib: {
			entry: fileURLToPath(new URL('./style-entry.js', import.meta.url)),
			formats: ['es'],
			fileName: 'styles',
			cssFileName: 'app',
		},
	},
});
