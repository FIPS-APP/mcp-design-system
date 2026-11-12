# MCP — Design System FIPS

Servidor [Model Context Protocol](https://modelcontextprotocol.io) que expõe o **[Design System FIPS](https://design-system.fips.app.br)** para qualquer agente de IA — Claude Desktop, Cursor, Continue, Cline, Windsurf, ChatGPT.

Conecte uma vez e a IA passa a saber **exatamente** quais componentes, variantes, tokens, padrões e regras de governança o DS-FIPS oferece. Sem alucinação. Sem hex inline. Sem variantes inventadas.

## Quick start (Claude Desktop)

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "fips-ds": {
      "command": "npx",
      "args": ["-y", "@fips-app/mcp-design-system"]
    }
  }
}
```

Outros hosts: `packages/mcp/examples/`.

## Estrutura

Monorepo com dois pacotes publicáveis:

```
mcp-design-system/
├── packages/
│   ├── eslint-plugin-ds-governance/   # @fips-app/eslint-plugin-ds-governance
│   │                                    A regra ESLint `governance/no-visual-overrides`
│   │                                    extraída como pacote npm reutilizável.
│   │                                    Mesma regra que o DS-FIPS roda em CI — drift zero.
│   └── mcp/                            # @fips-app/mcp-design-system
│                                         Servidor MCP propriamente dito.
│                                         Consome o plugin acima para `validate_jsx`.
├── packages/mcp/manifest/ds-manifest.json
│                                    Reserva (DS 0.4.1). So e lida se o pacote
│                                    do design system nao estiver instalado.
└── node_modules/@fips-app/ds-fips/ai/manifest.json
                                     Fonte de dados do MCP: o `ai/manifest.json`
                                     do pacote instalado (0.23.1).
```

## Capabilities expostas

11 tools, 16 resources estáticos + 4 templates, 4 prompts. Detalhe completo em [`packages/mcp/README.md`](./packages/mcp/README.md).

## Sincronia com o DS-FIPS

O servidor lê o `ai/manifest.json` do pacote `@fips-app/ds-fips` instalado (hoje 0.23.1, `optionalDependencies` do root e do `packages/mcp`). Para subir de versão: `npm i -E @fips-app/ds-fips@<versão>` (com `NODE_AUTH_TOKEN` do registro), `npm run smoke` e commit do lock. O bundle em `packages/mcp/bundled/` (snippets, CSS e referências do DS 0.20.4) segue como reserva dos resources; não é fonte das ferramentas. O playbook antigo está em [`packages/mcp/SYNC.md`](./packages/mcp/SYNC.md) (histórico).

Roadmap V3: GitHub Action que dispara `repository_dispatch` daqui no release do DS-FIPS, abre PR de bump automático.

## Desenvolvimento local

```bash
npm install
npm run smoke      # 41+ tests cobrindo tools, resources, prompts e closed-loop
npm run dev        # roda o server via tsx (stdio)
npm run build      # bundle de produção (tsup)
```

## Modo HTTP (hospedagem remota)

Para hospedar centralmente:

```bash
npm run build
node packages/mcp/dist/server.js --http --port 3030 --host 0.0.0.0
```

Endpoint: `POST /mcp`, Streamable HTTP / SSE response.

## Licença

MIT.
