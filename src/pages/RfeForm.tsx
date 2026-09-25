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
import type {
  ComponentSource,
  FormValues,
  QtyTier,
  SavedTotalPacks,
  SavedUnitBuildItem,
  SavedUnitCount,
} from '@/lib/form'
import { supabase } from '@/lib/supabase'

import Overview from '../steps/overview'
import Components from '../steps/components'
import Assemblies, { PACK_TYPES, derivedTotalPacks } from '../steps/assembly'
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
    title: 'Assembly',
    description: 'How will the components in this job be assembled together?',
    Component: Assemblies,
    fields: ['assemblies'],
    // isVisible: (values) => values.components.length > 1,
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


const defaultAssembly = (qty: QtyTier[] = [{}]) => ({
  id: crypto.randomUUID(),
  qty,
  items: [],
  steps: [{ instruction: '' }],
  packType: '',
})

// Shape of `Assemblies.steps` (jsonb). Sorted by `step` on load so edits come
// back in the saved order regardless of how the array was stored.
type SavedAssemblyStep = { step: number; instruction: string }

const loadAssemblySteps = (assembly: { steps?: unknown; instructions?: string | null }) => {
  const saved = Array.isArray(assembly.steps) ? (assembly.steps as SavedAssemblyStep[]) : []
  if (saved.length > 0) {
    return [...saved]
      .sort((a, b) => Number(a.step) - Number(b.step))
      .map((step) => ({ instruction: step.instruction ?? '' }))
  }
  // Assemblies saved before `steps` existed only have free-text instructions.
  return [{ instruction: assembly.instructions ?? '' }]
}

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
  // convenientCartons: false,
  assemblies: [defaultAssembly()],
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
      const [versionsRes, componentsRes, assembliesRes, quantitiesRes] =
        await Promise.all([
          supabase.from('RFE Versions').select('*').eq('rfe_id', sourceRfeId),
          supabase.from('Components').select('*'),
          // `Assemblies.id` is DB-generated and increasing, so it preserves
          // the order the assemblies were saved in.
          supabase.from('Assemblies').select('*').order('id', { ascending: true }),
          supabase.from('RFE Quantities').select('*'),
        ])

      for (const { error } of [
        versionsRes,
        componentsRes,
        assembliesRes,
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
      const assemblies = (assembliesRes.data ?? []).filter(
        (p) => p.version_id === latestVersion.id,
      )

      const quantities = (quantitiesRes.data ?? []).filter(
        (q) => q.version_id === latestVersion.id,
      )

      // Every save inserts brand new Components/Assemblies rows for the new
      // version, so the loaded (previous version's) component ids can't be
      // reused — remap them and translate assembly items' references along with
      // them.
      const componentIdMap = new Map<string, string>()
      const newComponents = components.map((component) => {
        const id = crypto.randomUUID()
        componentIdMap.set(component.id, id)

        return {
          id,
          name: component.component_name ?? '',
          finalSize: component.final_size ?? '',
          flatSize: component.flat_size ?? '',
          stock: component.stock ?? '',
          coating: component.coating ?? '',
          source: (component.source ?? '') as ComponentSource,
          sourceJobNumber: component.job_number ?? '',
          instruction: component.instruction ?? '',
          type: component.type ?? '',
          otherType: component.other_type ?? '',
        }

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
        // convenientCartons: latestVersion.convenient_cartons ?? false,
        assemblies: assemblies.map((assembly) => {
          const rawPackType: string = assembly.pack_type ?? ''
          const isKnownPackType = rawPackType === '' || PACK_TYPES.includes(rawPackType)
          const savedUnits: SavedUnitCount[] = Array.isArray(assembly.num_of_units)
            ? assembly.num_of_units
            : []
          const savedBuild: SavedUnitBuildItem[] = Array.isArray(assembly.unit_build)
            ? assembly.unit_build
            : []
          return {
            id: crypto.randomUUID(),
            // Aligned to the overview tiers by index, same as they were saved.
            qty: quantities.map((_, i) => {
              const units = savedUnits[i]?.units
              return { qty: units != null ? Number(units) : undefined }
            }),
            items: savedBuild.map((item) => ({
              componentId:
                componentIdMap.get(item.component_id) ?? item.component_id,
              qtyPerUnit: item.qty_per_unit != null ? Number(item.qty_per_unit) : 1,
            })),
            steps: loadAssemblySteps(assembly),
            packType: isKnownPackType ? rawPackType : 'Other',
            packTypeOther: isKnownPackType ? undefined : rawPackType,
            unitsPerPack:
              assembly.units_per_pack != null ? Number(assembly.units_per_pack) : undefined,
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

  const visibleSteps = STEPS.filter(
    (s) => !s.isVisible ||
      s.isVisible(methods.getValues()),
  )
  const step = visibleSteps[stepIndex]
  const StepComponent = step.Component
  const isFirst = stepIndex === 0
  const isLast = stepIndex === visibleSteps.length - 1




  const onSubmit = async (data: FormValues) => {
    // "Other" is a placeholder selection, not a real pack type — fold the
    // free-text value into `packType` so the submitted string is what to use.
    const assemblies = data.assemblies.map(({ packTypeOther, ...assembly }) => ({
      ...assembly,
      packType: assembly.packType === 'Other' ? (packTypeOther ?? '') : assembly.packType,
    }))

    // Units in each assembly at each overview qty tier. With a single
    // assembly its qty inputs are hidden and it gets the full tier qty (same
    // as the Assembly step shows), so don't trust its possibly-stale `qty`.
    const tiers = data.qty ?? []
    const unitQtys = (assembly: FormValues['assemblies'][number]) =>
      tiers.map((tier, i) =>
        Number(assemblies.length > 1 ? assembly.qty[i]?.qty : tier.qty) || 0,
      )
    const componentNameById = new Map(
      data.components.map((component) => [component.id, component.name]),
    )

    console.log({ ...data, assemblies })

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
        // convenient_cartons: data.convenientCartons,
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
        source: component.source,
        sort_order: String(index),
        instruction: component.instruction,
        type: component.type,
        other_type: component.otherType,
      })),
    )

    if (componentsError) console.error(componentsError)

    // Uses the folded `assemblies` (not `data.assemblies`) so a custom "Other"
    // pack type is actually saved instead of the literal string
    // "Other".
    const { error: assembliesError } = await supabase.from('Assemblies').insert(
      assemblies.map((assembly) => {
        // This assembly's units at each tier, keyed by the overview tier qty.
        const tierUnits = unitQtys(assembly).map((units, i) => ({
          unitTier: Number(tiers[i]?.qty) || 0,
          units,
        }))

        return {
          version_id: data.versionId,
          num_of_units: tierUnits.map(({ unitTier, units }): SavedUnitCount => ({
            unit_tier: unitTier,
            units,
          })),
          unit_build: assembly.items.map((item): SavedUnitBuildItem => {
            const qtyPerUnit = Number(item.qtyPerUnit) || 0
            return {
              component_id: item.componentId,
              component_name: componentNameById.get(item.componentId) ?? '',
              qty_per_unit: qtyPerUnit,
              pieces: tierUnits.map(({ unitTier, units }) => ({
                unit_tier: unitTier,
                total_pieces: units * qtyPerUnit,
              })),
            }
          }),
          pack_type: assembly.packType,
          units_per_pack: assembly.unitsPerPack,
          total_packs: tierUnits.map(({ unitTier, units }): SavedTotalPacks => ({
            unit_tier: unitTier,
            total_packs: derivedTotalPacks(units, assembly.unitsPerPack),
          })),
          // Blank steps are dropped and the rest renumbered from 1.
          steps: assembly.steps
            .map((step) => step.instruction.trim())
            .filter(Boolean)
            .map((instruction, index) => ({ step: index + 1, instruction })),
        }
      }),
    )

    if (assembliesError) console.error(assembliesError)

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
