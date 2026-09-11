import { useFormContext, Controller, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import type { FormValues } from '@/lib/form'

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
    return (
        <div className="flex flex-col gap-4">
            <Field className="max-w-64">
                <FieldLabel htmlFor="totalShipments">
                    Total Number of Shipments
                </FieldLabel>
                <Input
                    id="totalShipments"
                    type="number"
                    {...register('totalShipments', {
                        required: 'Total Number of Shipments is required',
                        valueAsNumber: true,
                        min: { value: 1, message: 'Must be at least 1' },
                    })}
                />
                <FieldError errors={[errors.totalShipments]} />
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
                    <Field>
                        <FieldLabel htmlFor="asnInstructions">
                            ASN Instructions
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
                            <Field>
                                <FieldLabel htmlFor="usnpcCode">
                                    USNPC Code
                                </FieldLabel>
                                <Input
                                    id="usnpcCode"
                                    {...register('usnpcCode', {
                                        required: 'USNPC Code is required',
                                    })}
                                />
                                <FieldError errors={[errors.usnpcCode]} />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="customsValue">
                                    Customs Value
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
                        <Field>
                            <FieldLabel htmlFor="customsDescription">
                                Customs Description
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
                    legend="Shipment Method"
                    options={SHIP_METHODS_RADIO_OPTIONS}
                    rules={{ required: 'Select a shipment method' }}
                />
            </div>
        </div>
    )
}

export default Shipping
