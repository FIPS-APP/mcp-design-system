# Mantendo o MCP em sincronia com o DS-FIPS

Este doc é o playbook de quem atualiza o MCP `@fips-app/mcp-design-system` quando o DS-FIPS publica uma versão nova. Toda vez que o DS ganha uma tag, **execute esse fluxo antes de publicar o MCP**.

## A regra mental

O MCP **não lê o código do DS**. Ele serve duas coisas que moram neste repo:

- `packages/mcp/bundled/`: cópia de arquivos do DS numa tag (CSS, skill, exports, patterns).
- `packages/mcp/manifest/ds-manifest.json`: um JSON **gerado** a partir do `bundled/` por `npm run build:manifest`.

Nada no manifest é escrito à mão. O gerador (`packages/mcp/scripts/build-ds-manifest.ts`, com os extratores em `scripts/ds-manifest.ts`) lê só o `bundled/`, o plugin `packages/eslint-plugin-ds-governance` e o campo `designSystem` do `packages/mcp/package.json`. Mesma entrada, mesma saída: sem relógio, sem rede. É por isso que o CI consegue regerar o arquivo e comparar com o versionado.

## Passo a passo (versão nova do DS)

1. **Regerar o `bundled/` a partir da tag**, sem edição à mão. Os caminhos são os mesmos do DS:

   | Caminho (no DS e no `bundled/`) | Observação |
   |---|---|
   | `exports/` | |
   | `skills/design-system-fips/` | sem `agents/` |
   | `src/docs/pages/patterns/` | |
   | `src/styles/globals.css` e `src/styles/fontes-fips.css` | |
   | `src/fonts/` | |

   Apague esses caminhos do `bundled/` antes (para sumir o que a tag removeu) e extraia a tag por cima. Exemplo, a partir de um clone do DS:

   ```bash
   rm -rf packages/mcp/bundled/{exports,skills,src}
   git -C <clone-do-DS> archive v<X.Y.Z> -- exports skills/design-system-fips src/docs/pages/patterns \
     src/styles/globals.css src/styles/fontes-fips.css src/fonts \
     | tar -x -C packages/mcp/bundled --exclude='skills/design-system-fips/agents'
   ```

2. **Declarar a versão.** O `bundled/` não carrega a versão do DS em lugar nenhum. Em `packages/mcp/package.json`:

   ```json
   "designSystem": { "version": "X.Y.Z", "syncedAt": "AAAA-MM-DD" }
   ```

   `version` é a da tag, sem o `v`. `syncedAt` é o dia em que o `bundled/` foi regerado; vira o `generatedAt` do manifest.

3. **Regerar o manifest.**

   ```bash
   npm install
   npm run build:manifest
   ```

4. **Ler o diff do manifest.** O que entrou, saiu ou mudou tem de bater com o que mudou na tag:

   ```bash
   git diff packages/mcp/manifest/ds-manifest.json
   ```

5. **Typecheck, build e smoke.**

   ```bash
   npm run typecheck && npm run build && npm run smoke
   ```

   Se o smoke reclamar que o `ds-manifest.json` não é o que o `build:manifest` gera, falta o passo 3. Se quebrar outro caso, o manifest mudou de um jeito que a expectativa do teste não previa: atualize o teste (e veja a tabela de versões abaixo).

6. **Um commit só** com `bundled/`, `ds-manifest.json` e `package.json`. O CI regera o manifest e falha se ele diferir do versionado.

## De onde vem cada campo do manifest

Os caminhos abaixo são relativos a `packages/mcp/bundled/`. `components.md`, `foundations.md` e `source-of-truth.md` ficam em `skills/design-system-fips/references/`.

