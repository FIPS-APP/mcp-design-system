/**
 * Smoke test: exercises each tool handler, every resource URI, and every
 * prompt directly (no MCP transport). Run with:
 *
 *   npm --workspace @fips-app/mcp-design-system exec tsx scripts/smoke.ts
 */

import { readFileSync } from 'node:fs'
import { tools } from '../src/tools/index.js'
import { listResources, listResourceTemplates, readResource } from '../src/resources/index.js'
import { listPrompts, getPrompt } from '../src/prompts/index.js'
import { loadManifest } from '../src/manifest/loader.js'
import {
  MANIFEST_PATH,
  ManifestBuildError,
  buildCssVars,
  buildManifest,
  readDsMeta,
  renderManifest,
} from './ds-manifest.js'

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

/** Pages open with the page banner: the h1 lives in PageHeader, never in the page. */
function checkBanner(kind: string, files: { path: string; contents: string }[]): string | null {
  const page = files[0]
  if (!page.contents.includes("from '../ds/PageHeader'") || !page.contents.includes('<PageHeader')) {
    return `${kind}: page does not use PageHeader`
  }
  if (/<h1[\s>]/.test(page.contents)) return `${kind}: page has its own <h1>`
  const header = files.find((f) => f.path === 'src/ds/PageHeader.tsx')
  if (!header) return `${kind}: missing bundled src/ds/PageHeader.tsx`
  for (const marker of ['fips-banner-shell--content', '#004B9B_0%,#002A68_60%,#001A4A_100%', 'headingLevel = 1']) {
    if (!header.contents.includes(marker)) return `${kind}: PageHeader without ${marker}`
  }
  return null
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
    // No escuro o verde de texto é o --color-success-strong (#8be5ad); o --color-success é igual nos dois temas.
    tool: 'resolve_token',
    input: { semantic: 'successStrong', mode: 'dark' },
    check: (o) => {
      const x = o as { dark?: string; cssVar?: string }
      return x.dark === '#8BE5AD' && x.cssVar === '--color-success-strong' ? null : `dark=${x.dark} cssVar=${x.cssVar}`
    },
  },
  {
    // Token da rodada de 24/10 (DS 0.20.26): o trilho do Switch ligado.
    tool: 'resolve_token',
    input: { semantic: 'switchOn', mode: 'both' },
    check: (o) => {
      const x = o as { light?: string; dark?: string; cssVar?: string }
      return x.light === '#004B9B' && x.dark === '#658EC9' && x.cssVar === '--color-switch-on'
        ? null
        : `light=${x.light} dark=${x.dark} cssVar=${x.cssVar}`
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
      return checkBanner('form', x.files)
    },
  },
  {
    tool: 'scaffold_screen',
    input: { kind: 'dashboard', name: 'Operações' },
    check: (o) => {
      const x = o as { files: { path: string; contents: string }[] }
      return checkBanner('dashboard', x.files)
    },
  },
  {
    tool: 'scaffold_screen',
    input: { kind: 'dashboard', name: 'Pedidos "VIP" & Cia' },
    check: (o) => {
      const x = o as { files: { path: string; contents: string }[] }
      return x.files[0].contents.includes('title={"Pedidos \\"VIP\\" & Cia"}')
        ? null
        : 'dashboard: name with quotes is not passed as an expression'
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
      if (!page.contents.includes('actions={')) return 'listing: banner without the new-record action'
      return checkBanner('listing', x.files)
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

// bundled/ vem do DS 0.20.26: o globals.css traz as regras do banner (as mesmas
// que o molde PageHeader replica), as fontes locais, sem o @import do Google, e
// os tokens da rodada de 24/10 (hover de texto do primary e cores do Switch).
{
  const label = 'bundled globals.css na linha do DS 0.20.26'
  try {
    const css = readResource('dsfips://styles/globals.css').text
    const missing = [
      "@import './fontes-fips.css'",
      '@container fips-page-header (min-width: 560px)',
      '--fips-banner-content-bg: linear-gradient(135deg, #1e2a3a 0%, #162030 50%, #1a2840 100%)',
      '#001a4a 100%',
      '--color-primary-hover-text: var(--color-primary-hover)',
      '--color-switch-on: var(--color-primary)',
      '--color-border-control: #808d9a',
    ].filter((m) => !css.includes(m))
    if (css.includes('fonts.googleapis.com')) missing.push('sem @import do Google (ainda tem)')
    if (missing.length === 0) ok(label)
    else bad(label, missing.join('; '))
  } catch (e) {
    bad(label, e instanceof Error ? e.message : String(e))
  }
}

// O manifest é a projeção do bundled/ (scripts/ds-manifest.ts). Se o JSON for
// editado à mão, ou o bundled/ mudar sem `npm run build:manifest`, estes blocos falham.
function firstDifference(actual: string, expected: string): string {
  const a = actual.split('\n')
  const e = expected.split('\n')
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      return `linha ${i + 1}: versionado ${JSON.stringify(a[i])}, gerado ${JSON.stringify(e[i])}. Rode npm run build:manifest.`
    }
  }
  return 'diferem'
}

{
  const label = 'ds-manifest.json é o que build:manifest gera do bundled/'
  try {
    const committed = readFileSync(MANIFEST_PATH, 'utf-8')
    const expected = renderManifest(buildManifest())
    if (committed === expected) ok(label)
    else bad(label, firstDifference(committed, expected))
  } catch (e) {
    bad(label, e instanceof Error ? e.message : String(e))
  }
}

{
  const meta = readDsMeta()
  const label = `dsVersion servido pelo get_version é o do package.json (${meta.version})`
  try {
    const getVersion = tools.find((t) => t.name === 'get_version')!
    const served = (await (getVersion.handler as () => Promise<{ dsVersion: string }>)()).dsVersion
    if (served === meta.version) ok(label)
    else bad(label, `servido ${served}`)
  } catch (e) {
    bad(label, e instanceof Error ? e.message : String(e))
  }
}

{
  // O gerador não preenche com padrão: sem o que lê, para com ManifestBuildError.
  const label = 'gerador para com erro quando o bundled/ não tem o que ele lê'
  const stops = (run: () => unknown) => {
    try {
      run()
      return false
    } catch (e) {
      return e instanceof ManifestBuildError
    }
  }
  const noBundled = stops(() => buildManifest({ bundledDir: '/nao/existe', meta: { version: '0.0.0', syncedAt: '2026-01-01' } }))
  const noCssVars = stops(() => buildCssVars('body { color: red }'))
  if (noBundled && noCssVars) ok(label)
  else bad(label, `bundled ausente parou: ${noBundled}; css sem @theme/:root/.dark parou: ${noCssVars}`)
}

{
  const label = 'manifest com os tokens do DS 0.20.26'
  try {
    const { cssVars } = loadManifest().tokens
    const missing = [
      '--color-primary-hover-text',
      '--color-switch-on',
      '--color-switch-off',
      '--color-border-control',
    ].filter((name) => !(name in cssVars.root))
    if (cssVars.root['--color-border-control'] !== '#808d9a') missing.push('--color-border-control do claro em #808d9a')
    if (cssVars.dark['--color-switch-on'] !== 'var(--color-fips-blue-700)') missing.push('--color-switch-on do escuro em blue-700')
    if (missing.length === 0) ok(label)
    else bad(label, `faltando: ${missing.join('; ')}`)
  } catch (e) {
    bad(label, e instanceof Error ? e.message : String(e))
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
