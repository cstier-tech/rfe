import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { useFormContext, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@/components/ui/collapsible'
import type { ComponentItem, FormValues } from '@/lib/form'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'

const PACK_TYPES = [
    { label: 'Shrink Wrap', value: 'Shrink Wrap' },
    { label: 'Banded', value: 'Banded' },
    { label: 'Convenient Cartons', value: 'Convenient Cartons' },
    { label: 'Other', value: 'Other' }
]

function Packs() {
    const { control } = useFormContext<FormValues>()

    const components = useWatch({ control, name: 'components' }) ?? []

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'packs',
    })

    // Which pack is expanded. Only one at a time; null means all collapsed.
    const [openKeys, setOpenKeys] = useState<Set<string>>(
        () => new Set(fields[0] ? [fields[0].id] : []),
    )
    // When a pack is added, open it (and collapse the others).
    const prevLen = useRef(fields.length)
    useEffect(() => {
        if (fields.length > prevLen.current) {
            const newField = fields[fields.length - 1]
            if (newField) {
                setOpenKeys((prev) => new Set(prev).add(newField.id))
            }
        }
        prevLen.current = fields.length
    }, [fields])

    const addPack = () => {
        append({ id: crypto.randomUUID(), type: '', qty: 1, items: [] })
    }

    return (
        <div className="flex flex-col gap-4">
            {/* <Controller
                control={control}
                name="convenientCartons"
                defaultValue={false}
                render={({ field }) => (
                    <Field orientation="horizontal">
                        <Checkbox
                            id="convenientCartons"
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v === true)}
                        />
                        <FieldLabel htmlFor="convenientCartons">
                            Pack in Convenient Cartons
                        </FieldLabel>
                    </Field>
                )}
            /> */}

            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No packs yet.</p>
            )}

            {fields.map((field, packIndex) => (
                <PackCard
                    key={field.id}
                    packIndex={packIndex}
                    components={components}
                    open={openKeys.has(field.id)}
                    onOpenChange={(open) =>
                        setOpenKeys((prev) => {
                            const next = new Set(prev)
                            if (open) {
                                next.add(field.id)
                            } else {
                                next.delete(field.id)
                            }
                            return next
                        })
                    }
                    onRemove={() => remove(packIndex)}
                />
            ))}

            <Button type="button" variant="outline" onClick={addPack}>
                Add pack
            </Button>
        </div>
    )
}

