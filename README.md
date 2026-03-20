# Astro Grab

**Visual Element Targeting for AI-First Development.**

Astro Grab is an Astro integration that bridges the gap between your browser and your source code. By simply holding a hotkey and clicking an element, you can copy its exact source snippet, DOM structure, and file location directly to your clipboard.

Designed specifically to provide **instant context for AI agents** (like Gemini, Claude, or ChatGPT), it automates the tedious task of finding component files and manually copying code blocks.

---

## Features

- **Visual Targeting**: Hold **Alt** to highlight any element in your browser.
- **One-Click Context**: Click any highlighted element to copy its localized .astro snippet.
- **AI-Ready Templates**: Pre-configured templates that include DOM structure, file paths, and source code for the perfect AI prompt.
- **Zero-Config Instrumentation**: Automatically tracks elements back to their source files and line numbers using a custom Vite plugin.
- **Clean DOM Clones**: Automatically strips Astro-specific tracking attributes and internal CIDs before copying.
- **Lightweight & Fast**: Only runs during development with minimal footprint.

---

## Installation

```bash
npm install @wiktorkulas51/astro-grab
```

---

## Usage

Add the integration to your `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import { astroGrab } from '@wiktorkulas51/astro-grab';


export default defineConfig({
  integrations: [
    astroGrab({
      // Configuration options (optional)
      enabled: true,         // Explicitly enable/disable (default: true in dev)
      contextLines: 10,      // Lines of code around the target (default: 5)
    }),
  ],
});
```

### Hotkeys

1. **Hold Alt**: Enter "Grab Mode" and highlight elements under your cursor.
2. **Move Mouse**: See the source file name for each element.
3. **Left Click**: Instant copy to clipboard with a visual "Success" indicator.

---

## Configuration

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` (in dev) | Whether the integration is active. |
| `contextLines` | `number` | `5` | Number of lines to include above and below the targeted line. |
| `template` | `string` | *(See below)* | Custom format for the clipboard content. Supports placeholders. |

### Placeholder Support

You can customize your `template` using these placeholders:
- `{{file}}`: Relative path to the source file.
- `{{line}}`: Line number where the element is defined.
- `{{snippet}}`: The actual source code snippet from the file.
- `{{dom}}`: A "clean" string representation of the live DOM element (stripped of Astro IDs).
- `{{language}}`: File extension (e.g., `astro`).

**Example Template (Default):**
```markdown
### PROŚBA O ZMIANĘ DLA @AI
**Plik:** {{file}}
**Lokalizacja:** Linia {{line}}

**Struktura DOM:**
```html
{{dom}}
```

**Kod źródłowy:**
```astro
{{snippet}}
```
---
**Instrukcja:**
```


---

## How it Works

1. **Instrumentation**: A lightweight Vite plugin processes your .astro files during development, injecting `data-ag-line` attributes into your templates while intelligently skipping frontmatter, scripts, and comments.
2. **Dynamic Overlay**: A client-side script monitors keyboard states and creates a high-performance overlay that tracks the BoundingClientRect of targeted elements.
3. **Snippet Server**: An API middleware handles secure snippet retrieval from the filesystem, ensuring paths are sanitized and restricted to the project root.
4. **Context Synthesis**: Before copying, it creates a virtual clone of the DOM element to provide the AI with both the *expected* source code and the *rendered* state.

---

## Compatibility

- Astro 4.0+ / 5.0+ / 6.0+
- View Transitions support
- Server-Side Rendering (SSR) & Static sites
- Multi-environment support (Vite-based)

---

## License

MIT

