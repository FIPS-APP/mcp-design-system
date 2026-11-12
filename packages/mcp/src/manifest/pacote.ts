/**
 * Acesso ao pacote `@fips-app/ds-fips` instalado: o `ai/manifest.json` dele e
 * as regras de lint exportadas em `@fips-app/ds-fips/eslint`.
 *
 * O pacote e dependencia opcional: sem ele (instalacao standalone sem token do
 * registro) o servidor cai no manifest reserva em `packages/mcp/manifest/`.
 * `@fips-app/ds-fips` fica EXTERNO no bundle (ver tsup.config.ts), entao o que
 * o servidor serve e sempre o que esta instalado em node_modules.
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ESLint } from 'eslint'

export interface PacoteManifest {
  pacote: string
  versao: string
  data: string
  exports: { componente: string[]; funcao: string[]; valor: string[]; tipo: string[] }
  props: Record<
    string,
    { nome: string; opcional: boolean; tipo: string; origem: string; valores?: string[] }[]
  >
  tokens: { claro: Record<string, string>; escuro: Record<string, string> }
  padroes: { tela: string; referencia?: string; componentes?: string[]; desde?: string; nota?: string }[]
  proibicoes: string[]
  regimes: string[]
}

export interface PacoteLint {
  plugin: ESLint.Plugin
  governedComponents: string[]
  visualOverridePattern: string
  rules: string[]
}

const require_ = createRequire(import.meta.url)

/** Le o `ai/manifest.json` do pacote instalado; null se o pacote faltar. */
export function lerManifestDoPacote(): { manifest: PacoteManifest; caminho: string } | null {
  try {
    const caminho = require_.resolve('@fips-app/ds-fips/ai/manifest.json')
    return { manifest: JSON.parse(readFileSync(caminho, 'utf-8')) as PacoteManifest, caminho }
  } catch {
    return null
  }
}

/** Le o `ai/SKILL.md` do pacote instalado; null se faltar. */
export function lerSkillDoPacote(): string | null {
  try {
    const manifest = require_.resolve('@fips-app/ds-fips/ai/manifest.json')
    return readFileSync(resolve(dirname(manifest), 'SKILL.md'), 'utf-8')
  } catch {
    return null
  }
}

async function carregarLint(): Promise<PacoteLint | null> {
  try {
    const mod = (await import('@fips-app/ds-fips/eslint')) as unknown as {
      default: ESLint.Plugin & { rules: Record<string, unknown> }
      GOVERNED_COMPONENTS: Set<string>
      VISUAL_OVERRIDE_PATTERN: RegExp
    }
    return {
      plugin: mod.default,
      governedComponents: [...mod.GOVERNED_COMPONENTS],
      visualOverridePattern: mod.VISUAL_OVERRIDE_PATTERN.source,
      rules: Object.keys(mod.default.rules),
    }
  } catch {
    return null
  }
}

export const lintDoPacote: PacoteLint | null = await carregarLint()
