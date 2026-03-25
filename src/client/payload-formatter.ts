import type { PromptPayload } from './payload-extractor.js';

export interface FormatPromptOptions {
  payloadMode?: 'compact' | 'full';
  template?: string;
}

export function formatGrabPrompt(payload: PromptPayload, options: FormatPromptOptions = {}): string {
  if (options.template) {
    return renderTemplate(options.template, payload);
  }

  return formatStructuredPrompt(payload, options.payloadMode ?? 'compact');
}

function formatStructuredPrompt(payload: PromptPayload, mode: 'compact' | 'full'): string {
  const lines: string[] = [
    'ELEMENT',
    payload.elementType,
    '',
    'PATH',
    payload.path,
    '',
    'ATTRIBUTES',
    payload.attributes.length ? payload.attributes.join('\n') : '(none)',
  ];

  if (payload.computedStyles?.length) {
    lines.push('', 'COMPUTED STYLES', payload.computedStyles.join('\n'));
  }

  if (mode === 'full' && payload.dom) {
    lines.push('', 'DOM', payload.dom);
  } else if (payload.dom && mode !== 'full') {
    lines.push('', 'DOM', payload.dom);
  }

  lines.push(
    '',
    'SOURCE',
    `file: ${payload.source.file}`,
    `line: ${payload.source.line}`,
    `language: ${payload.source.language}`,
    '',
    'SNIPPET',
    '```astro',
    renderNumberedSnippet(payload),
    '```',
    '',
    'INSTRUCTION'
  );

  if (payload.instruction.trim()) {
    lines.push(payload.instruction.trim());
  }

  return lines.join('\n');
}

function renderTemplate(template: string, payload: PromptPayload): string {
  const values: Record<string, string> = {
    attributes: payload.attributes.join('\n'),
    computedStyles: payload.computedStyles?.join('\n') ?? '',
    dom: payload.dom ?? '',
    element: payload.elementType,
    file: payload.source.file,
    instruction: payload.instruction,
    language: payload.source.language,
    line: String(payload.source.line),
    path: payload.path,
    snippet: renderNumberedSnippet(payload),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

function renderNumberedSnippet(payload: PromptPayload): string {
  const snippet = payload.source.snippet.trimEnd();
  const lines = snippet.split('\n');
  if (!payload.source.startLine || !payload.source.line) {
    return snippet;
  }

  const startLine = payload.source.startLine;
  const targetLine = payload.source.line;
  const width = String(payload.source.endLine ?? startLine + lines.length - 1).length;

  return lines
    .map((line, index) => {
      const lineNumber = startLine + index;
      const marker = lineNumber === targetLine ? '>' : ' ';
      return `${marker} ${String(lineNumber).padStart(width, ' ')} | ${line}`;
    })
    .join('\n');
}
