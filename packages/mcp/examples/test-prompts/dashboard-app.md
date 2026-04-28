# Teste prático — App com Dashboard via MCP do FIPS Design System

Documento auto-contido que outra pessoa pode executar **em qualquer máquina** para validar o servidor MCP `@fips-app/mcp-design-system` end-to-end. Cobre setup do MCP, registro no agente, validação, prompt do teste e checklist de auditoria.

---

## Parte 1 — Instalar o MCP na máquina-alvo

Escolha **uma** das três rotas. Depois de instalar, você vai apontar o agente (Claude Desktop, Cursor, Continue ou Cline) para o servidor.

### Rota A — `npx git+https` (recomendada — funciona hoje, sem npm registry)

Pré-requisitos: Node.js ≥ 20, npm ≥ 10, e acesso git ao repositório (`gh auth login` ou SSH key configurada se o repo estiver privado; sem auth para repo público).

A pessoa que rodar o agente **não precisa clonar nada manualmente**. O host (Claude Desktop, Cursor, etc.) executa `npx git+https://...` ao iniciar: o npm clona o repo num cache, instala deps, builda automaticamente via `prepare` script, e executa o servidor. Primeira execução leva ~30s; subsequentes são instantâneas (cache).

Configuração no host (exemplo Claude Desktop):

```json
{
  "mcpServers": {
    "fips-ds": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/FIPS-APP/mcp-design-system.git"]
    }
  }
}
```

> Validado em máquina limpa: `npm install` do tarball git produz binário em ~900ms (sem cache de pacotes prévios) e `initialize` do MCP responde com as 3 capabilities completas. Repo privado funciona idêntico desde que `gh auth status` mostre logged in.

### Rota B — clone + build local (manual, sem npm registry e sem rede)

Pré-requisitos: Git, Node.js ≥ 20, npm ≥ 10.

Em qualquer máquina:

```bash
# 1. Clonar o repo do MCP server
git clone https://github.com/FIPS-APP/mcp-design-system.git
cd mcp-design-system

# 2. Instalar deps e gerar o bundle
npm install
npm run build

# 3. Anote o caminho absoluto do binário gerado
pwd
# imprime, por exemplo: /home/foo/mcp-design-system
# o servidor compilado fica em: <pwd>/packages/mcp/dist/server.js
```

Configuração no host (substituir `/CAMINHO/ABSOLUTO/AQUI` pelo retorno do `pwd`):

```json
{
  "mcpServers": {
    "fips-ds": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/AQUI/packages/mcp/dist/server.js"]
    }
  }
}
```

> Repo privado? A pessoa precisa estar autenticada no GitHub com acesso à org `FIPS-APP` (ex.: `gh auth login` ou SSH key configurada).

### Rota C — endpoint HTTP remoto (uma instalação para todos os usuários)

Hospede o servidor uma vez e todos os agentes da empresa apontam pra mesma URL.

No servidor:

```bash
git clone https://github.com/FIPS-APP/mcp-design-system.git
cd mcp-design-system && npm install && npm run build
node packages/mcp/dist/server.js --http --port 3030 --host 0.0.0.0
# (em produção, gerencie via systemd/pm2/docker e exponha via reverse proxy
#  com TLS — ex.: mcp.fips.app.br/mcp)
```

Configuração no host do agente (Claude Desktop ainda usa stdio nativo, então pra HTTP costuma ser via Continue, ou via wrapper). Exemplo:

```json
{
  "mcpServers": {
    "fips-ds": {
      "url": "https://mcp.fips.app.br/mcp"
    }
  }
}
```

> Recomendado para uso em escala. Em V1, prefira A ou B.

---

## Parte 2 — Registrar no agente

Onde colocar a configuração depende do host. Após editar, **reinicie** o host completamente.

| Host | Arquivo |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` (ou `.cursor/mcp.json` na raiz do projeto) |
| Continue | `~/.continue/config.json` (sob `experimental.modelContextProtocolServers`) |
| Cline (VS Code) | painel "MCP Servers" da extensão |

A entrada `fips-ds` deve fundir com o que já existir nesse arquivo — não substituir o JSON inteiro.

---

## Parte 3 — Validar antes de testar

Faça uma conversa rápida com o agente, fora do prompt principal, só pra confirmar:

1. **O agente vê o servidor `fips-ds`?**
   Pergunte: "Liste as tools do servidor MCP `fips-ds` que você tem disponível."
   Esperado: 11 tools — `get_version`, `get_governance_rules`, `list_components`, `get_component`, `list_tokens`, `resolve_token`, `list_patterns`, `get_pattern`, `validate_jsx`, `search`, `scaffold_screen`.

2. **`get_version` responde?**
   Peça: "Chame `get_version` no fips-ds e me devolva a saída."
   Esperado: JSON com `mcpVersion`, `dsVersion`, `manifestSchemaVersion`, `manifestGeneratedAt`.

3. **Resources aparecem?**
   Peça: "Liste os resources do fips-ds."
   Esperado: pelo menos 16 estáticos (`dsfips://manifest`, `dsfips://governance`, `dsfips://styles/globals.css`, vários `dsfips://tokens/...` e `dsfips://references/...`) + 4 templates.

