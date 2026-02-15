# Contributing to bd-eye

## Reporting Bugs

Open an issue at <https://github.com/Applicative-Works/bd-eye/issues> with a clear
description of the problem, steps to reproduce, and expected vs actual behavior.

## Development Setup

```bash
git clone https://github.com/Applicative-Works/bd-eye.git
cd bd-eye
npm install
npm run dev
```

Requires Node.js 18 or later.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server and client in parallel (watch mode) |
| `npm run dev:server` | Start server only (watch mode) |
| `npm run dev:client` | Start Vite dev server only |
| `npm run build` | Production client build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint on `src/` |
| `npm run format` | Run Prettier on source files |
| `npm run check` | Run TypeScript type checking |

## Code Style

The project uses ESLint and Prettier for consistent formatting. Before submitting
changes, run:

```bash
npm run lint
npm run format
npm run check
```

All three must pass cleanly.

## Submitting Changes

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make your changes.
4. Verify that `lint`, `format`, and `check` all pass.
5. Submit a pull request with a clear description of the change.