| Campo | Fonte | Como |
|---|---|---|
| `dsVersion` | `designSystem.version` do `package.json` do MCP | Declarada no passo 2. |
| `generatedAt` | `designSystem.syncedAt` | Meia-noite UTC desse dia. Data do `bundled/`, não do relógio. |
| `tokens.cssVars.{theme,root,dark}` | `src/styles/globals.css` | Variáveis `--*` do `@theme`, das regras `:root` e das regras `.dark`, soltas ou dentro de `@layer`. O que está em `@media` ou `@container` só vale sob condição e fica de fora. Se a variável se repete, vale a última. |
| `tokens.semantic.{light,dark}` | as `--color-*` de `:root` e `.dark` do mesmo CSS | `var()` resolvido até o valor final; hex em maiúsculas. A chave é o nome sem `--color-` em camelCase (`--color-primary-hover` vira `primaryHover`), a conversão que a tool `resolve_token` desfaz. No escuro vale `:root` com `.dark` por cima. |
| `tokens.palette` | `foundations.md`, tabelas de "Cores oficiais" | |
| `tokens.spacing` | `foundations.md`, "Escala exportada" | |
| `tokens.typography` | `foundations.md`, "Tipografia" | Famílias e o `typeScale`. |
| `components`, `exports.barrel` | `components.md`, lista do barrel `src/components/ui/index.ts` | `·` separa grupos. Em cada grupo, o primeiro nome é o componente e os nomes PascalCase que começam com o dele são sub-componentes; um PascalCase que não começa (`AdminTablePagination` depois de `AdminTableColumnMenu`) é outro componente. Funções (`buttonVariants`) e constantes ficam só no barrel. |
| `components[].importPath` | `source-of-truth.md`, "Componentes reutilizáveis" | O arquivo `src/components/ui/*.tsx` de mesmo nome. Sem arquivo com esse nome, aponta para `src/components/ui/index.ts`. |
| `components[].variants` | seção `## <Componente>` do `components.md` | Linhas "Variantes exatas" e "Tamanhos exatos". |
| `components[].defaultVariants` | a mesma seção | Só quando a skill traz a chamada de referência `xVariants({ ... })`, e só com valores que estão nas listas. Sem ela, `null`. |
| `components[].governed` | plugin `governance` | O componente está em `governedComponents`. |
| `patterns` | `src/docs/pages/patterns/*.tsx` | `id` é o nome do arquivo sem `Demo`/`Doc`, em kebab-case. `summary` é o `description` literal do primeiro `<DocPage>`, ou `null`. |
| `governance.{plugin,ruleName,governedComponents,blockedClassPrefixPattern}` | `packages/eslint-plugin-ds-governance` | A mesma regra que o `validate_jsx` roda. |
| `governance.nonNegotiables` | `SKILL.md`, "## Non-negotiables" | Os itens da lista, como o DS escreveu. |

### O que o manifest não enxerga

O `bundled/` não tem `src/tokens/*.ts` nem `src/components/ui/*`. Então o manifest só sabe o que o DS escreve nas referências da skill e no CSS:

- Tipos `*Props` e exports que a lista do barrel não cita (hoje `DialogTrigger`, `DialogOverlay`, `DialogPortal` e os equivalentes do `Drawer`) não aparecem.
- `defaultVariants` sai preenchido só para quem tem a chamada de referência na skill (hoje o `Button`).

## Quando o gerador para

O gerador nunca preenche com valor padrão: se não acha o que espera, sai com código 1 e diz onde.

| Mensagem | O que houve | O que fazer |
|---|---|---|
| `package.json do MCP sem o campo "designSystem"` | falta a versão do DS | Passo 2. |
| `bundled/<arquivo> não existe` | `bundled/` incompleto | Passo 1. |
| `components.md: não achei a seção do barrel`, `foundations.md: não achei ...`, `SKILL.md: não achei ...` | o DS reescreveu o trecho de onde o gerador lê | Ajuste o extrator em `scripts/ds-manifest.ts` (funções `build*` e `parseUiBarrel`). Não edite o manifest. |
| `globals.css: ... usa --x, que não está definido` | `var()` para uma variável que não existe | É defeito do CSS do DS. O `bundled/` não se edita: corrija no DS. |
| `O plugin tem N regras` | o plugin ganhou uma regra, e o manifest tem um só `ruleName` | Decida como representar antes de seguir. |

## Quando disparar cada bump

| Mudança | Manifest | Versão do MCP | Ação |
|---|---|---|---|
| Versão nova do DS, mesmo formato | regera | nenhuma | atualizar `designSystem` |
| Renomear ou remover componente do DS | regera | **major** | breaking |
| Regra nova no plugin de governança | regera | minor | atualizar os prompts |
| Campo novo no manifest | subir `SCHEMA_VERSION` (minor) em `scripts/ds-manifest.ts` e ajustar a interface `Manifest` do `loader.ts` | nenhuma | atualizar o smoke |
| Campo removido ou renomeado | subir `SCHEMA_VERSION` (major) | **major** | breaking |
| Tool nova | nenhuma | minor | nenhuma |
| Tool removida | nenhuma | **major** | breaking |

## Onde isso é garantido

- **CI** (`.github/workflows/ci.yml`): o passo "Manifest" roda `npm run build:manifest` e `git diff --exit-code` no `ds-manifest.json`. Manifest editado à mão, ou `bundled/` alterado sem regerar, derruba o PR.
- **Smoke** (`npm run smoke`): confere que o manifest versionado é igual ao que o gerador monta agora, que o `dsVersion` servido é o do `package.json` e que os tokens da versão estão lá.
