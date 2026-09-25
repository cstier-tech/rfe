export type ComponentSource =
  | ''
  | 'LCP Production'
  | 'Customer Supplied'
  | 'Veracore Inventory'

export type ComponentItem = {
  // Stable identity so assemblies can reference a component even if the list is
  // reordered or trimmed later.
  id: string
  name: string
  finalSize: string
  flatSize: string
  stock: string
  coating: string
  source: ComponentSource
  // Only meaningful when source === 'LCP Production'.
  sourceJobNumber: string

  instruction: string

  type: string
  otherType: string
}

export type AssemblyItem = {
  // References ComponentItem.id. An entry exists only for selected components.
  componentId: string
  qtyPerUnit: number
}

// One entry in a assembly's ordered assembly instructions. Order in the array is
// the step order; step numbers are assigned on save.
export type AssemblyStep = {
  instruction: string
}

export type Assembly = {
  id: string
  qty: QtyTier[]
  items: AssemblyItem[]
  steps: AssemblyStep[]
  // Each assembly has exactly one unit pack. Total packs per tier are always
  // derived (unit qty / unitsPerPack), so they aren't stored on the form.
  packType: string
  // Only meaningful when packType === 'Other'; folded into `pack_type` on submit.
  packTypeOther?: string
  unitsPerPack?: number
}

// Shape of each entry in `Assemblies.num_of_units` (jsonb): the assembly's own
// unit count at each overview qty tier (`unit_tier`), in tier order.
export type SavedUnitCount = { unit_tier: number; units: number }

// e.g. "500" with one tier, or "500 @ 1000, 1000 @ 2000" with several.
export const formatUnitCounts = (counts: SavedUnitCount[] | null) =>
  !counts || counts.length === 0
    ? null
    : counts.length === 1
      ? String(counts[0].units)
      : counts.map((count) => `${count.units} @ ${count.unit_tier}`).join(', ')

// Shape of each entry in `Assemblies.unit_build` (jsonb): one per component
// in the assembly, with the pieces this assembly needs at each overview qty
// tier (`unit_tier`), in tier order.
export type SavedUnitBuildItem = {
  component_id: string
  component_name: string
  qty_per_unit: number
  pieces: { unit_tier: number; total_pieces: number }[]
}

// Shape of each entry in `Assemblies.total_packs` (jsonb): the packs this
// assembly needs at each overview qty tier (`unit_tier`), in tier order.
export type SavedTotalPacks = { unit_tier: number; total_packs: number }

export type QtyTier = {
  qty?: number
  name?: string
}

export type FormValues = {
  // Stable identity for the RFE itself, shared across every version/edit of
  // it. `versionId` below identifies just this particular save.
  rfeId: string
  versionId: string
  name: string
  dueDate?: Date
  customer?: string
  customerNumber?: string
  salesRep?: string
  jobType?: string
  prevJobNumber: string
  changesFromPrev?: string
  description?: string
  isKit?: string
  kittingRequired?: 'Yes' | 'No'
  qty?: QtyTier[]
  components: ComponentItem[]
  // convenientCartons?: boolean
  assemblies: Assembly[]

  // Shipping
  totalShipments?: number
  shipMethod?: 'Drop Ship' | 'Bulk Ship'
  asnRequired?: boolean
  // Only meaningful when asnRequired is true.
  asnInstructions?: string
  approvalNeededPriorToShip?: boolean
  internationalShipment?: boolean
  // Only meaningful when internationalShipment is true.
  usnpcCode?: string
  customsValue?: string
  customsDescription?: string
}
