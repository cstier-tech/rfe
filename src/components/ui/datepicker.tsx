"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

function formatDate(date: Date | undefined) {
    if (!date) {
        return ""
    }

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function isValidDate(date: Date | undefined) {
    if (!date) {
        return false
    }
    return !isNaN(date.getTime())
}

type DatePickerInputProps = {
    label?: string
    id?: string
    /** Currently selected date. */
    value?: Date
    /** Called with the new date (or undefined when cleared). */
    onChange?: (date: Date | undefined) => void
    /** Validation error to show under the input. */
    error?: { message?: string }
}

export function DatePickerInput({
    label = "Date",
    id = "date-required",
    value,
    onChange,
    error,
}: DatePickerInputProps) {
    const [open, setOpen] = React.useState(false)
    const [month, setMonth] = React.useState<Date | undefined>(value)
    // Free-typed text is local; the parsed Date is lifted via onChange.
    const [text, setText] = React.useState(formatDate(value))

    return (
        <Field className="w-full">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
                <InputGroupInput
                    id={id}
                    value={text}
                    placeholder="June 01, 2025"
                    onChange={(e) => {
                        setText(e.target.value)
                        if (e.target.value === "") {
                            onChange?.(undefined)
                            return
                        }
                        const parsed = new Date(e.target.value)
                        if (isValidDate(parsed)) {
                            setMonth(parsed)
                            onChange?.(parsed)
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setOpen(true)
                        }
                    }}
                />
                <InputGroupAddon align="inline-end">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <InputGroupButton
                                id="date-picker"
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Select date"
                            >
                                <CalendarIcon />
                                <span className="sr-only">Select date</span>
                            </InputGroupButton>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="end"
                            alignOffset={-8}
                            sideOffset={10}
                        >
                            <Calendar
                                mode="single"
                                selected={value}
                                month={month}
                                onMonthChange={setMonth}
                                onSelect={(next) => {
                                    onChange?.(next)
                                    setText(formatDate(next))
                                    setOpen(false)
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[error]} />
        </Field>
    )
}
