/**
 * Loads the DS-FIPS manifest.
 *
 * Resolution order:
 *   1. Env var DS_FIPS_MANIFEST_PATH (absolute path to either an
 *      `ai/manifest.json` of the package or a legacy ds-manifest.json)
 *   2. The installed package `@fips-app/ds-fips` (`ai/manifest.json`) —
 *      the normal source: whatever version is in node_modules is what is served
 *   3. Reserve: legacy ds-manifest.json (monorepo dist/ or the copy bundled at
 *      packages/mcp/manifest/), only when the package is not installed
 *
 * The loader is sync at startup so all tools see the same snapshot.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { adaptarPacote } from './adaptar.js'
import { lerManifestDoPacote, lintDoPacote, type PacoteManifest } from './pacote.js'

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
      families: { heading: string[]; body: string[]; mono: string[] }
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
  /** Where this snapshot came from. Absent in legacy files. */
  source?: 'pacote' | 'reserva'
}

function candidatePaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates: string[] = []
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

function ehDoPacote(x: unknown): x is PacoteManifest {
  return typeof x === 'object' && x !== null && 'versao' in x && 'exports' in x && 'padroes' in x
}

export function loadManifest(): Manifest {
  if (cached) return cached

  const override = process.env.DS_FIPS_MANIFEST_PATH
  if (override) {
    if (!existsSync(override)) throw new Error(`DS_FIPS_MANIFEST_PATH not found: ${override}`)
    const json = JSON.parse(readFileSync(override, 'utf-8')) as unknown
    cached = ehDoPacote(json)
      ? { ...adaptarPacote(json, lintDoPacote), source: 'pacote' }
      : { ...(json as Manifest), source: 'reserva' }
    return cached
  }

  const pacote = lerManifestDoPacote()
  if (pacote) {
    cached = { ...adaptarPacote(pacote.manifest, lintDoPacote), source: 'pacote' }
    return cached
  }

  for (const path of candidatePaths()) {
    if (existsSync(path)) {
      process.stderr.write(
        '[mcp-fips-ds] @fips-app/ds-fips nao esta instalado: servindo o manifest reserva (desatualizado).\n',
      )
      cached = { ...(JSON.parse(readFileSync(path, 'utf-8')) as Manifest), source: 'reserva' }
      return cached
    }
  }
  throw new Error(
    '@fips-app/ds-fips is not installed and no reserve manifest was found. ' +
      'Install the package from the FIPS registry or set DS_FIPS_MANIFEST_PATH.\nSearched:\n  ' +
      candidatePaths().join('\n  '),
  )
}
