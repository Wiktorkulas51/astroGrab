import type { Plugin } from 'vite';
import MagicString from 'magic-string';
import path from 'node:path';
import fs from 'node:fs/promises';

const virtualModuleId = 'astro-grab/client';
const resolvedVirtualModuleId = '\0' + virtualModuleId;

export function astroGrabInstrumentation(clientScriptPath: string): Plugin {
  return {
    name: 'astro-grab-instrumentation',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return await fs.readFile(clientScriptPath, 'utf8');
      }
      return null;
    },
    async transform(code: string, id: string) {
      if (!id.endsWith('.astro')) return null;

      const s = new MagicString(code);
      const relativePath = path.relative(process.cwd(), id).replace(/\\/g, '/');

      // 1. Identify and skip script/style blocks
      const blocksToSkip: [number, number][] = [];
      const blockRegex = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
      let blockMatch;
      while ((blockMatch = blockRegex.exec(code)) !== null) {
        blocksToSkip.push([blockMatch.index, blockMatch.index + blockMatch[0].length]);
      }

      // 2. Tag identification regex
      const tagRegex = /<([a-zA-Z0-9-]+)(?![^>]*\sdata-astro-grab=)(?=[^>]*>)/g;
      let match;

      while ((match = tagRegex.exec(code)) !== null) {
        const index = match.index;
        const tagName = match[1];

        // Check if we are inside a skip block
        if (blocksToSkip.some(([s, e]) => index >= s && index < e)) {
          continue;
        }

        // Skip non-UI tags
        if (['script', 'style', 'head', 'html', 'body', 'link', 'meta', '!doctype'].includes(tagName.toLowerCase())) {
          continue;
        }

        // Calculate line number
        const lines = code.substring(0, index).split('\n');
        const line = lines.length;
        
        // Inject data-astro-grab attribute
        const insertPos = index + 1 + tagName.length;
        s.appendLeft(insertPos, ` data-astro-grab="${relativePath}:${line}"`);
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true })
        };
      }
      return null;
    }
  };
}
