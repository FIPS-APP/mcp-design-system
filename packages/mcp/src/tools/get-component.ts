import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const getComponentTool = {
  name: 'get_component',
  description:
    'Returns the full API surface of a single DS-FIPS component: variants, sizes, default variants, sub-components, governance flag, and import path. ' +
    'Always call this before writing JSX for a component — picking the wrong variant name (e.g. "save" instead of "success") is the #1 source of broken DS code.',
  inputSchema: z
    .object({
      name: z.string().describe('Exact component name, case-sensitive (e.g. "Button", "Field", "Dialog").'),
    })
    .describe('Component name.'),
  async handler({ name }: { name: string }) {
    const m = loadManifest()
    const c = m.components.find((c) => c.name === name)
    if (!c) {
      const available = m.components.map((c) => c.name).join(', ')
      throw new Error(
        `Component "${name}" not found in DS-FIPS. Available: ${available}.`,
      )
    }
    return {
      name: c.name,
      governed: c.governed,
      importPath: c.importPath,
      variants: c.variants,
      defaultVariants: c.defaultVariants,
      subComponents: c.subComponents,
      governanceNote: c.governed
        ? 'This component is governed: visual className overrides (bg-*, text-*, border*, rounded*, shadow*, h*, p*, font*, leading*, tracking*, ring*, opacity*) WILL be rejected by the ESLint rule. Promote visual needs to a variant via class-variance-authority instead.'
        : 'This component is not under the no-visual-overrides rule, but still respect official tokens (--color-*, --radius-*, --shadow-*) for consistency.',
    }
  },
}
