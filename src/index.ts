import type { AstroIntegration } from 'astro';
import { astroGrabInstrumentation } from './vite/plugin.js';
import { astroGrabMiddleware } from './server/middleware.js';
import type { GrabOptions } from './types.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function astroGrab(options: GrabOptions = {}): AstroIntegration {
  const {
    enabled = true,
    contextLines = 5,
    template = '{{snippet}}'
  } = options;

  return {
    name: 'astro-grab',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript, command }) => {
        // Only run in dev mode unless explicitly enabled
        if (command !== 'dev' && !enabled) return;

        // Path to the client script - in dev it's .ts, in prod it will be .js
        // For simplicity during development of the package itself:
        const clientPath = path.resolve(__dirname, './client.ts');

        updateConfig({
          vite: {
            plugins: [astroGrabInstrumentation(clientPath) as any],
          },
        });

        // Inject the client-side script via virtual module
        injectScript('page', "import 'astro-grab/client';");

      },
      'astro:server:setup': ({ server }) => {
        if (enabled) {
          astroGrabMiddleware(server as any, { contextLines, template });
        }
      }

    },
  };
}

export default astroGrab;

