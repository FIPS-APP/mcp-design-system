# @fips-app/mcp-design-system

Servidor [MCP](https://modelcontextprotocol.io) que expõe o **Design System FIPS** (DS-FIPS) para qualquer agente de IA.

Conecte uma vez no Claude Desktop, Cursor, Continue, Cline ou Windsurf — e a IA passa a saber **exatamente** quais componentes, variantes, tokens, padrões e regras de governança o DS-FIPS oferece. Sem mais alucinação, sem mais hex inline, sem mais variantes inventadas.

## Quick start

### Claude Desktop

Adicione ao `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

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

Reinicie o Claude Desktop. Pronto.

Outros hosts: ver [`examples/`](./examples/).

## Modo HTTP (hospedagem remota)

Para hospedar centralmente (ex.: `mcp.fips.app.br`):

```bash
mcp-fips-ds --http --port 3030 --host 0.0.0.0
```

Endpoint: `POST /mcp` (Streamable HTTP / SSE response). Stateless por padrão — cada request é independente. Aceita os mesmos métodos JSON-RPC que o stdio.

## Tools (11)

| Tool | O que faz |
|---|---|
| `get_version` | Versão do MCP, schema do manifest e do DS-FIPS sendo servido. |
| `get_governance_rules` | Regras non-negotiable, componentes governados e o regex que bloqueia overrides visuais. **Leia antes de gerar JSX.** |
| `list_components` | Lista todos os componentes oficiais (`Button`, `Field`, `Dialog`, ...). Filtro `governed: true`. |
| `get_component` | API completa de um componente: variantes, sizes, defaults, sub-componentes, import path. |
| `list_tokens` | Tokens por categoria: `palette`, `semantic-light/dark`, `css-theme/root/dark`, `spacing`, `typography`. |
| `resolve_token` | Resolve uma role semântica (`primary`, `success`, `danger`, ...) para hex + CSS var, em light/dark/ambos. |
| `list_patterns` | Padrões de tela: Application Shell, Dashboard, Data Listing, Form Workspace, Modal Workflow, Hero. |
| `get_pattern` | Detalhe + caminho do arquivo de demo. |
| `validate_jsx` | Valida JSX/TSX contra a regra `governance/no-visual-overrides`. **Mesma regra do CI do DS-FIPS** — sem drift. |
| `search` | Busca cross-source (componentes, variantes, tokens, CSS vars, patterns, governance, exports). |
| `scaffold_screen` | **Gera arquivo .tsx pronto** de form / dashboard / listing / modal-workflow usando só primitivas oficiais. Output passa por `validate_jsx` clean (validado em CI). |

## Resources (16 estáticos + 4 templates)

URIs `dsfips://...` que o agente lê como dados — sem encher o contexto da tool call.

**Estáticos**:

- `dsfips://manifest` — JSON completo (single source of truth)
- `dsfips://governance` — regras + governed list + regex bloqueador
- `dsfips://tokens/palette`
- `dsfips://tokens/semantic/light` · `dsfips://tokens/semantic/dark`
- `dsfips://tokens/spacing` · `dsfips://tokens/typography`
- `dsfips://tokens/css-vars/theme` · `…/root` · `…/dark`
- `dsfips://styles/globals.css` — fonte literal
- `dsfips://references/foundations` · `…/components` · `…/patterns` · `…/source-of-truth` (markdowns do skill bundle)
- `dsfips://skill/SKILL.md`

**Templates** (URI placeholder):

- `dsfips://components/{name}` — JSON da API de um componente
- `dsfips://components/{name}/snippet` — TSX self-contained de `exports/<slug>/`
- `dsfips://patterns/{id}` — metadata de um pattern
- `dsfips://patterns/{id}/source` — `.tsx` cru do demo

## Prompts (4)

Cada um devolve um pre-built turn de usuário pra bootstrapar o agente em um workflow específico.

- `build-with-fips({goal})` — bootstrapa uma sessão de build com regras do DS já carregadas
- `review-fips-jsx({code})` — pede review de um snippet contra `validate_jsx` + apontamento de hex/raio fora dos tokens
- `migrate-to-fips({code, sourceDs?})` — porta JSX de outro DS (MUI, Chakra, raw Tailwind, etc.) pro DS-FIPS
- `explain-token({semantic})` — explica um token (light, dark, var, quando usar, com o que NÃO confundir)

## Como funciona

O servidor lê **um único** JSON estruturado (`ds-manifest.json`) gerado pelo DS-FIPS em build:

```
DS-FIPS repo                                MCP server
─────────────                               ──────────
src/tokens/*.ts             ┐
src/components/ui/*.ts      │  build:manifest    ┌────────────────────┐
src/styles/globals.css      │ ───────────────────▶│ ds-manifest.json   │
src/composites/*            │                    │ (source of truth)   │
src/docs/pages/patterns/*   ┘                    └─────────┬──────────┘
                                                            │
                                                            ▼
                                              tools + resources + prompts
```

O MCP nunca importa `.tsx` — o que dá ao DS liberdade pra evoluir sem quebrar consumidores.

A regra de governança usada por `validate_jsx` é a **mesma** que o DS-FIPS roda em CI, exposta como pacote npm separado: `@fips-app/eslint-plugin-ds-governance`. Drift = zero.

Para o playbook de "como manter o MCP em sincronia quando o time atualiza o DS", veja [`SYNC.md`](./SYNC.md).

## Versionamento

| Quem | Quando muda |
|---|---|
| MCP versão | Quando contratos de tools/resources mudam (breaking). |
| Manifest schemaVersion | Quando shape do manifest muda. |
| `dsVersion` | Espelha exatamente a versão do DS-FIPS. |

`get_version` retorna os três para o agente decidir compatibilidade.

## Desenvolvimento local

```bash
# A partir da raiz do monorepo DS-FIPS
npm install
npm run build:manifest                                # gera dist/manifest/ds-manifest.json
npm --workspace @fips-app/mcp-design-system run dev   # roda via tsx (stdio)
npm --workspace @fips-app/mcp-design-system run build # bundle de produção (tsup)
```

Smoke test (cobre 11 tools + 16 resources + 4 prompts + 4 cenários closed-loop scaffold→validate):

```bash
npm --workspace @fips-app/mcp-design-system exec tsx scripts/smoke.ts
```

Inspector oficial:

```bash
npm --workspace @fips-app/mcp-design-system run inspect
```

## Roadmap

- [x] 11 tools, 16 resources, 4 prompts, scaffold_screen, search
- [x] Modo HTTP (`--http --port`)
- [x] Closed-loop validation (scaffold output → validate_jsx clean)
- [ ] Pacote `@fips-app/design-system-manifest` separado (publica o JSON em npm; hoje o MCP lê via workspace)
- [ ] Migrar pra repo separado `github.com/FIPS-APP/mcp-design-system`
- [ ] GitHub Action que dispara bump automático aqui no release do DS-FIPS

## Licença

MIT.
