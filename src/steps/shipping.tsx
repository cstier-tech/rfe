import { useFormContext, Controller, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioButtonGroup } from '@/components/ui/radio-button-group'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { hasOverage, type FormValues } from '@/lib/form'

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
        getValues,
        formState: { errors },
    } = useFormContext<FormValues>()

    const asnRequired = useWatch({ control, name: 'asnRequired' })
    const internationalShipment = useWatch({
        control,
        name: 'internationalShipment',
    })
    const qtyTiers = useWatch({ control, name: 'qty' }) ?? []
    const shipments = useWatch({ control, name: 'totalShipments' }) ?? []
    const multipleTiers = qtyTiers.length > 1
    const tierSuffix = (tier: number | undefined) => (multipleTiers ? ` @ qty ${tier ?? 0}` : '')

    const overageTiers = qtyTiers
        .map((tier, tierIndex) => ({ tier, tierIndex }))
        .filter(({ tier, tierIndex }) => hasOverage(shipments[tierIndex], tier))

    return (
        <div className="flex flex-col gap-4">
            {/* One shipments field per overview qty tier. */}
            <div className="flex flex-col gap-2">
                <FieldLabel>Total Number of Shipments *</FieldLabel>
                <div className="flex flex-wrap items-start gap-4">
                    {qtyTiers.map((tier, tierIndex) => {
                        const fieldName = `totalShipments.${tierIndex}.qty` as const
                        return (
                            <Field key={fieldName} name={fieldName} className="w-auto">
                                {multipleTiers && (
                                    <label htmlFor={fieldName} className="text-sm text-muted-foreground">
                                        Shipments @ qty {tier ?? 0}
                                    </label>
                                )}
                                <Input
                                    id={fieldName}
                                    type="number"
                                    className="w-32"
                                    aria-label={`Total Number of Shipments${tierSuffix(tier)}`}
                                    // Defaults to the tier's qty. RHF reads this
                                    // into the form value on register when the
                                    // field is still blank; saved or entered
                                    // values take precedence.
                                    defaultValue={getValues(fieldName) ?? tier}
                                    {...register(fieldName, {
                                        required: 'Total Number of Shipments is required',
                                        valueAsNumber: true,
                                        min: { value: 1, message: 'Must be at least 1' },
                                    })}
                                />
                                <FieldError errors={[errors.totalShipments?.[tierIndex]?.qty]} />
                            </Field>
                        )
                    })}
                </div>
            </div>

            {/* An overage field for each tier whose shipments fall short of its qty.
                A hidden field keeps its value (in case the shipments go back
                down), but it isn't validated, and it's dropped on submit. */}
            {overageTiers.length > 0 && (
                <div className="flex flex-col gap-3">
                    {overageTiers.map(({ tier, tierIndex }) => {
                        const fieldName = `totalShipments.${tierIndex}.overageAction` as const
                        return (
                            <Field key={fieldName} name={fieldName}>
                                <FieldLabel htmlFor={fieldName}>
                                    What to do with the overage?{tierSuffix(tier)} *
                                </FieldLabel>
                                <Textarea
                                    id={fieldName}
                                    {...register(fieldName, {
                                        required: 'Overage instructions are required',
                                    })}
                                />
                                <FieldError errors={[errors.totalShipments?.[tierIndex]?.overageAction]} />
                            </Field>
                        )
                    })}
                </div>
            )}

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
