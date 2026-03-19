import { describe, it, expect, vi } from 'vitest';
import { getSnippet } from './snippet';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

describe('getSnippet', () => {
  it('should extract correct number of context lines', async () => {
    const mockContent = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10';
    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result = await getSnippet('test.astro', 5, 2, process.cwd());

    expect(result.snippet).toContain('3\n4\n5\n6\n7');
    expect(result.startLine).toBe(3);
    expect(result.endLine).toBe(7);
    expect(result.targetLine).toBe(5);
  });

  it('should handle start of file', async () => {
    const mockContent = '1\n2\n3\n4\n5';
    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const result = await getSnippet('test.astro', 1, 2, process.cwd());

    expect(result.snippet).toBe('1\n2\n3');
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(3);
  });
});
