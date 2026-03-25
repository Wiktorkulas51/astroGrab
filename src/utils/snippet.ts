import fs from 'node:fs/promises';
import path from 'node:path';
import type { SnippetResponse } from '../types';

export interface SnippetTargetDescriptor {
  tagName?: string;
  id?: string;
  className?: string;
}

export async function getSnippet(
  filePath: string,
  lineNumber: number,
  contextLines: number,
  rootPath: string,
  target: SnippetTargetDescriptor = {}
): Promise<SnippetResponse> {
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const fullPath = normalize(path.resolve(rootPath, filePath));
  const normalizedRoot = normalize(rootPath);

  if (!fullPath.startsWith(normalizedRoot)) {
    throw new Error(`Access denied: Path is outside of project root.\nRoot: ${normalizedRoot}\nPath: ${fullPath}`);
  }

  const content = await fs.readFile(fullPath, 'utf8');
  const lines = content.split('\n');
  const targetLine = selectSnippetTargetLine(lines, lineNumber, target);
  const start = Math.max(0, targetLine - contextLines - 1);
  const end = Math.min(lines.length, targetLine + contextLines);

  const snippet = lines.slice(start, end).join('\n');

  return {
    file: filePath,
    snippet,
    startLine: start + 1,
    endLine: end,
    targetLine,
    language: path.extname(filePath).slice(1) || 'text',
  };
}

export function selectSnippetTargetLine(
  lines: string[],
  lineNumber: number,
  target: SnippetTargetDescriptor = {}
): number {
  const index = Math.min(Math.max(lineNumber - 1, 0), Math.max(lines.length - 1, 0));
  const baseScore = scoreSnippetLine(lines[index] ?? '', target);
  let bestLine = lineNumber;
  let bestScore = baseScore;
  const searchRadius = Math.max(12, Math.min(40, Math.floor(lines.length / 4)));
  const start = Math.max(0, index - searchRadius);
  const end = Math.min(lines.length - 1, index + searchRadius);

  for (let current = start; current <= end; current++) {
    const candidateScore = scoreSnippetLine(lines[current], target);
    if (candidateScore <= 0) continue;

    const distance = Math.abs(current + 1 - lineNumber);
    const score = candidateScore * 10 - distance;
    if (score > bestScore) {
      bestScore = score;
      bestLine = current + 1;
    }
  }

  return bestLine;
}

function scoreSnippetLine(line: string, target: SnippetTargetDescriptor): number {
  const normalized = line.trim();
  if (!normalized) return 0;

  let score = 0;
  const tagName = target.tagName?.toLowerCase();
  if (tagName) {
    const openingTagPattern = new RegExp(`<${escapeRegExp(tagName)}\\b`);
    if (openingTagPattern.test(normalized)) score += 20;
    if (new RegExp(`</${escapeRegExp(tagName)}\\b`).test(normalized)) score += 4;
  }

  if (target.id) {
    if (matchesAttributeValue(normalized, 'id', target.id)) score += 12;
  }

  const classTokens = (target.className ?? '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 6);

  for (const token of classTokens) {
    if (normalized.includes(token)) score += 5;
  }

  if (normalized.includes('class:list') || normalized.includes('className')) score += 3;
  if (normalized.startsWith('<')) score += 2;
  return score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesAttributeValue(line: string, name: string, value: string): boolean {
  const escaped = escapeRegExp(value);
  const quotedPattern = new RegExp(`${name}\\s*=\\s*["'][^"']*${escaped}[^"']*["']`);
  const unquotedPattern = new RegExp(`${name}\\s*=\\s*[^\\s>]*${escaped}[^\\s>]*`);
  return quotedPattern.test(line) || unquotedPattern.test(line);
}
