import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';

function inspectorLogger(): Plugin {
	return {
		name: 'vite-inspector-logger',
		enforce: 'pre',
		configureServer(server) {
			server.middlewares.use('/__open-in-editor', (req, res) => {
				const url = new URL(req.url!, 'http://localhost');
				const file = url.searchParams.get('file');
				console.log(`[inspector] ${file}`);
				res.statusCode = 200;
				res.end();
			});
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), inspectorLogger(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
