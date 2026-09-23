import { useEffect } from 'react'
import { useFormContext, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field, FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { FormValues } from '@/lib/form'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

const PACK_TYPES = [
    { label: 'Shrink Wrap', value: 'Shrink Wrap' },
    { label: 'Banded', value: 'Banded' },
    { label: 'Convenient Cartons', value: 'Convenient Cartons' },
    { label: 'Other', value: 'Other' },
]

const splitWholeQuantity = (total: number, count: number, index: number) => {
    const base = Math.floor(total / count)
    return base + (index < total % count ? 1 : 0)
}

function Packs() {
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
    const packs = useWatch({ control, name: 'packs' }) ?? []
    const { fields, append, remove } = useFieldArray({ control, name: 'packs' })

    const componentIdsKey = components.map((component) => component.id).join(',')

    useEffect(() => {
        if (fields.length === 0) return

        const currentPacks = getValues('packs')
        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            if (target <= 0) return

            currentPacks.forEach((pack, packIndex) => {
                if (pack.qty[tierIndex]?.qty === undefined) {
                    setValue(
                        `packs.${packIndex}.qty.${tierIndex}.qty`,
                        splitWholeQuantity(target, fields.length, packIndex),
                    )
                }
            })
        })
    }, [fields.length, getValues, overviewQtyTiers, setValue])

    useEffect(() => {
        const validComponentIds = new Set(componentIdsKey ? componentIdsKey.split(',') : [])
        const currentPacks = getValues('packs')

        currentPacks.forEach((pack, packIndex) => {
            const existingItems = new Map(
                pack.items
                    .filter((item) => validComponentIds.has(item.componentId))
                    .map((item) => [item.componentId, item]),
            )
            const nextItems = components.map((component) =>
                existingItems.get(component.id) ?? {
                    componentId: component.id,
                    qtyPerPack: 1,
                },
            )

            if (JSON.stringify(nextItems) !== JSON.stringify(pack.items)) {
                setValue(`packs.${packIndex}.items`, nextItems)
            }
        })
    }, [componentIdsKey, fields.length, getValues, setValue])

    const addPack = () => {
        const currentPacks = getValues('packs')
        const newPackCount = currentPacks.length + 1
        const newPackQty = overviewQtyTiers.map((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            const hasEditedPack = currentPacks.some(
                (_, packIndex) => dirtyFields.packs?.[packIndex]?.qty?.[tierIndex]?.qty,
            )

            if (!hasEditedPack) {
                return { qty: splitWholeQuantity(target, newPackCount, currentPacks.length) }
            }

            const existingTotal = currentPacks.reduce(
                (total, pack) => total + (Number(pack.qty[tierIndex]?.qty) || 0),
                0,
            )
            return { qty: Math.max(0, target - existingTotal) }
        })

        append({ id: crypto.randomUUID(), type: '', qty: newPackQty, items: [] })

        overviewQtyTiers.forEach((tier, tierIndex) => {
            const target = Number(tier.qty) || 0
            const hasEditedPack = currentPacks.some(
                (_, packIndex) => dirtyFields.packs?.[packIndex]?.qty?.[tierIndex]?.qty,
            )

            if (hasEditedPack) return

            currentPacks.forEach((_, packIndex) => {
                setValue(
                    `packs.${packIndex}.qty.${tierIndex}.qty`,
                    splitWholeQuantity(target, newPackCount, packIndex),
                )
            })
        })
    }

    const multipleTiers = overviewQtyTiers.length > 1
    const multiplePacks = packs.length > 1

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No packs yet.</p>
            )}
            <div className='border bg-white p-5 rounded-lg'>
                {/* <span className='text-xl font-semibold'>Assembly</span> */}
                <Table>

                    <TableHeader>
                        <TableRow>
                            <TableHead>{multiplePacks && 'Variant #'}</TableHead>
                            <TableHead>Pack Type</TableHead>
                            {overviewQtyTiers.map((tier, tierIndex) => {
                                let displayLabel = multipleTiers ? `Packs @ qty ${tier.qty ?? 0}` : 'Pack Qty'
                                return (
                                    <TableHead key={tier.name ?? tierIndex}>{displayLabel}</TableHead>
                                )

                            })}

                            {multiplePacks && <TableHead>Actions</TableHead>}

                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {packs.map((pack, packIndex) => {
                            const packErrors = errors.packs?.[packIndex]

                            return (
                                <TableRow key={pack.id}>
                                    <TableCell>{multiplePacks ? `Assembly Variant ${packIndex + 1}` : 'Assembly'}</TableCell>
                                    <TableCell>
                                        <div className="flex items-start gap-2">
                                            <Controller
                                                control={control}
                                                name={`packs.${packIndex}.type`}
                                                rules={{ required: 'Pack Type is required' }}
                                                render={({ field, fieldState }) => (
                                                    <Select
                                                        value={field.value || undefined}
                                                        onValueChange={(value) => {
                                                            field.onChange(value)
                                                            if (value !== 'Other') {
                                                                unregister(`packs.${packIndex}.typeOther`)
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            size="sm"
                                                            aria-invalid={fieldState.invalid || undefined}
                                                        >
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PACK_TYPES.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            {pack.type === 'Other' && (
                                                <Input
                                                    className="w-36"
                                                    aria-label={`Custom type for Assembly Variant ${packIndex + 1}`}
                                                    {...register(`packs.${packIndex}.typeOther`, {
                                                        required: 'Please specify the pack type',
                                                    })}
                                                />
                                            )}
                                        </div>
                                        <FieldError errors={[packErrors?.type, packErrors?.typeOther]} />
                                    </TableCell>
                                    {overviewQtyTiers.map((tier, tierIndex) => {

                                        const fieldName = `packs.${packIndex}.qty.${tierIndex}.qty` as const
                                        const tierTarget = Number(tier.qty) || 0
                                        const currentValue = getValues(fieldName)
                                        const fieldRegistration = register(fieldName, {
                                            required: 'Pack Qty is required',
                                            valueAsNumber: true,
                                            min: { value: 0, message: 'Pack Qty cannot be negative' },
                                            validate: {
                                                wholeNumber: (value) =>
                                                    Number.isInteger(value) || 'Must be a whole number',
                                                total: (value) => {
                                                    const total = getValues('packs').reduce(
                                                        (sum, currentPack, index) => index === packIndex
                                                            ? sum + (Number(value) || 0)
                                                            : sum + (Number(currentPack.qty[tierIndex]?.qty) || 0),
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
                                        const tierFieldNames = packs.map((_, index) =>
                                            `packs.${index}.qty.${tierIndex}.qty` as const,
                                        )
                                        if (multiplePacks && multipleTiers) {
                                            return (
                                                <TableCell key={fieldName}>
                                                    <Field name={fieldName}>
                                                        <Input
                                                            id={fieldName}
                                                            type="number"
                                                            step="1"
                                                            defaultValue={
                                                                currentValue ??
                                                                splitWholeQuantity(tierTarget, fields.length, packIndex)
                                                            }
                                                            {...fieldRegistration}
                                                            onChange={(event) => {
                                                                fieldRegistration.onChange(event)
                                                                void trigger(tierFieldNames)
                                                            }}
                                                        />
                                                        <FieldError errors={[packErrors?.qty?.[tierIndex]?.qty]} />
                                                    </Field>
                                                </TableCell>
                                            )
                                        }
                                        return (
                                            <TableCell>
                                                {tier.qty}

                                            </TableCell>
                                        )
                                    })
                                    }

                                    {multiplePacks &&
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => remove(packIndex)}
                                            >
                                                Remove
                                            </Button>
                                        </TableCell>
                                    }
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <Button type="button" size='sm' className='w-auto' variant="outline" onClick={addPack}>
                    <Plus />
                    Add Assembly Variation
                </Button>
            </div>



            <div className='border bg-white p-5 rounded-lg'>
                <Table>
                    <TableCaption>Components</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Component</TableHead>
                            {packs.map((pack, packIndex) => (
                                <TableHead className='text-xs' key={pack.id}>{`V${packIndex + 1} per pack`}</TableHead>
                            ))}
                            {overviewQtyTiers.map((tier, tierIndex) => {
                                let displayLabel = multipleTiers ? `Pieces @ qty ${tier.qty ?? 0}` : 'Total Pieces'
                                return (
                                    <TableHead key={tier.name ?? tierIndex}>{displayLabel}</TableHead>
                                )
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {components.map((component) => (
                            <TableRow key={component.id}>
                                <TableCell>{component.name || 'Unnamed component'}</TableCell>
                                {packs.map((pack, packIndex) => {
                                    const itemIndex = pack.items.findIndex(
                                        (item) => item.componentId === component.id,
                                    )
                                    const item = itemIndex === -1 ? undefined : pack.items[itemIndex]
                                    const qtyError = errors.packs?.[packIndex]?.items?.[itemIndex]?.qtyPerPack

                                    return (
                                        <TableCell key={pack.id}>
                                            {item && (
                                                <div className="flex flex-col gap-1">
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        className="h-7 w-20"
                                                        aria-label={`Qty Per Pack for ${component.name || 'component'} in Variant ${packIndex + 1}`}
                                                        {...register(`packs.${packIndex}.items.${itemIndex}.qtyPerPack`, {
                                                            required: 'Required',
                                                            valueAsNumber: true,
                                                            min: { value: 0, message: 'Min 0' },
                                                        })}
                                                    />
                                                    <FieldError className="text-xs" errors={[qtyError]} />
                                                </div>
                                            )}
                                        </TableCell>
                                    )
                                })}
                                {overviewQtyTiers.map((_, tierIndex) => {
                                    const needed = packs.reduce((total, pack) => {
                                        const item = pack.items.find(
                                            (packItem) => packItem.componentId === component.id,
                                        )
                                        return total + (Number(pack.qty[tierIndex]?.qty) || 0)
                                            * (Number(item?.qtyPerPack) || 0)
                                    }, 0)

                                    return (
                                        <TableCell key={`${component.id}-${tierIndex}`}>
                                            <span className="font-semibold">{needed}</span>
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

        </div>
    )
}

export default Packs
