import type { DomLikeElement } from './dom-types.js';

export interface TargetCandidate {
  element?: DomLikeElement;
  tagName: string;
  depth?: number;
  area?: number;
  pointHit?: boolean;
  distanceToPoint?: number;
  hasSource?: boolean;
  isInteractive?: boolean;
  isSemantic?: boolean;
  isGenericWrapper?: boolean;
  matchesIgnoreSelector?: boolean;
  matchesPreferSelector?: boolean;
  textLength?: number;
  attributeCount?: number;
}

export interface TargetHeuristics {
  preferInteractive?: boolean;
  preferSemantic?: boolean;
  preferTextContent?: boolean;
  ignoreGenericWrappers?: boolean;
}

const defaultHeuristics: Required<TargetHeuristics> = {
  preferInteractive: true,
  preferSemantic: true,
  preferTextContent: true,
  ignoreGenericWrappers: true,
};

export function pickBestTargetCandidate(
  candidates: TargetCandidate[],
  heuristics: TargetHeuristics = {}
): TargetCandidate | null {
  const settings = { ...defaultHeuristics, ...heuristics };
  let best: TargetCandidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreTargetCandidate(candidate, settings);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function scoreTargetCandidate(
  candidate: TargetCandidate,
  heuristics: Required<TargetHeuristics>
): number {
  if (candidate.matchesIgnoreSelector) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const depth = candidate.depth ?? 0;
  score -= depth * 2;
  if (candidate.hasSource) score += candidate.isGenericWrapper ? 8 : 20;
  if (candidate.matchesPreferSelector) score += 100;
  if (heuristics.preferInteractive && candidate.isInteractive) score += 30;
  if (heuristics.preferSemantic && candidate.isSemantic) score += 20;
  if (heuristics.preferTextContent && (candidate.textLength ?? 0) > 0) score += 8;
  if (heuristics.ignoreGenericWrappers && candidate.isGenericWrapper) score -= 25;
  if ((candidate.attributeCount ?? 0) > 3) score += 4;
  if (candidate.pointHit) score += 35;
  if (typeof candidate.distanceToPoint === 'number') {
    score -= Math.min(candidate.distanceToPoint / 6, 55);
  }
  if (candidate.area && Number.isFinite(candidate.area)) {
    score -= Math.min(Math.sqrt(candidate.area) / 20, 40);
    if (heuristics.ignoreGenericWrappers && candidate.isGenericWrapper && candidate.area > 30000) {
      score -= 18;
    }
  }

  const tag = candidate.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea') {
    score += 12;
  }

  return score;
}

export function resolveTargetFromPoint(
  documentRef: Document,
  x: number,
  y: number,
  options: { ignoreSelectors?: string[]; preferSelectors?: string[]; targetHeuristics?: TargetHeuristics } = {}
): DomLikeElement | null {
  const elements = documentRef.elementsFromPoint(x, y) as DomLikeElement[];
  const candidates: TargetCandidate[] = [];
  const seen = new Set<DomLikeElement>();

  for (const element of elements) {
    collectTargetCandidates(element, candidates, seen, 0, x, y, options);
  }

  const coarseTarget = pickBestTargetCandidate(candidates, options.targetHeuristics)?.element ?? null;
  return coarseTarget ? refineTargetWithinSubtree(coarseTarget, x, y, options.targetHeuristics) : null;
}

export function moveTargetByDepth(element: DomLikeElement, direction: -1 | 1): DomLikeElement | null {
  if (direction < 0) {
    return element.parentElement;
  }

  const children = Array.from(element.children);
  if (!children.length) return null;

  const candidates = children.map((child) => buildCandidate(child, 0, false, false));
  return pickBestTargetCandidate(candidates)?.element ?? children[0] ?? null;
}

export function findSourceAnchor(element: DomLikeElement | null): DomLikeElement | null {
  if (!element) return null;

  let current: DomLikeElement | null = element;
  while (current) {
    if (hasSourceAttributes(current)) return current;
    current = current.parentElement;
  }

  const descendants = collectDescendants(element, 4).filter(hasSourceAttributes);
  if (!descendants.length) return null;

  const candidates = descendants.map((descendant) => buildCandidate(descendant, 0, false, false));
  return pickBestTargetCandidate(candidates)?.element ?? descendants[0] ?? null;
}

