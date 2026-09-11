import { cn } from "cn"
import { Controller } from "react-hook-form"
import type {
    Control,
    FieldPath,
    FieldValues,
    RegisterOptions,
} from "react-hook-form"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"

export type RadioButtonOption = {
    label: string
    value: string
}

type RadioButtonGroupProps<
    TFieldValues extends FieldValues,
    TName extends FieldPath<TFieldValues>,
> = {
    control: Control<TFieldValues>
    name: TName
    legend: string
    options: RadioButtonOption[]
    /** Passed through to Controller, e.g. `{ required: 'Select yes or no' }`. */
    rules?: RegisterOptions<TFieldValues, TName>
    /** Called with the new value in addition to updating the field, for side effects like clearing a dependent field. */
    onValueChange?: (value: string) => void
    className?: string
}

/** A row of pill-style radio buttons wrapped in a FieldSet + legend, matching
 * the "Is kitting required?" styling. Fully controlled via RHF's Controller. */
function RadioButtonGroup<
    TFieldValues extends FieldValues,
    TName extends FieldPath<TFieldValues>,
>({
    control,
    name,
    legend,
    options,
    rules,
    onValueChange,
    className,
}: RadioButtonGroupProps<TFieldValues, TName>) {
    return (
        <FieldSet>
            <FieldLegend>{legend}</FieldLegend>
            <Controller
                control={control}
                name={name}
                rules={rules}
                render={({ field, fieldState }) => (
                    <>
                        <RadioGroup
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                                field.onChange(value)
                                onValueChange?.(value)
                            }}
                            className={cn("flex gap-2", className)}
                        >
                            {options.map((option) => {
                                const id = `${name}-${option.value}`
                                return (
                                    <Field
                                        key={option.value}
                                        orientation="radiobutton"
                                    >
                                        <FieldLabel
                                            htmlFor={id}
                                            className="py-2 pl-3 cursor-pointer"
                                        >
                                            {option.label}
                                        </FieldLabel>
                                        <RadioGroupItem
                                            value={option.value}
                                            id={id}
                                        />
                                    </Field>
                                )
                            })}
                        </RadioGroup>
                        <FieldError errors={[fieldState.error]} />
                    </>
                )}
            />
        </FieldSet>
    )
}

export { RadioButtonGroup }
