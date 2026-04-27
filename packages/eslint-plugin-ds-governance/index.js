/**
 * @fips-app/eslint-plugin-ds-governance
 *
 * ESLint plugin that enforces Design System FIPS governance rules.
 *
 * Currently exposes one rule: `no-visual-overrides`. It bans className
 * tokens that override the visual layer (background, text, border,
 * rounded, shadow, height, padding, font, leading, tracking, ring,
 * opacity) on governed DS-FIPS primitives. The intent is that visual
 * needs are promoted to official component variants (CVA) instead of
 * being patched ad-hoc at call sites.
 *
 * The plugin is consumed both by the DS-FIPS repo itself (dogfooding)
 * and by `@fips-app/mcp-design-system` (so the MCP `validate_jsx` tool
 * runs the same rule the repo enforces in CI).
 */

export const GOVERNED_COMPONENTS = new Set([
  'Button',
  'Input',
  'Select',
  'Textarea',
  'TabsList',
  'TabsTrigger',
])

export const VISUAL_OVERRIDE_PATTERN =
  /^(?:bg-|text-|border(?:$|-)|rounded(?:$|-)|shadow(?:$|-)|h(?:$|-)|min-h(?:$|-)|max-h(?:$|-)|p(?:$|-|x-|y-|t-|r-|b-|l-)|font(?:$|-)|leading(?:$|-)|tracking(?:$|-)|ring(?:$|-)|opacity(?:$|-))/

function getJsxName(node) {
  if (node.type === 'JSXIdentifier') return node.name
  if (node.type === 'JSXMemberExpression') return node.property.name
  return null
}

function getClassAttribute(node) {
  return node.attributes.find(
    (attribute) => attribute.type === 'JSXAttribute' && attribute.name.name === 'className',
  )
}

function getAttributeSourceText(attribute, sourceCode) {
  if (!attribute || !attribute.value) return ''
  if (attribute.value.type === 'Literal' && typeof attribute.value.value === 'string') {
    return attribute.value.value
  }
  if (attribute.value.type === 'JSXExpressionContainer') {
    return sourceCode.getText(attribute.value.expression)
  }
  return sourceCode.getText(attribute.value)
}

function getPotentialClassTokens(classText) {
  return (classText.match(/[!:[\]()/.%#,\w-]+/g) ?? []).map(
    (token) => token.split(':').at(-1)?.replace(/^!/, '') ?? token,
  )
}

const noVisualOverridesRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow visual className overrides on governed DS-FIPS primitives.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode
    return {
      JSXOpeningElement(node) {
        const componentName = getJsxName(node.name)
        if (!componentName || !GOVERNED_COMPONENTS.has(componentName)) return

        const classAttribute = getClassAttribute(node)
        const classText = getAttributeSourceText(classAttribute, sourceCode)
        if (!classText) return

        const offendingToken = getPotentialClassTokens(classText).find((token) =>
          VISUAL_OVERRIDE_PATTERN.test(token),
        )
        if (!offendingToken) return

        context.report({
          node: classAttribute,
          message:
            `Evite override visual direto em \`${componentName}\` com \`${offendingToken}\`. ` +
            'Promova a necessidade para uma variante ou composição oficial do DS-FIPS e deixe className apenas para layout externo.',
        })
      },
    }
  },
}

const plugin = {
  meta: {
    name: '@fips-app/eslint-plugin-ds-governance',
    version: '0.1.0',
  },
  rules: {
    'no-visual-overrides': noVisualOverridesRule,
  },
}

export default plugin
export { plugin }
