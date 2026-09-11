import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@/components/ui/collapsible'
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form'
import type { FormValues } from '@/lib/form'

const SOURCE_OPTIONS = [
    'LCP Production',
    'Customer Supplied',
    'Veracore Inventory',
] as const

const SOURCE_RADIO_OPTIONS = SOURCE_OPTIONS.map((option) => ({
    label: option,
    value: option,
}))

function Components() {
    const {
        register,
        control,
        setValue,
        formState: { errors },
    } = useFormContext<FormValues>()

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'components',
    })

    // Live values (useFieldArray's `fields` doesn't update as the user types).
    const watched = useWatch({ control, name: 'components' })

    const kittingRequired = useWatch({ control, name: 'kittingRequired' })
    const qtyLabel = kittingRequired === 'Yes' ? 'Qty per kit' : 'Qty'

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

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No components yet.</p>
            )}

            {fields.map((field, index) => {
                const fieldErrors = errors.components?.[index]
                const hasErrors =
                    !!fieldErrors && Object.keys(fieldErrors).length > 0
                const displayName =
                    watched?.[index]?.name?.trim() || `Component ${index + 1}`

                return (
                    <Collapsible
                        key={field.id}
                        open={openKey === field.id}
                        onOpenChange={(open) =>
                            setOpenKey(open ? field.id : null)
                        }
                        className="rounded-lg border border-border bg-gray-50"
                    >
                        <div className="flex items-center justify-between gap-2 p-3">
                            <CollapsibleTrigger
                                className={`flex flex-1 items-center gap-2 text-left text-sm font-medium [&[data-state=open]>svg]:rotate-90 ${
                                    hasErrors ? 'text-destructive' : ''
                                }`}
                            >
                                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform" />
                                <span className="truncate">{displayName}</span>
                            </CollapsibleTrigger>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                            >
                                Remove
                            </Button>
                        </div>

                        <CollapsibleContent className="flex flex-col gap-2 p-3 pt-0">
                            <input
                                type="hidden"
                                {...register(`components.${index}.id`)}
                            />
                            <div className='flex gap-4'>
                                <Field>
                                    <FieldLabel htmlFor={`components.${index}.name`}>
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id={`components.${index}.name`}
                                        {...register(`components.${index}.name`, {
                                            required: 'Name is required',
                                        })}
                                    />
                                    <FieldError errors={[fieldErrors?.name]} />
                                </Field>
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
                            </div>

                            <div className='flex gap-4'>
                                <Field>
                                    <FieldLabel htmlFor={`components.${index}.finalSize`}>
                                        Final Size
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

                            <RadioButtonGroup
                                control={control}
                                name={`components.${index}.source`}
                                legend="Source"
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

                            {watched?.[index]?.source === 'LCP Production' && (
                                <Field className='max-w-64'>
                                    <FieldLabel
                                        htmlFor={`components.${index}.sourceJobNumber`}
                                    >
                                        Job Number
                                    </FieldLabel>
                                    <Input
                                        id={`components.${index}.sourceJobNumber`}
                                        {...register(
                                            `components.${index}.sourceJobNumber`,
                                        )}
                                    />
                                </Field>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                )
            })}

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
                    })
                }
            >
                Add component
            </Button>
        </div>
    )
}

export default Components
