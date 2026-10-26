/**
 * Extratores que montam o `ds-manifest.json` a partir de `packages/mcp/bundled/`.
 * O comando é `npm run build:manifest` (scripts/build-ds-manifest.ts); o smoke
 * importa este módulo para conferir que o JSON versionado é o que sai daqui.
 *
 * O manifest é o único dado estruturado que o servidor lê (`src/manifest/loader.ts`).
 * Ele é uma projeção do `bundled/`: nada nele é escrito à mão. Mesma entrada,
 * mesma saída (sem relógio, sem rede, sem ordem de diretório), para o CI conferir
 * com `git diff --exit-code`.
 *
 * De onde vem cada campo:
 *
 *   dsVersion, generatedAt   packages/mcp/package.json, campo `designSystem`
 *                            (o bundled/ não carrega a versão do DS em lugar nenhum)
 *   tokens.cssVars           bundled/src/styles/globals.css  (@theme, :root, .dark)
 *   tokens.semantic          as mesmas variáveis `--color-*` de :root e .dark, com
 *                            os var() resolvidos (o hex é o que a variável vale)
 *   tokens.palette           foundations.md  (tabelas "Cores oficiais")
 *   tokens.spacing           foundations.md  ("Escala exportada")
 *   tokens.typography        foundations.md  (famílias e `typeScale`)
 *   components, exports      components.md   (lista do barrel `src/components/ui/index.ts`),
 *                            source-of-truth.md (arquivo de cada componente)
 *   patterns                 bundled/src/docs/pages/patterns/*.tsx
 *   governance               @fips-app/eslint-plugin-ds-governance (este repo) e
 *                            a seção "Non-negotiables" da SKILL.md
 *
 * Quando um extrator não acha o que espera, lança ManifestBuildError dizendo onde.
 * Nunca preenche com valor padrão: um manifest incompleto é pior que nenhum.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import dsGovernance, {
  GOVERNED_COMPONENTS,
  VISUAL_OVERRIDE_PATTERN,
} from '@fips-app/eslint-plugin-ds-governance'
import type { Manifest, ManifestComponent, ManifestPattern } from '../src/manifest/loader.js'

const here = dirname(fileURLToPath(import.meta.url))

export const PACKAGE_ROOT = resolve(here, '..')
export const BUNDLED_DIR = join(PACKAGE_ROOT, 'bundled')
export const MANIFEST_PATH = join(PACKAGE_ROOT, 'manifest', 'ds-manifest.json')

/** Muda só quando o formato (as chaves) do manifest muda. Ver SYNC.md. */
export const SCHEMA_VERSION = '1.0.0'

/** Namespace com que o plugin é registrado (README do plugin e `src/governance/eslint-runner.ts`). */
const RULE_NAMESPACE = 'governance'

export class ManifestBuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestBuildError'
  }
}

function fail(message: string): never {
  throw new ManifestBuildError(message)
}

/* ──────────────────────────────────────────────────────────
   Versão do DS (package.json) e arquivos do bundled/
   ────────────────────────────────────────────────────────── */

export interface DsMeta {
  /** Versão do DS da tag de onde o bundled/ saiu, sem o "v" (ex.: 0.20.26). */
  version: string
  /** Dia (AAAA-MM-DD) em que o bundled/ foi regerado. Vira `generatedAt`. */
  syncedAt: string
}

export function readDsMeta(packageJsonPath = join(PACKAGE_ROOT, 'package.json')): DsMeta {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    designSystem?: { version?: unknown; syncedAt?: unknown }
  }
  const ds = pkg.designSystem
  if (!ds || typeof ds.version !== 'string' || typeof ds.syncedAt !== 'string') {
    fail(
      'package.json do MCP sem o campo "designSystem": { "version": "X.Y.Z", "syncedAt": "AAAA-MM-DD" }. ' +
        'O bundled/ não traz a versão do DS; ela é declarada ali quando o bundled/ é regerado (SYNC.md).',
    )
  }
  if (!/^\d+\.\d+\.\d+$/.test(ds.version)) {
    fail(`package.json: designSystem.version "${ds.version}" não é X.Y.Z (sem o "v").`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds.syncedAt) || Number.isNaN(Date.parse(`${ds.syncedAt}T00:00:00Z`))) {
    fail(`package.json: designSystem.syncedAt "${ds.syncedAt}" não é uma data AAAA-MM-DD.`)
  }
  return { version: ds.version, syncedAt: ds.syncedAt }
}

