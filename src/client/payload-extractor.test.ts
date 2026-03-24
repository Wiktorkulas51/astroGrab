import { describe, expect, it } from 'vitest';
import type { DomLikeElement } from './dom-types';
import { extractPromptPayload } from './payload-extractor';

function createElementFixture() {
  const button = {
    tagName: 'BUTTON',
    id: 'save',
    className: 'btn btn-primary',
    textContent: 'Save changes',
    attributes: [
      { name: 'id', value: 'save' },
      { name: 'class', value: 'btn btn-primary' },
      { name: 'data-ag-line', value: 'src%2Fcomponents%2FCard.astro:12' },
      { name: 'aria-label', value: 'Save changes' },
    ],
    parentElement: null,
    children: [],
    getAttribute(name: string) {
      return Array.from(this.attributes).find((attr) => attr.name === name)?.value ?? null;
    },
    hasAttribute(name: string) {
      return Array.from(this.attributes).some((attr) => attr.name === name);
    },
    querySelectorAll() {
      return [];
    },
  } as DomLikeElement;

  const section = {
    tagName: 'SECTION',
    id: 'actions',
    className: 'card-actions',
    textContent: 'Save changes',
    attributes: [
      { name: 'id', value: 'actions' },
      { name: 'class', value: 'card-actions' },
      { name: 'data-astro-cid-abc', value: '' },
    ],
    parentElement: null,
    children: [button],
    getAttribute(name: string) {
      return Array.from(this.attributes).find((attr) => attr.name === name)?.value ?? null;
    },
    hasAttribute(name: string) {
      return Array.from(this.attributes).some((attr) => attr.name === name);
    },
    querySelectorAll() {
      return [button];
    },
  } as DomLikeElement;

  button.parentElement = section;

  return button;
}

describe('extractPromptPayload', () => {
  it('builds a compact payload without full outerHTML by default', () => {
    const payload = extractPromptPayload(createElementFixture(), {
      file: 'src/components/Card.astro',
      line: 12,
      snippet: '<button>Save changes</button>',
      language: 'astro',
    });

    expect(payload.elementType).toBe('button');
    expect(payload.path).toContain('section#actions.card-actions > button#save.btn.btn-primary');
    expect(payload.attributes).toContain('aria-label="Save changes"');
    expect(payload.attributes).not.toContain('data-ag-line="src%2Fcomponents%2FCard.astro:12"');
    expect(payload.dom).toBeUndefined();
    expect(payload.source.file).toBe('src/components/Card.astro');
  });

  it('includes a localized DOM excerpt when requested', () => {
    const payload = extractPromptPayload(createElementFixture(), {
      file: 'src/components/Card.astro',
      line: 12,
      snippet: '<button>Save changes</button>',
      language: 'astro',
    }, {
      includeDom: true,
      maxDomDepth: 1,
    });

    expect(payload.dom).toContain('<section#actions.card-actions>');
    expect(payload.dom).toContain('<button#save.btn.btn-primary');
  });
});
