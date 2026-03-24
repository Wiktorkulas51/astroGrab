import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('falls back to execCommand when navigator clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    const appendChild = vi.fn();
    const remove = vi.fn();
    const focus = vi.fn();
    const select = vi.fn();
    const textarea = { style: {}, value: '', focus, select, remove };

    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild },
      execCommand,
    });

    await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
