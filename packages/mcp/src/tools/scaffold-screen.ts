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
  const parts = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
  return parts.join('') || 'Tela'
}

function fieldName(label: string) {
  const parts = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (parts.length === 0) return 'campo'
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('')
}

/* ──────────────────────────────────────────────────────────
   Self-contained component templates.
   Each returns the full .tsx content for src/ds/<Name>.tsx.
   No external deps beyond `react`. Style via CSS vars defined
   in src/index.css (which the agent copies from
   dsfips://styles/globals.css).
   ────────────────────────────────────────────────────────── */

const TPL_CARD = `import { type HTMLAttributes, type ReactNode } from 'react'

type DivProps = HTMLAttributes<HTMLDivElement>

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ')
}

export function Card({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <div {...rest} className={cn('flex flex-col gap-1.5 p-6', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <h3
      {...rest}
      className={cn(
        'font-heading text-lg font-semibold tracking-tight text-[var(--color-fg)]',
        className,
      )}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <p {...rest} className={cn('text-sm text-[var(--color-fg-muted)]', className)}>
      {children}
    </p>
  )
}

export function CardContent({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <div {...rest} className={cn('p-6 pt-0', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...rest }: DivProps & { children?: ReactNode }) {
  return (
    <div {...rest} className={cn('flex items-center gap-3 p-6 pt-0', className)}>
      {children}
    </div>
  )
}
`

const TPL_BUTTON = `import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'accent'
  | 'inverseOutline'
  | 'success'
  | 'ouro'
  | 'danger'
  | 'link'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'iconSm'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--color-secondary)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-secondary-hover)]',
  secondary:
    'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-soft)]',
  outline:
    'border border-[var(--color-primary)]/30 bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10',
  ghost: 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10',
  accent:
    'bg-[var(--color-accent-strong)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-warning)]/90',
  inverseOutline:
    'border border-white/60 bg-white/[0.06] text-white hover:bg-white/[0.12]',
  success:
    'bg-[var(--color-success)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-success-strong)]',
  ouro:
    'bg-[var(--color-accent)] text-[var(--color-primary-hover)] shadow-[var(--shadow-card)] hover:bg-[var(--color-accent-strong)]',
  danger:
    'bg-[var(--color-danger)] text-white shadow-[var(--shadow-card)] hover:opacity-90',
  link: 'text-[var(--color-primary)] underline-offset-4 hover:underline',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0',
  iconSm: 'h-8 w-8 p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
`

const TPL_BADGE = `import { type HTMLAttributes, type ReactNode } from 'react'

type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'info'

const map: Record<Variant, string> = {
  default: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  secondary: 'bg-[var(--color-surface-soft)] text-[var(--color-fg-muted)]',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success-strong)]',
  warning: 'bg-[var(--color-badge-warning-bg)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-badge-danger-bg)] text-[var(--color-danger)]',
  outline:
    'border border-[var(--color-border)] bg-transparent text-[var(--color-fg-muted)]',
  info: 'bg-[var(--color-info)]/15 text-[var(--color-primary)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  children?: ReactNode
}

export function Badge({ variant = 'default', className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={[
        'inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold',
        map[variant],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
`

const TPL_PROGRESS = `import { type HTMLAttributes } from 'react'

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

export function Progress({ value = 0, max = 100, className, ...rest }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={['h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-soft)]', className ?? ''].filter(Boolean).join(' ')}
    >
      <div
        className="h-full rounded-full bg-[var(--color-secondary)] transition-[width]"
        style={{ width: pct + '%' }}
      />
    </div>
  )
}
`

const TPL_FIELD = `import { type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react'

type Density = 'default' | 'compact'

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  density?: Density
  children?: ReactNode
}

export function Field({ className, children, ...rest }: FieldProps) {
  return (
    <div {...rest} className={['flex flex-col gap-1.5', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  children?: ReactNode
}

export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      {...rest}
      className={[
        'text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {required ? <span className="ml-0.5 text-[var(--color-danger)]">*</span> : null}
    </label>
  )
}

export function FieldHint({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} className={['text-xs text-[var(--color-fg-muted)]', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </p>
  )
}

type Tone = 'danger' | 'warning' | 'info' | 'success'

const toneClasses: Record<Tone, string> = {
  danger: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-primary)]',
  success: 'text-[var(--color-success-strong)]',
}

export interface FieldMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: Tone
  children?: ReactNode
}

export function FieldMessage({ tone = 'danger', className, children, ...rest }: FieldMessageProps) {
  return (
    <p {...rest} className={['text-xs font-medium', toneClasses[tone], className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </p>
  )
}
`

