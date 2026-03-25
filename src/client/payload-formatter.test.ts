import { describe, expect, it } from 'vitest';
import { formatGrabPrompt } from './payload-formatter';

describe('formatGrabPrompt', () => {
  it('renders a compact structured prompt', () => {
    const output = formatGrabPrompt({
      elementType: 'button',
      elementKind: 'interactive',
      path: 'body > main > section.card > button#save',
      attributes: ['id="save"', 'class="btn btn-primary"'],
      source: {
        file: 'src/components/Card.astro',
        line: 11,
        language: 'astro',
        startLine: 10,
        endLine: 12,
        snippet: '<div>\n  <button>Save changes</button>\n</div>',
      },
      instruction: '',
    });

    expect(output).toContain('ELEMENT');
    expect(output).toContain('PATH');
    expect(output).toContain('ATTRIBUTES');
    expect(output).toContain('SOURCE');
    expect(output).toContain('SNIPPET');
    expect(output).toContain('INSTRUCTION');
    expect((output.match(/\bINSTRUCTION\b/g) ?? []).length).toBe(1);
    expect(output).toContain('> 11 |   <button>Save changes</button>');
    expect(output).not.toContain('Edit the smallest source node that controls this element.');
    expect(output).not.toContain('outerHTML');
  });

  it('includes DOM only in full mode', () => {
    const output = formatGrabPrompt(
      {
        elementType: 'button',
        elementKind: 'interactive',
        path: 'body > main > button#save',
        attributes: ['id="save"'],
        dom: '<button id="save">Save</button>',
        source: {
          file: 'src/components/Card.astro',
          line: 12,
          language: 'astro',
          startLine: 10,
          endLine: 13,
          snippet: '<button>Save</button>',
        },
        instruction: '',
      },
      { payloadMode: 'full' }
    );

    expect(output).toContain('DOM');
    expect(output).toContain('<button id="save">Save</button>');
  });
});
