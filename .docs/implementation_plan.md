# Astro Grab Payload Refactor Implementation Plan

> **For Antigravity:** Use `executing-plans` logic to implement this plan task-by-task.

**Goal:** Replace the default full-DOM clipboard payload with a compact, structured AI context while improving cursor target resolution and keeping compatibility safe.
**Architecture:** Split the browser logic into small pure helpers for target resolution, source extraction, sanitization, payload formatting, and clipboard transport. Keep the existing integration entrypoints, preserve snippet fetching on the server, and add optional `full` mode only as an explicit fallback.
**Tech Stack:** TypeScript, Astro integration, Vite plugin, Vitest, browser DOM APIs

### Task 1: Define payload types and options
**Files:**
- Modify: `src/types.ts`

**Steps:**
1. Write the failing type-level expectations in unit tests for new options and payload shape.
2. Extend the public options with `payloadMode`, `includeComputedStyles`, `includeDom`, `maxDomDepth`, `maxChildren`, `ignoreAttributes`, `ignoreSelectors`, `preferSelectors`, and `targetHeuristics`.
3. Add strongly typed payload structures for compact and full modes.
4. Verify `npm run build` succeeds on the updated types.

### Task 2: Build target resolution helper
**Files:**
- Create: `src/client/target-resolver.ts`
- Create: `src/client/target-resolver.test.ts`

**Steps:**
1. Write failing tests for selecting the deepest sensible element, skipping framework wrappers, and preferring interactive or semantic nodes.
2. Implement a resolver that inspects the cursor stack and scores candidates deterministically.
3. Add fallback behavior when wrappers obscure the intended node.
4. Verify tests pass.

### Task 3: Build payload extraction and sanitization helpers
**Files:**
- Create: `src/client/payload-extractor.ts`
- Create: `src/client/payload-sanitizer.ts`
- Create: `src/client/payload-extractor.test.ts`

**Steps:**
1. Write failing tests for compact payload assembly, attribute filtering, style selection, breadcrumb generation, and localized DOM fragments.
2. Implement attribute sanitization to strip Astro/runtime noise and helper attributes.
3. Implement compact data extraction with source file, source line, snippet, and optional local DOM fragment.
4. Verify tests pass.

### Task 4: Build formatter and clipboard pipeline
**Files:**
- Create: `src/client/payload-formatter.ts`
- Create: `src/client/clipboard.ts`
- Modify: `src/client.ts`

**Steps:**
1. Write failing tests for the structured prompt format and compact-by-default output.
2. Implement a formatter that emits `ELEMENT`, `PATH`, `ATTRIBUTES`, `COMPUTED STYLES`, `SOURCE`, `SNIPPET`, and `INSTRUCTION`.
3. Wire the browser listener to use the new resolver, extractor, formatter, and clipboard helper.
4. Preserve the `full` fallback path without making it the default.
5. Verify manual clipboard flow in dev.

### Task 5: Update middleware template compatibility
**Files:**
- Modify: `src/server/middleware.ts`
- Modify: `src/index.ts`

**Steps:**
1. Write failing tests for template rendering with the new payload fields.
2. Keep snippet delivery intact while making the default integration options favor compact payloads.
3. Ensure dev-only behavior remains unchanged for production and preview builds.
4. Verify `npm run build` and `npm test` pass.

### Task 6: Update docs and project context
**Files:**
- Modify: `README.md`
- Modify: `.docs/CONTEXT.md`

**Steps:**
1. Document the new default compact mode and the explicit full fallback.
2. Describe the new options and the structured prompt format.
3. Refresh the project context so future work starts from the current architecture.
4. Verify there are no stale references to full-HTML default payloads.