const TPL_INPUT = `import { type InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  density?: 'default' | 'compact'
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { density = 'default', error, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      className={[
        'w-full rounded-xl border bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-fg)] outline-none',
        'transition-shadow placeholder:text-[var(--color-fg-muted)]',
        'focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]/25',
        density === 'compact' ? 'h-9' : 'h-12',
        error
          ? 'border-[var(--color-danger)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        'disabled:opacity-60 disabled:pointer-events-none',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
})
`

const TPL_SELECT = `import { type SelectHTMLAttributes, forwardRef, type ReactNode } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  density?: 'default' | 'compact'
  error?: boolean
  children?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { density = 'default', error, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      {...rest}
      className={[
        'w-full rounded-xl border bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-fg)] outline-none',
        'transition-shadow appearance-none pr-9',
        'focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]/25',
        density === 'compact' ? 'h-9' : 'h-12',
        error
          ? 'border-[var(--color-danger)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        'disabled:opacity-60 disabled:pointer-events-none',
        'bg-no-repeat bg-[length:14px] bg-[position:right_14px_center]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundImage:
          "url(\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 16 16'%3E%3Cpath d='M3 6l5 5 5-5' stroke='%236b7784' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\\")",
      }}
    >
      {children}
    </select>
  )
})
`

const TPL_TEXTAREA = `import { type TextareaHTMLAttributes, forwardRef } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  density?: 'default' | 'compact'
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { density = 'default', error, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={[
        'w-full rounded-xl border bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-fg)] outline-none',
        'transition-shadow placeholder:text-[var(--color-fg-muted)]',
        'focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]/25',
        density === 'compact' ? 'min-h-[92px]' : 'min-h-[132px]',
        error
          ? 'border-[var(--color-danger)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        'disabled:opacity-60 disabled:pointer-events-none resize-y',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
})
`

const TPL_TABS = `import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

type TabsCtx = { value: string; setValue: (v: string) => void }
const Ctx = createContext<TabsCtx | null>(null)

function useTabs() {
  const c = useContext(Ctx)
  if (!c) throw new Error('Tabs subcomponents must be used inside <Tabs>')
  return c
}

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  className?: string
  children?: ReactNode
}

export function Tabs({ defaultValue = '', value, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue)
  const current = value ?? internal
  const setValue = (v: string) => {
    if (value === undefined) setInternal(v)
    onValueChange?.(v)
  }
  return (
    <Ctx.Provider value={{ value: current, setValue }}>
      <div className={['flex flex-col gap-3', className ?? ''].filter(Boolean).join(' ')}>{children}</div>
    </Ctx.Provider>
  )
}

export function TabsList({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      {...rest}
      className={[
        'inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children?: ReactNode
}

export function TabsTrigger({ value, className, children, ...rest }: TabsTriggerProps) {
  const ctx = useTabs()
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? 'active' : 'inactive'}
      onClick={() => ctx.setValue(value)}
      {...rest}
      className={[
        'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-[var(--color-secondary)] text-white'
          : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children?: ReactNode
}

export function TabsContent({ value, className, children, ...rest }: TabsContentProps) {
  const ctx = useTabs()
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" {...rest} className={['pt-2', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
`

const TPL_TABLE = `import { type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table {...rest} className={['w-full caption-bottom text-sm text-[var(--color-fg)]', className ?? ''].filter(Boolean).join(' ')}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead {...rest} className={['border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </thead>
  )
}

export function TableBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody {...rest} className={['', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </tbody>
  )
}

export function TableRow({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...rest} className={['border-b border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]/60 transition-colors', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </tr>
  )
}

export function TableHead({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...rest} className={['h-11 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </th>
  )
}

export function TableCell({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td {...rest} className={['px-4 py-3 align-middle', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </td>
  )
}

export function TableEmpty({ children, colSpan = 1 }: { children?: ReactNode; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]">
        {children}
      </td>
    </tr>
  )
}
`

