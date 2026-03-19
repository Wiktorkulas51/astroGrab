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

      // Check for .astro files but ignore node_modules
      // Also ignore vite internal requests (queries)
      if (!id.endsWith('.astro') || id.includes('node_modules') || id.includes('?')) {
        return null;
      }

      try {
        const rawCode = await fs.readFile(id, 'utf8');
        const s = new MagicString(rawCode);
        const relativePath = path.relative(process.cwd(), id).replace(/\\/g, '/');

        const rangesToSkip: [number, number][] = [];
        
        // 0. Astro Frontmatter (--- ... ---)
        const frontmatterRegex = /^---\s*[\s\S]*?^---/m;
        const fmMatch = frontmatterRegex.exec(rawCode);
        if (fmMatch) {
          rangesToSkip.push([fmMatch.index, fmMatch.index + fmMatch[0].length]);
        }

        // 1. Script/Style blocks
        const blockRegex = /<(script|style|textarea)[^>]*>[\s\S]*?<\/\1>/gi;
        let blockMatch;
        while ((blockMatch = blockRegex.exec(rawCode)) !== null) {
          rangesToSkip.push([blockMatch.index, blockMatch.index + blockMatch[0].length]);
        }

        // 2. HTML Comments
        const commentRegex = /<!--[\s\S]*?-->/g;
        let commentMatch;
        while ((commentMatch = commentRegex.exec(rawCode)) !== null) {
          rangesToSkip.push([commentMatch.index, commentMatch.index + commentMatch[0].length]);
        }

        // 3. Blacklist of system tags
        const blacklist = new Set([
          'script', 'style', 'head', 'html', 'body', 'link', 'meta', '!doctype', 
          'fragment', 'title', 'base', 'noscript', 'template'
        ]);

        const tagRegex = /<([a-zA-Z][a-zA-Z0-9-:]*)/g;
        let match;

        while ((match = tagRegex.exec(rawCode)) !== null) {
          const index = match.index;
          const tagName = match[1];

          // Skip if inside restricted ranges
          if (rangesToSkip.some(([start, end]) => index >= start && index < end)) continue;
          if (blacklist.has(tagName.toLowerCase())) continue;

          // Count lines precisely
          const substring = rawCode.substring(0, index);
          let lineCount = 1;
          for (let i = 0; i < substring.length; i++) {
            if (substring[i] === '\n') lineCount++;
          }
          
          const insertPos = index + 1 + tagName.length;
          s.appendLeft(insertPos, ` data-ag-line="${relativePath}:${lineCount}" `);
        }

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id })
        };
      } catch (e) {
        return null; // Let others handle it if we fail
      }
    }
  };
}
