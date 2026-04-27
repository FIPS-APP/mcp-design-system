# Mantendo o MCP em sincronia com o DS-FIPS

Este doc é o playbook de quem trabalha no DS-FIPS e precisa garantir que o MCP `@fips-app/mcp-design-system` continue refletindo fielmente o sistema. Toda vez que o `main` do DS-FIPS recebe commits novos, **execute esse fluxo antes de publicar o MCP** (ou de deixar o MCP exposto a novos agentes de IA).

## A regra mental

O MCP **não lê código TSX**. Ele lê **um JSON** (`dist/manifest/ds-manifest.json`) gerado por `npm run build:manifest`. Tudo o que afeta o MCP, afeta esse JSON. Tudo o que não afeta o JSON, não afeta o MCP.

Isso divide as mudanças do DS em dois caminhos:

### Hot path — afeta o MCP

Mudanças nestes arquivos exigem **regenerar o manifest** + **smoke test** + (em mudança de contrato) **bump do MCP**:

| Arquivo / pasta | O que muda no manifest |
|---|---|
| `src/tokens/colors.ts` | `tokens.palette`, `tokens.semantic.{light,dark}` |
| `src/tokens/typography.ts` | `tokens.typography` |
| `src/tokens/spacing.ts` | `tokens.spacing` |
| `src/styles/globals.css` (`@theme`, `:root`, `.dark`) | `tokens.cssVars.{theme,root,dark}` |
| `src/components/ui/index.ts` | `exports.barrel` |
| `src/components/ui/*.tsx` (novo componente) | `components` (precisa adicionar à lista hardcoded em `scripts/build-ds-manifest.ts`) |
| `src/components/ui/*-variants.ts` | `components[].variants`, `components[].defaultVariants` |
| `src/composites/PageHero.tsx` (API) | (futuro: composites no manifest) |
| `src/docs/pages/patterns/*.tsx` | `patterns` (id, name, file, summary) |
| `eslint.config.js` ou `packages/eslint-plugin-ds-governance/index.js` | `governance.{rule,governedComponents,blockedClassPrefixPattern}` |
| `package.json` `version` | `dsVersion` |

### Cold path — não afeta o MCP

Mudanças nestes arquivos **não exigem nenhuma ação no MCP**:

- `src/docs/pages/{components,foundations}/*` — doc pages que documentam, não definem
- `src/docs/pages/*.tsx` (raiz, exceto patterns) — Stacks, Home, Overview, Login, Governance, Changelog
- `src/app/DocLayout.tsx`, `src/components/{layout,brand,domain}/*` — chrome do site
- `src/data/*`, `src/hooks/*`, `src/lib/*`, `src/routes/nav.ts`
- README, docs, public/*, exports/*
- Qualquer mudança em `dist/` (gerado)

## Playbook após `git pull`

1. **Atualizar o repo**:
   ```bash
   git fetch origin
   git pull --ff-only origin main
   ```

2. **Inspecionar o que mudou em hot path**:
   ```bash
   git diff HEAD@{1}..HEAD --name-only -- \
     src/tokens/ src/styles/globals.css \
     src/components/ui/ src/composites/ \
     src/docs/pages/patterns/ \
     eslint.config.js packages/eslint-plugin-ds-governance/ \
     package.json
   ```
   Se a saída for **vazia**, terminou — só cold path. Pode pular pro deploy.

3. **Regenerar manifest**:
   ```bash
   npm install                          # workspaces resolvem
   npm run build:manifest
   ```

4. **Diff do manifest**:
   ```bash
   git stash; git checkout HEAD@{1} -- dist/manifest/ds-manifest.json 2>/dev/null
   diff <(jq -S 'del(.generatedAt)' dist/manifest/ds-manifest.json.prev 2>/dev/null) \
        <(jq -S 'del(.generatedAt)' dist/manifest/ds-manifest.json)
   git stash pop
   ```
   Ignora `generatedAt` (sempre muda). Se o restante mudou, leia o diff.

5. **Smoke test do MCP**:
   ```bash
   npm --workspace @fips-app/mcp-design-system exec tsx scripts/smoke.ts
   ```
   Os 10 testes ainda devem passar. Se algum quebrar, o manifest mudou de forma incompatível com a expectativa do teste — atualize o teste **e** considere bumpar `manifest.schemaVersion`.

6. **Build do MCP**:
   ```bash
   npm --workspace @fips-app/mcp-design-system run build
   ```

7. **Decidir bumps**:
   - Manifest schema mudou (campo novo, removido, renomeado)? → bumpar `schemaVersion` no `scripts/build-ds-manifest.ts` E no `loader.ts`/`Manifest` interface do MCP.
   - Tools mudaram contrato (input/output shape)? → bumpar `version` no `packages/mcp/package.json` (minor para ampliar, major para breaking).
   - Só dados mudaram (novas variantes, novas cores, etc.)? → nenhum bump necessário, MCP serve automaticamente.

8. **Deploy do site DS-FIPS** (independente do MCP):
   ```bash
   bash scripts/deploy-vps.sh
   ```

## Quando dispara cada bump

| Mudança no DS | Manifest | MCP version | Ação |
|---|---|---|---|
| Variante nova num componente existente | regenera | — | nada |
| Componente novo em `src/components/ui/` | regenera + adicionar à lista `tops` em `build-ds-manifest.ts` | — | atualizar smoke test |
| Token de cor novo / renomeado | regenera | — | nada |
| Pattern novo em `src/docs/pages/patterns/` | regenera | — | nada |
| Renomear/remover componente | regenera | **major bump** | breaking |
| Regra ESLint nova no plugin | regenera | minor bump (nova capability) | atualizar prompts |
| Schema do manifest muda (campo novo) | `schemaVersion` bump | — | nada se for additive |
| Schema do manifest muda (campo removido/renomeado) | `schemaVersion` major bump | major bump | breaking |
| Tool nova no MCP | — | minor bump | — |
| Tool removida | — | major bump | breaking |

## Quando o MCP migrar para o repo `FIPS-APP/mcp-design-system`

Esse playbook continua valendo, com uma diferença: o passo 3 (`npm run build:manifest`) é executado no DS-FIPS, e o MCP consome o manifest via pacote npm `@fips-app/design-system-manifest`. O fluxo vira:

1. DS-FIPS dispara release → publica `@fips-app/design-system-manifest@X.Y.Z`
2. GitHub Action no MCP repo escuta o `repository_dispatch`, atualiza a dep
3. CI roda smoke + build, abre PR
4. Merge automático em patch/minor

Até lá (workspace local), o playbook acima é o suficiente.

## Onde isso é enforçado

Hoje, em revisão humana. Próximo passo: hook de pre-commit no DS-FIPS que detecta mudança em hot path e exige `dist/manifest/ds-manifest.json` regenerado no mesmo commit. Tracking item: MCP V2.
