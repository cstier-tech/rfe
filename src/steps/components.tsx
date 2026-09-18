import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon, GripVerticalIcon, PencilIcon } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@/components/ui/collapsible'
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    useFormContext,
    useFieldArray,
    useWatch,
    type FieldArrayWithId,
} from 'react-hook-form'
import type { FormValues, QtyTier } from '@/lib/form'
import { Textarea } from '@/components/ui/textarea'

// Displayed (and editable via the popover) when kitting isn't required: the
// component's effective qty per overview quantity tier, pipe-delimited. Each
// tier can be individually overridden; an un-overridden tier tracks the
// overview quantity automatically.
function ComponentQtyDisplay({
    index,
    tiers,
}: {
    index: number
    tiers: QtyTier[]
}) {
    const { control, setValue } = useFormContext<FormValues>()
    const overrides = useWatch({
        control,
        name: `components.${index}.qtyOverrides`,
    })
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState<string[]>([])

    const effective = tiers.map((tier, i) => overrides?.[i] ?? tier?.qty ?? null)
    const displayText =
        effective.length > 0
            ? effective.map((v) => (v ?? '—')).join(' | ')
            : '—'

    const handleOpenChange = (next: boolean) => {
        if (next) {
            setDraft(effective.map((v) => (v != null ? String(v) : '')))
        }
        setOpen(next)
    }

    const handleSave = () => {
        setValue(
            `components.${index}.qtyOverrides`,
            draft.map((v) => {
                const n = Number(v)
                return v.trim() !== '' && !Number.isNaN(n) ? n : null
            }),
            { shouldDirty: true },
        )
        setOpen(false)
    }

    return (
        <div className="flex items-center gap-1.5">
            <span className="text-sm">{displayText}</span>
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Override quantity"
                    >
                        <PencilIcon />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                    <PopoverHeader>
                        <PopoverTitle>Override Quantity</PopoverTitle>
                    </PopoverHeader>
                    <div className="flex flex-col gap-2">
                        {tiers.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No quantities entered on the overview step yet.
                            </p>
                        )}
                        {tiers.map((_, i) => (
                            <Input
                                key={i}
                                type="number"
                                aria-label={`Override quantity ${i + 1}`}
                                value={draft[i] ?? ''}
                                onChange={(e) => {
                                    const value = e.target.value
                                    setDraft((prev) => {
                                        const next = [...prev]
                                        next[i] = value
                                        return next
                                    })
                                }}
                            />
                        ))}
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSave}
                        disabled={tiers.length === 0}
                    >
                        Save
                    </Button>
                </PopoverContent>
            </Popover>
        </div>
    )
}

const SOURCE_OPTIONS = [
    'LCP Production',
    'Customer Supplied',
    'Veracore Inventory',
] as const

const SOURCE_RADIO_OPTIONS = SOURCE_OPTIONS.map((option) => ({
    label: option,
    value: option,
}))

const TYPE_OPTIONS = [
    { label: 'Printed', value: 'Printed' },
    { label: 'Promo', value: 'Promo' },
    { label: 'Apparel', value: 'Apparel' },
    { label: 'Product Sample', value: 'Product Sample' },
    { label: 'Other', value: 'Other' },
]

