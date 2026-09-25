import { useEffect } from 'react'
import { useFormContext, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import type { FormValues } from '@/lib/form'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const PACK_TYPES = ['Shrink Wrap', 'Banded', 'Convenient Cartons', 'Other']

// Every unit in an assembly goes into its one pack type, so each tier's pack
// count is derived rather than entered.
export const derivedTotalPacks = (unitQty?: number, unitsPerPack?: number) => {
    const units = Number(unitQty) || 0
    const perPack = Number(unitsPerPack) || 0
    return perPack > 0 ? units / perPack : 0
}

// Vertical lines between columns, for the unit build and packout tables.
const BORDERED_COLUMNS =
    '[&_td]:border-r [&_th]:border-r [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0'

const formatPacks = (packs: number) =>
    Number.isInteger(packs) ? String(packs) : packs.toFixed(2)

const splitWholeQuantity = (total: number, count: number, index: number) => {
    const base = Math.floor(total / count)
    return base + (index < total % count ? 1 : 0)
}

function AssemblySteps({ assemblyIndex }: { assemblyIndex: number }) {
    const { control, register } = useFormContext<FormValues>()
    const { fields, append, insert, remove } = useFieldArray({
        control,
        name: `assemblies.${assemblyIndex}.steps`,
    })

    return (
        <div className="col-span-4 flex flex-col gap-2">
            <FieldLabel>Instructions</FieldLabel>
            <ol className="flex flex-col gap-2">
                {fields.map((field, stepIndex) => (
                    <li key={field.id} className="flex items-center gap-2">
                        <span className="w-6 text-right text-sm text-muted-foreground">
                            {stepIndex + 1}.
                        </span>
                        <Input
                            className="h-8 flex-1"
                            placeholder={`Step ${stepIndex + 1}`}
                            aria-label={`Step ${stepIndex + 1} for Assembly Variant ${assemblyIndex + 1}`}
                            {...register(`assemblies.${assemblyIndex}.steps.${stepIndex}.instruction`)}
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

function Assemblies() {
    const {
        control,
        formState: { dirtyFields, errors },
        getValues,
        register,
        setValue,
        trigger,
        unregister,
    } = useFormContext<FormValues>()
    const components = useWatch({ control, name: 'components' }) ?? []
    const overviewQtyTiers = useWatch({ control, name: 'qty' }) ?? []
    const assemblies = useWatch({ control, name: 'assemblies' }) ?? []
    const { fields, append, remove } = useFieldArray({ control, name: 'assemblies' })

    const componentIdsKey = components.map((component) => component.id).join(',')

    useEffect(() => {
        if (fields.length === 0) return

        const currentAssemblies = getValues('assemblies')
        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            if (target <= 0) return

            currentAssemblies.forEach((assembly, assemblyIndex) => {
                if (assembly.qty[tierIndex]?.qty === undefined) {
                    setValue(
                        `assemblies.${assemblyIndex}.qty.${tierIndex}.qty`,
                        splitWholeQuantity(target, fields.length, assemblyIndex),
                    )
                }
            })
        })
    }, [fields.length, getValues, overviewQtyTiers, setValue])

    useEffect(() => {
        const validComponentIds = new Set(componentIdsKey ? componentIdsKey.split(',') : [])
        const currentAssemblies = getValues('assemblies')

        currentAssemblies.forEach((assembly, assemblyIndex) => {
            const existingItems = new Map(
                assembly.items
                    .filter((item) => validComponentIds.has(item.componentId))
                    .map((item) => [item.componentId, item]),
            )
            // A lone component *is* the unit, so it's always 1 per unit (its
            // table is hidden, so there'd be no way to see a leftover value).
            const nextItems = components.map((component) =>
                components.length === 1
                    ? { componentId: component.id, qtyPerUnit: 1 }
                    : existingItems.get(component.id) ?? {
                        componentId: component.id,
                        qtyPerUnit: 1,
                    },
            )

            if (JSON.stringify(nextItems) !== JSON.stringify(assembly.items)) {
                setValue(`assemblies.${assemblyIndex}.items`, nextItems)
            }
        })
    }, [componentIdsKey, fields.length, getValues, setValue])

    const addAssembly = () => {
        const currentAssemblies = getValues('assemblies')
        const newAssemblyCount = currentAssemblies.length + 1
        const newAssemblyQty = overviewQtyTiers.map((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            const hasEditedAssembly = currentAssemblies.some(
                (_, assemblyIndex) => dirtyFields.assemblies?.[assemblyIndex]?.qty?.[tierIndex]?.qty,
            )

            if (!hasEditedAssembly) {
                return { qty: splitWholeQuantity(target, newAssemblyCount, currentAssemblies.length) }
            }

            const existingTotal = currentAssemblies.reduce(
                (total, assembly) => total + (Number(assembly.qty[tierIndex]?.qty) || 0),
                0,
            )
            return { qty: Math.max(0, target - existingTotal) }
        })

        append({
            id: crypto.randomUUID(),
            qty: newAssemblyQty,
            items: [],
            steps: [{ instruction: '' }],
            packType: '',
        })

        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            const hasEditedAssembly = currentAssemblies.some(
                (_, assemblyIndex) => dirtyFields.assemblies?.[assemblyIndex]?.qty?.[tierIndex]?.qty,
            )

            if (hasEditedAssembly) return

            currentAssemblies.forEach((_, assemblyIndex) => {
                setValue(
                    `assemblies.${assemblyIndex}.qty.${tierIndex}.qty`,
                    splitWholeQuantity(target, newAssemblyCount, assemblyIndex),
                )
            })
        })
    }

    const multipleTiers = overviewQtyTiers.length > 1
    const multipleAssemblies = assemblies.length > 1

    // With a single assembly the qty fields are hidden and the assembly gets the full tier qty.
    const getAssemblyQty = (assembly: FormValues['assemblies'][number], tierIndex: number) =>
        multipleAssemblies
            ? Number(assembly.qty[tierIndex]?.qty) || 0
            : Number(overviewQtyTiers[tierIndex]?.qty) || 0

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No assemblies yet.</p>
            )}
            {assemblies.map((assembly, assemblyIndex) => {
                const assemblyErrors = errors.assemblies?.[assemblyIndex]

                return (
                    <Card
                        key={assembly.id}
                        className="flex flex-col gap-4 bg-gray-50"
                    >
                        {/* Row 1: variant # and remove */}
                        <CardHeader className='flex justify-between'>
                            <div className="font-semibold">
                                {multipleAssemblies ? `Assembly Variant ${assemblyIndex + 1}` : 'Assembly'}
                            </div>
                            <div className="lex justify-end">
                                {multipleAssemblies && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => remove(assemblyIndex)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className='flex flex-col gap-4'>
                            {/* Row 2: unit qtys */}
                            {multipleAssemblies && (
                                <div className="col-span-4 flex flex-wrap items-start gap-4">
                                    {overviewQtyTiers.map((tier, tierIndex) => {
                                        const displayLabel = multipleTiers ? `Units @ qty ${tier.qty ?? 0}` : 'Unit Qty'
                                        const fieldName = `assemblies.${assemblyIndex}.qty.${tierIndex}.qty` as const

                                        const tierTarget = Number(tier.qty) || 0
                                        const currentValue = getValues(fieldName)
                                        const fieldRegistration = register(fieldName, {
                                            required: 'Unit Qty is required',
                                            valueAsNumber: true,
                                            min: { value: 0, message: 'Unit Qty cannot be negative' },
                                            validate: {
                                                wholeNumber: (value) =>
                                                    Number.isInteger(value) || 'Must be a whole number',
                                                total: (value) => {
                                                    const total = getValues('assemblies').reduce(
                                                        (sum, currentAssembly, index) => index === assemblyIndex
                                                            ? sum + (Number(value) || 0)
                                                            : sum + (Number(currentAssembly.qty[tierIndex]?.qty) || 0),
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
                                        const tierFieldNames = assemblies.map((_, index) =>
                                            `assemblies.${index}.qty.${tierIndex}.qty` as const,
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
                                                            splitWholeQuantity(tierTarget, fields.length, assemblyIndex)
                                                        }
                                                        {...fieldRegistration}
                                                        onChange={(event) => {
                                                            fieldRegistration.onChange(event)
                                                            void trigger(tierFieldNames)
                                                        }}
                                                    />
                                                </div>
                                                <FieldError errors={[assemblyErrors?.qty?.[tierIndex]?.qty]} />
                                            </Field>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Row 4: components. Hidden with a single component, since it's the unit itself. */}
                            {components.length !== 1 && (
                                <div className="col-span-4 rounded-sm border bg-white">
                                    {components.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No components yet.</p>
                                    ) : (
                                        <Table className={BORDERED_COLUMNS}>
                                            <TableHeader>
                                                <TableRow className='text-xs'>
                                                    <TableHead colSpan={2} className="text-center">
                                                        Unit Build
                                                    </TableHead>
                                                    <TableHead colSpan={overviewQtyTiers.length} className="text-center">
                                                        Pieces Required
                                                    </TableHead>
                                                </TableRow>
                                                <TableRow className='text-xs'>
                                                    <TableHead>Component</TableHead>
                                                    <TableHead>Per Unit</TableHead>
                                                    {overviewQtyTiers.map((tier, tierIndex) => (
                                                        <TableHead key={tier.name ?? tierIndex}>
                                                            {getAssemblyQty(assembly, tierIndex)} units
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {components.map((component) => {
                                                    const itemIndex = assembly.items.findIndex(
                                                        (item) => item.componentId === component.id,
                                                    )
                                                    const item = itemIndex === -1 ? undefined : assembly.items[itemIndex]
                                                    const qtyError = assemblyErrors?.items?.[itemIndex]?.qtyPerUnit
                                                    const qtyPerUnit = Number(item?.qtyPerUnit) || 0

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
                                                                            aria-label={`Qty Per Unit for ${component.name || 'component'} in Variant ${assemblyIndex + 1}`}
                                                                            {...register(`assemblies.${assemblyIndex}.items.${itemIndex}.qtyPerUnit`, {
                                                                                required: 'Required',
                                                                                valueAsNumber: true,
                                                                                min: { value: 0, message: 'Min 0' },
                                                                            })}
                                                                        />
                                                                        <FieldError className="text-xs" errors={[qtyError]} />
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            {overviewQtyTiers.map((_, tierIndex) => (
                                                                <TableCell key={`${component.id}-${tierIndex}`}>
                                                                    <span className="font-semibold">
                                                                        {getAssemblyQty(assembly, tierIndex) * qtyPerUnit}
                                                                    </span>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            )}

                            {/* Row 5: unit pack. One per assembly, so a single-row table laid out like the components table. */}
                            <div className="col-span-4 rounded-sm border bg-white">
                                <Table className={BORDERED_COLUMNS}>
                                    <TableHeader>
                                        <TableRow className='text-xs'>
                                            <TableHead colSpan={assembly.packType === 'Other' ? 3 : 2} className="text-center">
                                                Packout
                                            </TableHead>
                                            <TableHead colSpan={overviewQtyTiers.length} className="text-center">
                                                Total Packs
                                            </TableHead>
                                        </TableRow>
                                        <TableRow className='text-xs'>
                                            <TableHead>Pack Type</TableHead>
                                            {assembly.packType === 'Other' && <TableHead>Other Type</TableHead>}
                                            <TableHead>Units per Pack</TableHead>
                                            {overviewQtyTiers.map((tier, tierIndex) => (
                                                <TableHead key={tier.name ?? tierIndex}>
                                                    {getAssemblyQty(assembly, tierIndex)} units
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="align-top">
                                            <TableCell>
                                                <Controller
                                                    control={control}
                                                    name={`assemblies.${assemblyIndex}.packType`}
                                                    rules={{ required: 'Required' }}
                                                    render={({ field: typeField, fieldState }) => (
                                                        <div className="flex w-40 flex-col gap-1">
                                                            <Select
                                                                value={typeField.value || undefined}
                                                                onValueChange={(value) => {
                                                                    typeField.onChange(value)
                                                                    if (value !== 'Other') {
                                                                        unregister(`assemblies.${assemblyIndex}.packTypeOther`)
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger
                                                                    size="sm"
                                                                    className="w-full bg-white"
                                                                    aria-label={`Pack type for Assembly Variant ${assemblyIndex + 1}`}
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
                                            {assembly.packType === 'Other' && (
                                                <TableCell>
                                                    <div className="flex w-36 flex-col gap-1">
                                                        <Input
                                                            className="h-7"
                                                            placeholder="Specify type"
                                                            aria-label={`Other pack type for Assembly Variant ${assemblyIndex + 1}`}
                                                            {...register(`assemblies.${assemblyIndex}.packTypeOther`, {
                                                                required: 'Required',
                                                            })}
                                                        />
                                                        <FieldError className="text-xs" errors={[assemblyErrors?.packTypeOther]} />
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        className="h-7 w-20"
                                                        aria-label={`Units per pack for Assembly Variant ${assemblyIndex + 1}`}
                                                        {...register(`assemblies.${assemblyIndex}.unitsPerPack`, {
                                                            required: 'Required',
                                                            valueAsNumber: true,
                                                            min: { value: 1, message: 'Min 1' },
                                                        })}
                                                    />
                                                    <FieldError className="text-xs" errors={[assemblyErrors?.unitsPerPack]} />
                                                </div>
                                            </TableCell>
                                            {overviewQtyTiers.map((tier, tierIndex) => (
                                                <TableCell key={tier.name ?? tierIndex} className="align-middle">
                                                    <span className="font-semibold">
                                                        {formatPacks(
                                                            derivedTotalPacks(getAssemblyQty(assembly, tierIndex), assembly.unitsPerPack),
                                                        )}
                                                    </span>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Row 6: instructions */}
                            <AssemblySteps assemblyIndex={assemblyIndex} />
                        </CardContent>
                    </Card>
                )
            })}
            <Button type="button" size='sm' className='w-auto self-start' variant="outline" onClick={addAssembly}>
                <Plus />
                Add Assembly Variation
            </Button>
        </div>
    )
}

export default Assemblies