function readBundled(bundledDir: string, rel: string): string {
  const full = join(bundledDir, rel)
  if (!existsSync(full)) fail(`bundled/${rel} não existe. O bundled/ está completo? Ver SYNC.md.`)
  return readFileSync(full, 'utf-8')
}

/* ──────────────────────────────────────────────────────────
   Markdown: seções, blocos de código, listas e trechos entre crases
   ────────────────────────────────────────────────────────── */

interface MdLine {
  text: string
  /** Dentro de um bloco de código (as linhas das cercas também contam). */
  fence: boolean
}

interface MdDoc {
  lines: MdLine[]
  headings: { level: number; title: string; index: number }[]
}

function parseMd(md: string): MdDoc {
  const lines: MdLine[] = []
  const headings: MdDoc['headings'] = []
  let inFence = false
  for (const text of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(text)) {
      lines.push({ text, fence: true })
      inFence = !inFence
      continue
    }
    lines.push({ text, fence: inFence })
    if (inFence) continue
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(text)
    if (h) headings.push({ level: h[1].length, title: h[2], index: lines.length - 1 })
  }
  return { lines, headings }
}

/** Corpo da primeira seção cujo título casa, até o próximo título do mesmo nível ou acima. */
function section(doc: MdDoc, match: (title: string) => boolean, level?: number): MdLine[] | null {
  const head = doc.headings.find((h) => (level === undefined || h.level === level) && match(h.title))
  if (!head) return null
  const next = doc.headings.find((h) => h.index > head.index && h.level <= head.level)
  return doc.lines.slice(head.index + 1, next ? next.index : doc.lines.length)
}

