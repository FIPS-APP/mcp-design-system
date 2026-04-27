import { z } from 'zod'
import { validateJsx } from '../governance/eslint-runner.js'

export const validateJsxTool = {
  name: 'validate_jsx',
  description:
    'Validates a JSX/TSX snippet against the DS-FIPS governance ESLint rule (the same rule the design-system repo enforces in CI). ' +
    'Returns ok:true when the snippet is clean, otherwise a list of violations (line, column, rule, message). ' +
    'Use this BEFORE handing JSX to the user — catches visual className overrides on governed primitives.',
  inputSchema: z
    .object({
      code: z.string().describe('Full JSX/TSX snippet to validate.'),
      filename: z
        .string()
        .optional()
        .describe('Optional filename hint (default: snippet.tsx). Affects parser only.'),
    })
    .describe('JSX/TSX to validate.'),
  async handler({ code, filename }: { code: string; filename?: string }) {
    return validateJsx(code, filename)
  },
}