Se algum desses falhar, **pare**: o problema é de instalação/registro. Volte para a Parte 1, confira o caminho absoluto, reinicie o host, repita.

---

## Parte 4 — Prompt do teste (copie a partir daqui)

> Você é um desenvolvedor front-end sênior. Vai construir uma **mini-aplicação web** que serve como teste prático do servidor MCP `fips-ds` que você tem conectado. **Restrição absoluta**: todo o visual da aplicação sai do **FIPS Design System**, e a única forma que você tem de saber sobre ele é via as tools, resources e prompts do MCP `fips-ds`. Nada de inventar componentes, nada de hex inline, nada de variantes que você "lembra" — confirme tudo no MCP.
>
> ### O que entregar
>
> Uma aplicação React + Vite + TypeScript que:
>
> - **Inicia direto em `/dashboard`** (a rota `/` redireciona).
> - Tem **dois módulos**:
>   - `/dashboard` — tela operacional com KPIs, cards e tabs.
>   - `/cadastro` — formulário de cliente.
> - Usa **somente** componentes, variantes, tokens e padrões oficiais do FIPS Design System.
>
> ### Stack obrigatória
>
> - React 19, Vite 8+, TypeScript estrito.
> - `react-router-dom` v7.
> - Tailwind CSS v4 via `@tailwindcss/vite`.
> - Fontes: **Saira Expanded** (heading) e **Open Sans** (body), via Google Fonts no `index.html`.
> - Idioma da UI: **português brasileiro**.
>
> ### Workflow obrigatório (siga nesta ordem)
>
> 1. **`get_version`** — confirme que o MCP está vivo e qual `dsVersion` está sendo servida. Anote.
> 2. **`get_governance_rules`** — leia tudo. Memorize a lista de **componentes governados** (className visual neles é proibido), o regex de classes bloqueadas, e as regras non-negotiable.
> 3. **`list_components`** — pegue o catálogo de primitivas oficiais. Use `governed: true` pra ver só as governadas.
> 4. **Resource `dsfips://styles/globals.css`** — leia na íntegra e **copie o conteúdo em `src/index.css`** do seu projeto. Esse CSS define `--color-*`, `--radius-*`, `--shadow-*` que os componentes esperam.
> 5. **Para cada componente que for usar**, pegue o snippet self-contained:
>    - Resource `dsfips://components/<Name>/snippet` retorna um `.tsx` standalone.
>    - Salve em `src/ds/<Name>.tsx`.
>    - Confira a API real chamando `get_component({name})` antes de escrever JSX que consuma.
> 6. **Para o Dashboard**:
>    - Chame `scaffold_screen({ kind: "dashboard", name: "Operações" })`.
>    - O retorno traz um `.tsx` que importa `from "ds-fips"`. **Substitua todos esses imports** pelos arquivos locais que você baixou em `src/ds/`. Ex.: `import { Card } from "../ds/Card"`.
>    - Salve em `src/pages/DashboardPage.tsx`.
>    - Chame `validate_jsx({ code: <conteúdo final> })`. Exija `ok: true`. Se houver violation, corrija e revalide.
> 7. **Para o Cadastro**:
>    - Chame `scaffold_screen({ kind: "form", name: "Cliente", fields: [
>      { label: "Razão social", type: "text", required: true, placeholder: "Empresa LTDA" },
>      { label: "CNPJ", type: "text", required: true, placeholder: "00.000.000/0001-00" },
>      { label: "E-mail", type: "email", required: true },
>      { label: "Telefone", type: "tel", placeholder: "(13) 0000-0000" },
>      { label: "Status", type: "select", options: ["Ativo", "Pendente", "Inativo"] },
>      { label: "Observações", type: "textarea" }
>    ]})`.
>    - Mesma rotina: substituir imports, salvar em `src/pages/CadastroPage.tsx`, `validate_jsx` clean.
> 8. **Sempre que precisar de uma cor concreta** em algum lugar onde só CSS resolve: chame `resolve_token({ semantic, mode: "both" })` e use `var(--color-<x>)` no estilo. **Nunca** escreva hex literal em `style={}` ou em `className` com `bg-[#xxxxxx]`.
> 9. Se surgir uma necessidade visual que **não** existe no DS (variante faltando, token faltando): **pare**, descreva o gap, e proponha promover para variante oficial. Não bypasse a regra de governança.
>
> ### Estrutura mínima esperada
>
> ```
> my-app/
> ├── package.json
> ├── vite.config.ts          # plugins: @vitejs/plugin-react + @tailwindcss/vite
> ├── tsconfig.json           # strict
> ├── index.html              # <link> Saira Expanded + Open Sans, root div
> └── src/
>     ├── main.tsx            # createRoot + <BrowserRouter> + import './index.css'
>     ├── App.tsx             # rotas: "/" → <Navigate to="/dashboard">; "/dashboard"; "/cadastro"
>     ├── index.css           # cópia integral de dsfips://styles/globals.css + @import 'tailwindcss'
>     ├── ds/                 # componentes do DS (cópias dos snippets do MCP)
>     │   ├── Card.tsx
>     │   ├── Button.tsx
>     │   └── ...             # apenas os que você usar
>     └── pages/
>         ├── DashboardPage.tsx
>         └── CadastroPage.tsx
> ```
>
> ### Critérios de aceite
>
> - `npm install && npm run build` passa sem erros nem warnings de tipo.
> - Cada arquivo em `src/pages/` passa em `validate_jsx` com `ok: true`.
> - Nenhum `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, `<TabsList>` ou `<TabsTrigger>` recebe className visual (`bg-*`, `text-*`, `border*`, `rounded*`, `shadow*`, `h*`, `min-h*`, `max-h*`, `p*`, `font*`, `leading*`, `tracking*`, `ring*`, `opacity*`).
> - Cada cor referenciada via CSS var (`var(--color-...)`), nunca por hex literal em `style={}` ou em string de classe arbitrária.
> - Headings em Saira Expanded. Corpo em Open Sans.
> - Toda copy de UI em português brasileiro.
>
> ### O que devolver
>
> 1. **Tree** dos arquivos do projeto.
> 2. **Conteúdo completo de cada arquivo**, em blocos de código com o caminho como header.
> 3. **Lista cronológica das chamadas de tools** que você fez no MCP (nome + parâmetros resumidos).
> 4. **Para cada `.tsx` em `src/pages/`**: a saída textual de `validate_jsx`, mostrando `ok: true`.
> 5. Uma seção **"O que aprendi do FIPS Design System pelo MCP"** — três a cinco bullets com fatos não óbvios que o MCP te ensinou.
>
> Se em algum passo o MCP retornar erro, falha de tool, ou conteúdo claramente incompleto: pare, reporte o problema com a chamada exata que falhou, e aguarde instruções. Não improvise contornando o MCP.

---

## Parte 5 — Auditoria do resultado

Quando o agente terminar, valide manualmente:

1. **Build limpo**: `cd my-app && npm install && npm run build` — sem erros, sem warnings de TypeScript.
2. **Variantes corretas**: `grep -E '<(Button|Input|Select|Textarea|TabsList|TabsTrigger)\b' src/pages/*.tsx` — todas as ocorrências usam variantes que aparecem em `get_component` (ex.: `variant="primary"`, não `variant="save"`).
3. **Sem hex inline**: `grep -nE '#[0-9a-fA-F]{6}' src/pages src/ds | grep -v globals.css` — só pode aparecer dentro de `src/index.css` (que é cópia do globals.css). Nas pages, zero ocorrências.
4. **Smoke runtime**: `npm run dev`, abrir o app, navegar `/` → deve redirecionar pra `/dashboard`. Visual deve respirar institucional FIPS (azul profundo, ouro como destaque, Saira Expanded em títulos).

Se as 4 passarem, o MCP entregou o que prometeu.

---

## Apêndice — Distribuição via npmjs (opcional, só se quiser disponibilidade pública sem git)

A Rota A (git+https) já cobre 100% dos casos onde a máquina-alvo tem acesso ao repo. Se quiser disponibilidade pública sem exigir git auth — qualquer pessoa do mundo, fora da FIPS, instalando — então sim, publicação no npm vira útil.

Necessário:

1. Org `@fips-app` no [npmjs.com](https://www.npmjs.com) (a org no GitHub não basta — npm tem registro próprio). Conta gratuita aceita pacotes públicos.
2. Token `NPM_TOKEN` com permissão de publish no escopo `@fips-app`. Salve como secret no repo `FIPS-APP/mcp-design-system`.
3. Workflow `release.yml` no `mcp-design-system` (não fornecido ainda). Esqueleto:

```yaml
name: release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --workspace @fips-app/eslint-plugin-ds-governance --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
      - run: npm publish --workspace @fips-app/mcp-design-system --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

Tag `v0.1.0` dispara, ambos os pacotes vão pro npm. A partir daí, máquinas externas podem usar `npx -y @fips-app/mcp-design-system` em vez do `git+https`. Rota A continua funcionando — esta é apenas uma alternativa.