function codeBlocks(lines: MdLine[]): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = []
  let current: { lang: string; code: string[] } | null = null
  for (const line of lines) {
    const marker = /^\s*```\s*([\w-]*)/.exec(line.text)
    if (line.fence && marker) {
      if (current) {
        blocks.push({ lang: current.lang, code: current.code.join('\n') })
        current = null
      } else {
        current = { lang: marker[1], code: [] }
      }
      continue
    }
    if (current) current.code.push(line.text)
  }
  return blocks
}

/** Itens de lista (`- `), com as linhas de continuação recuadas juntadas ao item. */
function bullets(lines: MdLine[]): string[] {
  const items: string[] = []
  let current: string | null = null
  for (const { text, fence } of lines) {
    if (fence) {
      current = null
      continue
    }
    const start = /^\s*[-*]\s+(.*)$/.exec(text)
    if (start) {
      if (current !== null) items.push(current)
      current = start[1]
    } else if (current !== null && /^\s+\S/.test(text)) {
      current += ` ${text.trim()}`
    } else {
      if (current !== null) items.push(current)
      current = null
    }
  }
  if (current !== null) items.push(current)
  return items
}

/** Tudo que está entre crases, na ordem. */
function ticks(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/* ──────────────────────────────────────────────────────────
   TypeScript: valores literais de trechos de código
   ────────────────────────────────────────────────────────── */

function parseTs(code: string, kind: ts.ScriptKind = ts.ScriptKind.TS): ts.SourceFile {
  return ts.createSourceFile('trecho.tsx', code, ts.ScriptTarget.Latest, true, kind)
}

function literalText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return undefined
}

function objectLiteralStrings(node: ts.ObjectLiteralExpression, where: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) fail(`${where}: só propriedades "chave: valor" são aceitas.`)
    const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined
    const value = literalText(prop.initializer)
    if (key === undefined || value === undefined) {
      fail(`${where}: esperava chave simples e valor string em "${prop.getText()}".`)
    }
    out[key] = value
  }
  return out
}

/** `const <name> = { chave: 'valor', ... }` dentro de um trecho TS. */
function constObjectStrings(code: string, name: string, where: string): Record<string, string> | null {
  const sf = parseTs(code)
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const decl of st.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
        if (!ts.isObjectLiteralExpression(decl.initializer)) fail(`${where}: ${name} não é um objeto literal.`)
        return objectLiteralStrings(decl.initializer, where)
      }
    }
  }
  return null
}

/* ──────────────────────────────────────────────────────────
   CSS: leitura de blocos e variáveis customizadas
   ────────────────────────────────────────────────────────── */

interface CssRule {
  prelude: string
  decls: { prop: string; value: string }[]
  rules: CssRule[]
}

function stripCssComments(src: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      out += c
      if (c === '\\') out += src[++i] ?? ''
      else if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
      out += c
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      if (end === -1) fail('globals.css: comentário /* sem o */ de fechamento.')
      out += ' '
      i = end + 1
    } else {
      out += c
    }
  }
  return out
}

/** Lê um bloco `{ ... }` (ou o arquivo todo, em `top`). Devolve onde parou. */
function parseCssBlock(src: string, start: number, top: boolean): { rules: CssRule[]; decls: CssRule['decls']; end: number } {
  const rules: CssRule[] = []
  const decls: CssRule['decls'] = []
  let pos = start
  for (;;) {
    while (pos < src.length && /\s/.test(src[pos])) pos++
    if (pos >= src.length) {
      if (!top) fail('globals.css: bloco { sem o } de fechamento.')
      return { rules, decls, end: pos }
    }
    if (src[pos] === '}') {
      if (top) fail('globals.css: } sem o { correspondente.')
      return { rules, decls, end: pos + 1 }
    }
    // Cabeça do item: vai até { ; ou } fora de parênteses, colchetes e aspas.
    let depth = 0
    let quote: string | null = null
    let i = pos
    for (; i < src.length; i++) {
      const c = src[i]
      if (quote) {
        if (c === '\\') i++
        else if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'") quote = c
      else if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth--
      else if (depth === 0 && (c === '{' || c === ';' || c === '}')) break
    }
    const head = src.slice(pos, i).trim()
    const stop = src[i]
    if (stop === '{') {
      const child = parseCssBlock(src, i + 1, false)
      rules.push({ prelude: head, decls: child.decls, rules: child.rules })
      pos = child.end
      continue
    }
    if (head && !head.startsWith('@')) {
      const colon = head.indexOf(':')
      if (colon === -1) fail(`globals.css: declaração sem ":" em "${head.slice(0, 60)}".`)
      decls.push({ prop: head.slice(0, colon).trim(), value: head.slice(colon + 1).trim() })
    }
    pos = stop === ';' ? i + 1 : i
  }
}

function selectorList(prelude: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let last = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      parts.push(prelude.slice(last, i).trim())
      last = i + 1
    }
  }
  parts.push(prelude.slice(last).trim())
  return parts
}

function cleanCssValue(value: string): string {
  return collapse(value).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}

/**
 * Variáveis customizadas (`--x`) dos blocos que `pick` aceita. Entram os blocos
 * soltos e os dentro de `@layer`; o que está em `@media`, `@container`,
 * `@supports` e afins só vale sob condição e fica de fora. Em caso de repetição,
 * vale a última (a cascata).
 */
function customProperties(rules: CssRule[], pick: (prelude: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {}
  const visit = (list: CssRule[]) => {
    for (const rule of list) {
      if (rule.prelude.startsWith('@') && /^@layer\b/.test(rule.prelude)) {
        visit(rule.rules)
      } else if (pick(rule.prelude)) {
        for (const d of rule.decls) if (d.prop.startsWith('--')) out[d.prop] = cleanCssValue(d.value)
      }
    }
  }
  visit(rules)
  return out
}

/** `theme` = blocos `@theme`; `root` = regras que incluem `:root`; `dark` = regras que incluem `.dark`. */
export function buildCssVars(css: string): Manifest['tokens']['cssVars'] {
  const rules = parseCssBlock(stripCssComments(css), 0, true).rules
  const cssVars = {
    theme: customProperties(rules, (p) => /^@theme\b/.test(p)),
    root: customProperties(rules, (p) => !p.startsWith('@') && selectorList(p).includes(':root')),
    dark: customProperties(rules, (p) => !p.startsWith('@') && selectorList(p).includes('.dark')),
  }
  for (const [block, vars] of Object.entries(cssVars)) {
    if (Object.keys(vars).length < 10) fail(`globals.css: o bloco ${block} saiu com ${Object.keys(vars).length} variáveis (esperava 10 ou mais).`)
  }
  return cssVars
}

/* ──────────────────────────────────────────────────────────
   tokens.semantic: as cores de :root e .dark, com os var() resolvidos
   ────────────────────────────────────────────────────────── */

function topLevelComma(text: string): number {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (text[i] === ',' && depth === 0) return i
  }
  return -1
}

function substituteVars(value: string, scope: Record<string, string>, owner: string, depth = 0): string {
  if (depth > 16) fail(`globals.css: ${owner} entra em ciclo de var().`)
  let out = ''
  let i = 0
  while (i < value.length) {
    const at = value.indexOf('var(', i)
    if (at === -1) {
      out += value.slice(i)
      break
    }
    if (at > 0 && /[\w-]/.test(value[at - 1])) {
      out += value.slice(i, at + 4)
      i = at + 4
      continue
    }
    out += value.slice(i, at)
    let open = 1
    let j = at + 4
    while (j < value.length && open > 0) {
      if (value[j] === '(') open++
      else if (value[j] === ')') open--
      j++
    }
    if (open !== 0) fail(`globals.css: ${owner} tem var() sem fechar em "${value}".`)
    const inner = value.slice(at + 4, j - 1)
    const comma = topLevelComma(inner)
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim()
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim()
    const found = scope[name]
    if (found !== undefined) out += substituteVars(found, scope, `${owner} > ${name}`, depth + 1)
    else if (fallback !== null) out += substituteVars(fallback, scope, owner, depth + 1)
    else fail(`globals.css: ${owner} usa ${name}, que não está definido.`)
    i = j
  }
  return out
}

function semanticKey(cssVar: string): string {
  return cssVar.replace(/^--color-/, '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/** Mesma conversão que a tool `resolve_token` faz para achar a variável de volta. */
function cssVarOf(semantic: string): string {
  return `--color-${semantic.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`
}

function resolvedColors(
  own: Record<string, string>,
  scope: Record<string, string>,
  mode: string,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const cssVar of Object.keys(own)) {
    if (!cssVar.startsWith('--color-')) continue
    const key = semanticKey(cssVar)
    if (cssVarOf(key) !== cssVar) {
      fail(`globals.css: ${cssVar} vira "${key}", que a tool resolve_token não converte de volta. Renomeie a variável ou ajuste a conversão.`)
    }
    const value = substituteVars(scope[cssVar], scope, `${mode} ${cssVar}`)
    out[key] = /^#[0-9a-fA-F]{3,8}$/.test(value) ? value.toUpperCase() : value
  }
  return out
}

/**
 * `--color-*` de :root (claro) e de :root com .dark por cima (escuro), como o
 * navegador resolve em `html.dark`. A chave é o nome sem `--color-` em camelCase.
 */
export function buildSemantic(cssVars: Manifest['tokens']['cssVars']): Manifest['tokens']['semantic'] {
  const light = { ...cssVars.theme, ...cssVars.root }
  const dark = { ...light, ...cssVars.dark }
  return {
    light: resolvedColors(cssVars.root, light, 'claro'),
    dark: resolvedColors({ ...cssVars.root, ...cssVars.dark }, dark, 'escuro'),
  }
}

/* ──────────────────────────────────────────────────────────
   foundations.md: paleta, espaçamento e tipografia
   ────────────────────────────────────────────────────────── */

export function buildPalette(foundations: string): Record<string, string> {
  const body = section(parseMd(foundations), (t) => /^Cores oficiais$/i.test(t), 2)
  if (!body) fail('foundations.md: não achei a seção "## Cores oficiais".')
  const palette: Record<string, string> = {}
  for (const { text, fence } of body) {
    if (fence) continue
    const row = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*(?:\||$)/.exec(text)
    if (!row) continue
    if (palette[row[1]] !== undefined) fail(`foundations.md: a cor ${row[1]} aparece duas vezes em "Cores oficiais".`)
    palette[row[1]] = row[2]
  }
  if (Object.keys(palette).length < 10 || !palette.azulProfundo) {
    fail(`foundations.md: "Cores oficiais" saiu com ${Object.keys(palette).length} cores e ${palette.azulProfundo ? 'com' : 'sem'} azulProfundo.`)
  }
  return palette
}

export function buildSpacing(foundations: string): number[] {
  const body = section(parseMd(foundations), (t) => /^Espaçamento$/i.test(t), 2)
  if (!body) fail('foundations.md: não achei a seção "## Espaçamento".')
  const line = body.find((l) => !l.fence && /Escala exportada/.test(l.text))
  const list = line && ticks(line.text).find((t) => /^\[[\d,\s]+\]$/.test(t))
  if (!list) fail('foundations.md: não achei "Escala exportada: `[...]`" em "## Espaçamento".')
  const scale = JSON.parse(list) as number[]
  if (scale.length < 5) fail(`foundations.md: a escala de espaçamento saiu com ${scale.length} valores.`)
  return scale
}

export function buildTypography(foundations: string): Manifest['tokens']['typography'] {
  const body = section(parseMd(foundations), (t) => /^Tipografia$/i.test(t), 2)
  if (!body) fail('foundations.md: não achei a seção "## Tipografia".')
  const family = (label: string): string => {
    for (const { text, fence } of body) {
      const m = !fence && new RegExp(`^-\\s*${label}:\\s*\`(.+)\`\\s*$`).exec(text)
      if (m) return m[1]
    }
    return fail(`foundations.md: não achei "- ${label}: \`...\`" em "## Tipografia".`)
  }
  let scale: Record<string, string> | null = null
  for (const block of codeBlocks(body)) {
    scale = constObjectStrings(block.code, 'typeScale', 'foundations.md typeScale')
    if (scale) break
  }
  if (!scale || Object.keys(scale).length < 5) fail('foundations.md: não achei `const typeScale = {...}` em "## Tipografia".')
  return {
    families: { heading: family('Heading'), body: family('Body'), mono: family('Mono') },
    scale,
  }
}

