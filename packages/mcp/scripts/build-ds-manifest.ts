/**
 * Regera `packages/mcp/manifest/ds-manifest.json` a partir de `packages/mcp/bundled/`.
 *
 *   npm run build:manifest
 *
 * Os extratores estão em ./ds-manifest.ts; de onde vem cada campo está em SYNC.md.
 * Sai com código 1, dizendo onde, se o `bundled/` não tiver o que o gerador espera.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { MANIFEST_PATH, ManifestBuildError, buildManifest, renderManifest } from './ds-manifest.js'

try {
  const manifest = buildManifest()
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  writeFileSync(MANIFEST_PATH, renderManifest(manifest))
  console.log(
    `ds-manifest.json: DS-FIPS ${manifest.dsVersion} (${manifest.generatedAt}), ` +
      `${Object.keys(manifest.tokens.palette).length} cores, ` +
      `${Object.keys(manifest.tokens.semantic.light).length}/${Object.keys(manifest.tokens.semantic.dark).length} semânticas (claro/escuro), ` +
      `${manifest.components.length} componentes, ${manifest.patterns.length} patterns, ` +
      `${manifest.exports.barrel.length} exports.`,
  )
} catch (error) {
  if (error instanceof ManifestBuildError) console.error(`build:manifest: ${error.message}`)
  else console.error(error)
  process.exit(1)
}
