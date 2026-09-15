import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
    Field,
    FieldLabel,
    FieldError,
    FieldLegend,
    FieldSet,
    FieldDescription,
} from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { DatePickerInput } from '@/components/ui/datepicker'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useFormContext, Controller, useWatch, useFieldArray } from 'react-hook-form'
import type { FormValues } from '@/lib/form'

const kittingRequiredOptions = [
    { label: 'No', value: 'No' },
    { label: 'Yes', value: 'Yes' }
]

function Overview() {
    const {
        register,
        control,
        formState: { errors },
    } = useFormContext<FormValues>()

    const jobType = useWatch({
        control,
        name: 'jobType',
        defaultValue: 'New Job',
    })

    const kittingRequired = useWatch({ control, name: 'kittingRequired' })

    const {
        fields: qtyFields,
        append: appendQty,
        remove: removeQty,
    } = useFieldArray({ control, name: 'qty' })

    // Live values, used to detect qty edits and to check which components
    // (if any) have manually overridden quantities.
    const watchedQty = useWatch({ control, name: 'qty' })
    const watchedComponents = useWatch({ control, name: 'components' })

    const [reviewNames, setReviewNames] = useState<string[]>([])
    const prevQtySerialized = useRef<string | null>(null)

    // Whenever the overview quantities change (an edit, or a tier added or
    // removed), components that were never manually overridden should just
    // pick up the new values automatically (they already do, since their
    // displayed qty falls back to these tiers). Components that do have an
    // override won't update on their own, so flag them for the user to
    // review instead of silently going stale.
    useEffect(() => {
        const serialized = JSON.stringify(
            (watchedQty ?? []).map((tier) => tier?.qty ?? null),
        )

        if (prevQtySerialized.current === null) {
            prevQtySerialized.current = serialized
            return
        }

        if (serialized === prevQtySerialized.current) return
        prevQtySerialized.current = serialized

        const overriddenNames = (watchedComponents ?? [])
            .map(
                (component, index) =>
                    [
                        component?.name?.trim() || `Component ${index + 1}`,
                        component?.qtyOverrides?.some((v) => v != null) ?? false,
                    ] as const,
            )
            .filter(([, hasOverride]) => hasOverride)
            .map(([name]) => name)

        if (overriddenNames.length > 0) {
            setReviewNames(overriddenNames)
        }
    }, [watchedQty, watchedComponents])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4">
                <Field className='w-full'>
                    <FieldLabel htmlFor="name">RFE Name *</FieldLabel>
                    <Input

                        id="name"
                        {...register('name', { required: 'Name is required' })}
                    />
                    <FieldError errors={[errors.name]} />
                </Field>
                <Controller
                    control={control}
                    name="dueDate"
                    rules={{ required: 'Due date is required' }}
                    render={({ field, fieldState }) => (
                        <DatePickerInput
                            id="dueDate"
                            label="Requested Due Date *"
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldState.error}
                        />
                    )}
                />
            </div>

            <div className='flex gap-4'>
                <Field className='w-full'>
                    <FieldLabel>Customer</FieldLabel>
                    <Input
                        id='customer'
                        {...register('customer')}
                    />
                </Field>
                <Field className='w-full'>
                    <FieldLabel>Customer Number</FieldLabel>
                    <Input
                        id='customerNumber'
                        {...register('customerNumber')}
                    />
                </Field>
                <Field className='w-full'>
                    <FieldLabel>Sales Rep</FieldLabel>
                    <Input
                        id='salesRep'
                        {...register('salesRep')}
                    />
                </Field>
            </div>
            <FieldSet>
                <FieldLegend>Job Type</FieldLegend>
                <Controller
                    control={control}
                    name='jobType'
                    defaultValue='New Job'
                    render={({ field }) => (
                        <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                        >
                            <Field orientation="horizontal">
                                <RadioGroupItem value='New Job' id='new-job' />
                                <FieldLabel htmlFor='new-job'>New Job</FieldLabel>
                            </Field>
                            <Field orientation="horizontal">
                                <RadioGroupItem value='Reprint - no changes' id='reprint-no-change' />
                                <FieldLabel htmlFor='reprint-no-change'>Reprint - no changes</FieldLabel>
                            </Field>
                            <Field orientation="horizontal">
                                <RadioGroupItem value='Reprint - with changes' id='reprint-with-change' />
                                <FieldLabel htmlFor='reprint-with-change'>Reprint - with changes</FieldLabel>
                            </Field>
                            <Field orientation="horizontal">
                                <RadioGroupItem value='Quote Update' id='quote-update' />
                                <FieldLabel htmlFor='quote-update'>Quote Update</FieldLabel>
                            </Field>
                        </RadioGroup>
                    )}
                />
            </FieldSet>

            {jobType !== 'New Job' &&
                <div className='flex gap-4'>
                    <Field className='w-full'>
                        <FieldLabel htmlFor='prevJobNumber'>
                            Previous Job Number
                        </FieldLabel>
                        <Input
                            id='prevJobNumber'
                            {...register('prevJobNumber')}
                        />
                    </Field>
                    {jobType !== 'Reprint - no changes' &&
                        <Field className='w-full'>
                            <FieldLabel htmlFor='changesFromPrev'>
                                Changes from previous job
                            </FieldLabel>
                            <Input
                                id='changesFromPrev'
                                {...register('changesFromPrev')}
                            />
                        </Field>
                    }
                </div>
            }
            <RadioButtonGroup
                control={control}
                name='kittingRequired'
                legend='Is kitting required? *'
                options={kittingRequiredOptions}
                rules={{ required: 'Select yes or no' }}
            />

            {kittingRequired && (
                <Field>
                    <FieldLabel>
                        {kittingRequired === 'Yes'
                            ? 'How many kits? *'
                            : 'How many units? *'}
                    </FieldLabel>
                    <FieldDescription>
                        If you need this job estimated at different quantities,
                        add all of them using the Add qty button.
                    </FieldDescription>
                    <div className='flex flex-col gap-2'>
                        {qtyFields.length === 0 && (
                            <p className='text-sm text-muted-foreground'>
                                No quantities yet.
                            </p>
                        )}
                        {qtyFields.map((qtyField, index) => (
                            <div
                                key={qtyField.id}
                                className='flex items-start gap-2'
                            >
                                <div className='flex flex-col gap-1'>
                                    <Input
                                        type='number'
                                        className='w-32'
                                        aria-label={`Quantity ${index + 1}`}
                                        {...register(`qty.${index}.qty`, {
                                            required: 'Required',
                                            valueAsNumber: true,
                                            min: { value: 1, message: 'Min 1' },
                                        })}
                                    />
                                    <FieldError
                                        className='text-xs'
                                        errors={[errors.qty?.[index]?.qty]}
                                    />
                                </div>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => removeQty(index)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='self-start'
                            onClick={() => appendQty({})}
                        >
                            Add qty
                        </Button>
                    </div>
                </Field>
            )}

            <AlertDialog
                open={reviewNames.length > 0}
                onOpenChange={(open) => {
                    if (!open) setReviewNames([])
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Review quantity overrides</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please review the quantity overrides for{' '}
                            {reviewNames.join(', ')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setReviewNames([])}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

    )
}

export default Overview
