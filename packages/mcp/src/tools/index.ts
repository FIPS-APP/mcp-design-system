import { getVersionTool } from './get-version.js'
import { listComponentsTool } from './list-components.js'
import { getComponentTool } from './get-component.js'
import { listTokensTool } from './list-tokens.js'
import { resolveTokenTool } from './resolve-token.js'
import { listPatternsTool } from './list-patterns.js'
import { getPatternTool } from './get-pattern.js'
import { getGovernanceRulesTool } from './get-governance-rules.js'
import { validateJsxTool } from './validate-jsx.js'
import { searchTool } from './search.js'
import { scaffoldScreenTool } from './scaffold-screen.js'

export const tools = [
  getVersionTool,
  getGovernanceRulesTool,
  listComponentsTool,
  getComponentTool,
  listTokensTool,
  resolveTokenTool,
  listPatternsTool,
  getPatternTool,
  validateJsxTool,
  searchTool,
  scaffoldScreenTool,
] as const
