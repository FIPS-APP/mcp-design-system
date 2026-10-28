/**
 * Loads the DS-FIPS manifest that `npm run build:manifest` generates from
 * `packages/mcp/bundled/` (see scripts/build-ds-manifest.ts and SYNC.md).
 *
 * Resolution order:
 *   1. Env var DS_FIPS_MANIFEST_PATH (absolute path to ds-manifest.json)
 *   2. Repo-relative dist/manifest/ds-manifest.json (when running from a
 *      checkout that has a live build output there)
 *   3. packages/mcp/manifest/ds-manifest.json, committed in this repo
 *
 * The loader is sync at startup so all tools see the same snapshot.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export interface ManifestComponent {
  name: string
  importPath: string
  governed: boolean
  variants: Record<string, string[]> | null
  defaultVariants: Record<string, string> | null
  subComponents: string[]
}

export interface ManifestPattern {
  id: string
  name: string
  file: string
  summary: string | null
}

export interface Manifest {
  schemaVersion: string
  dsVersion: string
  generatedAt: string
  tokens: {
    palette: Record<string, string>
    semantic: { light: Record<string, string>; dark: Record<string, string> }
    cssVars: {
      theme: Record<string, string>
      root: Record<string, string>
      dark: Record<string, string>
    }
    spacing: number[]
    typography: {
      families: { heading: string; body: string; mono: string }
      scale: Record<string, string>
    }
  }
  components: ManifestComponent[]
  patterns: ManifestPattern[]
  governance: {
    plugin: string
    ruleName: string
    governedComponents: string[]
    blockedClassPrefixPattern: string
    nonNegotiables: string[]
  }
  exports: { barrel: string[] }
}

function candidatePaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates: string[] = []
  if (process.env.DS_FIPS_MANIFEST_PATH) candidates.push(process.env.DS_FIPS_MANIFEST_PATH)
  // DS-FIPS monorepo dev paths (when working inside the design-system repo)
  candidates.push(resolve(here, '../../../../dist/manifest/ds-manifest.json'))
  candidates.push(resolve(here, '../../../dist/manifest/ds-manifest.json'))
  // Bundled in standalone MCP repo: packages/mcp/manifest/ds-manifest.json
  // committed alongside the source so `npm run dev` works without DS-FIPS.
  candidates.push(resolve(here, '../../manifest/ds-manifest.json'))
  candidates.push(resolve(here, '../manifest/ds-manifest.json'))
  return candidates
}

let cached: Manifest | null = null

export function loadManifest(): Manifest {
  if (cached) return cached
  for (const path of candidatePaths()) {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8')
      cached = JSON.parse(raw) as Manifest
      return cached
    }
  }
  throw new Error(
    'DS-FIPS manifest not found. Run `npm run build:manifest` at the root of this repo, ' +
      'or set DS_FIPS_MANIFEST_PATH to point at ds-manifest.json.\nSearched:\n  ' +
      candidatePaths().join('\n  '),
  )
}
