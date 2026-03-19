import fs from 'node:fs/promises';
import path from 'node:path';
import type { SnippetResponse } from '../types';

export async function getSnippet(
  filePath: string,
  lineNumber: number,
  contextLines: number,
  rootPath: string
): Promise<SnippetResponse> {
  // Resolve and sanitize path
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const fullPath = normalize(path.resolve(rootPath, filePath));
  const normalizedRoot = normalize(rootPath);
  
  if (!fullPath.startsWith(normalizedRoot)) {
    throw new Error(`Access denied: Path is outside of project root.\nRoot: ${normalizedRoot}\nPath: ${fullPath}`);
  }


  const content = await fs.readFile(fullPath, 'utf8');
  const lines = content.split('\n');
  
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  
  const snippet = lines.slice(start, end).join('\n');

  return {
    file: filePath,
    snippet,
    startLine: start + 1,
    endLine: end,
    targetLine: lineNumber,
    language: path.extname(filePath).slice(1) || 'text'
  };
}
