import { z } from 'zod'

const KINDS = ['form', 'dashboard', 'listing', 'modal-workflow'] as const

const FieldSchema = z.object({
  label: z.string(),
  type: z.enum(['text', 'email', 'tel', 'number', 'select', 'textarea']).default('text'),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional().describe('Used when type="select".'),
})

interface ScaffoldField {
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: string[]
}

function pascal(s: string) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

function fieldName(label: string) {
  const parts = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('')
}

function renderField(f: ScaffoldField): string {
  const id = fieldName(f.label)
  const required = f.required ? ' required' : ''
  const reqStar = f.required ? ' required' : ''
  if (f.type === 'select') {
    const opts = (f.options ?? []).map((o) => `              <option value="${o}">${o}</option>`).join('\n')
    return `        <Field>
          <FieldLabel${reqStar} htmlFor="${id}">${f.label}</FieldLabel>
          <Select id="${id}" name="${id}"${required}>
            <option value="">Selecione…</option>
${opts}
          </Select>
        </Field>`
  }
  if (f.type === 'textarea') {
    return `        <Field>
          <FieldLabel${reqStar} htmlFor="${id}">${f.label}</FieldLabel>
          <Textarea id="${id}" name="${id}" placeholder="${f.placeholder ?? ''}"${required} />
        </Field>`
  }
  return `        <Field>
          <FieldLabel${reqStar} htmlFor="${id}">${f.label}</FieldLabel>
          <Input id="${id}" name="${id}" type="${f.type}" placeholder="${f.placeholder ?? ''}"${required} />
        </Field>`
}

function renderForm(name: string, fields: ScaffoldField[]): string {
  const usedComponents = new Set<string>(['Field', 'FieldLabel', 'Button', 'Card', 'CardHeader', 'CardTitle', 'CardContent', 'CardFooter'])
  for (const f of fields) {
    if (f.type === 'select') usedComponents.add('Select')
    else if (f.type === 'textarea') usedComponents.add('Textarea')
    else usedComponents.add('Input')
  }
  const importLine = `import { ${[...usedComponents].sort().join(', ')} } from 'ds-fips'`
  const body = fields.map(renderField).join('\n\n')
  return `${importLine}

export function ${pascal(name)}Form() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>${name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
${body}
        </form>
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button variant="secondary" type="button">Cancelar</Button>
        <Button variant="primary" type="submit">Salvar</Button>
      </CardFooter>
    </Card>
  )
}
`
}

function renderDashboard(name: string): string {
  return `import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Progress, Tabs, TabsList, TabsTrigger, TabsContent } from 'ds-fips'

const kpis = [
  { label: 'Pedidos abertos', value: '128', delta: '+12%', tone: 'success' as const },
  { label: 'SLA médio', value: '4h 32m', delta: '−18m', tone: 'success' as const },
  { label: 'Em atraso', value: '7', delta: '+2', tone: 'danger' as const },
  { label: 'Concluídos hoje', value: '42', delta: '+5', tone: 'info' as const },
]

export function ${pascal(name)}Dashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-fg)]">${name}</h1>
        <p className="text-[var(--color-fg-muted)]">Visão geral em tempo real.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="font-heading text-3xl">{k.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={k.tone === 'danger' ? 'danger' : k.tone === 'success' ? 'success' : 'info'}>{k.delta}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral">
          <Card>
            <CardHeader>
              <CardTitle>Capacidade operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={68} />
              <p className="text-sm text-[var(--color-fg-muted)]">68% da capacidade utilizada.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="historico">…</TabsContent>
        <TabsContent value="alertas">…</TabsContent>
      </Tabs>
    </div>
  )
}
`
}

function renderListing(name: string): string {
  return `import { useState } from 'react'
import { Card, Input, Select, Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from 'ds-fips'

interface Item { id: string; nome: string; status: 'ativo' | 'pendente' | 'inativo'; cnpj: string }
const data: Item[] = [
  { id: '1', nome: 'Cliente A', status: 'ativo', cnpj: '00.000.000/0001-00' },
  { id: '2', nome: 'Cliente B', status: 'pendente', cnpj: '11.111.111/0001-11' },
]
const statusVariant = { ativo: 'success', pendente: 'warning', inativo: 'danger' } as const

export function ${pascal(name)}Listing() {
  const [selected, setSelected] = useState<Item | null>(null)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">${name}</h1>
      </header>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input placeholder="Buscar por nome ou CNPJ" className="min-w-[280px] flex-1" />
          <Select className="min-w-[180px]">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pendente">Pendente</option>
            <option value="inativo">Inativo</option>
          </Select>
          <Button variant="primary">Adicionar</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nome}</TableCell>
                <TableCell>{item.cnpj}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelected(item)}>Ver</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{selected?.nome}</DialogTitle>
                        <DialogDescription>CNPJ {selected?.cnpj}</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="secondary">Fechar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
`
}

