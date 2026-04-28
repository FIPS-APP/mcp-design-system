/**
 * Smoke test: exercises each tool handler, every resource URI, and every
 * prompt directly (no MCP transport). Run with:
 *
 *   npm --workspace @fips-app/mcp-design-system exec tsx scripts/smoke.ts
 */

import { tools } from '../src/tools/index.js'
import { listResources, listResourceTemplates, readResource } from '../src/resources/index.js'
import { listPrompts, getPrompt } from '../src/prompts/index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function ok(label: string) {
  console.log(`✓ ${label}`)
  pass++
}
function bad(label: string, err: string) {
  console.error(`✗ ${label} — ${err}`)
  failures.push(`${label}: ${err}`)
  fail++
}

/* ──────────────── Tools ──────────────── */

interface ToolCase {
  tool: string
  input: unknown
  check: (out: unknown) => string | null
}

const toolCases: ToolCase[] = [
  {
    tool: 'get_version',
    input: {},
    check: (o) => {
      const x = o as { dsVersion: string; mcpVersion: string }
      return x.dsVersion && x.mcpVersion ? null : 'missing version fields'
    },
  },
  {
    tool: 'list_components',
    input: {},
    check: (o) => {
      const x = o as { count: number; components: { name: string }[] }
      return x.count >= 14 && x.components.find((c) => c.name === 'Button') ? null : `got ${x.count}`
    },
  },
  {
    tool: 'list_components',
    input: { governed: true },
    check: (o) => {
      const x = o as { components: { name: string }[] }
      const names = x.components.map((c) => c.name).sort().join(',')
      return names === 'Button,Input,Select,Textarea' ? null : `got "${names}"`
    },
  },
  {
    tool: 'get_component',
    input: { name: 'Button' },
    check: (o) => {
      const x = o as { variants: { variant: string[] }; defaultVariants: { variant: string } }
      return x.variants.variant.includes('success') && x.defaultVariants.variant === 'primary'
        ? null
        : 'Button shape unexpected'
    },
  },
  {
    tool: 'resolve_token',
    input: { semantic: 'success', mode: 'dark' },
    check: (o) => {
      const x = o as { dark?: string }
      return x.dark === '#8BE5AD' ? null : `dark=${x.dark}`
    },
  },
  {
    tool: 'list_tokens',
    input: { category: 'palette' },
    check: (o) => {
      const x = o as { tokens: Record<string, string> }
      return x.tokens.azulProfundo === '#004B9B' ? null : 'palette wrong'
    },
  },
  {
    tool: 'get_governance_rules',
    input: {},
    check: (o) => {
      const x = o as { governedComponents: string[] }
      return x.governedComponents.length === 6 ? null : `got ${x.governedComponents.length}`
    },
  },
  {
    tool: 'validate_jsx',
    input: { code: 'const x = <Button className="bg-red-500 h-7">Bad</Button>' },
    check: (o) => {
      const x = o as { ok: boolean; violations: { rule: string }[] }
      return !x.ok && x.violations.find((v) => v.rule === 'governance/no-visual-overrides')
        ? null
        : 'expected governance violation'
    },
  },
  {
    tool: 'validate_jsx',
    input: { code: 'const x = <Button variant="primary">Good</Button>' },
    check: (o) => {
      const x = o as { ok: boolean }
      return x.ok ? null : 'expected ok'
    },
  },
  {
    tool: 'list_patterns',
    input: {},
    check: (o) => {
      const x = o as { patterns: { id: string }[] }
      const ids = x.patterns.map((p) => p.id)
      return ids.includes('application-shell') && ids.includes('dashboard') ? null : `got ${ids.join(',')}`
    },
  },
  {
    tool: 'search',
    input: { query: 'success' },
    check: (o) => {
      const x = o as { count: number; hits: { kind: string; match: string }[] }
      const kinds = new Set(x.hits.map((h) => h.kind))
      return x.count >= 3 && kinds.has('component') && kinds.has('token')
        ? null
        : `got count=${x.count} kinds=${[...kinds].join(',')}`
    },
  },
  {
    tool: 'scaffold_screen',
    input: { kind: 'form', name: 'Cliente' },
    check: (o) => {
      const x = o as { files: { path: string; contents: string }[] }
      const page = x.files[0]
      if (!page || !page.path.startsWith('src/pages/')) return 'form: first file is not the page'
      if (!page.contents.includes("from '../ds/Card'")) return 'form: page does not import from ../ds/Card'
      if (!page.contents.includes("from '../ds/Field'")) return 'form: page does not import from ../ds/Field'
      const dsFiles = x.files.slice(1).map((f) => f.path)
      const need = ['src/ds/Card.tsx', 'src/ds/Field.tsx', 'src/ds/Button.tsx']
      for (const n of need) if (!dsFiles.includes(n)) return `form: missing bundled ${n}`
      return null
    },
  },
  {
    tool: 'scaffold_screen',
    input: { kind: 'listing', name: 'Clientes' },
    check: (o) => {
      const x = o as { files: { path: string; contents: string }[] }
      const page = x.files[0]
      if (!page.contents.includes('<Table>') || !page.contents.includes('<Badge')) return 'listing: page missing Table/Badge'
      const dsFiles = x.files.slice(1).map((f) => f.path)
      for (const n of ['src/ds/Table.tsx', 'src/ds/Dialog.tsx', 'src/ds/Card.tsx']) {
        if (!dsFiles.includes(n)) return `listing: missing bundled ${n}`
      }
      return null
    },
  },
]

