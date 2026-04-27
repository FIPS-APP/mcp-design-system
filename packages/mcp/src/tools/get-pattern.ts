import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const getPatternTool = {
  name: 'get_pattern',
  description:
    'Returns details about a single DS-FIPS pattern: id, name, source file path, and a one-line summary. Use the file path when you need to read the actual demo code via the resource interface.',
  inputSchema: z
    .object({
      id: z
        .string()
        .describe('Pattern id, e.g. "application-shell", "dashboard", "data-listing", "form-workspace", "modal-workflow", "hero-header", "hero-banner".'),
    })
    .describe('Pattern id.'),
  async handler({ id }: { id: string }) {
    const m = loadManifest()
    const p = m.patterns.find((p) => p.id === id)
    if (!p) {
      const ids = m.patterns.map((p) => p.id).join(', ')
      throw new Error(`Pattern "${id}" not found. Available: ${ids}.`)
    }
    return {
      id: p.id,
      name: p.name,
      summary: p.summary,
      file: p.file,
      hint: `Read the actual demo source via the resource URI dsfips://patterns/${id} once that handler ships, or open the file at ${p.file} in the DS-FIPS repo.`,
    }
  },
}
