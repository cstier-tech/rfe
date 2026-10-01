import { useEffect } from 'react'
import { useFormContext, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { blankPackLayer, derivePackoutQtys, formatQty, packLayerName, type FormValues } from '@/lib/form'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const PACK_TYPES = ['Shrink Wrap', 'Banded', 'Convenient Cartons', 'Double Walled Cartons', 'Other']

// Vertical lines between columns, for the unit build and packout tables.
const BORDERED_COLUMNS =
    '[&_td]:border-r [&_th]:border-r [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0'

const splitWholeQuantity = (total: number, count: number, index: number) => {
    const base = Math.floor(total / count)
    return base + (index < total % count ? 1 : 0)
}

function KitSteps({ packoutIndex }: { packoutIndex: number }) {
    const { control, register } = useFormContext<FormValues>()
    const { fields, append, insert, remove } = useFieldArray({
        control,
        name: `packouts.${packoutIndex}.kitSteps`,
    })

    return (
        <div className="col-span-4 flex flex-col gap-1 mt-1">
            <FieldLabel>Kit Steps (optional):</FieldLabel>
            <ol className="flex flex-col gap-2">
                {fields.map((field, stepIndex) => (
                    <li key={field.id} className="flex items-center gap-2">
                        <span className="w-6 text-right text-sm text-muted-foreground">
                            {stepIndex + 1}.
                        </span>
                        <Input
                            className="h-8 flex-1"
                            placeholder={`Step ${stepIndex + 1}`}
                            aria-label={`Step ${stepIndex + 1} for Packout Variant ${packoutIndex + 1}`}
                            {...register(`packouts.${packoutIndex}.kitSteps.${stepIndex}.instruction`)}
                            onKeyDown={(event) => {
                                // Enter starts a new step right after this one.
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    insert(stepIndex + 1, { instruction: '' })
                                }
                            }}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove step ${stepIndex + 1}`}
                            onClick={() => remove(stepIndex)}
                        >
                            <X />
                        </Button>
                    </li>
                ))}
            </ol>
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-auto self-start"
                onClick={() => append({ instruction: '' })}
            >
                <Plus />
                Add Step
            </Button>
        </div>
    )
}

// Layers of packing, innermost first: the first row packs the units, and each
// row after it packs the row before it. Starts with one blank row, which can be removed for no packing.
function Packing({
    packoutIndex,
    units,
    packTotals,
}: {
    packoutIndex: number
    units: number[]
    packTotals: (number[] | null)[]
}) {
    const {
        control,
        register,
        setValue,
        clearErrors,
        formState: { errors },
    } = useFormContext<FormValues>()
    const { fields, append, remove } = useFieldArray({
        control,
        name: `packouts.${packoutIndex}.packing`,
    })
    const packing = useWatch({ control, name: `packouts.${packoutIndex}.packing` }) ?? []
    const layerErrors = errors.packouts?.[packoutIndex]?.packing
    const showOtherColumn = packing.some((layer) => layer?.type === 'Other')

    return (
        <div className="flex flex-col gap-2">
            {fields.length > 0 && (
                <div className="rounded-sm border bg-white">
                    <Table className={BORDERED_COLUMNS}>
                        <TableHeader>
                            <TableRow className='text-xs'>
                                <TableHead colSpan={showOtherColumn ? 3 : 2} className="text-center">
                                    Packing
                                </TableHead>
                                <TableHead colSpan={units.length} className="text-center">
                                    Total Packs
                                </TableHead>
                                <TableHead />
                            </TableRow>
                            <TableRow className='text-xs'>
                                <TableHead>Pack Type</TableHead>
                                {showOtherColumn && <TableHead>Other Type</TableHead>}
                                <TableHead>Qty per Pack</TableHead>
                                {units.map((count, tierIndex) => (
                                    <TableHead key={tierIndex}>{count} units</TableHead>
                                ))}
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, layerIndex) => {
                                const layer = packing[layerIndex]
                                const fieldErrors = layerErrors?.[layerIndex]
                                const fieldPrefix = `packouts.${packoutIndex}.packing.${layerIndex}` as const
                                const label = `packing layer ${layerIndex + 1} of Packout Variant ${packoutIndex + 1}`
                                const isConvenientCartons = layer?.type === 'Convenient Cartons'
                                // What this layer holds: the units, or the previous layer's packs.
                                const inner = layerIndex === 0
                                    ? 'units'
                                    : packLayerName(packing[layerIndex - 1] ?? { type: '' })

                                return (
                                    <TableRow key={field.id} className="align-top">
                                        <TableCell>
                                            <Controller
                                                control={control}
                                                name={`${fieldPrefix}.type`}
                                                rules={{ required: 'Required' }}
                                                render={({ field: typeField, fieldState }) => (
                                                    <div className="flex flex-col gap-1">
                                                        <Select
                                                            value={typeField.value || undefined}
                                                            onValueChange={(value) => {
                                                                typeField.onChange(value)
                                                                // Convenient Cartons hold however many fit.
                                                                if (value === 'Convenient Cartons') {
                                                                    setValue(`${fieldPrefix}.qtyPer`, null, { shouldDirty: true })
                                                                    clearErrors(`${fieldPrefix}.qtyPer`)
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger
                                                                size="sm"
                                                                className="w-full bg-white"
                                                                aria-label={`Pack type for ${label}`}
                                                                aria-invalid={fieldState.invalid || undefined}
                                                                onBlur={typeField.onBlur}
                                                            >
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PACK_TYPES.map((packType) => (
                                                                    <SelectItem key={packType} value={packType}>
                                                                        {packType}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FieldError className="text-xs" errors={[fieldState.error]} />
                                                    </div>
                                                )}
                                            />
                                        </TableCell>
                                        {showOtherColumn && (
                                            <TableCell>
                                                {layer?.type === 'Other' && (
                                                    <div className="flex w-32 flex-col gap-1">
                                                        <Input
                                                            className="h-7"
                                                            placeholder="Specify type"
                                                            aria-label={`Other pack type for ${label}`}
                                                            {...register(`${fieldPrefix}.otherType`, {
                                                                required: 'Required',
                                                            })}
                                                        />
                                                        <FieldError className="text-xs" errors={[fieldErrors?.otherType]} />
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        className="h-7 w-20"
                                                        aria-label={`${inner} per pack for ${label}`}
                                                        disabled={isConvenientCartons}
                                                        {...register(`${fieldPrefix}.qtyPer`, {
                                                            required: isConvenientCartons ? false : 'Required',
                                                            valueAsNumber: true,
                                                            min: { value: 1, message: 'Min 1' },
                                                        })}
                                                    />
                                                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                                                        {inner}
                                                    </span>
                                                </div>
                                                <FieldError className="text-xs" errors={[fieldErrors?.qtyPer]} />
                                            </div>
                                        </TableCell>
                                        {units.map((_, tierIndex) => {
                                            const total = packTotals[layerIndex]?.[tierIndex]
                                            return (
                                                <TableCell key={tierIndex} className="align-middle">
                                                    <span className="font-semibold">
                                                        {total == null ? '-' : formatQty(total)}
                                                    </span>
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="align-middle">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Remove ${label}`}
                                                onClick={() => remove(layerIndex)}
                                            >
                                                <X />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-auto self-start"
                onClick={() =>
                    append(blankPackLayer())
                }
            >
                <Plus />
                {fields.length === 0 ? 'Add Packing' : 'Add Packing Layer'}
            </Button>
        </div>
    )
}

function Packouts() {
    const {
        control,
        formState: { dirtyFields, errors },
        getValues,
        register,
        setValue,
        trigger,
    } = useFormContext<FormValues>()
    const components = useWatch({ control, name: 'components' }) ?? []
    const overviewQtyTiers = useWatch({ control, name: 'qty' }) ?? []
    const packouts = useWatch({ control, name: 'packouts' }) ?? []
    const { fields, append, remove } = useFieldArray({ control, name: 'packouts' })

    const componentIdsKey = components.map((component) => component.id).join(',')

    useEffect(() => {
        if (fields.length === 0) return

        const currentPackouts = getValues('packouts')
        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier) || 0
            if (target <= 0) return

            currentPackouts.forEach((packout, packoutIndex) => {
                if (packout.qty[tierIndex] === undefined) {
                    setValue(
                        `packouts.${packoutIndex}.qty.${tierIndex}`,
                        splitWholeQuantity(target, fields.length, packoutIndex),
                    )
                }
            })
        })
    }, [fields.length, getValues, overviewQtyTiers, setValue])

    useEffect(() => {
        const validComponentIds = new Set(componentIdsKey ? componentIdsKey.split(',') : [])
        const currentPackouts = getValues('packouts')

        currentPackouts.forEach((packout, packoutIndex) => {
            const existingItems = new Map(
                packout.kitItems
                    .filter((item) => validComponentIds.has(item.componentId))
                    .map((item) => [item.componentId, item]),
            )
            // A lone component *is* the unit, so it's always 1 per unit (its
            // table is hidden, so there'd be no way to see a leftover value).
            const nextItems = components.map((component) =>
                components.length === 1
                    ? { componentId: component.id, componentName: component.name, qtyPerKit: 1 }
                    : existingItems.get(component.id) ?? {
                        componentId: component.id,
                        componentName: component.name,
                        qtyPerKit: 1,
                    },
            )

            if (JSON.stringify(nextItems) !== JSON.stringify(packout.kitItems)) {
                setValue(`packouts.${packoutIndex}.kitItems`, nextItems)
            }
        })
    }, [componentIdsKey, fields.length, getValues, setValue])

    const addPackout = () => {
        const currentPackouts = getValues('packouts')
        const newPackoutCount = currentPackouts.length + 1
        const newPackoutQty = overviewQtyTiers.map((tier, tierIndex) => {
            const target = Number(tier) || 0
            const hasEditedPackout = currentPackouts.some(
                (_, packoutIndex) => dirtyFields.packouts?.[packoutIndex]?.qty?.[tierIndex],
            )

            if (!hasEditedPackout) {
                return splitWholeQuantity(target, newPackoutCount, currentPackouts.length)
            }

            const existingTotal = currentPackouts.reduce(
                (total, packout) => total + (Number(packout.qty[tierIndex]) || 0),
                0,
            )
            return Math.max(0, target - existingTotal)
        })

        append({
            id: crypto.randomUUID(),
            qty: newPackoutQty,
            kitId: crypto.randomUUID(),
            kitItems: [],
            kitSteps: [],
            packing: [blankPackLayer()],
        })

        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier) || 0
            const hasEditedPackout = currentPackouts.some(
                (_, packoutIndex) => dirtyFields.packouts?.[packoutIndex]?.qty?.[tierIndex],
            )

            if (hasEditedPackout) return

            currentPackouts.forEach((_, packoutIndex) => {
                setValue(
                    `packouts.${packoutIndex}.qty.${tierIndex}`,
                    splitWholeQuantity(target, newPackoutCount, packoutIndex),
                )
            })
        })
    }

    const multipleTiers = overviewQtyTiers.length > 1
    const multiplePackouts = packouts.length > 1

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No packouts yet.</p>
            )}
            {packouts.map((packout, packoutIndex) => {
                const packoutErrors = errors.packouts?.[packoutIndex]
                // Same values that get saved on submit.
                const derived = derivePackoutQtys(packout, overviewQtyTiers, multiplePackouts)

                return (
                    <Card
                        key={packout.id}
                        className="flex flex-col gap-4 bg-gray-50"
                    >
                        {/* Row 1: variant # and remove */}
                        <CardHeader className='flex justify-between items-center'>
                            <div className="font-semibold">
                                {multiplePackouts ? `Packout Variant ${packoutIndex + 1}` : 'Packout'}
                            </div>
                            <div className="lex justify-end">
                                {multiplePackouts && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => remove(packoutIndex)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className='flex flex-col gap-4'>
                            {/* Row 2: unit qtys */}
                            {multiplePackouts && (
                                <div className="col-span-4 flex flex-wrap items-start gap-4">
                                    {overviewQtyTiers.map((tier, tierIndex) => {
                                        const displayLabel = multipleTiers ? `Units @ qty ${tier ?? 0}` : 'Unit Qty'
                                        const fieldName = `packouts.${packoutIndex}.qty.${tierIndex}` as const

                                        const tierTarget = Number(tier) || 0
                                        const currentValue = getValues(fieldName)
                                        const fieldRegistration = register(fieldName, {
                                            required: 'Unit Qty is required',
                                            valueAsNumber: true,
                                            min: { value: 0, message: 'Unit Qty cannot be negative' },
                                            validate: {
                                                wholeNumber: (value) =>
                                                    Number.isInteger(value) || 'Must be a whole number',
                                                total: (value) => {
                                                    const total = getValues('packouts').reduce(
                                                        (sum, currentPackout, index) => index === packoutIndex
                                                            ? sum + (Number(value) || 0)
                                                            : sum + (Number(currentPackout.qty[tierIndex]) || 0),
                                                        0,
                                                    )
                                                    if (total === tierTarget) return true
                                                    const difference = Math.abs(total - tierTarget)
                                                    return total > tierTarget
                                                        ? `Over by ${difference}`
                                                        : `Under by ${difference}`
                                                },
                                            },
                                        })
                                        const tierFieldNames = packouts.map((_, index) =>
                                            `packouts.${index}.qty.${tierIndex}` as const,
                                        )

                                        return (
                                            <Field key={fieldName} name={fieldName} className="w-auto">
                                                <div className="flex flex-col gap-1 text-sm">
                                                    <label htmlFor={fieldName} className="text-muted-foreground">
                                                        {displayLabel}
                                                    </label>
                                                    <Input
                                                        id={fieldName}
                                                        type="number"
                                                        step="1"
                                                        className="h-8 w-24"
                                                        defaultValue={
                                                            currentValue ??
                                                            splitWholeQuantity(tierTarget, fields.length, packoutIndex)
                                                        }
                                                        {...fieldRegistration}
                                                        onChange={(event) => {
                                                            fieldRegistration.onChange(event)
                                                            void trigger(tierFieldNames)
                                                        }}
                                                    />
                                                </div>
                                                <FieldError errors={[packoutErrors?.qty?.[tierIndex]]} />
                                            </Field>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Row 4: components. Hidden with a single component, since it's the unit itself. */}
                            {components.length !== 1 && (
                                <div className='flex flex-col gap-2'>
                                    {/* <span>How will each kit be built?</span> */}
                                    <div className="col-span-4 rounded-sm border bg-white">
                                        {components.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No components yet.</p>
                                        ) : (
                                            <div>
                                            <Table className={BORDERED_COLUMNS}>
                                                <TableHeader>
                                                    <TableRow className='text-xs'>
                                                        <TableHead colSpan={2} className="text-center">
                                                            Kit Assembly
                                                        </TableHead>
                                                        <TableHead colSpan={overviewQtyTiers.length} className="text-center">
                                                            Pieces Required
                                                        </TableHead>
                                                    </TableRow>
                                                    <TableRow className='text-xs'>
                                                        <TableHead>Component</TableHead>
                                                        <TableHead>Per Unit</TableHead>
                                                        {derived.qty.map((units, tierIndex) => (
                                                            <TableHead key={tierIndex}>{units} units</TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {components.map((component) => {
                                                        const itemIndex = packout.kitItems.findIndex(
                                                            (item) => item.componentId === component.id,
                                                        )
                                                        const item = itemIndex === -1 ? undefined : packout.kitItems[itemIndex]
                                                        const qtyError = packoutErrors?.kitItems?.[itemIndex]?.qtyPerKit
                                                        const pieces = derived.kitItemPieces[itemIndex] ?? []

                                                        return (
                                                            <TableRow key={component.id}>
                                                                <TableCell>{component.name || 'Unnamed component'}</TableCell>
                                                                <TableCell>
                                                                    {item && (
                                                                        <div className="flex flex-col gap-1">
                                                                            <Input
                                                                                type="number"
                                                                                step="1"
                                                                                className="h-7 w-20"
                                                                                aria-label={`Qty Per Unit for ${component.name || 'component'} in Variant ${packoutIndex + 1}`}
                                                                                {...register(`packouts.${packoutIndex}.kitItems.${itemIndex}.qtyPerKit`, {
                                                                                    required: 'Required',
                                                                                    valueAsNumber: true,
                                                                                    min: { value: 0, message: 'Min 0' },
                                                                                })}
                                                                            />
                                                                            <FieldError className="text-xs" errors={[qtyError]} />
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                {derived.qty.map((_, tierIndex) => (
                                                                    <TableCell key={tierIndex}>
                                                                        <span className="font-semibold">{pieces[tierIndex] ?? 0}</span>
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                            </div>
                                        )}

                                    </div>
                                    {/* Row 5: instructions */}
                                    <KitSteps packoutIndex={packoutIndex} />
                                </div>
                            )}
                            {/* Row 6: packing layers */}
                            <Packing
                                packoutIndex={packoutIndex}
                                units={derived.qty}
                                packTotals={derived.packTotals}
                            />
                        </CardContent>
                    </Card>
                )
            })}
            <Button type="button" size='sm' className='w-auto self-start' variant="outline" onClick={addPackout}>
                <Plus />
                Add Packout Variation
            </Button>
        </div>
    )
}

export default Packouts
