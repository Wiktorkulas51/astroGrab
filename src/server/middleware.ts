import type { ViteDevServer } from 'vite';
import { getSnippet } from '../utils/snippet.js';
import type { GrabOptions } from '../types.js';

export function astroGrabMiddleware(server: ViteDevServer, options: GrabOptions) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url?.startsWith('/__astro-grab/snippet')) {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const rawFile = url.searchParams.get('file');
        const file = rawFile ? decodeURIComponent(rawFile) : null;
        const line = parseInt(url.searchParams.get('line') || '1', 10);

        if (!file) {
          res.statusCode = 400;
          return res.end('Missing file parameter');
        }

        const data = await getSnippet(
          file,
          line,
          options.contextLines || 5,
          server.config.root
        );

        // Apply template
        const template = options.template || '{{snippet}}';
        const result = template
          .replace(/{{snippet}}/g, data.snippet)
          .replace(/{{file}}/g, data.file)
          .replace(/{{line}}/g, String(data.targetLine))
          .replace(/{{language}}/g, data.language);

        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ...data, result }));
      } catch (error: any) {
        res.statusCode = 500;
        return res.end(error?.message || 'Internal Server Error');
      }
    }
    return next();
  });
}