function renderModalWorkflow(name: string): string {
  return `import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, Tabs, TabsList, TabsTrigger, TabsContent, Field, FieldLabel, Input, Textarea, Button } from 'ds-fips'

export function ${pascal(name)}Workflow() {
  const [step, setStep] = useState('dados')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">${name}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>${name}</DialogTitle>
          <DialogDescription>Preencha as etapas para concluir.</DialogDescription>
        </DialogHeader>

        <Tabs value={step} onValueChange={setStep}>
          <TabsList>
            <TabsTrigger value="dados">1. Dados</TabsTrigger>
            <TabsTrigger value="contato">2. Contato</TabsTrigger>
            <TabsTrigger value="confirmar">3. Confirmar</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="space-y-4 pt-4">
            <Field>
              <FieldLabel required htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" name="nome" required />
            </Field>
          </TabsContent>
          <TabsContent value="contato" className="space-y-4 pt-4">
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="obs">Observações</FieldLabel>
              <Textarea id="obs" name="obs" />
            </Field>
          </TabsContent>
          <TabsContent value="confirmar" className="pt-4 text-sm text-[var(--color-fg-muted)]">
            Revise e confirme. Os dados serão enviados ao backend.
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="primary">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
`
}

export const scaffoldScreenTool = {
  name: 'scaffold_screen',
  description:
    'Generates a complete, governance-clean DS-FIPS screen ready to drop into a project. ' +
    'Pick a kind (form, dashboard, listing, modal-workflow); pass an optional `name` and (for forms) a `fields` array. ' +
    'The output uses ONLY official primitives, real variant names and CSS vars — no hex inline, no overrides on governed components. ' +
    'Run validate_jsx on the result before showing to user (optional but recommended).',
  inputSchema: z
    .object({
      kind: z.enum(KINDS).describe('Screen kind.'),
      name: z.string().default('Cadastro').describe('Display name (used in headings and component name).'),
      fields: z.array(FieldSchema).optional().describe('Form fields (only used when kind="form").'),
    })
    .describe('Scaffold input.'),
  async handler({ kind, name, fields }: { kind: (typeof KINDS)[number]; name?: string; fields?: ScaffoldField[] }) {
    const screenName = name ?? 'Cadastro'
    let contents: string
    let path: string
    switch (kind) {
      case 'form': {
        const f = fields ?? [
          { label: 'Razão social', type: 'text' as const, required: true, placeholder: 'Empresa LTDA' },
          { label: 'CNPJ', type: 'text' as const, required: true, placeholder: '00.000.000/0001-00' },
          { label: 'E-mail', type: 'email' as const, required: true },
          { label: 'Status', type: 'select' as const, options: ['Ativo', 'Pendente', 'Inativo'] },
          { label: 'Observações', type: 'textarea' as const },
        ]
        contents = renderForm(screenName, f)
        path = `src/screens/${pascal(screenName)}Form.tsx`
        break
      }
      case 'dashboard':
        contents = renderDashboard(screenName)
        path = `src/screens/${pascal(screenName)}Dashboard.tsx`
        break
      case 'listing':
        contents = renderListing(screenName)
        path = `src/screens/${pascal(screenName)}Listing.tsx`
        break
      case 'modal-workflow':
        contents = renderModalWorkflow(screenName)
        path = `src/screens/${pascal(screenName)}Workflow.tsx`
        break
    }
    return {
      kind,
      files: [{ path, contents }],
      notes: [
        'All components imported from ds-fips. No hex inline, no className overrides on governed primitives.',
        'Tabs/TabsTrigger receive only layout className; visual is handled by the variant.',
        'Run validate_jsx on the contents to confirm before delivering to the user.',
      ],
    }
  },
}
