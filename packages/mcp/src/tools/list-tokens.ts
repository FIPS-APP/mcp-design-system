import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

const CATEGORIES = ['palette', 'semantic-light', 'semantic-dark', 'css-theme', 'css-root', 'css-dark', 'spacing', 'typography'] as const

export const listTokensTool = {
  name: 'list_tokens',
  description:
    'Lists DS-FIPS tokens by category. Always prefer tokens over hex literals — pasting #004B9B in JSX bypasses theming and breaks dark-mode consumers. Categories: palette (raw named colors), semantic-light/dark (logical colors per mode), css-theme/root/dark (Tailwind v4 + CSS vars), spacing, typography.',
  inputSchema: z
    .object({
      category: z.enum(CATEGORIES).describe('Which token category to list.'),
    })
    .describe('Token category.'),
  async handler({ category }: { category: (typeof CATEGORIES)[number] }) {
    const m = loadManifest()
    switch (category) {
      case 'palette':
        return { category, tokens: m.tokens.palette }
      case 'semantic-light':
        return { category, tokens: m.tokens.semantic.light }
      case 'semantic-dark':
        return { category, tokens: m.tokens.semantic.dark }
      case 'css-theme':
        return { category, tokens: m.tokens.cssVars.theme }
      case 'css-root':
        return { category, tokens: m.tokens.cssVars.root }
      case 'css-dark':
        return { category, tokens: m.tokens.cssVars.dark }
      case 'spacing':
        return {
          category,
          base: '4px',
          scale: m.tokens.spacing,
          asPixels: m.tokens.spacing.map((n) => `${n * 4}px`),
        }
      case 'typography':
        return { category, ...m.tokens.typography }
    }
  },
}
