import type { ViteDevServer } from 'vite';
import { getSnippet } from '../utils/snippet';
import type { GrabOptions } from '../types';

export function astroGrabMiddleware(server: ViteDevServer, options: GrabOptions) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url?.startsWith('/__astro-grab/snippet')) {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const file = url.searchParams.get('file');
        const line = parseInt(url.searchParams.get('line') || '1', 10);

        if (!file) {
          res.statusCode = 400;
          return res.end('Missing file parameter');
        }

        const snippet = await getSnippet(
          file,
          line,
          options.contextLines || 5,
          server.config.root
        );

        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(snippet));
      } catch (error: any) {
        res.statusCode = 500;
        return res.end(error?.message || 'Internal Server Error');
      }
    }
    return next();
  });
}

