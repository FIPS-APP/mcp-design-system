import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const getGovernanceRulesTool = {
  name: 'get_governance_rules',
  description:
    'Returns the non-negotiable rules of the DS-FIPS, the list of governed components whose className is restricted, the regex pattern that determines a "visual override", and the ESLint plugin name that enforces it. Always read these before generating JSX — they are how FIPS keeps every product visually consistent.',
  inputSchema: z.object({}).describe('No parameters.'),
  async handler() {
    const m = loadManifest()
    return {
      ...m.governance,
      explanation:
        'When you write JSX for a governed component (Button, Input, Select, Textarea, TabsList, TabsTrigger), do NOT add visual classes via className. ' +
        'If you find yourself wanting to (e.g. <Button className="bg-red-500 h-7">), the correct move is to call get_component({name}) and pick an existing variant, ' +
        'or — if no variant matches — surface to the user that the design system needs a new variant. Do not bypass.',
    }
  },
}