type PackCardProps = {
    packIndex: number
    components: ComponentItem[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onRemove: () => void
}

function PackCard({
    packIndex,
    components,
    open,
    onOpenChange,
    onRemove,
}: PackCardProps) {
    const {
        control,
        register,
        unregister,
        formState: { errors },
    } = useFormContext<FormValues>()

    const {
        fields: items,
        append: appendItem,
        remove: removeItem,
    } = useFieldArray({ control, name: `packs.${packIndex}.items` })

    const packType = useWatch({ control, name: `packs.${packIndex}.type` })

    // Drop selections whose component no longer exists (deleted in a prior step).
    const componentIdsKey = components.map((c) => c.id).join(',')
    useEffect(() => {
        const valid = new Set(componentIdsKey ? componentIdsKey.split(',') : [])
        for (let i = items.length - 1; i >= 0; i--) {
            if (!valid.has(items[i].componentId)) removeItem(i)
        }
        // Add items for any component not yet in this pack, so everything
        // starts selected by default.
        const existingIds = new Set(items.map((it) => it.componentId))
        for (const component of components) {
            if (!existingIds.has(component.id)) {
                appendItem({ componentId: component.id, qtyPerPack: 1 })
            }
        }
        // Intentionally keyed only on componentIdsKey: `items` changes on every
        // field-array edit, and re-running then would fight the user's typing.
    }, [componentIdsKey])

    const packErrors = errors.packs?.[packIndex]
    const hasErrors = !!packErrors && Object.keys(packErrors).length > 0

    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className="rounded-lg border border-border bg-gray-50"
        >
            <div className="flex items-center justify-between gap-2 p-3">
                <CollapsibleTrigger
                    className={`flex flex-1 items-center gap-2 text-left text-sm font-medium [&[data-state=open]>svg]:rotate-90 ${hasErrors ? 'text-destructive' : ''
                        }`}
                >
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform" />
                    Pack {packIndex + 1}
                </CollapsibleTrigger>
                <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                    Remove
                </Button>
            </div>

            <CollapsibleContent className="flex flex-col gap-3 p-3 pt-0">
                <RadioButtonGroup
                    control={control}
                    name={`packs.${packIndex}.type`}
                    legend='Pack Type *'
                    options={PACK_TYPES}
                    rules={{ required: 'Pack Type is required' }}
                    onValueChange={(value) => {
                        // Clear + unregister (rather than shouldUnregister on
                        // the input itself) so switching away from "Other"
                        // drops the stale value/validation, but simply
                        // navigating to another step and back — which also
                        // unmounts this input — does not.
                        if (value !== 'Other') {
                            unregister(`packs.${packIndex}.typeOther`)
                        }
                    }}
                />

                {packType === 'Other' && (
                    <Field>
                        <FieldLabel htmlFor={`packs.${packIndex}.typeOther`}>
                            Please specify *
                        </FieldLabel>
                        <Input
                            id={`packs.${packIndex}.typeOther`}
                            {...register(`packs.${packIndex}.typeOther`, {
                                required: 'Please specify the pack type',
                            })}
                        />
                        <FieldError errors={[packErrors?.typeOther]} />
                    </Field>
                )}

                <Field>
                    <FieldLabel htmlFor={`packs.${packIndex}.qty`}>
                        Pack Qty *
                    </FieldLabel>
                    <Input
                        id={`packs.${packIndex}.qty`}
                        type="number"
                        {...register(`packs.${packIndex}.qty`, {
                            required: 'Pack Qty is required',
                            valueAsNumber: true,
                            min: { value: 1, message: 'Pack Qty must be positive' },
                        })}
                    />
                    <FieldError errors={[packErrors?.qty]} />
                </Field>

                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                        Components in this pack
                    </span>
                    {components.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Add components in the previous step first.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="w-8 py-1 font-medium"></th>
                                        <th className="py-1 font-medium">Component</th>
                                        <th className="py-1 font-medium">Source</th>
                                        <th className="py-1 font-medium">Qty Per Pack</th>
                                        <th className="py-1 font-medium">Total Needed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {components.map((component, compIndex) => {
                                        const itemIndex = items.findIndex(
                                            (it) => it.componentId === component.id,
                                        )

                                        return (
                                            <ComponentRow
                                                key={component.id}
                                                packIndex={packIndex}
                                                itemIndex={itemIndex}
                                                label={
                                                    component.name ||
                                                    `Component ${compIndex + 1}`
                                                }
                                                source={component.source}
                                                onToggle={() => {
                                                    if (itemIndex === -1) {
                                                        appendItem({
                                                            componentId: component.id,
                                                            qtyPerPack: 1,
                                                        })
                                                    } else {
                                                        removeItem(itemIndex)
                                                    }
                                                }}
                                            />
                                            // <td></td>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

type ComponentRowProps = {
    packIndex: number
    itemIndex: number
    label: string
    source: string
    onToggle: () => void
}

function ComponentRow({
    packIndex,
    itemIndex,

    label,
    source,
    onToggle,
}: ComponentRowProps) {
    const {
        register,
        control,
        formState: { errors },
    } = useFormContext<FormValues>()


    const selected = itemIndex !== -1
    // const selected = itemIndex === -1
    const qtyError = selected
        ? errors.packs?.[packIndex]?.items?.[itemIndex]?.qtyPerPack
        : undefined

    const [qtyPerPack, packsQty] = useWatch({
        control,
        name: [`packs.${packIndex}.items.${itemIndex}.qtyPerPack`, `packs.${packIndex}.qty`]
    })

    const totalNeeded = selected ? qtyPerPack * packsQty : '—'

    return (
        <tr className="border-b border-border last:border-0">
            <td className="py-2 align-top">
                <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle()}
                    aria-label={`Include ${label} in this pack`}
                />
            </td>
            <td className="py-2 align-top">{label}</td>
            <td className="py-2 align-top text-muted-foreground">{source || '—'}</td>
            <td className="py-2 align-top">
                {selected ? (
                    <div className="flex flex-col gap-1">
                        <Input
                            type="number"
                            className="h-7 w-20"
                            aria-label={`Qty Per Pack for ${label}`}
                            {...register(`packs.${packIndex}.items.${itemIndex}.qtyPerPack`, {
                                required: 'Required',
                                valueAsNumber: true,
                                min: { value: 1, message: 'Min 1' },
                            })}
                        />
                        <FieldError className="text-xs" errors={[qtyError]} />
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </td>
            <td>{totalNeeded}</td>
        </tr>
    )
}

export default Packs