/* ──────────────────────────────────────────────────────────
   components.md + source-of-truth.md: componentes e barrel
   ────────────────────────────────────────────────────────── */

const isIdentifier = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s)
/** Componente ou tipo (PascalCase). Funções (buttonVariants) e constantes (DIALOG_X) ficam só no barrel. */
const isPascal = (s: string) => /^[A-Z][A-Za-z0-9]*$/.test(s) && /[a-z]/.test(s)

/**
 * A lista do barrel é escrita em grupos: `·` separa grupos; dentro do grupo o
 * primeiro nome é o componente e o resto sai junto com ele.
 *   `Button` + `buttonVariants` · `Badge` + `badgeVariants`
 *   `Card`, `CardHeader`, `CardTitle`
 *   `Dialog` (+ `DialogContent`, `DialogClose`)
 */
function parseUiBarrel(components: MdDoc): string[][] {
  const body = section(components, (t) => t.includes('src/components/ui/index.ts'))
  if (!body) fail('components.md: não achei a seção do barrel (título com `src/components/ui/index.ts`).')
  const groups: string[][] = []
  for (const item of bullets(body)) {
    for (const part of item.split('·')) {
      const names = ticks(part).filter(isIdentifier)
      if (names.length) groups.push(names)
    }
  }
  if (groups.length < 8) fail(`components.md: o barrel saiu com ${groups.length} grupos (esperava 8 ou mais).`)
  return groups
}

