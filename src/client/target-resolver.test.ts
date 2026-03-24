import { describe, expect, it } from 'vitest';
import { findSourceAnchor, moveTargetByDepth, pickBestTargetCandidate, resolveTargetFromPoint } from './target-resolver';

describe('pickBestTargetCandidate', () => {
  it('prefers an interactive child over a generic wrapper', () => {
    const target = pickBestTargetCandidate([
      { tagName: 'DIV', depth: 1, hasSource: true, isGenericWrapper: true },
      { tagName: 'BUTTON', depth: 2, hasSource: true, isInteractive: true },
    ]);

    expect(target?.tagName).toBe('BUTTON');
  });

  it('skips candidates that match ignored selectors', () => {
    const target = pickBestTargetCandidate(
      [
        { tagName: 'DIV', depth: 1, hasSource: true, matchesIgnoreSelector: true },
        { tagName: 'SECTION', depth: 2, hasSource: true, isSemantic: true },
      ]
    );

    expect(target?.tagName).toBe('SECTION');
  });

  it('prefers explicit selector hints when present', () => {
    const target = pickBestTargetCandidate(
      [
        { tagName: 'DIV', depth: 1, hasSource: true, isGenericWrapper: true },
        { tagName: 'ARTICLE', depth: 2, hasSource: true, isSemantic: true, matchesPreferSelector: true },
      ]
    );

    expect(target?.tagName).toBe('ARTICLE');
  });

  it('prefers the deeper sensible child over a wrapper when scores are otherwise close', () => {
    const target = pickBestTargetCandidate([
      { tagName: 'DIV', depth: 0, area: 120000, hasSource: true, isGenericWrapper: true },
      { tagName: 'BUTTON', depth: 1, area: 8000, hasSource: true, isInteractive: true },
    ]);

    expect(target?.tagName).toBe('BUTTON');
  });

  it('moves to parent on upward navigation', () => {
    const child = {
      tagName: 'BUTTON',
      parentElement: null,
      children: [],
      attributes: [],
      id: '',
      className: '',
      textContent: '',
      getAttribute: () => null,
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ width: 100, height: 30 } as DOMRectReadOnly),
    } as any;
    const parent = {
      tagName: 'DIV',
      parentElement: null,
      children: [child],
      attributes: [],
      id: '',
      className: '',
      textContent: '',
      getAttribute: () => null,
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ width: 400, height: 200 } as DOMRectReadOnly),
    } as any;
    child.parentElement = parent;

    expect(moveTargetByDepth(child, -1)).toBe(parent);
  });

  it('moves to best child on downward navigation', () => {
    const button = {
      tagName: 'BUTTON',
      parentElement: null,
      children: [],
      attributes: [],
      id: '',
      className: '',
      textContent: 'Save',
      getAttribute: () => null,
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ width: 110, height: 34 } as DOMRectReadOnly),
    } as any;
    const span = {
      tagName: 'SPAN',
      parentElement: null,
      children: [],
      attributes: [],
      id: '',
      className: '',
      textContent: 'Label',
      getAttribute: () => null,
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ width: 200, height: 28 } as DOMRectReadOnly),
    } as any;
    const parent = {
      tagName: 'DIV',
      parentElement: null,
      children: [span, button],
      attributes: [],
      id: '',
      className: '',
      textContent: '',
      getAttribute: () => null,
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ width: 800, height: 400 } as DOMRectReadOnly),
    } as any;
    span.parentElement = parent;
    button.parentElement = parent;

    expect(moveTargetByDepth(parent, 1)).toBe(button);
  });

  it('refines a coarse wrapper selection to the descendant under the cursor', () => {
    const button = createNode('BUTTON', 140, 40, 120, 36);
    const section = createNode('SECTION', 80, 60, 320, 160, [button]);
    const doc = {
      elementsFromPoint: () => [section],
    } as any;

    expect(resolveTargetFromPoint(doc, 150, 120, {} as any)).toBe(section);
  });

  it('prefers the nearest descendant over a source-bearing wrapper when hovering inside a subtree', () => {
    const child = createNode('DIV', 150, 140, 120, 40);
    const wrapper = createNode('DIV', 100, 100, 360, 220, [child], true);
    const doc = {
      elementsFromPoint: () => [wrapper],
    } as any;

    expect(resolveTargetFromPoint(doc, 165, 155, {} as any)).toBe(child);
  });

  it('finds the nearest source-bearing element when the current wrapper has none', () => {
    const button = createNode('BUTTON', 140, 40, 120, 36, [], true);
    const section = createNode('SECTION', 80, 60, 320, 160, [button]);
    const main = createNode('MAIN', 0, 0, 800, 500, [section]);

    expect(findSourceAnchor(main)).toBe(button);
  });
});

function createNode(
  tagName: string,
  left: number,
  top: number,
  width: number,
  height: number,
  children: any[] = [],
  hasSource = false
) {
  const node: any = {
    tagName,
    parentElement: null,
    children,
    attributes: hasSource
      ? [{ name: 'data-ag-line', value: 'src%2Fcomponents%2FCard.astro:12' }]
      : [],
    id: '',
    className: '',
    textContent: '',
    getAttribute: (name: string) => (hasSource && name === 'data-ag-line' ? 'src%2Fcomponents%2FCard.astro:12' : null),
    hasAttribute: (name: string) => hasSource && name === 'data-ag-line',
    getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height, width, height } as DOMRectReadOnly),
  };

  for (const child of children) {
    child.parentElement = node;
  }

  return node;
}
