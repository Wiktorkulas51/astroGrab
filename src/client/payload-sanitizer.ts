import type { DomAttribute, DomLikeElement } from './dom-types.js';

const DEFAULT_IGNORED_ATTRIBUTE_PREFIXES = ['data-astro-', 'data-ag-', 'data-svelte-', 'data-v-'];
const DEFAULT_IGNORED_ATTRIBUTES = new Set(['nonce', 'integrity', 'crossorigin']);
const IMPORTANT_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'class',
  'disabled',
  'for',
  'href',
  'id',
  'name',
  'placeholder',
  'role',
  'src',
  'title',
  'type',
  'value',
  'data-testid',
  'data-state',
  'data-slot',
]);

export interface SanitizerOptions {
  ignoreAttributes?: string[];
}

export function sanitizeAttributes(attributes: ArrayLike<DomAttribute>, options: SanitizerOptions = {}): string[] {
  const ignored = new Set([...(options.ignoreAttributes ?? []), ...DEFAULT_IGNORED_ATTRIBUTES]);
  const result: string[] = [];

  for (const attribute of Array.from(attributes)) {
    if (shouldIgnoreAttribute(attribute.name, ignored)) continue;
    if (!IMPORTANT_ATTRIBUTES.has(attribute.name) && !attribute.name.startsWith('aria-') && !attribute.name.startsWith('data-')) continue;
    result.push(formatAttribute(attribute.name, attribute.value));
  }

  return result;
}

export function buildBreadcrumb(element: DomLikeElement, maxDepth = 6): string {
  const parts: string[] = [];
  let current: DomLikeElement | null = element;

  while (current && parts.length < maxDepth) {
    parts.unshift(describeNode(current));
    current = current.parentElement;
  }

  return parts.join(' > ');
}

export function buildLocalDomExcerpt(
  element: DomLikeElement,
  options: SanitizerOptions & { maxDomDepth?: number; maxChildren?: number } = {}
): string {
  const root = findExcerptRoot(element, options.maxDomDepth ?? 1);
  return serializeDom(root, {
    depth: 0,
    maxDepth: options.maxDomDepth ?? 1,
    maxChildren: options.maxChildren ?? 4,
    ignoreAttributes: options.ignoreAttributes ?? [],
  });
}

export function extractRelevantStyles(styles: Record<string, string>): string[] {
  const relevant: string[] = [];
  const interesting = [
    'display',
    'position',
    'flex-direction',
    'align-items',
    'justify-content',
    'gap',
    'grid-template-columns',
    'overflow',
    'white-space',
    'text-align',
    'font-size',
    'font-weight',
    'line-height',
    'color',
    'background-color',
    'border-radius',
    'pointer-events',
    'z-index',
  ];

  for (const name of interesting) {
    const value = styles[name];
    if (!value || value === 'normal' || value === 'auto' || value === 'rgba(0, 0, 0, 0)') continue;
    relevant.push(`${name}: ${value}`);
  }

  return relevant.slice(0, 6);
}

function findExcerptRoot(element: DomLikeElement, maxDomDepth: number): DomLikeElement {
  let current = element;
  let depth = 0;
  while (current.parentElement && depth < maxDomDepth) {
    current = current.parentElement;
    depth += 1;
  }
  return current;
}

function serializeDom(
  element: DomLikeElement,
  options: { depth: number; maxDepth: number; maxChildren: number; ignoreAttributes: string[] }
): string {
  const indent = '  '.repeat(options.depth);
  const attrs = sanitizeAttributes(element.attributes, {
    ignoreAttributes: [...options.ignoreAttributes, 'id', 'class'],
  });
  const head = `${indent}<${describeNode(element)}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;

  if (options.depth >= options.maxDepth) {
    return head;
  }

  const children = Array.from(element.children).slice(0, options.maxChildren);
  const childLines = children.map((child) => serializeDom(child, { ...options, depth: options.depth + 1 }));
  const moreCount = element.children.length - children.length;
  const tail = moreCount > 0 ? `${indent}  … +${moreCount} more` : '';

  return [head, ...childLines, tail].filter(Boolean).join('\n');
}

function describeNode(element: DomLikeElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join('');
  return `${tag}${id}${classes}`;
}

function formatAttribute(name: string, value: string): string {
  if (!value) return name;
  return `${name}="${value}"`;
}

function shouldIgnoreAttribute(name: string, ignoreAttributes: Set<string>): boolean {
  if (ignoreAttributes.has(name)) return true;
  return DEFAULT_IGNORED_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix));
}
