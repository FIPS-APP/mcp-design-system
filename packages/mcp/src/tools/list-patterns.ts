import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const listPatternsTool = {
  name: 'list_patterns',
  description:
    'Lists DS-FIPS screen patterns (Application Shell, Dashboard, Data Listing, Form Workspace, Modal Workflow, Hero, etc.). When the user asks for a "form screen" or "data listing", look up the matching pattern here before composing primitives — patterns encode opinionated structure that matches FIPS UX.',
  inputSchema: z.object({}).describe('No parameters.'),
  async handler() {
    const m = loadManifest()
    return {
      count: m.patterns.length,
      patterns: m.patterns.map((p) => ({
        id: p.id,
        name: p.name,
        summary: p.summary,
      })),
    }
  },
}
