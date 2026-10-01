import type {
  ComponentSource,
  FormValues,
  KitLayerJson,
  PackagingLayerJson,
  Packout,
  PackoutBuild,
  ShipmentTier,
} from '@/lib/form'
import { supabase } from '@/lib/supabase'

const numberOrUndefined = (value: unknown) => (value != null ? Number(value) : undefined)

// Reads `Packouts.packout_build` back into a packout (minus its row id).
export const loadPackoutBuild = (saved: PackoutBuild | null): Omit<Packout, 'id'> => {
  const layers = saved ?? []
  const kit = layers.find((layer): layer is KitLayerJson => layer.layer_type === 'kit')
  // Saved innermost first, so array order is the packing order.
  const packaging = layers.filter(
    (layer): layer is PackagingLayerJson => layer.layer_type === 'packaging',
  )
  return {
    kitId: kit?.id ?? crypto.randomUUID(),
    qty: (kit?.units ?? []).map((units) => Number(units) || 0),
    kitItems: (kit?.kit_build ?? []).map((item) => ({
      componentId: item.component_id,
      componentName: item.component_name ?? '',
      qtyPerKit: Number(item.qty_per_unit) || 0,
    })),
    kitSteps: (kit?.steps ?? []).map((instruction) => ({ instruction })),
    packing: packaging.map((layer) => ({
      id: layer.id,
      type: layer.type ?? '',
      otherType: layer.otherType ?? '',
      qtyPer: numberOrUndefined(layer.contains?.[0]?.qty_per) ?? null,
    })),
  }
}

// Rows saved before overage actions existed hold plain numbers.
const loadShipments = (saved: (number | ShipmentTier | null)[] | null): ShipmentTier[] =>
  (saved ?? []).map((value) =>
    value != null && typeof value === 'object'
      ? { qty: numberOrUndefined(value.qty), overageAction: value.overageAction ?? '' }
      : { qty: numberOrUndefined(value), overageAction: '' },
  )

export type LoadedRfe = { versionNumber: number | null; values: FormValues }

// Loads the latest version of an RFE as FormValues â€” the same shape the form
// submits. Ids are the saved ones; callers reusing this in the form adjust them.
export async function loadRfe(rfeId: string): Promise<LoadedRfe | null> {
  const { data: versions, error } = await supabase
    .from('RFE Versions')
    .select('*')
    .eq('rfe_id', rfeId)
  if (error) console.error(error)

  const version = (versions ?? []).reduce<NonNullable<typeof versions>[number] | null>(
    (latest, v) => (!latest || (v.version_number ?? 0) > (latest.version_number ?? 0) ? v : latest),
    null,
  )
  if (!version) {
    console.error(`No RFE Versions found for rfe_id ${rfeId}`)
    return null
  }

  const [componentsRes, packoutsRes, quantitiesRes] = await Promise.all([
    supabase.from('Components').select('*').eq('version_id', version.id),
    // `Packouts.id` is DB-generated and increasing, so it preserves save order.
    supabase.from('Packouts').select('*').eq('version_id', version.id).order('id', { ascending: true }),
    supabase.from('RFE Quantities').select('*').eq('version_id', version.id),
  ])
  for (const { error } of [componentsRes, packoutsRes, quantitiesRes]) {
    if (error) console.error(error)
  }

  const components = [...(componentsRes.data ?? [])].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  )

  return {
    versionNumber: version.version_number ?? null,
    values: {
      rfeId: version.rfe_id,
      versionId: version.id,
      name: version.rfe_name ?? '',
      dueDate: version.due_date ? new Date(version.due_date) : undefined,
      customer: version.customer_name ?? '',
      customerNumber: version.customer_number ?? '',
      salesRep: version.sales_rep ?? '',
      jobType: version.job_type || 'New Job',
      prevJobNumber: version.previous_job_number ?? '',
      changesFromPrev: version.changes_from_prev ?? '',
      description: version.description ?? '',
      qty: (quantitiesRes.data ?? []).map((q) => numberOrUndefined(q.quantity)),
      components: components.map((component) => ({
        id: component.id,
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
      })),
      packouts: (packoutsRes.data ?? []).map((packout) => ({
        id: String(packout.id),
        ...loadPackoutBuild(packout.packout_build),
      })),
      totalShipments: loadShipments(version.num_of_shipments2),
      labelInstructions: version.label_instructions ?? '',
      shipMethod: (version.ship_method ?? undefined) as FormValues['shipMethod'],
      asnRequired: version.asn_required ?? false,
      asnInstructions: version.asn_instructions ?? '',
      approvalNeededPriorToShip: version.approval_required ?? false,
      internationalShipment: version.intl_shipment ?? false,
      usnpcCode: version.usnpc_code ?? '',
      customsValue: version.customs_value ?? '',
      customsDescription: version.customs_description ?? '',
    },
  }
}