const TPL_DIALOG = `import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'

type DialogCtx = { open: boolean; setOpen: (o: boolean) => void; ref: React.RefObject<HTMLDialogElement | null> }
const Ctx = createContext<DialogCtx | null>(null)

function useDialog() {
  const c = useContext(Ctx)
  if (!c) throw new Error('Dialog subcomponents must be used inside <Dialog>')
  return c
}

export interface DialogProps {
  open?: boolean
  onOpenChange?: (o: boolean) => void
  children?: ReactNode
}

export function Dialog({ open: controlled, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = useState(false)
  const ref = useRef<HTMLDialogElement | null>(null)
  const open = controlled ?? internal
  const setOpen = (o: boolean) => {
    if (controlled === undefined) setInternal(o)
    onOpenChange?.(o)
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return <Ctx.Provider value={{ open, setOpen, ref }}>{children}</Ctx.Provider>
}

export interface DialogTriggerProps {
  asChild?: boolean
  children: ReactElement<{ onClick?: (e: unknown) => void }>
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const ctx = useDialog()
  if (asChild && isValidElement(children)) {
    const original = children.props.onClick
    return cloneElement(children, {
      onClick: (e: unknown) => {
        original?.(e)
        ctx.setOpen(true)
      },
    })
  }
  return (
    <button type="button" onClick={() => ctx.setOpen(true)}>
      {children}
    </button>
  )
}

export interface DialogContentProps extends HTMLAttributes<HTMLDialogElement> {
  children?: ReactNode
}

export function DialogContent({ className, children, ...rest }: DialogContentProps) {
  const ctx = useDialog()
  return (
    <dialog
      ref={ctx.ref}
      onClose={() => ctx.setOpen(false)}
      onClick={(e) => {
        if (e.target === ctx.ref.current) ctx.setOpen(false)
      }}
      {...rest}
      className={[
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-fg)] shadow-[var(--shadow-elevated)]',
        'backdrop:bg-[var(--color-fg)]/40 backdrop:backdrop-blur-sm',
        'w-full max-w-lg',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-4 p-6">{children}</div>
    </dialog>
  )
}

export function DialogHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={['flex flex-col gap-1', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export function DialogTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 {...rest} className={['font-heading text-lg font-semibold tracking-tight text-[var(--color-fg)]', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} className={['text-sm text-[var(--color-fg-muted)]', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </p>
  )
}

export function DialogFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={['flex justify-end gap-3 pt-2', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export interface DialogCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  children?: ReactNode
}

export function DialogClose({ asChild, children, onClick, ...rest }: DialogCloseProps) {
  const ctx = useDialog()
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onClick?: (e: unknown) => void }>, {
      onClick: (e: unknown) => {
        ;(children as ReactElement<{ onClick?: (e: unknown) => void }>).props.onClick?.(e)
        ctx.setOpen(false)
      },
    })
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e)
        ctx.setOpen(false)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
`

const COMPONENT_TEMPLATES: Record<string, string> = {
  Card: TPL_CARD,
  Button: TPL_BUTTON,
  Badge: TPL_BADGE,
  Progress: TPL_PROGRESS,
  Field: TPL_FIELD,
  Input: TPL_INPUT,
  Select: TPL_SELECT,
  Textarea: TPL_TEXTAREA,
  Tabs: TPL_TABS,
  Table: TPL_TABLE,
  Dialog: TPL_DIALOG,
}

/* ──────────────────────────────────────────────────────────
   Page renderers — return content + which DS files to bundle.
   ────────────────────────────────────────────────────────── */

interface RenderedPage {
  contents: string
  components: string[]
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

function renderForm(name: string, fields: ScaffoldField[]): RenderedPage {
  const components = ['Card', 'Field', 'Button']
  for (const f of fields) {
    if (f.type === 'select' && !components.includes('Select')) components.push('Select')
    else if (f.type === 'textarea' && !components.includes('Textarea')) components.push('Textarea')
    else if (!['select', 'textarea'].includes(f.type) && !components.includes('Input')) components.push('Input')
  }
  const importLines: string[] = [
    "import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ds/Card'",
    "import { Field, FieldLabel } from '../ds/Field'",
    "import { Button } from '../ds/Button'",
  ]
  if (components.includes('Input')) importLines.push("import { Input } from '../ds/Input'")
  if (components.includes('Select')) importLines.push("import { Select } from '../ds/Select'")
  if (components.includes('Textarea')) importLines.push("import { Textarea } from '../ds/Textarea'")
  const body = fields.map(renderField).join('\n\n')
  const contents = `${importLines.join('\n')}

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
  return { contents, components }
}

function renderDashboard(name: string): RenderedPage {
  const contents = `import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ds/Card'
import { Badge } from '../ds/Badge'
import { Progress } from '../ds/Progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ds/Tabs'

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
        <TabsContent value="historico">
          <Card><CardContent>Sem dados.</CardContent></Card>
        </TabsContent>
        <TabsContent value="alertas">
          <Card><CardContent>Sem alertas.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
`
  return { contents, components: ['Card', 'Badge', 'Progress', 'Tabs'] }
}

function renderListing(name: string): RenderedPage {
  const contents = `import { useState } from 'react'
import { Card } from '../ds/Card'
import { Input } from '../ds/Input'
import { Select } from '../ds/Select'
import { Button } from '../ds/Button'
import { Badge } from '../ds/Badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ds/Table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '../ds/Dialog'

interface Item { id: string; nome: string; status: 'ativo' | 'pendente' | 'inativo'; cnpj: string }
const data: Item[] = [
  { id: '1', nome: 'Cliente A', status: 'ativo', cnpj: '00.000.000/0001-00' },
  { id: '2', nome: 'Cliente B', status: 'pendente', cnpj: '11.111.111/0001-11' },
]
const statusVariant: Record<Item['status'], 'success' | 'warning' | 'danger'> = {
  ativo: 'success',
  pendente: 'warning',
  inativo: 'danger',
}

export function ${pascal(name)}Listing() {
  const [selected, setSelected] = useState<Item | null>(null)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-fg)]">${name}</h1>
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
                        <DialogClose asChild>
                          <Button variant="secondary">Fechar</Button>
                        </DialogClose>
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
  return {
    contents,
    components: ['Card', 'Input', 'Select', 'Button', 'Badge', 'Table', 'Dialog'],
  }
}

