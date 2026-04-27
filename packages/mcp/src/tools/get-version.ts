import { z } from 'zod'
import { loadManifest } from '../manifest/loader.js'

export const getVersionTool = {
  name: 'get_version',
  description:
    'Returns versions of this MCP server, the DS-FIPS manifest it is serving, and when the manifest was generated. ' +
    'Use this to confirm the MCP is up-to-date with the design system before relying on its outputs.',
  inputSchema: z.object({}).describe('No parameters.'),
  async handler() {
    const manifest = loadManifest()
    return {
      mcpVersion: '0.1.0',
      manifestSchemaVersion: manifest.schemaVersion,
      dsVersion: manifest.dsVersion,
      manifestGeneratedAt: manifest.generatedAt,
    }
  },
}
