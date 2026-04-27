/**
 * @fips-app/mcp-design-system — MCP server entry.
 *
 * Exposes the DS-FIPS surface (tokens, components, variants, patterns,
 * governance, JSX validation, scaffolding, search) to any MCP-aware AI
 * agent (Claude Desktop, Cursor, Continue, Cline, ...).
 *
 * Two transports:
 *   - stdio (default) — for local hosts that spawn the process
 *   - HTTP (Streamable HTTP) — `--http [--port N]` for remote hosting
 *
 * The server reads its data from a manifest JSON produced by
 * `npm run build:manifest` in the DS-FIPS repo. It never imports .tsx
 * directly — that decoupling is what lets the MCP and the design system
 * evolve independently.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z, type ZodTypeAny } from 'zod'
import { tools } from './tools/index.js'
import { loadManifest } from './manifest/loader.js'
import { listResources, listResourceTemplates, readResource } from './resources/index.js'
import { listPrompts, getPrompt } from './prompts/index.js'

/* ──────────────────────────────────────────────────────────
   Zod → JSON Schema (minimal — only shapes we ship)
   ────────────────────────────────────────────────────────── */

function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value)
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key)
      }
    }
    const result: Record<string, unknown> = { type: 'object', properties }
    if (required.length > 0) result.required = required
    if (schema.description) result.description = schema.description
    return result
  }
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap())
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema._def.innerType)
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema.element), description: schema.description }
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: [...schema.options], description: schema.description }
  }
  if (schema instanceof z.ZodString) return { type: 'string', description: schema.description }
  if (schema instanceof z.ZodNumber) return { type: 'number', description: schema.description }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean', description: schema.description }
  return { description: schema.description }
}

/* ──────────────────────────────────────────────────────────
   Server factory — used by both transports
   ────────────────────────────────────────────────────────── */

export function createServer(): Server {
  const server = new Server(
    {
      name: '@fips-app/mcp-design-system',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
    },
  )

  /* Tools */
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name)
    if (!tool) throw new Error(`Tool "${request.params.name}" not found.`)
    const args = request.params.arguments ?? {}
    const parsed = tool.inputSchema.parse(args)
    const result = await (tool.handler as (i: unknown) => Promise<unknown>)(parsed)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  })

  /* Resources */
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: listResources(),
  }))

  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
    resourceTemplates: listResourceTemplates(),
  }))

  server.setRequestHandler(ReadResourceRequestSchema, (request) => {
    const content = readResource(request.params.uri)
    return { contents: [content] }
  })

  /* Prompts */
  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: listPrompts(),
  }))

  server.setRequestHandler(GetPromptRequestSchema, (request) => {
    return getPrompt(request.params.name, request.params.arguments ?? {})
  })

  return server
}

/* ──────────────────────────────────────────────────────────
   CLI entry
   ────────────────────────────────────────────────────────── */

interface CliOpts {
  http: boolean
  port: number
  host: string
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { http: false, port: 3030, host: '0.0.0.0' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--http') opts.http = true
    else if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--host') opts.host = argv[++i] ?? opts.host
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        [
          'Usage: mcp-fips-ds [--http [--port 3030] [--host 0.0.0.0]]',
          '',
          'Default: stdio transport (used by Claude Desktop, Cursor, Continue, Cline).',
          'With --http: Streamable HTTP transport on POST /mcp (used for remote hosting).',
          '',
          'Env:',
          '  DS_FIPS_MANIFEST_PATH  Override path to ds-manifest.json',
          '  DS_FIPS_REPO_ROOT      Override repo root (used by resource readers)',
        ].join('\n') + '\n',
      )
      process.exit(0)
    }
  }
  return opts
}

async function startStdio() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

async function startHttp(port: number, host: string) {
  // Lazy-load HTTP deps so stdio mode stays slim.
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  )
  const { createServer: createHttpServer } = await import('node:http')

  const server = createServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — each request is independent
  })
  await server.connect(transport)

  const httpServer = createHttpServer((req, res) => {
    if (req.url !== '/mcp') {
      res.writeHead(404)
      res.end('Not Found. The MCP endpoint is POST /mcp.')
      return
    }
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : undefined
      transport.handleRequest(req, res, parsed).catch((err) => {
        process.stderr.write(`[mcp-design-system http] ${err}\n`)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end('Internal Server Error')
        }
      })
    })
  })

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve))
  process.stderr.write(`HTTP transport listening on http://${host}:${port}/mcp\n`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const manifest = loadManifest()

  process.stderr.write(
    `@fips-app/mcp-design-system v0.1.0 ready — DS-FIPS ${manifest.dsVersion} (manifest @ ${manifest.generatedAt}), ${tools.length} tools, ${listResources().length} resources, ${listPrompts().length} prompts.\n`,
  )

  if (opts.http) await startHttp(opts.port, opts.host)
  else await startStdio()
}

main().catch((err) => {
  process.stderr.write(
    `[mcp-design-system] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  )
  process.exit(1)
})
