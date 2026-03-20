import { describe, it, expect } from 'vitest';
import { astroGrabInstrumentation } from './plugin';

describe('astroGrabInstrumentation', () => {
  const plugin = astroGrabInstrumentation('mock-path') as any;

  it('should inject data-astro-grab into HTML tags', async () => {
    const code = '<div><span>Hello</span></div>';
    const result = await plugin.transform(code, 'src/test.astro');

    expect(result.code).toContain('data-ag-line="src%2Ftest.astro:1"');
    expect(result.code).toContain('<div data-ag-line="src%2Ftest.astro:1">');
    expect(result.code).toContain('<span data-ag-line="src%2Ftest.astro:1">');

  });

  it('should skip script and style tags', async () => {
    const code = '<script>const a = 1;</script><div></div><style>.a{}</style>';
    const result = await plugin.transform(code, 'src/test.astro');

    expect(result.code).not.toContain('<script data-ag-line');
    expect(result.code).not.toContain('<style data-ag-line');
    expect(result.code).toContain('<div data-ag-line');
  });

  it('should handle multiline content', async () => {
    const code = `
<div>
  <span>
    Hello
  </span>
</div>
    `.trim();
    const result = await plugin.transform(code, 'src/test.astro');

    expect(result.code).toContain('<div data-ag-line="src%2Ftest.astro:1">');
    expect(result.code).toContain('<span data-ag-line="src%2Ftest.astro:2">');

  });
});
