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
    template = `### PROŚBA O ZMIANĘ DLA @AI

**Plik:** {{file}}
**Lokalizacja:** Linia {{line}}

**Struktura DOM:**
\`\`\`html
{{dom}}
\`\`\`

**Kod źródłowy:**
\`\`\`astro
{{snippet}}
\`\`\`

---
**Instrukcja:** `

  } = options;


  return {
    name: '@hiimwiktor/astro-grab',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript, command }) => {
        // Strictly only run in dev mode unless explicitly enabled in options
        const shouldRun = command === 'dev' || options.enabled === true;
        if (!shouldRun) return;


        // Path to the client script - in dev it's .ts, in prod it will be .js
        const isTS = __dirname.includes('src');
        const clientPath = path.resolve(__dirname, isTS ? './client.ts' : './client.js');

        updateConfig({
          vite: {
            plugins: [astroGrabInstrumentation(clientPath) as any],
          },
        });


        // Inject the client-side script via virtual module
        injectScript('page', "import '@hiimwiktor/astro-grab/client';");

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

