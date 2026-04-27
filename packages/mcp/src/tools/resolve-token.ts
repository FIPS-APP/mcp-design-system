import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const resolveTokenTool = {
  name: 'resolve_token',
  description:
    'Resolves a semantic role ("primary", "success", "danger", "surface", "fg", "border", etc.) into its hex value and CSS var name for the requested mode. ' +
    'Use this whenever you need a concrete color in JSX/CSS — never write hex literals directly.',
  inputSchema: z
    .object({
      semantic: z
        .string()
        .describe('Semantic role (e.g. "primary", "success", "danger", "surface", "fg", "border", "accent").'),
      mode: z
        .enum(['light', 'dark', 'both'])
        .default('both')
        .describe('Theme mode. "both" returns both — recommended.'),
    })
    .describe('Token resolution.'),
  async handler({ semantic, mode = 'both' }: { semantic: string; mode?: 'light' | 'dark' | 'both' }) {
    const m = loadManifest()
    const lightVal = m.tokens.semantic.light[semantic]
    const darkVal = m.tokens.semantic.dark[semantic]
    if (!lightVal && !darkVal) {
      const available = [
        ...Object.keys(m.tokens.semantic.light),
        ...Object.keys(m.tokens.semantic.dark),
      ]
      const unique = [...new Set(available)].sort().join(', ')
      throw new Error(`Semantic token "${semantic}" not found. Available: ${unique}.`)
    }

    // Map common semantic names to CSS var names. Convention in globals.css
    // is --color-<kebab-of-semantic>, with a few abbreviations.
    const cssVar = `--color-${semantic
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')}`

    const result: Record<string, string | undefined> = {}
    if (mode === 'light' || mode === 'both') result.light = lightVal
    if (mode === 'dark' || mode === 'both') result.dark = darkVal
    return {
      semantic,
      cssVar,
      ...result,
      hint:
        'Prefer the CSS var (`var(' +
        cssVar +
        ')`) in JSX/CSS rather than the hex value — that way light/dark switches automatically.',
    }
  },
}
