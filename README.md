# Astro Grab

Visual element targeting for Astro projects. Hold **Alt** to target any element and click to copy its source code to your clipboard.

## Features
- 🎯 **Visual targeting mode**: Hold `Alt` to highlight elements in your browser.
- 📋 **Instant copy**: Click any highlighted element to copy its `.astro` source snippet.
- 🔍 **Source attribution**: Tracks elements directly back to their source files and lines.
- ⚡ **Zero-config injection**: Simply add the integration to your `astro.config.mjs`.

## Installation

```bash
npm install astro-grab
```

## Usage

Add to your `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import { astroGrab } from 'astro-grab';

export default defineConfig({
  integrations: [
    astroGrab({
      enabled: true, // Optional: default is true in dev
      contextLines: 5, // Optional: lines of code around the target
    }),
  ],
});
```

## How it works
1. **Instrumentation**: A Vite plugin adds `data-astro-grab` attributes to your components during development.
2. **Overlay**: A thin client script listens for the `Alt` key and provides visual feedback.
3. **Snippet Server**: A lightweight middleware fetches the source code snippets on demand.

---

## License
MIT