/**
 * Dentro de um grupo, um nome PascalCase que começa com o nome do componente
 * (CardHeader, DialogClose) é sub-componente dele. Um PascalCase que não começa
 * (AdminTablePagination depois de AdminTableColumnMenu) é outro componente.
 */
function groupComponents(groups: string[][]): { name: string; subs: string[] }[] {
  const out: { name: string; subs: string[] }[] = []
  for (const names of groups) {
    let current: { name: string; subs: string[] } | null = null
    for (const [i, name] of names.entries()) {
      if (!isPascal(name)) continue
      if (i === 0 || !current || !name.startsWith(current.name)) {
        current = { name, subs: [] }
        out.push(current)
      } else {
        current.subs.push(name)
      }
    }
  }
  const seen = new Set<string>()
  for (const c of out) {
    if (seen.has(c.name)) fail(`components.md: ${c.name} aparece em dois grupos do barrel.`)
    seen.add(c.name)
  }
  return out
}

/** Arquivos `src/components/ui/*.tsx` que a source-of-truth.md lista em "Componentes reutilizáveis". */
function uiComponentFiles(sourceOfTruth: MdDoc): string[] {
  const body = section(sourceOfTruth, (t) => t.includes('Componentes reutilizáveis'))
  if (!body) fail('source-of-truth.md: não achei a seção "Componentes reutilizáveis".')
  const files: string[] = []
  for (const item of bullets(body)) {
    let dir = ''
    for (const tick of ticks(item)) {
      if (!/\.tsx?$/.test(tick)) continue
      const full = tick.includes('/') ? tick : `${dir}/${tick}`
      if (tick.includes('/')) dir = dirname(tick)
      if (full.startsWith('src/components/ui/') && full.endsWith('.tsx')) files.push(full)
    }
  }
  return files
}