function CardShell({
    collapsible,
    dragEnabled,
    isOpen,
    onOpenChange,
    header,
    children,
    index,
    field,
}: {
    collapsible: boolean
    field: FieldArrayWithId<FormValues, 'components', 'id'>
    index: number
    dragEnabled: boolean
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    header: (handleRef: (el: HTMLElement | null) => void) => React.ReactNode
    children: React.ReactNode
}) {

    // const displayName = watchedComponent?.name?.trim() || `Component ${index + 1}`
    const { ref, handleRef, isDragging } = useSortable({
        id: field.id,
        index,
        disabled: !dragEnabled,
    })
    if (collapsible) {
        return (
            <Collapsible
                ref={ref}
                open={isOpen}
                onOpenChange={onOpenChange}
                className={`rounded-lg border border-border bg-gray-50 ${isDragging ? 'opacity-50' : ''
                    }`}
            >
                <div className="flex items-center justify-between gap-2 p-3">
                    {header(handleRef)}
                </div>
                <CollapsibleContent className="flex flex-col gap-2 p-3 pt-0">
                    {children}
                </CollapsibleContent>
            </Collapsible>
        )
    }
    return (
        <div
            ref={ref}
            className={`rounded-lg border border-border bg-gray-50 ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center justify-between gap-2 p-3">
                {header(handleRef)}
            </div>
            <div className="flex flex-col gap-2 p-3 pt-0">
                {children}
            </div>
        </div>
    )
}

function ComponentCard({
    field,
    index,
    dragEnabled,
    isOpen,
    onOpenChange,
    remove,
}: {
    field: FieldArrayWithId<FormValues, 'components', 'id'>
    index: number
    dragEnabled: boolean
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    remove: (index: number) => void

}) {
    const {
        register,
        control,
        setValue,
        formState: { errors },
    } = useFormContext<FormValues>()

    // const { ref, handleRef, isDragging } = useSortable({
    //     id: field.id,
    //     index,
    //     disabled: !dragEnabled,
    // })

    const watchedComponent = useWatch({ control, name: `components.${index}` })
    const kittingRequired = useWatch({ control, name: 'kittingRequired' })
    const qtyLabel = kittingRequired === 'Yes' ? 'Qty per kit *' : 'Qty *'
    const overviewQtyTiers = useWatch({ control, name: 'qty' }) ?? []

    const fieldErrors = errors.components?.[index]
    const hasErrors = !!fieldErrors && Object.keys(fieldErrors).length > 0
    const displayName = watchedComponent?.name?.trim() || `Component ${index + 1}`
    const collapsible = kittingRequired === 'Yes'


    return (
        <CardShell
        dragEnabled={dragEnabled}
            field={field}
            index={index}
            collapsible={collapsible}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            header={(handleRef) => collapsible
                ? (<>
                    <CollapsibleTrigger
                        className={`flex flex-1 items-center gap-2 text-left text-sm font-medium [&[data-state=open]>svg]:rotate-90 ${hasErrors ? 'text-destructive' : ''
                            }`}
                    >
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform" />
                        <span className="truncate">{displayName}</span>
                    </CollapsibleTrigger>
                    {/* Always mounted (even when disabled) so dnd-kit attaches its
                    drag-activator role/ARIA attributes to this handle from
                    the start, rather than briefly to the whole card and
                    leaving them stranded there once a handle appears. */}
                    <Button
                        ref={handleRef}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={`cursor-grab touch-none active:cursor-grabbing ${dragEnabled ? '' : 'invisible'
                            }`}
                        tabIndex={dragEnabled ? 0 : -1}
                        aria-hidden={!dragEnabled}
                        aria-label="Drag to reorder"
                    >
                        <GripVerticalIcon />
                    </Button>
                </>)
                : ''
            }
        >
            {<>
                <input
                    type="hidden"
                    {...register(`components.${index}.id`)}
                />
                <div className='flex gap-4'>
                    <Field>
                        <FieldLabel htmlFor={`components.${index}.name`}>
                            Name *
                        </FieldLabel>
                        <Input
                            id={`components.${index}.name`}
                            {...register(`components.${index}.name`, {
                                required: 'Name is required',
                            })}
                        />
                        <FieldError errors={[fieldErrors?.name]} />
                    </Field>
                    {kittingRequired === 'Yes' ? (
                        <Field>
                            <FieldLabel htmlFor={`components.${index}.qty`}>
                                {qtyLabel}
                            </FieldLabel>
                            <Input
                                id={`components.${index}.qty`}
                                type="number"
                                {...register(`components.${index}.qty`, {
                                    required: 'Qty is required',
                                    valueAsNumber: true,
                                    min: { value: 1, message: 'Qty must be positive' },
                                })}
                            />
                            <FieldError errors={[fieldErrors?.qty]} />
                        </Field>
                    ) : (
                        <Field>
                            <FieldLabel>{qtyLabel}</FieldLabel>
                            <ComponentQtyDisplay
                                index={index}
                                tiers={overviewQtyTiers}
                            />
                        </Field>
                    )}
                </div>

                <RadioButtonGroup
                    control={control}
                    name={`components.${index}.type`}
                    legend="Component Type *"
                    options={TYPE_OPTIONS}
                    rules={{ required: 'Type is required' }}
                    onValueChange={(value) => {
                        if (value !== 'Other') {
                            setValue(
                                `components.${index}.otherType`,
                                '',
                            )
                        }
                    }}
                />

                {(watchedComponent?.type === 'Other') &&

                    <Field className='max-w-64'>
                        <FieldLabel
                            htmlFor={`components.${index}.otherType`}
                        >
                            Specify Other *
                        </FieldLabel>
                        <Input
                            id={`components.${index}.otherType`}
                            {...register(
                                `components.${index}.otherType`, { required: 'Other type is required.' }
                            )}
                        />
                        <FieldError errors={[fieldErrors?.otherType]} />
                    </Field>
                }

                {watchedComponent?.type === "Printed" &&
                    <>
                        <div className='flex gap-4'>
                            <Field>
                                <FieldLabel htmlFor={`components.${index}.finalSize`}>
                                    Finished Size
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.finalSize`}
                                    {...register(`components.${index}.finalSize`)}
                                />
                                <FieldError errors={[fieldErrors?.finalSize]} />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor={`components.${index}.flatSize`}>
                                    Flat Size
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.flatSize`}
                                    {...register(`components.${index}.flatSize`)}
                                />
                                <FieldError errors={[fieldErrors?.flatSize]} />
                            </Field>
                        </div>

                        <div className='flex gap-4'>
                            <Field>
                                <FieldLabel htmlFor={`components.${index}.stock`}>
                                    Stock
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.stock`}
                                    {...register(`components.${index}.stock`)}
                                />
                                <FieldError errors={[fieldErrors?.stock]} />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor={`components.${index}.coating`}>
                                    Coating
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.coating`}
                                    {...register(`components.${index}.coating`)}
                                />
                                <FieldError errors={[fieldErrors?.coating]} />
                            </Field>
                        </div>
                    </>
                }



                <RadioButtonGroup
                    control={control}
                    name={`components.${index}.source`}
                    legend="Source *"
                    options={SOURCE_RADIO_OPTIONS}
                    rules={{ required: 'Source is required' }}
                    onValueChange={(value) => {
                        if (value !== 'LCP Production') {
                            setValue(
                                `components.${index}.sourceJobNumber`,
                                '',
                            )
                        }
                    }}
                />

                {watchedComponent?.source === 'LCP Production' && (
                    <Field className='max-w-64'>
                        <FieldLabel
                            htmlFor={`components.${index}.sourceJobNumber`}
                        >
                            Job Number *
                        </FieldLabel>
                        <Input
                            id={`components.${index}.sourceJobNumber`}
                            {...register(
                                `components.${index}.sourceJobNumber`, { required: 'Job number is required for LCP Production components.' }
                            )}
                        />
                        <FieldError errors={[fieldErrors?.sourceJobNumber]} />
                    </Field>
                )}

                <Field className=''>
                    <FieldLabel
                        htmlFor={`components.${index}.instruction`}
                    >
                        Instructions
                    </FieldLabel>

                    <Textarea
                        id={`components.${index}.instruction`}
                        {...register(
                            `components.${index}.instruction`,
                        )}
                    />
                    <FieldError errors={[fieldErrors?.instruction]} />
                </Field>

                {kittingRequired === 'Yes' &&
                    <div className="flex justify-end pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                        >
                            Remove
                        </Button>
                    </div>
                }
            </>}
        </CardShell>
    )
}

function Components() {
    const { control } = useFormContext<FormValues>()

    const { fields, append, remove, move } = useFieldArray({
        control,
        name: 'components',
    })

    // Which card is expanded. Only one at a time; null means all collapsed.
    const [openKey, setOpenKey] = useState<string | null>(
        () => fields[0]?.id ?? null,
    )

    // When a card is added, open it (and collapse the others).
    const prevLen = useRef(fields.length)
    useEffect(() => {
        if (fields.length > prevLen.current) {
            setOpenKey(fields[fields.length - 1]?.id ?? null)
        }
        prevLen.current = fields.length
    }, [fields])

    const dragEnabled = fields.length > 1

    const kittingRequired = useWatch({ control, name: 'kittingRequired' })

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No components yet.</p>
            )}

            <DragDropProvider
                onDragEnd={(event) => {
                    if (event.canceled) return
                    const { source, target } = event.operation
                    if (!source || !target) return
                    const sourceIndex = fields.findIndex(
                        (f) => f.id === source.id,
                    )
                    const targetIndex = fields.findIndex(
                        (f) => f.id === target.id,
                    )
                    if (
                        sourceIndex !== -1 &&
                        targetIndex !== -1 &&
                        sourceIndex !== targetIndex
                    ) {
                        move(sourceIndex, targetIndex)
                    }
                }}
            >
                {fields.map((field, index) => (
                    <ComponentCard
                        key={field.id}
                        field={field}
                        index={index}
                        dragEnabled={dragEnabled}
                        isOpen={openKey === field.id}
                        onOpenChange={(open) => setOpenKey(open ? field.id : null)}
                        remove={remove}
                    />
                ))}
            </DragDropProvider>

            {kittingRequired === 'Yes' &&
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        append({
                            id: crypto.randomUUID(),
                            name: `Component ${fields.length + 1}`,
                            finalSize: '',
                            flatSize: '',
                            stock: '',
                            coating: '',
                            qty: 1,
                            source: '',
                            sourceJobNumber: '',
                            instruction: '',
                            type: '',
                            otherType: '',
                        })
                    }
                >
                    Add component
                </Button>
            }


        </div>
    )
}

export default Components
