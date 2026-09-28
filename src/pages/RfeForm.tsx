import { useEffect, useState, type ReactNode } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { derivePackoutQtys, type ComponentSource, type FormValues } from '@/lib/form'
import { loadRfe } from '@/lib/loadRfe'
import { supabase } from '@/lib/supabase'

import Overview from '../steps/overview'
import Components from '../steps/components'
import Packouts, { PACK_TYPES } from '../steps/packout'
import Shipping from '../steps/shipping'

type Step = {
  title: string
  description: string
  Component: () => ReactNode
  fields: (keyof FormValues)[]
  isVisible?: (values: FormValues) => boolean

}

const STEPS: Step[] = [
  {
    title: 'Request for Estimate',
    description: 'Fill out the information required to recieve an estimate. ',
    Component: Overview,
    fields: [
      'name',
      'dueDate',
      'customer',
      'customerNumber',
      'salesRep',
      'jobType',
      'prevJobNumber',
      // 'kittingRequired',
      'qty',
    ],
  },
  {
    title: 'Components',
    description: 'List out the individual components for this job.',
    Component: Components,
    fields: ['components'],
  },
  {
    title: 'Kit Assembly & Packing',
    description: 'How will the components in this job be assembled together?',
    Component: Packouts,
    fields: ['packouts'],
    // isVisible: (values) => values.components.length > 1,
  },
  {
    title: 'Shipping',
    description: 'Basic shipping details.',
    Component: Shipping,
    fields: [
      'totalShipments',
      'labelInstructions',
      'shipMethod',
      'asnRequired',
      'asnInstructions',
      'approvalNeededPriorToShip',
      'internationalShipment',
      'usnpcCode',
      'customsValue',
      'customsDescription',
    ],
  },
]

const defaultComponent = () => ({
  id: crypto.randomUUID(),
  name: '',
  finalSize: '',
  flatSize: '',
  stock: '',
  coating: '',
  source: '' as ComponentSource,
  sourceJobNumber: '',
  instruction: '',
  type: '',
  otherType: '',
})


const defaultPackout = () => ({
  id: crypto.randomUUID(),
  qty: [],
  kitItems: [],
  kitSteps: [],
  packType: '',
  cartonType: '',
})

// A fully-specified blank form, explicitly clearing every field rather than
// omitting fields and relying on reset() to clear whatever isn't listed —
// used both for the form's initial state and to wipe a stale edit/duplicate
// session when navigating to the plain "start a new RFE" route.
const blankFormValues = (): FormValues => ({
  rfeId: crypto.randomUUID(),
  versionId: crypto.randomUUID(),
  name: '',
  dueDate: undefined,
  customer: '',
  customerNumber: '',
  salesRep: '',
  jobType: 'New Job',
  prevJobNumber: '',
  changesFromPrev: '',
  description: '',
  // isKit: undefined,
  // kittingRequired: undefined,
  qty: [undefined],
  components: [defaultComponent()],
  // convenientCartons: false,
  packouts: [defaultPackout()],
  totalShipments: undefined,
  labelInstructions: undefined,
  shipMethod: undefined,
  asnRequired: false,
  asnInstructions: '',
  approvalNeededPriorToShip: false,
  internationalShipment: false,
  usnpcCode: '',
  customsValue: '',
  customsDescription: '',
})

