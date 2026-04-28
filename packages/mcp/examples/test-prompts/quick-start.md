# Use o Design System FIPS na sua IA — copia, cola, pronto

Cole **tudo abaixo** numa conversa com seu agente (Claude Desktop, Cursor, Continue, Cline ou Claude Code). Ele se vira sozinho — vai te pedir 1 ação manual no meio, depois você re-cola este mesmo prompt e ele termina.

---

## PROMPT (copia daqui pra baixo)

Você é um agente de IA com acesso a ferramentas. Sua missão tem **duas etapas**: (1) garantir que o servidor MCP `fips-ds` está plugado, (2) usá-lo pra construir uma aplicação web de demo. Execute na ordem abaixo.

### Etapa 1 — Verificar se o `fips-ds` está plugado

Tente listar as tools do MCP `fips-ds`. Se você não tem comando direto, chame qualquer tool dele (ex.: `get_version`).

**Cenário A — você consegue listar/chamar `fips-ds` (vê 11 tools: `get_version`, `get_governance_rules`, `list_components`, `get_component`, `list_tokens`, `resolve_token`, `list_patterns`, `get_pattern`, `validate_jsx`, `search`, `scaffold_screen`):**

Pule pra Etapa 2.

**Cenário B — não vê `fips-ds`, ou só vê outras tools:**

Diga ao usuário **exatamente** isto, palavra por palavra:

> Pra eu poder criar com o Design System FIPS, preciso que você cole a configuração abaixo no arquivo de config do seu host MCP. Identifique seu host e siga uma das opções:
>
> - **Claude Desktop (macOS)**: abra `~/Library/Application Support/Claude/claude_desktop_config.json` (cria se não existir)
> - **Claude Desktop (Windows)**: abra `%APPDATA%\Claude\claude_desktop_config.json`
> - **Cursor**: abra `~/.cursor/mcp.json` (global) ou `.cursor/mcp.json` na raiz do projeto
> - **Continue**: abra `~/.continue/config.json`
> - **Cline (VS Code)**: clique no ícone MCP da extensão → "Configure MCP Servers"
> - **Claude Code (CLI)**: rode no terminal `claude mcp add fips-ds -- npx -y git+https://github.com/FIPS-APP/mcp-design-system.git` e pule pro último passo abaixo.
>
> Cole esta entrada (mesclando com o que já tem em `mcpServers`, sem apagar outros servidores):
>
> ```json
> {
>   "mcpServers": {
>     "fips-ds": {
>       "command": "npx",
>       "args": ["-y", "git+https://github.com/FIPS-APP/mcp-design-system.git"]
>     }
>   }
> }
> ```
>
> Pré-requisito na máquina: **Node.js ≥ 20**. Confira com `node -v`. Se for menor ou não tiver, instale em https://nodejs.org/ (LTS) antes.
>
> Salve o arquivo, **feche completamente o seu host** (não basta minimizar — quit/sair) e abra de novo.
>
> Abra uma nova conversa e **cole este mesmo prompt aqui** outra vez. A primeira execução leva ~30s (ele baixa e builda). Depois é instantâneo.

E pare. Não tente prosseguir sem o `fips-ds` plugado.

### Etapa 2 — Construir a aplicação de demo

Restrição absoluta: **todo o visual sai do `fips-ds`**. Nada inventado, nada de hex inline, nada de variantes que você "lembra" de outros sistemas.

#### O que entregar

Aplicação React + Vite + TypeScript que:

- Inicia direto em `/dashboard` (rota `/` redireciona)
- Tem 2 rotas: `/dashboard` (operacional, KPIs + cards + tabs) e `/cadastro` (form de cliente)
- Usa **somente** o que o `fips-ds` retornar

#### Stack obrigatória

- React 19, Vite 8+, TypeScript estrito
- `react-router-dom` v7
- Tailwind CSS v4 via `@tailwindcss/vite`
- Saira Expanded (heading) + Open Sans (body), via Google Fonts em `index.html`
- UI em **português brasileiro**

#### Workflow exato

