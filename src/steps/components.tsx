import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon, GripVerticalIcon, X, Plus } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { ChevronRightIcon } from 'lucide-react'
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
    useFormContext,
    useFieldArray,
    useWatch,
    type FieldArrayWithId,
} from 'react-hook-form'
import type { FormValues } from '@/lib/form'
import { Textarea } from '@/components/ui/textarea'

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
    { label: 'Packing Materials', value: 'Packing Materials' },
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
    children: React.ReactNode,
}) {
    // const watchedComponent = useWatch({ control, name: `components.${index}` })
    //     const displayName = watchedComponent?.name?.trim() || `Component ${index + 1}`
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
                <CollapsibleContent className="flex flex-col gap-4 p-3 pt-0">
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
            <div className="flex flex-col gap-4 p-3 pt-0">
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
    const fieldErrors = errors.components?.[index]
    const hasErrors = !!fieldErrors && Object.keys(fieldErrors).length > 0
    const displayName = watchedComponent?.name?.trim() || "unnamed component"
    const collapsible = true


    return (
        <CardShell
            dragEnabled={dragEnabled}
            field={field}
            index={index}
            collapsible={collapsible}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            header={() => collapsible
                && (<div className='flex justify-between w-full items-center'>
                    {/* <Button
                        ref={handleRef}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={`cursor-grab touch-none opacity-50 active:cursor-grabbing ${dragEnabled ? '' : 'hidden'
                            }`}
                        tabIndex={dragEnabled ? 0 : -1}
                        aria-hidden={!dragEnabled}
                        aria-label="Drag to reorder"
                    >
                        <GripVerticalIcon />
                    </Button> */}
                    <CollapsibleTrigger
                        className={`flex flex-1 items-center gap-2 text-left text-sm font-medium cursor-pointer [&[data-state=open]>svg]:rotate-90 ${hasErrors ? 'text-destructive' : ''
                            }`}
                    >
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform" />

                        <span className={`truncate font-semibold ${!watchedComponent?.name && "text-gray-500/50"}`}>{displayName}</span>

                    </CollapsibleTrigger>

                    {/* {kittingRequired === 'Yes' && */}

                    <Button
                        // className={`${dragEnabled ? '' : 'hidden'}`}
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(index)}
                    >
                        Remove
                    </Button>

                    {/* } */}
                    {/* Always mounted (even when disabled) so dnd-kit attaches its
                    drag-activator role/ARIA attributes to this handle from
                    the start, rather than briefly to the whole card and
                    leaving them stranded there once a handle appears. */}

                </div>)

            }
        >
            {<>
                <input
                    type="hidden"
                    {...register(`components.${index}.id`)}
                />
                <div className='flex gap-4'>
                    <Field name={`components.${index}.name`}>
                        <FieldLabel htmlFor={`components.${index}.name`}>
                            Name or Description *
                        </FieldLabel>
                        <Input
                            id={`components.${index}.name`}
                            {...register(`components.${index}.name`, {
                                required: 'Name is required',
                            })}
                        />
                        <FieldError errors={[fieldErrors?.name]} />
                    </Field>
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

                    <Field name={`components.${index}.otherType`} className='max-w-64'>
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
                        <div className='grid grid-cols-4 gap-4'>
                            <Field name={`components.${index}.finalSize`}>
                                <FieldLabel htmlFor={`components.${index}.finalSize`}>
                                    Finished Size
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.finalSize`}
                                    {...register(`components.${index}.finalSize`)}
                                />
                                <FieldError errors={[fieldErrors?.finalSize]} />
                            </Field>

                            <Field name={`components.${index}.flatSize`}>
                                <FieldLabel htmlFor={`components.${index}.flatSize`}>
                                    Flat Size
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.flatSize`}
                                    {...register(`components.${index}.flatSize`)}
                                />
                                <FieldError errors={[fieldErrors?.flatSize]} />
                            </Field>

                            <Field name={`components.${index}.stock`}>
                                <FieldLabel htmlFor={`components.${index}.stock`}>
                                    Stock
                                </FieldLabel>
                                <Input
                                    id={`components.${index}.stock`}
                                    {...register(`components.${index}.stock`)}
                                />
                                <FieldError errors={[fieldErrors?.stock]} />
                            </Field>

                            <Field name={`components.${index}.coating`}>
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
                    <Field name={`components.${index}.sourceJobNumber`} className='max-w-64'>
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

                <Field name={`components.${index}.instruction`} className=''>
                    <FieldLabel
                        htmlFor={`components.${index}.instruction`}
                    >
                        Additional Info (optional)
                    </FieldLabel>

                    <Textarea
                        id={`components.${index}.instruction`}
                        {...register(
                            `components.${index}.instruction`,
                        )}
                    />
                    <FieldError errors={[fieldErrors?.instruction]} />
                </Field>


            </>}
        </CardShell>
    )
}

function Components() {
    const { control } = useFormContext<FormValues>()

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'components',
    })

    // Which card is expanded. Only one at a time; null means all collapsed.
    // const [openKey, setOpenKey] = useState<string | null>(
    //     () => fields[0]?.id ?? null,
    // )

    const [openKeys, setOpenKeys] = useState<Set<string>>(
        () => new Set(fields.length === 1 ? [fields[0].id] : []),
    )


    // When a card is added, open it (and collapse the others).
    const prevLen = useRef(fields.length)
    useEffect(() => {
        if (fields.length > prevLen.current) {
            // setOpenKey(fields[fields.length - 1]?.id ?? null)
            const newField = fields[fields.length - 1]
            if (newField) {
                setOpenKeys((prev) => new Set(prev).add(newField.id))
            }
        }
        prevLen.current = fields.length
    }, [fields])

    const dragEnabled = fields.length > 1

    return (
        <div className="flex flex-col gap-4">
            {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">No components yet.</p>
            )}

            {/* <DragDropProvider
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
            > */}
            {fields.map((field, index) => (
                <ComponentCard
                    key={field.id}
                    field={field}
                    index={index}
                    dragEnabled={dragEnabled}
                    isOpen={openKeys.has(field.id)}
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
                    remove={remove}
                />
            ))}
            {/* </DragDropProvider> */}

            {/* {kittingRequired === 'Yes' && */}
            <Button
                type="button"
                variant="outline"
                size='sm'
                className='w-auto self-start'
                onClick={() =>
                    append({
                        id: crypto.randomUUID(),
                        name: '',
                        finalSize: '',
                        flatSize: '',
                        stock: '',
                        coating: '',
                        source: '',
                        sourceJobNumber: '',
                        instruction: '',
                        type: '',
                        otherType: '',
                    })
                }
            >
                <Plus />
                Add component
            </Button>
            {/* // } */}


        </div>
    )
}

export default Components
