import { describe, expect, it } from 'vitest';
import { selectSnippetTargetLine } from './snippet';

describe('selectSnippetTargetLine', () => {
  it('prefers a matching class-bearing line over an approximate frontmatter line', () => {
    const lines = [
      '---',
      'const spacingMapping = {',
      '  md: "py-20"',
      '};',
      '---',
      '<section>',
      '  <div class:list={[\'hero-content\', alignClasses]}>',
      '    <h1 class="hero-title text-4xl">Hero</h1>',
      '  </div>',
      '</section>',
    ];

    expect(
      selectSnippetTargetLine(lines, 2, {
        tagName: 'div',
        className: 'hero-content text-center md:text-left',
      })
    ).toBe(7);
  });

  it('keeps the approximate line when no better match exists', () => {
    const lines = ['<div>', '  <span>Label</span>', '</div>'];

    expect(selectSnippetTargetLine(lines, 2, { tagName: 'span' })).toBe(2);
  });
});
