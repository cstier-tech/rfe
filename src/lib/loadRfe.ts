import type { ComponentSource, FormValues, KitStep, PackoutItem } from '@/lib/form'
import { supabase } from '@/lib/supabase'

// Shape of `Packouts.kitting_steps` (jsonb). Steps are numbered on save.
type SavedKitStep = { step: number; instruction: string }

const loadKitSteps = (packout: { kitting_steps?: SavedKitStep[] | null; instructions?: string | null }): KitStep[] => {
  const saved = packout.kitting_steps ?? []
  if (saved.length > 0) {
    return [...saved]
      .sort((a, b) => Number(a.step) - Number(b.step))
      .map((step) => ({ instruction: step.instruction ?? '' }))
  }
  // Packouts saved before `kitting_steps` existed only have free-text instructions.
  return [{ instruction: packout.instructions ?? '' }]
}

const numberOrUndefined = (value: unknown) => (value != null ? Number(value) : undefined)

// Per-tier qty arrays are saved as plain numbers. Rows saved before that
// stored objects like { unit_tier, units } â€” `key` picks the value out of those.
type LegacyTierQty = Record<string, number>
export const loadQtys = (saved: (number | LegacyTierQty)[] | null, key: string) =>
  (saved ?? []).map((value) => Number(typeof value === 'object' ? value?.[key] : value) || 0)

// Older rows saved kit items as { component_id, component_name, qty_per_unit, pieces }.
type LegacyKitItem = {
  component_id: string
  component_name: string
  qty_per_unit: number
  pieces: LegacyTierQty[]
}
export const loadKitItems = (saved: (PackoutItem | LegacyKitItem)[] | null): PackoutItem[] =>
  (saved ?? []).map((item) =>
    'component_id' in item
      ? {
          componentId: item.component_id,
          componentName: item.component_name,
          qtyPerKit: Number(item.qty_per_unit) || 0,
          qty: loadQtys(item.pieces, 'total_pieces'),
        }
      : item,
  )

export type LoadedRfe = { versionNumber: number | null; values: FormValues }

// Loads the latest version of an RFE as FormValues â€” the same shape the form
// submits. Ids are the saved ones, and `packType` is the saved (already
// folded) string; callers reusing this in the form adjust both.
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
        qty: loadQtys(packout.num_of_units, 'units'),
        kitItems: loadKitItems(packout.kit_build),
        kitSteps: loadKitSteps(packout),
        packType: packout.pack_type ?? '',
        unitsPerPack: numberOrUndefined(packout.units_per_pack),
        totalPacksQty: loadQtys(packout.total_packs, 'total_packs'),
        cartonType: packout.carton_type ?? '',
        customCartonSource: packout.custom_carton_source ?? '',
        packsPerCarton: numberOrUndefined(packout.packs_per_carton),
        totalCartons: loadQtys(packout.total_cartons, 'total_cartons'),
      })),
      totalShipments: numberOrUndefined(version.num_of_shipments),
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
