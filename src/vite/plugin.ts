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

      // 1. Identify and skip areas we should NOT touch
      const rangesToSkip: [number, number][] = [];
      
      // Script and Style blocks
      const blockRegex = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
      let blockMatch;
      while ((blockMatch = blockRegex.exec(code)) !== null) {
        rangesToSkip.push([blockMatch.index, blockMatch.index + blockMatch[0].length]);
      }

      // HTML Comments
      const commentRegex = /<!--[\s\S]*?-->/g;
      let commentMatch;
      while ((commentMatch = commentRegex.exec(code)) !== null) {
        rangesToSkip.push([commentMatch.index, commentMatch.index + commentMatch[0].length]);
      }

      // 2. Blacklist of system tags
      const blacklist = new Set([
        'script', 'style', 'head', 'html', 'body', 'link', 'meta', '!doctype', 
        'fragment', 'title', 'base', 'noscript', 'template'
      ]);

      const tagRegex = /<([a-zA-Z0-9-]+)/g;
      let match;

      while ((match = tagRegex.exec(code)) !== null) {
        const index = match.index;
        const tagName = match[1];

        if (rangesToSkip.some(([s, e]) => index >= s && index < e)) continue;

        if (blacklist.has(tagName.toLowerCase())) continue;
        if (!/^[a-zA-Z]/.test(tagName)) continue;

        const lines = code.substring(0, index).split('\n');
        const line = lines.length;
        const insertPos = index + 1 + tagName.length;

        // Force a space before the attribute
        s.appendLeft(insertPos, ` data-astro-grab="${relativePath}:${line}" `);
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
