import type { AstroIntegration } from 'astro';
import { astroGrabInstrumentation } from './vite/plugin.js';
import { astroGrabMiddleware } from './server/middleware.js';
import type { GrabOptions } from './types.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function astroGrab(options: GrabOptions = {}): AstroIntegration {
  return {
    name: '@hiimwiktor/astro-grab',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript, command }) => {
        if (command !== 'dev' || options.enabled === false) return;

        const isTS = __dirname.includes('src');
        const clientPath = path.resolve(__dirname, isTS ? './client.ts' : './client.js');

        updateConfig({
          vite: {
            plugins: [astroGrabInstrumentation(clientPath) as any],
          },
        });

        injectScript('page', `globalThis.__ASTRO_GRAB_OPTIONS__ = ${JSON.stringify(options)};`);
        injectScript('page', "import '@hiimwiktor/astro-grab/client';");
      },
      'astro:server:setup': ({ server }) => {
        if (options.enabled === false || server.config.command !== 'serve') return;
        astroGrabMiddleware(server as any, {
          contextLines: options.contextLines ?? 5,
          template: options.template,
        });
      },
    },
  };
}

export default astroGrab;
