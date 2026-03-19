
const MagicString = require('magic-string');
const path = require('node:path');
const fs = require('node:fs');

const filePath = 'D:/Programy/Klient/dr Krzysztof Mystek/src/components/studio/design-system/RulesSection.astro';
const rawCode = fs.readFileSync(filePath, 'utf8');
const s = new MagicString(rawCode);
const id = filePath;
// Use a fixed root for relative path calculation
const rootPath = 'D:/Programy/Klient/dr Krzysztof Mystek';
const relativePath = path.relative(rootPath, id).replace(/\\/g, '/');

const rangesToSkip = [];

// 0. Astro Frontmatter
const frontmatterRegex = /^---\s*[\s\S]*?^---/m;
const fmMatch = frontmatterRegex.exec(rawCode);
if (fmMatch) {
  rangesToSkip.push([fmMatch.index, fmMatch.index + fmMatch[0].length]);
}

// 1. Script/Style blocks
const blockRegex = /<(script|style|textarea)[^>]*>[\s\S]*?<\/\1>/gi;
let blockMatch;
while ((blockMatch = blockRegex.exec(rawCode)) !== null) {
  rangesToSkip.push([blockMatch.index, blockMatch.index + blockMatch[0].length]);
}

// 2. HTML Comments
const commentRegex = /<!--[\s\S]*?-->/g;
let commentMatch;
while ((commentMatch = commentRegex.exec(rawCode)) !== null) {
  rangesToSkip.push([commentMatch.index, commentMatch.index + commentMatch[0].length]);
}

const blacklist = new Set([
  'script', 'style', 'head', 'html', 'body', 'link', 'meta', '!doctype', 
  'fragment', 'title', 'base', 'noscript', 'template'
]);

const tagRegex = /<([a-zA-Z][a-zA-Z0-9-:]*)/g;
let match;

while ((match = tagRegex.exec(rawCode)) !== null) {
  const index = match.index;
  const tagName = match[1];

  if (rangesToSkip.some(([start, end]) => index >= start && index < end)) continue;
  if (blacklist.has(tagName.toLowerCase())) continue;

  const substring = rawCode.substring(0, index);
  let lineCount = 1;
  for (let i = 0; i < substring.length; i++) {
    if (substring[i] === '\n') lineCount++;
  }
  
  const insertPos = index + 1 + tagName.length;
  s.appendLeft(insertPos, ` data-ag-line="${relativePath}:${lineCount}" `);
}

const lines = s.toString().split('\n');
console.log('Line 31 Raw:', JSON.stringify(lines[30]));
console.log('Line 31 Length:', lines[30].length);
if (lines[30].length >= 69) {
  console.log('Char at 69:', lines[30][68]);
  console.log('Around 69:', lines[30].substring(60, 80));
} else {
  console.log('Line 31 is shorter than 69 chars');
}
