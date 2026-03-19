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

      // 2. Safe Whitelist of tags to instrument
      const safeTags = new Set([
        'div', 'section', 'main', 'article', 'aside', 'nav', 'header', 'footer',
        'a', 'button', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'img', 'ul', 'ol', 'li', 'footer', 'canvas', 'svg', 'form', 'input', 'label'
      ]);

      // 3. Tag identification
      // We look for <tagName followed by space or >
      const tagRegex = /<([a-zA-Z0-9-]+)(?=\s|>)/g;
      let match;

      while ((match = tagRegex.exec(code)) !== null) {
        const index = match.index;
        const tagName = match[1];

        // Skip if inside restricted ranges
        if (rangesToSkip.some(([s, e]) => index >= s && index < e)) {
          continue;
        }

        const lowerName = tagName.toLowerCase();
        
        // ONLY instrument safe tags or PascalCase components
        const isPascalCase = /^[A-Z]/.test(tagName);
        const isSafeTag = safeTags.has(lowerName);

        if (!isSafeTag && !isPascalCase) {
          continue;
        }

        // Final safety: definitely skip system tags even if they start with uppercase (unlikely)
        if (['script', 'style', 'head', 'html', 'body', 'link', 'meta', '!doctype', 'fragment'].includes(lowerName)) {
          continue;
        }

        // Calculate line number
        const lines = code.substring(0, index).split('\n');
        const line = lines.length;
        
        // Inject data-astro-grab attribute
        const insertPos = index + 1 + tagName.length;
        
        // Double check we don't have it already
        const around = code.substring(index, index + 200);
        if (around.includes('data-astro-grab=')) {
          continue;
        }

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
