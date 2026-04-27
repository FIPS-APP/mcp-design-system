import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

interface Hit {
  kind: 'component' | 'token' | 'pattern' | 'governance' | 'cssVar' | 'export'
  name: string
  match: string
  resourceUri?: string
  detail?: string
}

export const searchTool = {
  name: 'search',
  description:
    'Full-text search across the DS-FIPS surface: components, variants, semantic tokens, palette, CSS vars, patterns, governance keywords. Use when the user references something vague ("o azul mais forte", "o botão de salvar", "o pattern de filtro") and you need to find what it actually is in the system.',
  inputSchema: z
    .object({
      query: z.string().min(1).describe('Search term (case-insensitive).'),
      kinds: z
        .array(z.enum(['component', 'token', 'pattern', 'governance', 'cssVar', 'export']))
        .optional()
        .describe('Optional filter: only return hits of these kinds.'),
    })
    .describe('Search input.'),
  async handler({ query, kinds }: { query: string; kinds?: Hit['kind'][] }) {
    const m = loadManifest()
    const q = query.toLowerCase()
    const filter = (k: Hit['kind']) => !kinds || kinds.includes(k)
    const hits: Hit[] = []

    if (filter('component')) {
      for (const c of m.components) {
        if (c.name.toLowerCase().includes(q)) {
          hits.push({
            kind: 'component',
            name: c.name,
            match: c.name,
            resourceUri: `dsfips://components/${c.name}`,
          })
        }
        if (c.variants) {
          for (const [vKey, vList] of Object.entries(c.variants)) {
            for (const v of vList) {
              if (v.toLowerCase().includes(q)) {
                hits.push({
                  kind: 'component',
                  name: c.name,
                  match: `${c.name} variants.${vKey} → ${v}`,
                  resourceUri: `dsfips://components/${c.name}`,
                  detail: `Use as <${c.name} ${vKey}="${v}">.`,
                })
              }
            }
          }
        }
      }
    }

    if (filter('token')) {
      for (const [name, value] of Object.entries(m.tokens.palette)) {
        if (name.toLowerCase().includes(q) || value.toLowerCase().includes(q)) {
          hits.push({
            kind: 'token',
            name,
            match: `palette ${name} = ${value}`,
            resourceUri: 'dsfips://tokens/palette',
          })
        }
      }
      for (const mode of ['light', 'dark'] as const) {
        for (const [name, value] of Object.entries(m.tokens.semantic[mode])) {
          if (name.toLowerCase().includes(q) || value.toLowerCase().includes(q)) {
            hits.push({
              kind: 'token',
              name,
              match: `semantic.${mode} ${name} = ${value}`,
              resourceUri: `dsfips://tokens/semantic/${mode}`,
              detail: `Use \`resolve_token({semantic: "${name}", mode: "${mode}"})\`.`,
            })
          }
        }
      }
    }

    if (filter('cssVar')) {
      for (const block of ['theme', 'root', 'dark'] as const) {
        for (const [name, value] of Object.entries(m.tokens.cssVars[block])) {
          if (name.toLowerCase().includes(q) || value.toLowerCase().includes(q)) {
            hits.push({
              kind: 'cssVar',
              name,
              match: `${block} ${name}: ${value}`,
              resourceUri: `dsfips://tokens/css-vars/${block}`,
            })
          }
        }
      }
    }

    if (filter('pattern')) {
      for (const p of m.patterns) {
        if (
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.summary ?? '').toLowerCase().includes(q)
        ) {
          hits.push({
            kind: 'pattern',
            name: p.id,
            match: p.name,
            resourceUri: `dsfips://patterns/${p.id}`,
            detail: p.summary ?? undefined,
          })
        }
      }
    }

    if (filter('governance')) {
      for (const g of m.governance.governedComponents) {
        if (g.toLowerCase().includes(q)) {
          hits.push({
            kind: 'governance',
            name: g,
            match: `${g} is governed (no className visual overrides)`,
            resourceUri: 'dsfips://governance',
          })
        }
      }
      for (const rule of m.governance.nonNegotiables) {
        if (rule.toLowerCase().includes(q)) {
          hits.push({
            kind: 'governance',
            name: m.governance.ruleName,
            match: rule,
            resourceUri: 'dsfips://governance',
          })
        }
      }
    }

    if (filter('export')) {
      for (const name of m.exports.barrel) {
        if (name.toLowerCase().includes(q)) {
          hits.push({
            kind: 'export',
            name,
            match: `exported from ds-fips: ${name}`,
            detail: 'See dsfips://manifest → exports.barrel for the full list.',
          })
        }
      }
    }

    return { count: hits.length, query, hits }
  },
}
