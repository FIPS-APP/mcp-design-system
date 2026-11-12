/**
 * Converte o `ai/manifest.json` do pacote `@fips-app/ds-fips` (pt-BR: exports,
 * props, tokens claro/escuro, padroes) no formato `Manifest` que as ferramentas
 * ja consomem. As ferramentas nao mudam de assinatura; muda a fonte.
 */

import type { Manifest, ManifestComponent, ManifestPattern } from './loader.js'
import type { PacoteLint, PacoteManifest } from './pacote.js'

const DEFAULT_GOVERNED = ['Button', 'Input', 'Select', 'Textarea', 'TabsList', 'TabsTrigger']

// Multiplicadores do Tailwind sobre `--spacing` (0.25rem). O pacote so publica a base.
const SPACING_SCALE = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]

export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function camel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/** Segue `var(--x)` dentro do mapa ate sair um valor final (ate 8 saltos). */
function resolver(valor: string, mapa: Record<string, string>): string {
  let v = valor
  for (let i = 0; i < 8; i++) {
    const m = /^var\((--[\w-]+)\)$/.exec(v.trim())
    if (!m || mapa[m[1]] === undefined) return v
    v = mapa[m[1]]
  }
  return v
}

function componentes(p: PacoteManifest, governados: Set<string>): ManifestComponent[] {
  const nomes = p.exports.componente
  return nomes.map((name) => {
    const props = p.props[`${name}Props`] ?? []
    const variants: Record<string, string[]> = {}
    for (const prop of props) if (prop.valores && prop.valores.length > 0) variants[prop.nome] = prop.valores
    return {
      name,
      importPath: '@fips-app/ds-fips',
      governed: governados.has(name),
      variants: Object.keys(variants).length > 0 ? variants : null,
      // O manifest do pacote nao publica o valor padrao das variantes.
      defaultVariants: null,
      subComponents: nomes.filter((n) => n !== name && n.startsWith(name) && /^[A-Z]/.test(n.slice(name.length))),
    }
  })
}

function tokens(p: PacoteManifest): Manifest['tokens'] {
  const { claro, escuro } = p.tokens
  const escuroCheio = { ...claro, ...escuro }
  const semantico = (base: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(base)) {
      if (!k.startsWith('--color-') || k.startsWith('--color-fips-')) continue
      out[camel(k.slice('--color-'.length))] = resolver(v, base)
    }
    return out
  }
  const palette: Record<string, string> = {}
  for (const [k, v] of Object.entries(claro)) {
    if (k.startsWith('--color-fips-')) palette[camel(k.slice('--color-fips-'.length))] = resolver(v, claro)
  }
  const familia = (v: string | undefined) =>
    (v ?? '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean)
  const escala: Record<string, string> = {}
  for (const [k, v] of Object.entries(claro)) if (k.startsWith('--text-')) escala[k.slice('--text-'.length)] = v
  return {
    palette,
    semantic: { light: semantico(claro), dark: semantico(escuroCheio) },
    // O pacote nao separa @theme de :root; todo o `claro` vai em theme.
    cssVars: { theme: claro, root: {}, dark: escuro },
    spacing: SPACING_SCALE,
    typography: {
      families: {
        heading: familia(claro['--font-heading']),
        body: familia(claro['--font-sans']),
        mono: familia(claro['--font-mono']),
      },
      scale: escala,
    },
  }
}

function padroes(p: PacoteManifest): ManifestPattern[] {
  return p.padroes.map((x) => ({
    id: slug(x.tela),
    name: x.tela,
    file: x.referencia ?? '',
    summary:
      [
        x.referencia ? `Referencia: ${x.referencia}` : null,
        x.componentes?.length ? `Componentes: ${x.componentes.join(', ')}` : null,
        x.desde ? `Desde ${x.desde}` : null,
        x.nota ?? null,
      ]
        .filter(Boolean)
        .join('. ') || null,
  }))
}

export function adaptarPacote(p: PacoteManifest, lint: PacoteLint | null): Manifest {
  const governados = lint?.governedComponents ?? DEFAULT_GOVERNED
  return {
    schemaVersion: 'ai-manifest',
    dsVersion: p.versao,
    generatedAt: p.data,
    tokens: tokens(p),
    components: componentes(p, new Set(governados)),
    patterns: padroes(p),
    governance: {
      plugin: '@fips-app/ds-fips/eslint',
      ruleName: 'governance/no-visual-overrides',
      governedComponents: governados,
      blockedClassPrefixPattern: lint?.visualOverridePattern ?? '',
      nonNegotiables: [...p.proibicoes, ...p.regimes],
    },
    exports: { barrel: [...p.exports.componente, ...p.exports.funcao, ...p.exports.valor, ...p.exports.tipo] },
  }
}