1. `get_version` no `fips-ds` — anote a `dsVersion`.
2. `get_governance_rules` — leia tudo. Memorize os 6 componentes governados (className visual neles é proibido) e a regex.
3. `list_components` — pegue o catálogo.
4. Leia o resource `dsfips://styles/globals.css` cru. Salve íntegra como `src/index.css`. **Adicione `@import 'tailwindcss';` na primeira linha** do arquivo (o `globals.css` cru não tem essa diretiva — ela é necessária pro Tailwind v4 processar). Importe `src/index.css` em `src/main.tsx`.
5. Para o dashboard: `scaffold_screen({ kind: "dashboard", name: "Operações" })`. **O retorno é um array `files`** com a página + todos os componentes em `src/ds/` que ela importa, todos self-contained (só dependem de `react`). **Salve cada arquivo do array exatamente no `path` que veio**, sem editar imports — eles já apontam pros arquivos certos. A página fica em `src/pages/...Dashboard.tsx`.
6. Para o cadastro: `scaffold_screen({ kind: "form", name: "Cliente", fields: [
   { label: "Razão social", type: "text", required: true, placeholder: "Empresa LTDA" },
   { label: "CNPJ", type: "text", required: true, placeholder: "00.000.000/0001-00" },
   { label: "E-mail", type: "email", required: true },
   { label: "Telefone", type: "tel", placeholder: "(13) 0000-0000" },
   { label: "Status", type: "select", options: ["Ativo", "Pendente", "Inativo"] },
   { label: "Observações", type: "textarea" }
] })`. Mesma regra: salve cada `path` do array `files` literalmente. Componentes em `src/ds/` que já vieram do dashboard podem se repetir — sobrescreva sem medo (são idênticos byte a byte).
7. Para cada `.tsx` em `src/pages/`: rode `validate_jsx({ code: <conteúdo da page> })`. Exija `ok: true`. Se falhar, **pare** — o bug é no `scaffold_screen`, não no seu código. Reporte.
8. Pra qualquer cor concreta em CSS: `resolve_token({ semantic, mode: "both" })` e use `var(--color-<x>)`. **Nunca** hex literal.
9. `App.tsx`: `<Routes>` com `/` redirecionando pra `/dashboard`, `/dashboard` → componente exportado pelo arquivo Dashboard (nome do export é `<Pascal>Dashboard`, ex.: `OperacoesDashboard`), `/cadastro` → `<Pascal>Form` (ex.: `ClienteForm`).
10. **Não** use `dsfips://components/<Name>/snippet` — esses resources são showcases legados com API diferente. O `scaffold_screen` já retorna tudo o que você precisa.

#### Estrutura final

```
fips-demo/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css        # @import 'tailwindcss'; + cópia integral de dsfips://styles/globals.css
    ├── ds/              # vindos do scaffold_screen, salvos verbatim
    │   ├── Card.tsx
    │   ├── Button.tsx
    │   └── ...
    └── pages/
        ├── OperacoesDashboard.tsx   # nome exato vem do scaffold
        └── ClienteForm.tsx
```

#### Critérios de aceite

- `npm install && npm run build` passa zero erros
- `validate_jsx` retorna `ok: true` em **cada** arquivo de `src/pages/`
- Zero `<Button>`/`<Input>`/`<Select>`/`<Textarea>`/`<TabsList>`/`<TabsTrigger>` com className visual (`bg-*`, `text-*`, `border*`, `rounded*`, `shadow*`, `h*`, `p*`, `font*`, `leading*`, `tracking*`, `ring*`, `opacity*`)
- Zero hex literal em `style={}` ou `bg-[#...]` fora do `src/index.css`
- Headings em Saira Expanded, corpo em Open Sans
- Tudo em pt-BR

#### O que devolver

1. **Tree** dos arquivos criados
2. **Conteúdo de cada arquivo**, em blocos com path como header
3. **Lista das chamadas de tools** do `fips-ds` na ordem que você fez
4. **Saída textual de `validate_jsx`** pra cada `.tsx` em `src/pages/` mostrando `ok: true`
5. Uma seção **"O que aprendi do FIPS Design System pelo MCP"** — 3 a 5 bullets com fatos não óbvios (ex.: nome exato de uma variante, regra de governança, comportamento de um pattern)

Se em qualquer ponto o `fips-ds` retornar erro, conteúdo vazio ou inconsistente: **pare**, mostre a chamada exata e a resposta recebida, e aguarde instruções. Não improvise contornando o MCP.

---

(fim do prompt)