function renderModalWorkflow(name: string): RenderedPage {
  const contents = `import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '../ds/Dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ds/Tabs'
import { Field, FieldLabel } from '../ds/Field'
import { Input } from '../ds/Input'
import { Textarea } from '../ds/Textarea'
import { Button } from '../ds/Button'

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
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="primary">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
`
  return {
    contents,
    components: ['Dialog', 'Tabs', 'Field', 'Input', 'Textarea', 'Button'],
  }
}

/* ──────────────────────────────────────────────────────────
   Tool
   ────────────────────────────────────────────────────────── */

export const scaffoldScreenTool = {
  name: 'scaffold_screen',
  description:
    'Generates a complete, governance-clean DS-FIPS screen as a SELF-CONTAINED bundle of files: the page itself plus every component the page imports under src/ds/. ' +
    "All generated components match the real DS-FIPS API (Card with CardHeader/CardTitle/CardContent/CardFooter; Tabs with TabsList/TabsTrigger/TabsContent; Button variants 'primary'|'secondary'|'outline'|'ghost'|'accent'|'inverseOutline'|'success'|'ouro'|'danger'|'link'; Badge variants 'success'|'warning'|'danger'|'info'|...). " +
    'No external dependency on a published `ds-fips` package and no dependency on the `dsfips://components/{name}/snippet` resources (which are legacy showcases). The agent saves all returned files verbatim — they compile with React 19 + Tailwind v4 + the globals.css you got from `dsfips://styles/globals.css`. ' +
    'After saving, run validate_jsx on the page contents — it MUST return ok:true.',
  inputSchema: z
    .object({
      kind: z.enum(KINDS).describe('Screen kind.'),
      name: z.string().default('Cadastro').describe('Display name (used in headings and component name).'),
      fields: z.array(FieldSchema).optional().describe('Form fields (only used when kind="form").'),
    })
    .describe('Scaffold input.'),
  async handler({
    kind,
    name,
    fields,
  }: {
    kind: (typeof KINDS)[number]
    name?: string
    fields?: ScaffoldField[]
  }) {
    const screenName = name ?? 'Cadastro'
    let rendered: RenderedPage
    let pagePath: string
    switch (kind) {
      case 'form': {
        const f = fields ?? [
          { label: 'Razão social', type: 'text' as const, required: true, placeholder: 'Empresa LTDA' },
          { label: 'CNPJ', type: 'text' as const, required: true, placeholder: '00.000.000/0001-00' },
          { label: 'E-mail', type: 'email' as const, required: true },
          { label: 'Status', type: 'select' as const, options: ['Ativo', 'Pendente', 'Inativo'] },
          { label: 'Observações', type: 'textarea' as const },
        ]
        rendered = renderForm(screenName, f)
        pagePath = `src/pages/${pascal(screenName)}Form.tsx`
        break
      }
      case 'dashboard':
        rendered = renderDashboard(screenName)
        pagePath = `src/pages/${pascal(screenName)}Dashboard.tsx`
        break
      case 'listing':
        rendered = renderListing(screenName)
        pagePath = `src/pages/${pascal(screenName)}Listing.tsx`
        break
      case 'modal-workflow':
        rendered = renderModalWorkflow(screenName)
        pagePath = `src/pages/${pascal(screenName)}Workflow.tsx`
        break
    }

    const componentFiles = rendered.components
      .filter((c) => COMPONENT_TEMPLATES[c])
      .map((c) => ({ path: `src/ds/${c}.tsx`, contents: COMPONENT_TEMPLATES[c] }))

    return {
      kind,
      files: [{ path: pagePath, contents: rendered.contents }, ...componentFiles],
      notes: [
        'Each generated component is self-contained: imports from "react" only. Style via CSS vars (`var(--color-*)`) which you must have in src/index.css from `dsfips://styles/globals.css`.',
        'Do NOT touch `dsfips://components/{name}/snippet` for these files — those are legacy showcases with a different API. Save the bundle below verbatim.',
        'Run validate_jsx on the page contents (the first file) — it MUST return ok:true. If a violation appears, the bug is in the scaffold, not in your code: report back.',
      ],
    }
  },
}
