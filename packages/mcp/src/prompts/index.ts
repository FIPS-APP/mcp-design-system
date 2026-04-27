/**
 * Pre-built prompts the MCP exposes. Each prompt returns a fully-formed
 * conversation skeleton that the host (Claude Desktop, Cursor, etc.) injects
 * into the model context. Used to bootstrap "build with FIPS" / "review JSX
 * for FIPS compliance" / "explain a token" flows without forcing the user
 * to type the framing every time.
 */

import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export interface PromptDescriptor {
  name: string
  description: string
  arguments: { name: string; description: string; required: boolean }[]
}

export interface PromptMessage {
  role: 'user' | 'assistant'
  content: { type: 'text'; text: string }
}

interface PromptDefinition {
  name: string
  description: string
  argumentSchema: z.ZodTypeAny
  arguments: PromptDescriptor['arguments']
  build: (args: Record<string, unknown>) => PromptMessage[]
}

/* ──────────────────────────────────────────────────────────
   build-with-fips — the default workflow framing
   ────────────────────────────────────────────────────────── */

const buildWithFips: PromptDefinition = {
  name: 'build-with-fips',
  description:
    'Bootstrap a build session with the DS-FIPS context loaded. Use as the first turn when the user asks for a screen, form, or component aligned with the FIPS Design System.',
  argumentSchema: z.object({
    goal: z.string().describe('What the user wants to build (e.g. "tela de cadastro de clientes" or "dashboard de KPIs operacionais").'),
  }),
  arguments: [
    {
      name: 'goal',
      description: 'Short description of what to build (use pt-BR — UI is pt-BR).',
      required: true,
    },
  ],
  build({ goal }) {
    const m = loadManifest()
    const governedList = m.governance.governedComponents.join(', ')
    const componentsList = m.components.map((c) => c.name).join(', ')
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Você vai me ajudar a construir: **${String(goal)}**.`,
            '',
            'Contexto obrigatório (não invente nada fora disto):',
            `- Sistema: Design System FIPS (DS-FIPS) v${m.dsVersion}`,
            `- Componentes oficiais disponíveis: ${componentsList}`,
            `- Componentes governados (className visual proibido): ${governedList}`,
            `- Tipografia: heading "Saira Expanded", corpo "Open Sans"`,
            `- Cores: use sempre var(--color-*) — NUNCA hex inline`,
            `- Patterns existentes: ${m.patterns.map((p) => p.id).join(', ')}`,
            '',
            'Antes de gerar JSX:',
            '1. Chame `get_governance_rules` para confirmar as regras non-negotiable.',
            '2. Para cada componente que vai usar, chame `get_component({name})` para pegar variantes/sizes corretos.',
            '3. Para semântica de cor, use `resolve_token({semantic, mode: "both"})`.',
            '4. Se for uma tela inteira (form, dashboard, listing, modal-workflow), considere `scaffold_screen` antes de escrever do zero.',
            '5. Antes de me devolver a resposta final, valide com `validate_jsx` e corrija qualquer violação.',
            '',
            'Quando estiver pronto, me devolva o JSX completo + lista das chamadas de tools que você usou para chegar nele.',
          ].join('\n'),
        },
      },
    ]
  },
}

/* ──────────────────────────────────────────────────────────
   review-fips-jsx — runs validate_jsx and frames findings
   ────────────────────────────────────────────────────────── */

const reviewFipsJsx: PromptDefinition = {
  name: 'review-fips-jsx',
  description:
    'Frame a code review of a JSX/TSX snippet against DS-FIPS governance. Pair with the validate_jsx tool — this prompt instructs the model to call it, format violations as review comments, and propose fixes.',
  argumentSchema: z.object({
    code: z.string().describe('JSX/TSX snippet to review.'),
  }),
  arguments: [
    {
      name: 'code',
      description: 'Snippet to review (full TSX file or fragment).',
      required: true,
    },
  ],
  build({ code }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Revise este JSX contra o Design System FIPS:',
            '',
            '```tsx',
            String(code),
            '```',
            '',
            'Passos:',
            '1. Chame `validate_jsx` com este código.',
            '2. Para cada violação retornada, escreva um comentário de review no formato:',
            '   - **[linha N, col M] regra**: descrição',
            '   - **Sugestão**: trecho corrigido (não invente variantes — confirme com `get_component`).',
            '3. Aponte também problemas que não disparam a regra mas são óbvios (hex inline, fonte hardcoded fora dos tokens, raios fora de --radius-*).',
            '4. Se o código já estiver limpo, diga claramente "OK — passa pelas regras de governança".',
          ].join('\n'),
        },
      },
    ]
  },
}

