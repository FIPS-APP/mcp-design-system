/**
 * MCP resource registry — all URIs the server exposes for client-side reads.
 *
 * Three classes of resources:
 *
 * 1. Static — fixed URI, fixed content (manifest blob, governance JSON,
 *    CSS source file, skill markdowns).
 * 2. Component-templated — `dsfips://components/{name}` and
 *    `dsfips://components/{name}/snippet`. Resolved against the manifest +
 *    the `exports/<slug>/` folder.
 * 3. Pattern-templated — `dsfips://patterns/{id}` (JSON metadata) and
 *    `dsfips://patterns/{id}/source` (raw .tsx).
 *
 * Static resources are listed in `listResources()`. Templates are listed in
 * `listResourceTemplates()` so MCP clients know the URI shape and can ask
 * the user / model to fill placeholders.
 */

import { readdirSync } from 'node:fs'
import { loadManifest, type Manifest } from '../manifest/loader.js'
import { readRepoFile, fileExists, bundledRoot } from './loader.js'

export interface ResourceDescriptor {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface ResourceTemplateDescriptor {
  uriTemplate: string
  name: string
  description: string
  mimeType: string
}

export interface ResourceContent {
  uri: string
  mimeType: string
  text: string
}

/* ──────────────────────────────────────────────────────────
   Static resource catalogue
   ────────────────────────────────────────────────────────── */

const STATIC_RESOURCES: ResourceDescriptor[] = [
  {
    uri: 'dsfips://manifest',
    name: 'DS-FIPS manifest',
    description:
      'Full structured snapshot of the DS-FIPS surface (tokens, components, patterns, governance, exports). The single source of truth this MCP serves.',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://governance',
    name: 'DS-FIPS governance',
    description:
      'Non-negotiables, governed components, blocked-class regex, ESLint rule name. Read this before generating any JSX.',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/palette',
    name: 'Palette colors',
    description: 'Raw named palette colors from src/tokens/colors.ts.',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/semantic/light',
    name: 'Semantic colors (light)',
    description: 'Light-mode semantic colors (primary, secondary, accent, success, surface, ...).',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/semantic/dark',
    name: 'Semantic colors (dark)',
    description: 'Dark-mode semantic colors. Use when generating dark-aware UI.',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/spacing',
    name: 'Spacing scale',
    description: 'Spacing scale (4px base; full scale + pixel translations).',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/typography',
    name: 'Typography',
    description: 'Font families and type scale (heading: Saira Expanded; body: Open Sans).',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/css-vars/theme',
    name: '@theme block CSS vars',
    description: 'Tailwind v4 @theme block (radii, shadows, raw color shades).',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/css-vars/root',
    name: ':root CSS vars',
    description: 'Light-mode CSS custom properties applied to :root.',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://tokens/css-vars/dark',
    name: '.dark CSS vars',
    description: 'Dark-mode CSS custom properties (override :root when html.dark).',
    mimeType: 'application/json',
  },
  {
    uri: 'dsfips://styles/globals.css',
    name: 'Raw globals.css',
    description: 'Full src/styles/globals.css source (Tailwind v4 + custom theming).',
    mimeType: 'text/css',
  },
  {
    uri: 'dsfips://references/foundations',
    name: 'Skill: foundations.md',
    description: 'Portable markdown reference for foundations (colors, typography, spacing, radii, shadows).',
    mimeType: 'text/markdown',
  },
  {
    uri: 'dsfips://references/components',
    name: 'Skill: components.md',
    description: 'Portable markdown reference covering each component, variants, and snippets.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'dsfips://references/patterns',
    name: 'Skill: patterns.md',
    description: 'Portable markdown reference for screen patterns (Application Shell, Dashboard, Listing, Form, Modal Workflow, Hero).',
    mimeType: 'text/markdown',
  },
  {
    uri: 'dsfips://references/source-of-truth',
    name: 'Skill: source-of-truth.md',
    description: 'Portable markdown describing where the source of truth lives in the repo + governance pointers.',
    mimeType: 'text/markdown',
  },
  {
    uri: 'dsfips://skill/SKILL.md',
    name: 'SKILL.md',
    description: 'Top-level skill manifest used by AI agents that load DS-FIPS as a portable skill bundle.',
    mimeType: 'text/markdown',
  },
]

const STATIC_TEMPLATES: ResourceTemplateDescriptor[] = [
  {
    uriTemplate: 'dsfips://components/{name}',
    name: 'Component API',
    description: 'Structured API of a single component: variants, sizes, defaults, sub-components, governance flag.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'dsfips://components/{name}/snippet',
    name: 'Component snippet (copy-paste)',
    description:
      'Raw self-contained .tsx snippet from exports/<slug>/. Use this when the consumer needs to copy the component into a project that does NOT depend on @ds-fips.',
    mimeType: 'text/typescript',
  },
  {
    uriTemplate: 'dsfips://patterns/{id}',
    name: 'Pattern metadata',
    description: 'id, name, file path, summary for one screen pattern.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'dsfips://patterns/{id}/source',
    name: 'Pattern source',
    description: 'Raw .tsx source of the pattern demo file. Use as a reference implementation when scaffolding a similar screen.',
    mimeType: 'text/typescript',
  },
]

/* ──────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────── */

export function listResources(): ResourceDescriptor[] {
  return STATIC_RESOURCES
}

export function listResourceTemplates(): ResourceTemplateDescriptor[] {
  return STATIC_TEMPLATES
}

const PASCAL_TO_KEBAB: Record<string, string> = {
  Button: 'button',
  Badge: 'badge',
  Card: 'card',
  Dialog: 'modal', // exports uses "modal" not "dialog"
  Drawer: 'drawer',
  Field: 'field-label', // exports uses "field-label"
  Input: 'input',
  Progress: 'progress-bar',
  Select: 'd-s-select',
  Table: 'd-s-table',
  Textarea: 'd-s-textarea',
  Tooltip: 'tooltip',
  // Tabs has multiple flavors in exports/; default to underline.
  Tabs: 'tabs-underline',
}

function findExportSlug(componentName: string): string | null {
  const direct = PASCAL_TO_KEBAB[componentName]
  if (direct && fileExists(`exports/${direct}`)) return direct
  // Fallback: kebab-case lower
  const slug = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  if (fileExists(`exports/${slug}`)) return slug
  return null
}

function readExportSnippet(componentName: string): string {
  const slug = findExportSlug(componentName)
  if (!slug) {
    throw new Error(
      `No standalone snippet available in exports/ for component "${componentName}". ` +
        `Use dsfips://components/${componentName} for the API and import from src/components/ui/ instead.`,
    )
  }
  const dir = `exports/${slug}`
  const fullDir = bundledRoot(dir)
  if (!fullDir) {
    throw new Error(`exports/${slug}/ not found (neither in repo root nor in packages/mcp/bundled/).`)
  }
  const files = readdirSync(fullDir).filter((f: string) => f.endsWith('.tsx'))
  if (files.length === 0) {
    throw new Error(`No .tsx file in exports/${slug}/`)
  }
  return readRepoFile(`${dir}/${files[0]}`)
}

export function readResource(uri: string): ResourceContent {
  const m: Manifest = loadManifest()

  // Static URIs first.
  switch (uri) {
    case 'dsfips://manifest':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m, null, 2) }
    case 'dsfips://governance':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.governance, null, 2) }
    case 'dsfips://tokens/palette':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.palette, null, 2) }
    case 'dsfips://tokens/semantic/light':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.semantic.light, null, 2) }
    case 'dsfips://tokens/semantic/dark':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.semantic.dark, null, 2) }
    case 'dsfips://tokens/spacing':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(
          { base: '4px', scale: m.tokens.spacing, asPixels: m.tokens.spacing.map((n) => `${n * 4}px`) },
          null,
          2,
        ),
      }
    case 'dsfips://tokens/typography':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.typography, null, 2) }
    case 'dsfips://tokens/css-vars/theme':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.cssVars.theme, null, 2) }
    case 'dsfips://tokens/css-vars/root':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.cssVars.root, null, 2) }
    case 'dsfips://tokens/css-vars/dark':
      return { uri, mimeType: 'application/json', text: JSON.stringify(m.tokens.cssVars.dark, null, 2) }
    case 'dsfips://styles/globals.css':
      return { uri, mimeType: 'text/css', text: readRepoFile('src/styles/globals.css') }
    case 'dsfips://references/foundations':
      return { uri, mimeType: 'text/markdown', text: readRepoFile('skills/design-system-fips/references/foundations.md') }
    case 'dsfips://references/components':
      return { uri, mimeType: 'text/markdown', text: readRepoFile('skills/design-system-fips/references/components.md') }
    case 'dsfips://references/patterns':
      return { uri, mimeType: 'text/markdown', text: readRepoFile('skills/design-system-fips/references/patterns.md') }
    case 'dsfips://references/source-of-truth':
      return { uri, mimeType: 'text/markdown', text: readRepoFile('skills/design-system-fips/references/source-of-truth.md') }
    case 'dsfips://skill/SKILL.md':
      return { uri, mimeType: 'text/markdown', text: readRepoFile('skills/design-system-fips/SKILL.md') }
  }

  // Templated URIs.
  let match = /^dsfips:\/\/components\/([^/]+)$/.exec(uri)
  if (match) {
    const name = match[1]
    const c = m.components.find((c) => c.name === name)
    if (!c) throw new Error(`Component "${name}" not in manifest.`)
    return { uri, mimeType: 'application/json', text: JSON.stringify(c, null, 2) }
  }

  match = /^dsfips:\/\/components\/([^/]+)\/snippet$/.exec(uri)
  if (match) {
    const name = match[1]
    return { uri, mimeType: 'text/typescript', text: readExportSnippet(name) }
  }

  match = /^dsfips:\/\/patterns\/([^/]+)$/.exec(uri)
  if (match) {
    const id = match[1]
    const p = m.patterns.find((p) => p.id === id)
    if (!p) throw new Error(`Pattern "${id}" not in manifest.`)
    return { uri, mimeType: 'application/json', text: JSON.stringify(p, null, 2) }
  }

  match = /^dsfips:\/\/patterns\/([^/]+)\/source$/.exec(uri)
  if (match) {
    const id = match[1]
    const p = m.patterns.find((p) => p.id === id)
    if (!p) throw new Error(`Pattern "${id}" not in manifest.`)
    return { uri, mimeType: 'text/typescript', text: readRepoFile(p.file) }
  }

  throw new Error(`Unknown resource URI: ${uri}`)
}
