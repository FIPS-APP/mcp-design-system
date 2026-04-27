# @fips-app/eslint-plugin-ds-governance

ESLint plugin que aplica as regras de governança do Design System FIPS.

Hoje expõe **uma regra**: `governance/no-visual-overrides`. Ela bloqueia tokens visuais (`bg-*`, `text-*`, `border*`, `rounded*`, `shadow*`, `h*`, `p*`, `font*`, `leading*`, `tracking*`, `ring*`, `opacity*`) passados via `className` para as primitivas governadas do DS-FIPS:

- `Button`
- `Input`
- `Select`
- `Textarea`
- `TabsList`
- `TabsTrigger`

O objetivo é **forçar a promoção** de necessidades visuais para variantes oficiais (via `class-variance-authority`) ao invés de cada call site reescrever a aparência de uma primitiva governada.

## Uso (ESLint flat config)

```js
import dsGovernance from '@fips-app/eslint-plugin-ds-governance'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { governance: dsGovernance },
    rules: {
      'governance/no-visual-overrides': 'error',
    },
  },
]
```

Recomenda-se ignorar `src/components/ui/**` (onde as primitivas vivem) — esses arquivos precisam manipular tokens visuais.

## Instalação

```bash
npm install --save-dev @fips-app/eslint-plugin-ds-governance
```

Requer **ESLint ≥ 9** (flat config).

## Por que essa regra existe

Sem governança, a próxima IA ou desenvolvedor que precise de um botão ligeiramente diferente vai escrever `<Button className="bg-red-500 h-7 rounded-full">` e o sistema desmancha em poucos meses. A regra força a discussão: a necessidade vira uma variante oficial (e fica disponível para todos), ou a composição é feita fora da primitiva.

## Mensagem da regra

> Evite override visual direto em `Button` com `bg-red-500`. Promova a necessidade para uma variante ou composição oficial do DS-FIPS e deixe className apenas para layout externo.

## Outras consumidoras

Esse plugin também é usado pelo servidor MCP `@fips-app/mcp-design-system` na tool `validate_jsx`, garantindo que qualquer IA que valide código contra o DS use exatamente a mesma regra que o repo enforça em CI.

## Licença

MIT
