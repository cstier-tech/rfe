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
import { useFormContext, Controller, useWatch } from 'react-hook-form'
import type { FormValues } from '@/lib/form'

// const kittingRequiredOptions = [
//     { label: 'No', value: 'No' },
//     { label: 'Yes', value: 'Yes' }
// ]

function Overview() {
    const {
        register,
        control,
        setValue,
        getValues,
        clearErrors,
        formState: { errors },
    } = useFormContext<FormValues>()

    const jobType = useWatch({
        control,
        name: 'jobType',
        defaultValue: 'New Job',
    })

    // `qty` is a flat number array, which useFieldArray doesn't support, so
    // tiers are added/removed by setting the whole array.
    const qtys = useWatch({ control, name: 'qty' }) ?? []
    const setQtys = (next: FormValues['qty']) => {
        setValue('qty', next, { shouldDirty: true })
        // Errors are index-keyed, so they'd no longer line up after a removal.
        clearErrors('qty')
    }

    return (
        <div className="flex flex-col gap-4">

            <div className="flex gap-4">
                <Field name="name" className='w-full'>
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
                            name="dueDate"
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
                <Field name="customer" className='w-full'>
                    <FieldLabel>Customer</FieldLabel>
                    <Input
                        id='customer'
                        {...register('customer')}
                    />
                </Field>
                <Field name="customerNumber" className='w-full'>
                    <FieldLabel>Customer Number</FieldLabel>
                    <Input
                        id='customerNumber'
                        {...register('customerNumber')}
                    />
                </Field>
                <Field name="salesRep" className='w-full'>
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
                    <Field name="prevJobNumber" className='w-full'>
                        <FieldLabel htmlFor='prevJobNumber'>
                            Previous Job Number
                        </FieldLabel>
                        <Input
                            id='prevJobNumber'
                            {...register('prevJobNumber')}
                        />
                    </Field>
                    {jobType !== 'Reprint - no changes' &&
                        <Field name="changesFromPrev" className='w-full'>
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
            {/* <RadioButtonGroup
                control={control}
                name='kittingRequired'
                legend='Is packout (kitting) required? *'
                options={kittingRequiredOptions}
                rules={{ required: 'Select yes or no' }}
            /> */}

            {/* {kittingRequired && ( */}
            <Field>
                <FieldLabel>
                    {/* {kittingRequired === 'Yes'
                            ? 'How many assembled units? *'
                            : 'How many units? *'} */}
                    How many finished units?
                </FieldLabel>
                <FieldDescription>
                    If you need this job estimated at different quantities,
                    add all of them using the Add qty button.
                </FieldDescription>
                <div className='flex flex-col gap-2'>
                    {qtys.length === 0 && (
                        <p className='text-sm text-muted-foreground'>
                            No quantities yet.
                        </p>
                    )}
                    {qtys.map((_, index) => (
                        <div
                            key={index}
                            className='flex items-start gap-2'
                        >
                            <div className='flex flex-col gap-1'>
                                <Input
                                    type='number'
                                    className='w-32 aria-[invalid=true]:bg-red-50 aria-[invalid=true]:border-destructive'
                                    aria-label={`Quantity ${index + 1}`}
                                    {...register(`qty.${index}`, {
                                        required: 'Required',
                                        valueAsNumber: true,
                                        min: { value: 1, message: 'Min 1' },
                                    })}
                                    aria-invalid={
                                        errors.qty?.[index]
                                            ? 'true'
                                            : undefined
                                    }
                                />
                                <FieldError
                                    className='text-xs'
                                    errors={[errors.qty?.[index]]}
                                />
                            </div>
                            {index > 0 &&
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => {
                                        setQtys(qtys.filter((_, i) => i !== index))
                                        // Keep per-tier shipment counts lined up with the remaining tiers.
                                        setValue(
                                            'totalShipments',
                                            (getValues('totalShipments') ?? []).filter((_, i) => i !== index),
                                        )
                                    }}
                                >
                                    Remove
                                </Button>
                            }

                        </div>
                    ))}
                    {qtys.length < 5 && (
                        <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='self-start'
                        onClick={() => setQtys([...qtys, undefined])}
                    >
                        Add qty
                    </Button>
                    )}
                    
                </div>
            </Field>
            {/* )} */}

        </div>

    )
}

export default Overview
