import type { ESLint, Linter, Rule } from 'eslint'

export declare const GOVERNED_COMPONENTS: Set<string>
export declare const VISUAL_OVERRIDE_PATTERN: RegExp

export interface DsGovernancePlugin extends ESLint.Plugin {
  meta: { name: string; version: string }
  rules: {
    'no-visual-overrides': Rule.RuleModule | Linter.RuleEntry
  }
}

declare const plugin: DsGovernancePlugin
export default plugin
export { plugin }
