import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const listComponentsTool = {
  name: 'list_components',
  description:
    'Lists every official DS-FIPS component (top-level primitives only). Use this before generating JSX so you only reach for components that actually exist in the system. ' +
    'Filter by `governed: true` to see only the primitives whose className overrides are blocked by the governance rule.',
  inputSchema: z
    .object({
      governed: z
        .boolean()
        .optional()
        .describe('When true, returns only governed components (Button, Input, Select, Textarea, TabsList, TabsTrigger).'),
    })
    .describe('Optional filter.'),
  async handler({ governed }: { governed?: boolean }) {
    const m = loadManifest()
    const list = m.components
      .filter((c) => (governed === undefined ? true : c.governed === governed))
      .map((c) => ({
        name: c.name,
        governed: c.governed,
        variants: c.variants ? Object.keys(c.variants) : [],
        sizes: c.variants?.size ?? [],
        importPath: c.importPath,
      }))
    return { count: list.length, components: list }
  },
}
