import type { DomLikeElement, PromptSourceInfo } from './dom-types.js';
import { buildBreadcrumb, buildLocalDomExcerpt, extractRelevantStyles, sanitizeAttributes } from './payload-sanitizer.js';

export interface ExtractPromptOptions {
  payloadMode?: 'compact' | 'full';
  includeComputedStyles?: boolean;
  includeDom?: boolean;
  maxDomDepth?: number;
  maxChildren?: number;
  ignoreAttributes?: string[];
}

export interface PromptPayload {
  elementType: string;
  elementKind: 'interactive' | 'semantic' | 'generic' | 'other';
  path: string;
  attributes: string[];
  computedStyles?: string[];
  dom?: string;
  source: PromptSourceInfo;
  instruction: string;
}

export function extractPromptPayload(
  element: DomLikeElement,
  source: PromptSourceInfo,
  options: ExtractPromptOptions = {}
): PromptPayload {
  const elementType = element.tagName.toLowerCase();
  const elementKind = classifyElementKind(elementType);
  const path = buildBreadcrumb(element);
  const attributes = sanitizeAttributes(element.attributes, { ignoreAttributes: options.ignoreAttributes });
  const computedStyles = readComputedStyles(element, options.includeComputedStyles);
  const dom = buildDomFragment(element, options);

  return {
    elementType,
    elementKind,
    path,
    attributes,
    computedStyles,
    dom,
    source,
    instruction: '',
  };
}

function buildDomFragment(element: DomLikeElement, options: ExtractPromptOptions): string | undefined {
  if (options.payloadMode === 'full') {
    return sanitizeFullOuterHtml(element, options.ignoreAttributes);
  }

  if (!options.includeDom) return undefined;
  return buildLocalDomExcerpt(element, {
    ignoreAttributes: options.ignoreAttributes,
    maxDomDepth: options.maxDomDepth,
    maxChildren: options.maxChildren,
  });
}

function sanitizeFullOuterHtml(element: DomLikeElement, ignoreAttributes?: string[]): string {
  if (!element.outerHTML) return '';

  if (!element.outerHTML.includes('data-')) return element.outerHTML;

  const clone = element.outerHTML;
  return clone.replace(/\sdata-(?:astro|ag|svelte|v)[^=]*(?:="[^"]*")?/g, (match) => {
    const name = match.trim().split('=')[0].slice(1);
    if (ignoreAttributes?.includes(name)) return '';
    return '';
  });
}

function readComputedStyles(element: DomLikeElement, includeComputedStyles?: boolean): string[] | undefined {
  if (!includeComputedStyles || typeof window === 'undefined' || !window.getComputedStyle) {
    return undefined;
  }

  const style = window.getComputedStyle(element as Element);
  const entries: Record<string, string> = {};
  for (const property of ['display', 'position', 'flex-direction', 'align-items', 'justify-content', 'gap', 'grid-template-columns', 'overflow', 'white-space', 'text-align', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border-radius', 'pointer-events', 'z-index']) {
    entries[property] = style.getPropertyValue(property);
  }

  return extractRelevantStyles(entries);
}

function classifyElementKind(tagName: string): PromptPayload['elementKind'] {
  if (['button', 'a', 'input', 'textarea', 'select', 'summary', 'label'].includes(tagName)) return 'interactive';
  if (['article', 'aside', 'figure', 'footer', 'header', 'main', 'nav', 'section', 'table', 'ul', 'ol', 'li', 'p'].includes(tagName)) return 'semantic';
  if (['div', 'span'].includes(tagName)) return 'generic';
  return 'other';
}
