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
import type { ComponentSource, FormValues } from '@/lib/form'
import { supabase } from '@/lib/supabase'

import Overview from '../steps/overview'
import Components from '../steps/components'
import Packs from '../steps/packs'
import Shipping from '../steps/shipping'

type Step = {
  title: string
  description: string
  Component: () => ReactNode
  fields: (keyof FormValues)[]
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
      'kittingRequired',
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
    title: 'Packs',
    description: 'How will the components in this job be packed?',
    Component: Packs,
    fields: ['convenientCartons', 'packs'],
  },
  {
    title: 'Shipping',
    description: 'Basic shipping details.',
    Component: Shipping,
    fields: [
      'totalShipments',
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

// Matches the radio options in steps/packs.tsx. A pack_type outside this set
// means the user typed a custom "Other" value on save — since that value is
// folded straight into `pack_type` (there's no separate stored column for
// it), the only way back is to treat anything unrecognized as "Other" text.
const KNOWN_PACK_TYPES = ['Shrink Wrap', 'Banded', 'Other']

const defaultComponent = () => ({
  id: crypto.randomUUID(),
  name: 'Component 1',
  finalSize: '',
  flatSize: '',
  stock: '',
  coating: '',
  qty: 1,
  source: '' as ComponentSource,
  sourceJobNumber: '',
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
  isKit: undefined,
  kittingRequired: undefined,
  qty: [{}],
  components: [defaultComponent()],
  convenientCartons: false,
  packs: [],
  totalShipments: undefined,
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
      const [versionsRes, componentsRes, packsRes, packItemsRes, quantitiesRes] =
        await Promise.all([
          supabase.from('RFE Versions').select('*').eq('rfe_id', sourceRfeId),
          supabase.from('Components').select('*'),
          supabase.from('Packs').select('*'),
          supabase.from('Pack Items').select('*'),
          supabase.from('RFE Quantities').select('*'),
        ])

      for (const { error } of [
        versionsRes,
        componentsRes,
        packsRes,
        packItemsRes,
        quantitiesRes,
      ]) {
        if (error) console.error(error)
      }

      const versions = versionsRes.data ?? []
      const latestVersion = versions.reduce<(typeof versions)[number] | null>(
        (latest, version) =>
          !latest ||
            (version.version_number ?? 0) > (latest.version_number ?? 0)
            ? version
            : latest,
        null,
      )

      if (!latestVersion) {
        console.error(`No RFE Versions found for rfe_id ${sourceRfeId}`)
        setLoading(false)
        return
      }

      const components = (componentsRes.data ?? [])
        .filter((c) => c.version_id === latestVersion.id)
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      const packs = (packsRes.data ?? []).filter(
        (p) => p.version_id === latestVersion.id,
      )
      const packItems = packItemsRes.data ?? []

      const quantities = (quantitiesRes.data ?? []).filter(
        (q) => q.version_id === latestVersion.id,
      )
      const overviewQtyValues = quantities.map((q) => q.quantity ?? null)
      const kittingRequired = (latestVersion.kitting_required ?? undefined) as
        | 'Yes'
        | 'No'
        | undefined

      // Every save inserts brand new Components/Packs rows for the new
      // version, so the loaded (previous version's) component ids can't be
      // reused — remap them and translate pack items' references along with
      // them.
      const componentIdMap = new Map<string, string>()
      const newComponents = components.map((component) => {
        const id = crypto.randomUUID()
        componentIdMap.set(component.id, id)

        const base = {
          id,
          name: component.component_name ?? '',
          finalSize: component.final_size ?? '',
          flatSize: component.flat_size ?? '',
          stock: component.stock ?? '',
          coating: component.coating ?? '',
          source: (component.source ?? '') as ComponentSource,
          sourceJobNumber: component.job_number ?? '',
        }

        if (kittingRequired !== 'No') {
          return { ...base, qty: Number(component.quantity) || 1 }
        }

        // Non-kit quantity is stored as pipe-delimited text, one value per
        // overview qty tier (see onSubmit below). Reconstitute it back into
        // per-tier overrides so editing preserves which tiers were manually
        // overridden vs. tracking the overview quantity automatically.
        const parsedValues: (number | null)[] = String(component.quantity ?? '')
          .split('|')
          .map((part: string) => part.trim())
          .map((part: string) => {
            const n = Number(part)
            return part !== '' && !Number.isNaN(n) ? n : null
          })

        const aligned = parsedValues.length === overviewQtyValues.length
        const qtyOverrides: (number | null)[] = aligned
          ? parsedValues.map((v, i) => (v === overviewQtyValues[i] ? null : v))
          : overviewQtyValues.map((_, i) => parsedValues[i] ?? null)

        return { ...base, qty: 1, qtyOverrides }
      })

      methods.reset({
        rfeId: isEditing && sourceRfeId ? sourceRfeId : crypto.randomUUID(),
        versionId: crypto.randomUUID(),
        name: isDuplicating
          ? `Copy of ${latestVersion.rfe_name ?? ''}`
          : (latestVersion.rfe_name ?? ''),
        dueDate: latestVersion.due_date
          ? new Date(latestVersion.due_date)
          : undefined,
        customer: latestVersion.customer_name ?? '',
        customerNumber: latestVersion.customer_number ?? '',
        salesRep: latestVersion.sales_rep ?? '',
        jobType: latestVersion.job_type || 'New Job',
        prevJobNumber: latestVersion.previous_job_number ?? '',
        changesFromPrev: latestVersion.changes_from_prev ?? '',
        description: latestVersion.description ?? '',
        kittingRequired: (latestVersion.kitting_required ?? undefined) as
          | 'Yes'
          | 'No'
          | undefined,
        qty:
          quantities.length > 0
            ? quantities.map((q) => ({ qty: q.quantity ?? undefined }))
            : [{}],
        components: newComponents.length > 0 ? newComponents : [defaultComponent()],
        convenientCartons: latestVersion.convenient_cartons ?? false,
        packs: packs.map((pack) => {
          const rawType = pack.pack_type ?? ''
          const isKnownType = KNOWN_PACK_TYPES.includes(rawType)
          return {
            id: crypto.randomUUID(),
            type: isKnownType ? rawType : 'Other',
            typeOther: isKnownType ? undefined : rawType,
            qty: Number(pack.num_of_packs) || 1,
            items: packItems
              .filter((item) => item.pack_id === pack.id)
              .map((item) => ({
                componentId:
                  componentIdMap.get(item.component_id) ?? item.component_id,
                qtyPerPack: Number(item.qty_per_pack) || 1,
              })),
          }
        }),
        totalShipments:
          latestVersion.num_of_shipments != null
            ? Number(latestVersion.num_of_shipments)
            : undefined,
        shipMethod: (latestVersion.ship_method ?? undefined) as
          | 'Drop Ship'
          | 'Bulk Ship'
          | undefined,
        asnRequired: latestVersion.asn_required ?? false,
        asnInstructions: latestVersion.asn_instructions ?? '',
        approvalNeededPriorToShip: latestVersion.approval_required ?? false,
        internationalShipment: latestVersion.intl_shipment ?? false,
        usnpcCode: latestVersion.usnpc_code ?? '',
        customsValue: latestVersion.customs_value ?? '',
        customsDescription: latestVersion.customs_description ?? '',
      })

      setLoading(false)
    }

    loadFromSource()
  }, [sourceRfeId, isEditing, isDuplicating, methods])

  const step = STEPS[stepIndex]
  const StepComponent = step.Component
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  const onSubmit = async (data: FormValues) => {
    // "Other" is a placeholder selection, not a real pack type — fold the
    // free-text value into `type` so the submitted string is what to use.
    const packs = data.packs.map(({ typeOther, ...pack }) =>
      pack.type === 'Other' ? { ...pack, type: typeOther ?? '' } : pack,
    )

    // Kit mode stores a single qty-per-kit number. Non-kit mode stores one
    // value per overview qty tier (an override where set, else that tier's
    // own value), pipe-delimited — `Components.quantity` is a text column.
    const componentQuantity = (component: FormValues['components'][number]) => {
      const tiers = data.qty ?? []
      if (data.kittingRequired !== 'No' || tiers.length === 0) {
        return component.qty
      }
      return tiers
        .map((tier, i) => component.qtyOverrides?.[i] ?? tier.qty ?? '')
        .join(' | ')
    }

    console.log({ ...data, packs })

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
        kitting_required: data.kittingRequired,
        convenient_cartons: data.convenientCartons,
        num_of_shipments: data.totalShipments,
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
        quantity: componentQuantity(component),
        source: component.source,
        sort_order: String(index),
      })),
    )

    if (componentsError) console.error(componentsError)

    // `Packs.id` is a DB-generated integer, not a client id, so packs are
    // inserted one at a time to get back the real id each pack's items need
    // to link against. Uses the folded `packs` (not `data.packs`) so a
    // custom "Other" pack type is actually saved instead of the literal
    // string "Other".
    for (const pack of packs) {
      const { data: insertedPack, error: packError } = await supabase
        .from('Packs')
        .insert({
          version_id: data.versionId,
          num_of_packs: pack.qty,
          pack_type: pack.type,
        })
        .select('id')
        .single()

      if (packError) {
        console.error(packError)
        continue
      }

      if (pack.items.length === 0) continue

      // `Pack Items.id` is also DB-generated (bigint), unlike most other
      // tables here which use client-generated UUIDs — don't set it.
      const { error: packItemsError } = await supabase.from('Pack Items').insert(
        pack.items.map((item) => ({
          qty_per_pack: item.qtyPerPack,
          version_id: data.versionId,
          pack_id: insertedPack.id,
          component_id: item.componentId,
        })),
      )

      if (packItemsError) console.error(packItemsError)
    }

    const { error: quantitiesError } = await supabase.from('RFE Quantities').insert(
      (data.qty ?? [])
        .filter((tier) => tier.qty != null)
        .map((tier) => ({
          id: crypto.randomUUID(),
          version_id: data.versionId,
          quantity: tier.qty,
        })),
    )

    if (quantitiesError) console.error(quantitiesError)

    if (isEditing || isDuplicating) navigate('/dashboard')
  }

  const next = async () => {
    // Only advance if the current step's fields pass validation.
    const valid = await methods.trigger(step.fields)
    if (valid) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 bg-gray-100">
        <p className="text-sm text-muted-foreground">Loading RFE…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
          <p className="text-sm text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
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
                    disabled={methods.formState.isSubmitting}
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
