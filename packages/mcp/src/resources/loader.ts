/**
 * Resolves repo-relative paths so the MCP can serve raw source files
 * (CSS, markdown skill references, exports/* snippets, pattern .tsx files)
 * without bundling them.
 *
 * Resolution mirrors the manifest loader: walks up from the package dist/src
 * looking for a checkout root (the directory that contains `dist/manifest`).
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

let cachedRoot: string | null = null

export function repoRoot(): string {
  if (cachedRoot) return cachedRoot
  const here = dirname(fileURLToPath(import.meta.url))
  // packages/mcp/{src|dist}/resources/loader.{ts|js} → 4 levels up
  const candidates = [
    resolve(here, '../../../..'),
    resolve(here, '../../..'),
    process.env.DS_FIPS_REPO_ROOT,
  ].filter((p): p is string => Boolean(p))
  for (const p of candidates) {
    if (existsSync(resolve(p, 'package.json')) && existsSync(resolve(p, 'src/tokens/colors.ts'))) {
      cachedRoot = p
      return p
    }
  }
  // Last resort: assume current working dir is the repo root.
  cachedRoot = process.cwd()
  return cachedRoot
}

function bundledCandidates(rel: string): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  // From packages/mcp/src/resources/loader.ts → packages/mcp/bundled/<rel>
  // From packages/mcp/dist/server.js (single file) → packages/mcp/bundled/<rel>
  return [
    resolve(here, '../../bundled', rel),
    resolve(here, '../bundled', rel),
  ]
}

function resolveRepoFile(rel: string): string | null {
  const direct = resolve(repoRoot(), rel)
  if (existsSync(direct)) return direct
  for (const c of bundledCandidates(rel)) {
    if (existsSync(c)) return c
  }
  return null
}

export function readRepoFile(rel: string): string {
  const full = resolveRepoFile(rel)
  if (!full) {
    throw new Error(
      `Repo file not found: ${rel}. Searched ${repoRoot()}/${rel} and packages/mcp/bundled/${rel}. ` +
        `In a standalone MCP repo, ensure the file is bundled into packages/mcp/bundled/.`,
    )
  }
  return readFileSync(full, 'utf-8')
}

export function fileExists(rel: string): boolean {
  return resolveRepoFile(rel) !== null
}

export function bundledRoot(rel: string): string | null {
  const direct = resolve(repoRoot(), rel)
  if (existsSync(direct)) return direct
  for (const c of bundledCandidates(rel)) {
    if (existsSync(c)) return c
  }
  return null
}