function RfeForm() {
  // `mode` is 'edit' or 'duplicate'; `sourceRfeId` is the RFE either loads
  // data from. Editing reuses that RFE's id; duplicating loads the same data
  // but gets a brand new RFE id, since it isn't created until the user saves.
  const { rfeId: sourceRfeId, mode } = useParams<{
    rfeId: string
    mode: string
  }>()
  const isEditing = mode === 'edit'
  const isDuplicating = mode === 'duplicate'
  const navigate = useNavigate()

  const methods = useForm<FormValues>({
    // The wizard validates each step via `trigger()`, not `handleSubmit`, so
    // RHF's `isSubmitted` stays false until the last step. With the default
    // mode ('onSubmit'), errors only clear on the next trigger()/submit call,
    // not as the user fixes them. 'onChange' revalidates live instead.
    mode: 'onChange',
    defaultValues: {
      // A brand new RFE (including a duplicate — it isn't created until the
      // user saves) gets a fresh id. When editing, `rfeId` is the existing
      // RFE's id (from the route) so the new version links back to it; the
      // rest of the fields are filled in by the prefill effect below once
      // the source version loads. `versionId` always gets a fresh id —
      // every save (new, edit, or duplicate) creates a new version row.
      ...blankFormValues(),
      rfeId: isEditing && sourceRfeId ? sourceRfeId : crypto.randomUUID(),
    },
  })



  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(isEditing || isDuplicating)
  // A new submission (including a duplicate) always creates a new RFE row;
  // editing reuses the existing one and only adds a version.
  const isNewRfe = !isEditing

  useEffect(() => {
    // App.tsx keys RfeForm by route pathname, so the plain "start a new RFE"
    // route always gets a fresh mount (and thus fresh, blank state from
    // useForm's defaultValues) — nothing to load here.
    if (!sourceRfeId || (!isEditing && !isDuplicating)) return

    const loadFromSource = async () => {
      const loaded = await loadRfe(sourceRfeId)
      if (!loaded) {
        setLoading(false)
        return
      }
      const { values } = loaded

      // Every save inserts brand new Components rows for the new version, so
      // the loaded component ids can't be reused — remap them, and packout
      // items' references along with them.
      const componentIdMap = new Map(
        values.components.map((component) => [component.id, crypto.randomUUID()]),
      )

      // Derived qtys (kitItems[].qty, totalPacksQty, totalCartons) come along
      // as loaded but are always recomputed on submit, so they can't go stale.
      methods.reset({
        ...values,
        rfeId: isEditing ? sourceRfeId : crypto.randomUUID(),
        versionId: crypto.randomUUID(),
        name: isDuplicating ? `Copy of ${values.name}` : values.name,
        qty: values.qty.length > 0 ? values.qty : [undefined],
        components:
          values.components.length > 0
            ? values.components.map((component) => ({
                ...component,
                id: componentIdMap.get(component.id)!,
              }))
            : [defaultComponent()],
        packouts: values.packouts.map((packout) => {
          // Unknown saved pack types were entered via "Other" — unfold them.
          const isKnownPackType = packout.packType === '' || PACK_TYPES.includes(packout.packType)
          return {
            ...packout,
            kitItems: packout.kitItems.map((item) => ({
              ...item,
              componentId: componentIdMap.get(item.componentId) ?? item.componentId,
            })),
            packType: isKnownPackType ? packout.packType : 'Other',
            packTypeOther: isKnownPackType ? undefined : packout.packType,
          }
        }),
      })

      setLoading(false)
    }

    loadFromSource()
  }, [sourceRfeId, isEditing, isDuplicating, methods])

  const visibleSteps = STEPS.filter(
    (s) => !s.isVisible ||
      s.isVisible(methods.getValues()),
  )
  const step = visibleSteps[stepIndex]
  const StepComponent = step.Component
  const isFirst = stepIndex === 0
  const isLast = stepIndex === visibleSteps.length - 1




  const onSubmit = async (formData: FormValues) => {
    // What's saved is the form data plus its derived qtys, with the "Other"
    // pack type placeholder folded into `packType`.
    const componentNames = new Map(formData.components.map((c) => [c.id, c.name]))
    const data: FormValues = {
      ...formData,
      packouts: formData.packouts.map(({ packTypeOther, ...packout }) => {
        const derived = derivePackoutQtys(packout, formData.qty, formData.packouts.length > 1)
        return {
          ...packout,
          ...derived,
          // Refreshed here since components may have been renamed.
          kitItems: derived.kitItems.map((item) => ({
            ...item,
            componentName: componentNames.get(item.componentId) ?? '',
          })),
          packType: packout.packType === 'Other' ? (packTypeOther ?? '') : packout.packType,
        }
      }),
    }

    console.log(data)

    if (isNewRfe) {
      const { error: rfeError } = await supabase
        .from('RFEs')
        .insert({ id: data.rfeId })

      if (rfeError) {
        console.error(rfeError)
        return
      }
    }

    // Version numbers are per-rfe_id and increment by 1 each save, so look up
    // the highest one saved so far for this RFE (none yet for a new RFE).
    // Max is computed in JS rather than via `.order().limit(1)` because
    // existing rows have a null version_number, and Postgres sorts nulls
    // first in descending order by default — that would pick a null instead
    // of the actual highest number.
    const { data: existingVersions, error: existingVersionsError } =
      await supabase
        .from('RFE Versions')
        .select('version_number')
        .eq('rfe_id', data.rfeId)

    if (existingVersionsError) {
      console.error(existingVersionsError)
      return
    }

    const versionNumber =
      Math.max(0, ...existingVersions.map((v) => v.version_number ?? 0)) + 1

    const { error: versionError } = await supabase.from('RFE Versions').insert(
      {
        id: data.versionId,
        rfe_id: data.rfeId,
        version_number: versionNumber,
        rfe_name: data.name,
        customer_name: data.customer,
        customer_number: data.customerNumber,
        description: data.description,
        due_date: data.dueDate,
        sales_rep: data.salesRep,
        previous_job_number: data.prevJobNumber,
        // previous_estimate_number: data.,
        job_type: data.jobType,
        // service_types: data.,
        changes_from_prev: data.changesFromPrev,
        // version_type: data.,
        // kitting_required: data.kittingRequired,
        // convenient_cartons: data.convenientCartons,
        num_of_shipments: data.totalShipments,
        label_instructions: data.labelInstructions,
        asn_required: data.asnRequired,
        asn_instructions: data.asnInstructions,
        approval_required: data.approvalNeededPriorToShip,
        intl_shipment: data.internationalShipment,
        usnpc_code: data.usnpcCode,
        customs_value: data.customsValue,
        customs_description: data.customsDescription,
        ship_method: data.shipMethod,
      },
    )

    if (versionError) {
      console.error(versionError)
      return
    }

    const { error: componentsError } = await supabase.from('Components').insert(
      data.components.map((component, index) => ({
        id: component.id,
        component_name: component.name,
        version_id: data.versionId,
        final_size: component.finalSize,
        stock: component.stock,
        coating: component.coating,
        flat_size: component.flatSize,
        job_number: component.sourceJobNumber,
        source: component.source,
        sort_order: String(index),
        instruction: component.instruction,
        type: component.type,
        other_type: component.otherType,
      })),
    )

    if (componentsError) console.error(componentsError)

    // Each jsonb column holds the matching form field as-is.
    const { error: packoutsError } = await supabase.from('Packouts').insert(
      data.packouts.map((packout) => ({
        version_id: data.versionId,
        num_of_units: packout.qty,
        kit_build: packout.kitItems,
        pack_type: packout.packType,
        units_per_pack: packout.unitsPerPack,
        total_packs: packout.totalPacksQty,
        carton_type: packout.cartonType,
        custom_carton_source: packout.customCartonSource,
        packs_per_carton: packout.packsPerCarton ?? null,
        total_cartons: packout.totalCartons,
        // Blank steps are dropped and the rest renumbered from 1.
        kitting_steps: packout.kitSteps
          .map((step) => step.instruction.trim())
          .filter(Boolean)
          .map((instruction, index) => ({ step: index + 1, instruction })),
      })),
    )

    if (packoutsError) console.error(packoutsError)

    const { error: quantitiesError } = await supabase.from('RFE Quantities').insert(
      data.qty
        .filter((qty) => qty != null)
        .map((qty) => ({
          id: crypto.randomUUID(),
          version_id: data.versionId,
          quantity: qty,
        })),
    )

    if (quantitiesError) console.error(quantitiesError)

    navigate('/dashboard')
  }

  const next = async () => {
    // Only advance if the current step's fields pass validation.
    const valid = await methods.trigger(step.fields)
    if (valid) setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1))
  }

  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 bg-taupe-100">
        <p className="text-sm text-muted-foreground">Loading RFE…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-taupe-100">
      {/* <Preview getValues={methods.getValues}/>  */}

      <Card className="w-full p-3 max-w-2xl">
        <CardHeader>
          <CardTitle className='text-xl'>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
          <p className="text-sm text-muted-foreground">
            Step {stepIndex + 1} of {visibleSteps.length}
          </p>
        </CardHeader>
        <CardContent>
          <FormProvider {...methods}>
            <form
              onSubmit={methods.handleSubmit(onSubmit)}
              // On the last step, a real submit button exists in the DOM,
              // which makes the browser treat Enter inside any text input as
              // an implicit submit — e.g. typing a number then hitting Enter
              // on the very first Shipping field would submit the whole
              // form. Only let Enter go through from the actual submit
              // button (or a textarea, where it should insert a newline).
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  e.target instanceof HTMLElement &&
                  e.target.tagName !== 'TEXTAREA' &&
                  !(
                    e.target instanceof HTMLButtonElement &&
                    e.target.type === 'submit'
                  )
                ) {
                  e.preventDefault()

                }
                // navigate("/dashboard", { replace: true });
              }}
              className="flex flex-col gap-4"
            >
              <StepComponent />

              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={back}
                  disabled={isFirst}
                >
                  Back
                </Button>
                {isLast ? (
                  // A distinct key (vs. the Next button below) forces React
                  // to mount a fresh DOM node here rather than reusing the
                  // Next button's node and mutating its type in place — that
                  // reuse let the click that advanced to this step also be
                  // treated as a click on this now-type="submit" button,
                  // submitting the form immediately on arrival.
                  <Button
                    key="submit"
                    type="submit"
                    disabled={methods.formState.isSubmitting || !methods.formState.isDirty}
                  >
                    {methods.formState.isSubmitting
                      ? 'Submitting…'
                      : isEditing
                        ? 'Save Changes'
                        : 'Submit'}
                  </Button>
                ) : (
                  <Button key="next" type="button" onClick={next}>
                    Next
                  </Button>
                )}
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>

  )
}

export default RfeForm
