import type { Plugin } from 'vite';
import MagicString from 'magic-string';
import path from 'node:path';
import fs from 'node:fs/promises';

const virtualModuleId = '@hiimwiktor/astro-grab/client';
const resolvedVirtualModuleId = '\0' + virtualModuleId;
const helperVirtualIds = new Map([
  ['clipboard', '@hiimwiktor/astro-grab/client/clipboard'],
  ['payload-extractor', '@hiimwiktor/astro-grab/client/payload-extractor'],
  ['payload-formatter', '@hiimwiktor/astro-grab/client/payload-formatter'],
  ['payload-sanitizer', '@hiimwiktor/astro-grab/client/payload-sanitizer'],
  ['runtime-config', '@hiimwiktor/astro-grab/client/runtime-config'],
  ['target-resolver', '@hiimwiktor/astro-grab/client/target-resolver'],
  ['dom-types', '@hiimwiktor/astro-grab/client/dom-types'],
  ['types', '@hiimwiktor/astro-grab/types'],
]);

export function astroGrabInstrumentation(clientScriptPath: string): Plugin {
  const clientDir = path.dirname(clientScriptPath);
  const helperExt = clientScriptPath.endsWith('.js') ? '.js' : '.ts';
  const relativeHelperImports: Record<string, string> = {
    './client/clipboard.js': helperVirtualIds.get('clipboard')!,
    './client/payload-extractor.js': helperVirtualIds.get('payload-extractor')!,
    './client/payload-formatter.js': helperVirtualIds.get('payload-formatter')!,
    './client/payload-sanitizer.js': helperVirtualIds.get('payload-sanitizer')!,
    './client/runtime-config.js': helperVirtualIds.get('runtime-config')!,
    './client/target-resolver.js': helperVirtualIds.get('target-resolver')!,
    './client/dom-types.js': helperVirtualIds.get('dom-types')!,
    './types.js': helperVirtualIds.get('types')!,
    '../types.js': helperVirtualIds.get('types')!,
  };

  return {
    name: 'astro-grab-instrumentation',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      if ([...helperVirtualIds.values()].includes(id)) {
        return '\0' + id;
      }
      if (importer === resolvedVirtualModuleId && relativeHelperImports[id]) {
        return '\0' + relativeHelperImports[id];
      }
      return null;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return rewriteImports(await fs.readFile(clientScriptPath, 'utf8'), relativeHelperImports);
      }
      if (id === '\0' + helperVirtualIds.get('clipboard')) {
        return fs.readFile(path.join(clientDir, 'client', `clipboard${helperExt}`), 'utf8');
      }
      if (id === '\0' + helperVirtualIds.get('payload-extractor')) {
        return rewriteImports(
          await fs.readFile(path.join(clientDir, 'client', `payload-extractor${helperExt}`), 'utf8'),
          {
            './dom-types.js': helperVirtualIds.get('dom-types')!,
            './payload-sanitizer.js': helperVirtualIds.get('payload-sanitizer')!,
          }
        );
      }
      if (id === '\0' + helperVirtualIds.get('payload-formatter')) {
        return rewriteImports(
          await fs.readFile(path.join(clientDir, 'client', `payload-formatter${helperExt}`), 'utf8'),
          {
            './payload-extractor.js': helperVirtualIds.get('payload-extractor')!,
          }
        );
      }
      if (id === '\0' + helperVirtualIds.get('payload-sanitizer')) {
        return rewriteImports(
          await fs.readFile(path.join(clientDir, 'client', `payload-sanitizer${helperExt}`), 'utf8'),
          {
            './dom-types.js': helperVirtualIds.get('dom-types')!,
          }
        );
      }
      if (id === '\0' + helperVirtualIds.get('runtime-config')) {
        return rewriteImports(
          await fs.readFile(path.join(clientDir, 'client', `runtime-config${helperExt}`), 'utf8'),
          {
            '../types.js': helperVirtualIds.get('types')!,
          }
        );
      }
      if (id === '\0' + helperVirtualIds.get('target-resolver')) {
        return rewriteImports(
          await fs.readFile(path.join(clientDir, 'client', `target-resolver${helperExt}`), 'utf8'),
          {
            './dom-types.js': helperVirtualIds.get('dom-types')!,
          }
        );
      }
      if (id === '\0' + helperVirtualIds.get('dom-types')) {
        return fs.readFile(path.join(clientDir, 'client', `dom-types${helperExt}`), 'utf8');
      }
      if (id === '\0' + helperVirtualIds.get('types')) {
        return fs.readFile(path.join(clientDir, `types${helperExt}`), 'utf8');
      }
      return null;
    },
    async transform(rawCode, id) {
      // Check for .astro files but ignore node_modules
      // Also ignore vite internal requests (queries)
      if (!id.endsWith('.astro') || id.includes('node_modules') || id.includes('?')) {
        return null;
      }

      try {
        const s = new MagicString(rawCode);
        const relativePath = path.relative(process.cwd(), id).replace(/\\/g, '/');


        const rangesToSkip: [number, number][] = [];
        
        // 0. Astro Frontmatter (--- ... ---)
        const frontmatterRegex = /^---\s*[\s\S]*?^---/m;
        const fmMatch = frontmatterRegex.exec(rawCode);
        if (fmMatch) {
          const start = fmMatch.index;
          const end = start + fmMatch[0].length;
          rangesToSkip.push([start, end]);
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

        // 2b. JS-style Comments in Template { /* ... */ }
        const jsCommentRegex = /\{\/\*[\s\S]*?\*\/\}/g;
        let jsCommentMatch;
        while ((jsCommentMatch = jsCommentRegex.exec(rawCode)) !== null) {
          rangesToSkip.push([jsCommentMatch.index, jsCommentMatch.index + jsCommentMatch[0].length]);
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

          // Robust check for comparisons (a < b, a <b, etc.)
          // Skip if preceded by characters that are not part of a tag start sequence
          let i = index - 1;
          while (i >= 0 && /\s/.test(rawCode[i])) i--;
          
          if (i >= 0) {
            const prevChar = rawCode[i];
            // Characters that can immediately precede a JSX/Astro tag
            const startOfTagChars = new Set(['(', '[', '{', ',', ':', '=', '&', '|', '?', '>', ';']);
            
            if (!startOfTagChars.has(prevChar)) {
              // Not a standard tag start, check if it's a keyword like 'return' or 'yield'
              let wordEnd = i;
              let wordStart = i;
              while (wordStart > 0 && /[a-zA-Z0-9_$]/.test(rawCode[wordStart - 1])) wordStart--;
              const word = rawCode.substring(wordStart, wordEnd + 1);
              
              const keywords = new Set(['return', 'yield', 'await', 'default', 'case', 'delete', 'void', 'typeof']);
              if (!keywords.has(word)) {
                continue; // It's a comparison or something else (like a string "a"<b)
              }
            }
          }

          if (blacklist.has(tagName.toLowerCase())) continue;

          // Count lines precisely
          const substring = rawCode.substring(0, index);
          let lineCount = 1;
          for (let i = 0; i < substring.length; i++) {
            if (substring[i] === '\n') lineCount++;
          }
          
          const insertPos = index + 1 + tagName.length;
          const encodedPath = encodeURIComponent(relativePath);
          // Added trailing space to ensure it doesn't merge with the next attribute/bracket
          s.appendLeft(insertPos, ` data-ag-line="${encodedPath}:${lineCount}" `);
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

function rewriteImports(code: string, replacements: Record<string, string>): string {
  let rewritten = code;
  for (const [from, to] of Object.entries(replacements)) {
    rewritten = rewritten.replace(new RegExp(`from\\s+['\"]${escapeRegExp(from)}['\"]`, 'g'), `from '${to}'`);
    rewritten = rewritten.replace(new RegExp(`import\\s+['\"]${escapeRegExp(from)}['\"]`, 'g'), `import '${to}'`);
  }
  return rewritten;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
