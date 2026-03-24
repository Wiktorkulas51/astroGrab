# Project Context - Astro Grab

## Overview
Astro Grab is an Astro integration that provides interactive element targeting and source code extraction during development.

## Project Structure
- `.docs/`: Project documentation and plans.
- `src/`: Source code.
  - `client/`: Browser-side logic, target resolution, payload formatting, clipboard transport, and overlay.
  - `server/`: Vite middleware and snippet extraction.
  - `vite/`: Instrumentation plugin for `.astro` files.
  - `utils/`: Shared utilities.
- `tests/`: Test suites.

## Tech Stack
- **Astro**: Core framework integration.
- **Vite**: Build tool and dev server.
- **TypeScript**: Typed development.
- **Magic-string**: Efficient code transformations.
- **Vitest**: Testing framework.

## Current Payload Direction
- Default payload is compact and structured for AI consumption.
- Full DOM output exists only as an explicit fallback/debug mode.
- Client-side prompt assembly uses small helpers for target resolution, sanitization, extraction, and formatting.

## Naming Conventions
- Files: `lowercase-with-hyphens.ts`
- Variables: `camelCase`
- Classes/Interfaces: `PascalCase`