for (const c of toolCases) {
  const tool = tools.find((t) => t.name === c.tool)
  if (!tool) {
    bad(`tool ${c.tool}`, 'not registered')
    continue
  }
  try {
    const parsed = tool.inputSchema.parse(c.input)
    const out = await (tool.handler as (i: unknown) => Promise<unknown>)(parsed)
    const err = c.check(out)
    if (err) bad(`tool ${c.tool} ${JSON.stringify(c.input)}`, err)
    else ok(`tool ${c.tool} ${JSON.stringify(c.input)}`)
  } catch (e) {
    bad(`tool ${c.tool}`, e instanceof Error ? e.message : String(e))
  }
}

/* ──────────────── Closed-loop: scaffold output → validate_jsx ──────────────── */

const validate = tools.find((t) => t.name === 'validate_jsx')!
const scaffold = tools.find((t) => t.name === 'scaffold_screen')!
for (const kind of ['form', 'dashboard', 'listing', 'modal-workflow'] as const) {
  try {
    const scaffolded = (await (scaffold.handler as (i: unknown) => Promise<{ files: { contents: string }[] }>)(
      scaffold.inputSchema.parse({ kind, name: 'Cliente' }),
    )) as { files: { contents: string }[] }
    const verdict = (await (validate.handler as (i: unknown) => Promise<{ ok: boolean; violations: { rule: string; message: string }[] }>)(
      validate.inputSchema.parse({ code: scaffolded.files[0].contents }),
    )) as { ok: boolean; violations: { rule: string; message: string }[] }
    if (verdict.ok) {
      ok(`closed-loop scaffold(${kind}) → validate_jsx clean`)
    } else {
      bad(`closed-loop scaffold(${kind})`, `${verdict.violations.length} violations: ${verdict.violations.map((v) => v.message).join('; ').slice(0, 200)}`)
    }
  } catch (e) {
    bad(`closed-loop scaffold(${kind})`, e instanceof Error ? e.message : String(e))
  }
}

/* ──────────────── Resources ──────────────── */

const resources = listResources()
const templates = listResourceTemplates()
console.log(`\nResources: ${resources.length} static, ${templates.length} templates.`)

for (const r of resources) {
  try {
    const c = readResource(r.uri)
    if (!c.text || c.text.length === 0) bad(`resource ${r.uri}`, 'empty text')
    else if (c.uri !== r.uri) bad(`resource ${r.uri}`, `uri mismatch (${c.uri})`)
    else ok(`resource ${r.uri}`)
  } catch (e) {
    bad(`resource ${r.uri}`, e instanceof Error ? e.message : String(e))
  }
}

// Templated URIs — sample one of each kind.
const sampledTemplates: string[] = [
  'dsfips://components/Button',
  'dsfips://components/Button/snippet',
  'dsfips://patterns/dashboard',
  'dsfips://patterns/dashboard/source',
]
for (const uri of sampledTemplates) {
  try {
    const c = readResource(uri)
    if (!c.text) bad(`resource ${uri}`, 'empty')
    else ok(`resource ${uri}`)
  } catch (e) {
    bad(`resource ${uri}`, e instanceof Error ? e.message : String(e))
  }
}

/* ──────────────── Prompts ──────────────── */

const prompts = listPrompts()
console.log(`\nPrompts: ${prompts.length}.`)

const promptCases: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'build-with-fips', args: { goal: 'tela de cadastro de clientes' } },
  { name: 'review-fips-jsx', args: { code: '<Button variant="primary">x</Button>' } },
  { name: 'migrate-to-fips', args: { code: '<button className="bg-blue-500">x</button>', sourceDs: 'raw Tailwind' } },
  { name: 'explain-token', args: { semantic: 'success' } },
]
for (const c of promptCases) {
  try {
    const p = getPrompt(c.name, c.args)
    if (p.messages.length > 0 && p.messages[0].content.text.length > 50) ok(`prompt ${c.name}`)
    else bad(`prompt ${c.name}`, 'unexpected shape')
  } catch (e) {
    bad(`prompt ${c.name}`, e instanceof Error ? e.message : String(e))
  }
}

/* ──────────────── Summary ──────────────── */

console.log(`\n${pass} passed, ${fail} failed.`)
if (fail > 0) {
  console.log('Failures:')
  for (const f of failures) console.log(`  - ${f}`)
}
process.exit(fail === 0 ? 0 : 1)
