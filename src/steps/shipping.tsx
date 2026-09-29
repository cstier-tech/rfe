import { useFormContext, Controller, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import type { FormValues } from '@/lib/form'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

const SHIP_METHODS = ['Drop Ship', 'Bulk Ship'] as const
const SHIP_METHODS_RADIO_OPTIONS = SHIP_METHODS.map((option) => ({
    label: option,
    value: option,
}))

function Shipping() {
    const {
        register,
        control,
        unregister,
        formState: { errors },
    } = useFormContext<FormValues>()

    const asnRequired = useWatch({ control, name: 'asnRequired' })
    const internationalShipment = useWatch({
        control,
        name: 'internationalShipment',
    })
    const overviewQtyTiers = useWatch({ control, name: 'qty' }) ?? []
    const multipleTiers = overviewQtyTiers.length > 1
    return (
        <div className="flex flex-col gap-4">
            <div className='flex flex-col gap-1.5'>
                <span>{multipleTiers ? 'Total # of Shipments per Unit Tier *' : 'Total # of Shipments *'}</span>
                {/* Inline style since Tailwind can't generate a dynamic grid-cols-N class. */}
                <div
                    className='grid gap-2'
                    style={{ gridTemplateColumns: `repeat(${Math.max(overviewQtyTiers.length, 1)}, minmax(0, 1fr))` }}
                >
                    {overviewQtyTiers.map((tier, tierIndex) => {
                        const inputProps = {
                            id: `totalShipments-${tierIndex}`,
                            type: 'number',
                            ...register(`totalShipments.${tierIndex}`, {
                                required: 'Total Number of Shipments is required',
                                valueAsNumber: true,
                                min: { value: 1, message: 'Must be at least 1' },
                            }),
                        }
                        return (
                            <Field name={`totalShipments.${tierIndex}`} key={tierIndex}>
                                {multipleTiers
                                    ? <InputGroup>
                                        <InputGroupInput {...inputProps} />
                                        <InputGroupAddon className='text-xs' align='inline-end'>@ {tier ?? '—'}</InputGroupAddon>
                                    </InputGroup>
                                    : <Input {...inputProps} />}
                                <FieldError errors={[errors.totalShipments?.[tierIndex]]} />
                            </Field>
                        )
                    })}
                </div>
            </div>


            <Field name="labelInstructions" >
                <FieldLabel htmlFor="labelInstructions">
                    Labeling Instructions
                </FieldLabel>
                <Textarea
                    id="labelInstructions"
                    {...register('labelInstructions', {
                    })}
                />
                <FieldError errors={[errors.labelInstructions]} />
            </Field>



            <div className="flex flex-col gap-3">
                <Controller
                    control={control}
                    name="asnRequired"
                    defaultValue={false}
                    render={({ field }) => (
                        <Field orientation="horizontal">
                            <Checkbox
                                id="asnRequired"
                                checked={!!field.value}
                                onCheckedChange={(v) => {
                                    field.onChange(v === true)
                                    // Clear + unregister (rather than
                                    // shouldUnregister on the input itself)
                                    // so unchecking drops the stale value,
                                    // but simply navigating to another step
                                    // and back — which also unmounts this
                                    // input — does not.
                                    if (v !== true) unregister('asnInstructions')
                                }}
                            />
                            <FieldLabel htmlFor="asnRequired">
                                Advanced Shipping Notice (ASN) Required
                            </FieldLabel>
                        </Field>
                    )}
                />

                {asnRequired && (
                    <Field name="asnInstructions">
                        <FieldLabel htmlFor="asnInstructions">
                            ASN Instructions *
                        </FieldLabel>
                        <Textarea
                            id="asnInstructions"
                            {...register('asnInstructions', {
                                required: 'ASN Instructions are required',
                            })}
                        />
                        <FieldError errors={[errors.asnInstructions]} />
                    </Field>
                )}

                <Controller
                    control={control}
                    name="approvalNeededPriorToShip"
                    defaultValue={false}
                    render={({ field }) => (
                        <Field orientation="horizontal">
                            <Checkbox
                                id="approvalNeededPriorToShip"
                                checked={!!field.value}
                                onCheckedChange={(v) =>
                                    field.onChange(v === true)
                                }
                            />
                            <FieldLabel htmlFor="approvalNeededPriorToShip">
                                Is Approval Needed Prior to Ship?
                            </FieldLabel>
                        </Field>
                    )}
                />

                <Controller
                    control={control}
                    name="internationalShipment"
                    defaultValue={false}
                    render={({ field }) => (
                        <Field orientation="horizontal">
                            <Checkbox
                                id="internationalShipment"
                                checked={!!field.value}
                                onCheckedChange={(v) => {
                                    field.onChange(v === true)
                                    // See the asnRequired checkbox above for
                                    // why this is an explicit unregister
                                    // rather than shouldUnregister.
                                    if (v !== true) {
                                        unregister([
                                            'usnpcCode',
                                            'customsValue',
                                            'customsDescription',
                                        ])
                                    }
                                }}
                            />
                            <FieldLabel htmlFor="internationalShipment">
                                International Shipment?
                            </FieldLabel>
                        </Field>
                    )}
                />

                {internationalShipment && (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-4">
                            <Field name="usnpcCode">
                                <FieldLabel htmlFor="usnpcCode">
                                    USNPC Code *
                                </FieldLabel>
                                <Input
                                    id="usnpcCode"
                                    {...register('usnpcCode', {
                                        required: 'USNPC Code is required',
                                    })}
                                />
                                <FieldError errors={[errors.usnpcCode]} />
                            </Field>
                            <Field name="customsValue">
                                <FieldLabel htmlFor="customsValue">
                                    Customs Value *
                                </FieldLabel>
                                <Input
                                    id="customsValue"
                                    {...register('customsValue', {
                                        required: 'Customs Value is required',
                                    })}
                                />
                                <FieldError errors={[errors.customsValue]} />
                            </Field>
                        </div>
                        <Field name="customsDescription">
                            <FieldLabel htmlFor="customsDescription">
                                Customs Description *
                            </FieldLabel>
                            <Textarea
                                id="customsDescription"
                                {...register('customsDescription', {
                                    required: 'Customs Description is required',
                                })}
                            />
                            <FieldError errors={[errors.customsDescription]} />
                        </Field>
                    </div>
                )}
                <RadioButtonGroup
                    control={control}
                    name="shipMethod"
                    legend="Shipment Method *"
                    options={SHIP_METHODS_RADIO_OPTIONS}
                    rules={{ required: 'Select a shipment method' }}
                />
            </div>
        </div>
    )
}

export default Shipping
