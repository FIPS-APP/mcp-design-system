import { defineConfig } from 'tsup'

// Bundle EVERYTHING (including @modelcontextprotocol/sdk, eslint,
// @typescript-eslint/parser, zod, the local @fips-app/eslint-plugin-ds-governance)
// into a single dist/server.js. Why: when this package is consumed via
// `npx -y git+https://github.com/FIPS-APP/mcp-design-system.git`, npm only
// installs the root package and skips workspace runtime deps — leaving
// `node_modules/@modelcontextprotocol/sdk` empty. By bundling everything,
// the dist file has zero runtime dependencies and `npx` works on every
// install path (npx, git clone + npm install, npm install <git-url>, etc.).
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  dts: false,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Inline the workspace plugin (won't be resolvable from a fresh `npx`
  // install of the root) and the small JS-pure deps. Keep eslint and
  // @typescript-eslint/parser EXTERNAL — they use dynamic require() and
  // can't be ESM-bundled. Those two are listed as runtime deps in the
  // root package.json so `npm install` puts them in node_modules.
  noExternal: [
    '@fips-app/eslint-plugin-ds-governance',
    '@modelcontextprotocol/sdk',
    'zod',
  ],
})