function collectTargetCandidates(
  element: DomLikeElement,
  candidates: TargetCandidate[],
  seen: Set<DomLikeElement>,
  depth: number,
  x: number,
  y: number,
  options: { ignoreSelectors?: string[]; preferSelectors?: string[] }
): void {
  if (seen.has(element)) return;
  seen.add(element);

  const matchesIgnoreSelector = matchesAny(element, options.ignoreSelectors);
  const matchesPreferSelector = matchesAny(element, options.preferSelectors);
  candidates.push(buildCandidate(element, depth, matchesIgnoreSelector, matchesPreferSelector, x, y));

  if (element.parentElement) {
    collectTargetCandidates(element.parentElement, candidates, seen, depth + 1, x, y, options);
  }
}

function buildCandidate(
  element: DomLikeElement,
  depth: number,
  matchesIgnoreSelector: boolean,
  matchesPreferSelector: boolean,
  x?: number,
  y?: number
): TargetCandidate {
  const tagName = element.tagName.toLowerCase();
  const rect = element.getBoundingClientRect?.();
  const distanceToPoint = rect && typeof x === 'number' && typeof y === 'number' ? distanceToRect(x, y, rect) : undefined;
  return {
    tagName,
    element,
    depth,
    area: rect ? rect.width * rect.height : undefined,
    distanceToPoint,
    hasSource: element.hasAttribute('data-ag-line') || element.hasAttribute('data-astro-source-loc'),
    isInteractive: isInteractiveTag(tagName) || hasInteractiveAttributes(element),
    isSemantic: isSemanticTag(tagName),
    isGenericWrapper: isGenericWrapperTag(tagName) || hasFrameworkWrapperAttributes(element),
    matchesIgnoreSelector,
    matchesPreferSelector,
    textLength: (element.textContent ?? '').trim().length,
    attributeCount: element.attributes.length,
  };
}

function refineTargetWithinSubtree(
  element: DomLikeElement,
  x: number,
  y: number,
  heuristics: TargetHeuristics = {}
): DomLikeElement {
  const descendants = collectDescendants(element, 4);
  if (!descendants.length) return element;

  const rootCandidate = buildCandidate(element, 0, false, false, x, y);
  rootCandidate.pointHit = (rootCandidate.distanceToPoint ?? Number.POSITIVE_INFINITY) === 0;
  const candidates: TargetCandidate[] = [rootCandidate];
  for (const descendant of descendants) {
    const candidate = buildCandidate(descendant, 1, false, false, x, y);
    candidate.pointHit = (candidate.distanceToPoint ?? Number.POSITIVE_INFINITY) === 0;
    if (candidate.pointHit || (candidate.distanceToPoint ?? Number.POSITIVE_INFINITY) <= 32) {
      candidates.push(candidate);
    }
  }

  const best = pickBestTargetCandidate(candidates, heuristics);
  return best?.element ?? element;
}

function collectDescendants(element: DomLikeElement, maxDepth: number): DomLikeElement[] {
  const result: DomLikeElement[] = [];
  const queue: Array<{ node: DomLikeElement; depth: number }> = [{ node: element, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;

    for (const child of Array.from(current.node.children)) {
      result.push(child);
      queue.push({ node: child, depth: current.depth + 1 });
    }
  }

  return result;
}

function distanceToRect(x: number, y: number, rect: DOMRect | DOMRectReadOnly): number {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function hasSourceAttributes(element: DomLikeElement): boolean {
  return element.hasAttribute('data-ag-line') || element.hasAttribute('data-astro-source-loc');
}

function matchesAny(element: DomLikeElement, selectors?: string[]): boolean {
  if (!selectors?.length || !element.matches) return false;
  return selectors.some((selector) => element.matches?.(selector));
}

function isInteractiveTag(tagName: string): boolean {
  return ['button', 'a', 'input', 'textarea', 'select', 'summary', 'label'].includes(tagName);
}

function isSemanticTag(tagName: string): boolean {
  return ['article', 'aside', 'figure', 'footer', 'header', 'main', 'nav', 'section', 'table', 'ul', 'ol', 'li', 'p'].includes(tagName);
}

function isGenericWrapperTag(tagName: string): boolean {
  return ['div', 'span', 'fragment'].includes(tagName);
}

function hasInteractiveAttributes(element: DomLikeElement): boolean {
  return element.hasAttribute('role') || element.hasAttribute('href') || element.hasAttribute('aria-label');
}

function hasFrameworkWrapperAttributes(element: DomLikeElement): boolean {
  return Array.from(element.attributes).some((attr) => attr.name.startsWith('data-astro-cid') || attr.name.startsWith('data-svelte-') || attr.name.startsWith('data-v-'));
}
