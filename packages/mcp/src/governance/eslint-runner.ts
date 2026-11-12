/**
 * Programmatic runner for the DS-FIPS governance rule against caller-supplied
 * JSX/TSX. Uses the same plugin the DS-FIPS repo enforces in CI, so a hit here
 * is exactly a hit there — no drift between the MCP `validate_jsx` tool and
 * the repo's lint gate.
 */

import { Linter, type ESLint } from 'eslint'
import dsGovernance from '@fips-app/eslint-plugin-ds-governance'
import * as tsParser from '@typescript-eslint/parser'
import { lintDoPacote } from '../manifest/pacote.js'

export interface Violation {
  rule: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  severity: 'error' | 'warning'
}

const linter = new Linter({ configType: 'flat' })

// Com o pacote instalado, valida com as regras dele (as mesmas do `fips-ds check`
// e do lint dos apps). Sem o pacote, cai no plugin local, so com no-visual-overrides.
const plugin = (lintDoPacote?.plugin ?? dsGovernance) as unknown as ESLint.Plugin
const regras: Linter.RulesRecord = Object.fromEntries(
  (lintDoPacote?.rules ?? ['no-visual-overrides']).map((r) => [`governance/${r}`, 'error' as const]),
)

export function validateJsx(code: string, filename = 'snippet.tsx'): {
  ok: boolean
  violations: Violation[]
} {
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
          parser: tsParser as Linter.Parser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: { jsx: true },
          },
        },
        plugins: {
          governance: plugin,
        },
        rules: regras,
      },
    ],
    { filename },
  )

  const violations: Violation[] = messages.map((m) => ({
    rule: m.ruleId ?? 'unknown',
    line: m.line,
    column: m.column,
    endLine: m.endLine,
    endColumn: m.endColumn,
    message: m.message,
    severity: m.severity === 2 ? 'error' : 'warning',
  }))

  return { ok: violations.length === 0, violations }
}