const flatName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const UI_BARREL_FILE = 'src/components/ui/index.ts'

/** `Variantes exatas:` / `Tamanhos exatos:` na seção do componente (na mesma linha ou em lista logo abaixo). */
function exactList(body: MdLine[], label: string): string[] | null {
  const at = body.findIndex((l) => !l.fence && l.text.includes(`${label}:`))
  if (at === -1) return null
  const rest = body[at].text.slice(body[at].text.indexOf(`${label}:`) + label.length + 1)
  const inline = ticks(rest)
  if (inline.length) return inline
  const items: string[] = []
  let started = false
  for (const line of body.slice(at + 1)) {
    if (line.fence) break
    const m = /^\s*[-*]\s+`([^`]+)`/.exec(line.text)
    if (m) {
      items.push(m[1])
      started = true
    } else if (!started && line.text.trim() === '') {
      continue
    } else {
      break
    }
  }
  return items.length ? items : null
}

function componentVariants(
  components: MdDoc,
  name: string,
): Pick<ManifestComponent, 'variants' | 'defaultVariants'> {
  const body = section(components, (t) => t === name, 2)
  if (!body) return { variants: null, defaultVariants: null }
  const variants: Record<string, string[]> = {}
  const variant = exactList(body, 'Variantes exatas')
  const size = exactList(body, 'Tamanhos exatos')
  if (variant) variants.variant = variant
  if (size) variants.size = size
  if (Object.keys(variants).length === 0) return { variants: null, defaultVariants: null }

  // O DS mostra a chamada de referência `xVariants({ variant: '...', size: '...' })`.
  // Os valores dela são os padrões, desde que existam nas listas.
  let defaults: Record<string, string> | null = null
  for (const block of codeBlocks(body)) {
    if (!/^(tsx?|typescript)$/.test(block.lang)) continue
    const sf = parseTs(block.code, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if (
        !defaults &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /Variants$/.test(node.expression.text) &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        const picked = objectLiteralStrings(node.arguments[0], `components.md ${name}`)
        const valid = Object.entries(picked).filter(([k, v]) => variants[k]?.includes(v))
        if (valid.length) defaults = Object.fromEntries(valid)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    if (defaults) break
  }
  return { variants, defaultVariants: defaults }
}

export function buildComponents(
  componentsMd: string,
  sourceOfTruthMd: string,
): { components: ManifestComponent[]; barrel: string[] } {
  const components = parseMd(componentsMd)
  const groups = parseUiBarrel(components)
  const files = uiComponentFiles(parseMd(sourceOfTruthMd))

  const list: ManifestComponent[] = groupComponents(groups).map(({ name, subs }) => {
    const file = files.find((f) => flatName(f.replace(/^.*\//, '').replace(/\.tsx$/, '')) === flatName(name))
    return {
      name,
      importPath: file ?? UI_BARREL_FILE,
      governed: GOVERNED_COMPONENTS.has(name),
      ...componentVariants(components, name),
      subComponents: subs,
    }
  })
  const barrel = [...new Set(groups.flat())].sort()
  return { components: list, barrel }
}

/* ──────────────────────────────────────────────────────────
   patterns: src/docs/pages/patterns/*.tsx
   ────────────────────────────────────────────────────────── */

const PATTERNS_DIR = 'src/docs/pages/patterns'

/** `description` do primeiro `<DocPage>` do arquivo, quando é texto literal. */
function docPageDescription(source: string): string | null {
  const sf = parseTs(source, ts.ScriptKind.TSX)
  let found: string | null = null
  let seen = false
  const visit = (node: ts.Node) => {
    if (seen) return
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === 'DocPage') {
      seen = true
      const attr = node.attributes.properties.find(
        (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'description',
      )
      const init = attr?.initializer
      if (init && ts.isJsxExpression(init)) found = literalText(init.expression) ?? null
      else found = literalText(init) ?? null
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export function buildPatterns(bundledDir: string): ManifestPattern[] {
  const dir = join(bundledDir, PATTERNS_DIR)
  if (!existsSync(dir)) fail(`bundled/${PATTERNS_DIR} não existe.`)
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx')).sort()
  const patterns = files.map((file): ManifestPattern => {
    const name = file.replace(/\.tsx$/, '')
    const id = name
      .replace(/(Demo|Doc)$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
    return {
      id,
      name,
      file: `${PATTERNS_DIR}/${file}`,
      summary: docPageDescription(readFileSync(join(dir, file), 'utf-8')),
    }
  })
  const ids = new Set<string>()
  for (const p of patterns) {
    if (ids.has(p.id)) fail(`bundled/${PATTERNS_DIR}: dois arquivos viram o id "${p.id}".`)
    ids.add(p.id)
  }
  if (patterns.length < 5) fail(`bundled/${PATTERNS_DIR}: só ${patterns.length} patterns (esperava 5 ou mais).`)
  return patterns
}

/* ──────────────────────────────────────────────────────────
   governance: plugin deste repo + Non-negotiables da SKILL.md
   ────────────────────────────────────────────────────────── */

export function buildGovernance(skillMd: string): Manifest['governance'] {
  const rules = Object.keys(dsGovernance.rules)
  if (rules.length !== 1) {
    fail(`O plugin tem ${rules.length} regras (${rules.join(', ')}). O manifest tem um só ruleName: decida como representar antes de seguir.`)
  }
  const body = section(parseMd(skillMd), (t) => /^Non-negotiables$/i.test(t), 2)
  if (!body) fail('SKILL.md: não achei a seção "## Non-negotiables".')
  const nonNegotiables = bullets(body).map(collapse)
  if (nonNegotiables.length === 0) fail('SKILL.md: "## Non-negotiables" sem itens de lista.')
  return {
    plugin: dsGovernance.meta.name,
    ruleName: `${RULE_NAMESPACE}/${rules[0]}`,
    governedComponents: [...GOVERNED_COMPONENTS],
    blockedClassPrefixPattern: VISUAL_OVERRIDE_PATTERN.source,
    nonNegotiables,
  }
}

/* ──────────────────────────────────────────────────────────
   Montagem
   ────────────────────────────────────────────────────────── */

export interface BuildOptions {
  bundledDir?: string
  meta?: DsMeta
}

export function buildManifest(options: BuildOptions = {}): Manifest {
  const bundledDir = options.bundledDir ?? BUNDLED_DIR
  const meta = options.meta ?? readDsMeta()

  const skill = 'skills/design-system-fips'
  const css = readBundled(bundledDir, 'src/styles/globals.css')
  const foundations = readBundled(bundledDir, `${skill}/references/foundations.md`)
  const componentsMd = readBundled(bundledDir, `${skill}/references/components.md`)
  const sourceOfTruth = readBundled(bundledDir, `${skill}/references/source-of-truth.md`)
  const skillMd = readBundled(bundledDir, `${skill}/SKILL.md`)

  const cssVars = buildCssVars(css)
  const { components, barrel } = buildComponents(componentsMd, sourceOfTruth)

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    dsVersion: meta.version,
    generatedAt: `${meta.syncedAt}T00:00:00.000Z`,
    tokens: {
      palette: buildPalette(foundations),
      semantic: buildSemantic(cssVars),
      cssVars,
      spacing: buildSpacing(foundations),
      typography: buildTypography(foundations),
    },
    components,
    patterns: buildPatterns(bundledDir),
    governance: buildGovernance(skillMd),
    exports: { barrel },
  }
  assertUsable(manifest)
  return manifest
}

/** O que o servidor e o smoke tomam como certo. Falhar aqui é melhor que servir um manifest furado. */
function assertUsable(m: Manifest): void {
  const button = m.components.find((c) => c.name === 'Button')
  if (!button?.variants?.variant?.length) fail('components.md: o Button saiu sem "Variantes exatas".')
  for (const name of m.governance.governedComponents) {
    if (!m.exports.barrel.includes(name)) fail(`${name} é governado pelo plugin, mas não está no barrel de components.md.`)
  }
  if (m.components.length < 10) fail(`components.md: só ${m.components.length} componentes (esperava 10 ou mais).`)
  if (Object.keys(m.tokens.semantic.light).length < 10 || Object.keys(m.tokens.semantic.dark).length < 10) {
    fail('globals.css: menos de 10 cores semânticas por modo.')
  }
}

export function renderManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