/* ──────────────────────────────────────────────────────────
   migrate-to-fips — port JSX from another DS to FIPS
   ────────────────────────────────────────────────────────── */

const migrateToFips: PromptDefinition = {
  name: 'migrate-to-fips',
  description:
    'Frame a migration: takes a JSX snippet from a foreign design system (Material, Chakra, Ant, raw Tailwind, etc.) and asks the model to port it to DS-FIPS components, tokens and patterns.',
  argumentSchema: z.object({
    code: z.string().describe('Foreign JSX/TSX to migrate.'),
    sourceDs: z.string().optional().describe('Optional name of the source design system (e.g. "MUI", "Chakra", "raw Tailwind").'),
  }),
  arguments: [
    { name: 'code', description: 'Snippet to migrate.', required: true },
    { name: 'sourceDs', description: 'Source DS name (optional, helps the model map).', required: false },
  ],
  build({ code, sourceDs }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Porte este código${sourceDs ? ` (vindo de ${String(sourceDs)})` : ''} para o Design System FIPS:`,
            '',
            '```tsx',
            String(code),
            '```',
            '',
            'Regras da migração:',
            '- Substitua componentes do DS de origem por equivalentes em DS-FIPS (`list_components` / `get_component`).',
            '- Substitua hex inline por tokens semânticos (`resolve_token`).',
            '- Substitua estilos custom (`bg-red-500`, `h-12`, etc.) por variantes oficiais. Se a variante exata não existir no DS-FIPS, **diga isso explicitamente** em vez de inventar.',
            '- Mantenha a UX original (textos, ordem, comportamento) — só a aparência muda.',
            '- Valide o resultado final com `validate_jsx`. Se houver violação, ajuste.',
            '- pt-BR para qualquer texto novo.',
          ].join('\n'),
        },
      },
    ]
  },
}

/* ──────────────────────────────────────────────────────────
   explain-token — quick lookup with rationale
   ────────────────────────────────────────────────────────── */

const explainToken: PromptDefinition = {
  name: 'explain-token',
  description: 'Explain a semantic token: hex values in light/dark, the CSS var, when to use it, and what NOT to confuse it with.',
  argumentSchema: z.object({
    semantic: z.string().describe('Semantic role to explain (e.g. "primary", "success", "danger", "border").'),
  }),
  arguments: [
    { name: 'semantic', description: 'Semantic role name.', required: true },
  ],
  build({ semantic }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Explique o token semântico **${String(semantic)}** do DS-FIPS:`,
            '',
            '1. Chame `resolve_token({semantic: "' + String(semantic) + '", mode: "both"})`.',
            '2. Apresente o valor em light, em dark, e o `var(--color-*)` correspondente.',
            '3. Diga quando usar (qual cenário de UI), e cite 1–2 tokens com nome similar para contraste (ex.: `success` vs `successStrong`).',
            '4. Se for uma cor de status (success/warning/danger/info), inclua um exemplo curto de Badge ou texto onde ela aparece.',
            '5. Termine reforçando: nunca usar hex inline; sempre via CSS var.',
          ].join('\n'),
        },
      },
    ]
  },
}

const PROMPTS: PromptDefinition[] = [buildWithFips, reviewFipsJsx, migrateToFips, explainToken]

export function listPrompts(): PromptDescriptor[] {
  return PROMPTS.map((p) => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments,
  }))
}

export function getPrompt(name: string, args: Record<string, unknown>): { description: string; messages: PromptMessage[] } {
  const p = PROMPTS.find((p) => p.name === name)
  if (!p) {
    throw new Error(`Prompt "${name}" not found. Available: ${PROMPTS.map((x) => x.name).join(', ')}.`)
  }
  const parsed = p.argumentSchema.parse(args ?? {})
  return {
    description: p.description,
    messages: p.build(parsed as Record<string, unknown>),
  }
}
