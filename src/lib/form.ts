export type ComponentSource =
  | ''
  | 'LCP Production'
  | 'Customer Supplied'
  | 'Veracore Inventory'

export type ComponentItem = {
  // Stable identity so packouts can reference a component even if the list is
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

export type PackoutItem = {
  // References ComponentItem.id. An entry exists only for selected components.
  componentId: string
  componentName: string
  qtyPerKit: number
}

// One entry in a packout's ordered packout instructions. Order in the array is
// the step order.
export type KitStep = {
  instruction: string
}

// One layer of packing. Layers are ordered innermost first: the first one packs
// the units, and each one after it packs the layer before it.
export type PackLayer = {
  id: string
  type: string
  // Only meaningful when type === 'Other'.
  otherType?: string
  // How many of the layer below (units, or the previous layer's packs) go in
  // one of these. Left blank for Convenient Cartons, which hold however many fit.
  qtyPer?: number | null
}

// Every per-tier qty array below lines up by index with FormValues.qty.
export type Packout = {
  id: string
  // Id of this packout's kit layer in `packout_build`, which the first
  // packing layer references.
  kitId: string
  // Units in this packout at each tier.
  qty: number[]
  kitItems: PackoutItem[]
  kitSteps: KitStep[]
  packing: PackLayer[]
}

// Shape of `Packouts.packout_build` (jsonb): the kit layer, then the packing
// layers innermost first. Each packing layer `contains` the layer before it.
export type KitLayerJson = {
  type: 'Assembly'
  layer_type: 'kit'
  id: string
  // Units in this packout at each qty tier.
  units: number[]
  kit_build: { component_id: string; qty_per_unit: number; component_name: string }[]
  steps: string[]
}
export type PackagingLayerJson = {
  type: string
  otherType?: string
  layer_type: 'packaging'
  id: string
  // qty_per is null when unknown (Convenient Cartons).
  contains: { id: string; qty_per: number | null }[]
}
export type PackoutBuild = (KitLayerJson | PackagingLayerJson)[]

// Shipping for one qty tier. Saved as-is (one object per tier) in
// `RFE Versions.num_of_shipments2`.
export type ShipmentTier = {
  // Number of shipments. Defaults to the tier's qty.
  qty?: number
  // Only meaningful when `qty` is less than the tier's qty.
  overageAction?: string
}

// Whether a tier's shipments fall short of its qty, so the overage needs handling.
export const hasOverage = (shipment: ShipmentTier | undefined, tier: number | undefined) =>
  shipment?.qty != null && !Number.isNaN(shipment.qty) && shipment.qty < (Number(tier) || 0)

// A pack layer's display name, e.g. "Shrink Wrap", or the typed-in name for "Other".
// A pack layer with nothing filled in yet.
export const blankPackLayer = (): PackLayer => ({
  id: crypto.randomUUID(),
  type: '',
  otherType: '',
  qtyPer: null,
})

export const packLayerName = (layer: Pick<PackLayer, 'type' | 'otherType'>) =>
  (layer.type === 'Other' ? layer.otherType : layer.type) || 'Other'

// Total packs of each layer at each tier. A layer whose qtyPer isn't set (e.g.
// Convenient Cartons) has no computable total, and neither does any layer
// outside it — those are null.
export const derivePackTotals = (units: number[], packing: PackLayer[]) => {
  const totals: (number[] | null)[] = []
  let inner: number[] | null = units
  for (const layer of packing) {
    const per = Number(layer.qtyPer)
    inner = inner && per > 0 ? inner.map((count) => count / per) : null
    totals.push(inner)
  }
  return totals
}

// Everything on a packout that follows from its unit qtys. These are always
// computed rather than kept in form state or saved (where they'd need syncing
// and could go stale). With a single packout its qty inputs are hidden and it
// gets the full tier qty, so its own (possibly stale) `qty` is ignored.
export const derivePackoutQtys = (
  packout: Packout,
  tiers: FormValues['qty'],
  multiplePackouts: boolean,
) => {
  const qty = tiers.map((tier, i) => Number(multiplePackouts ? packout.qty[i] : tier) || 0)
  return {
    qty,
    // Pieces of each kit item needed at each tier.
    kitItemPieces: packout.kitItems.map((item) =>
      qty.map((units) => units * (Number(item.qtyPerKit) || 0)),
    ),
    packTotals: derivePackTotals(qty, packout.packing),
  }
}

// The packout as saved in `Packouts.packout_build`. `units` are the packout's
// (derived) per-tier unit qtys.
export const toPackoutBuild = (
  packout: Packout,
  units: number[],
  componentNames: Map<string, string>,
): PackoutBuild => [
  {
    type: 'Assembly',
    layer_type: 'kit',
    id: packout.kitId,
    units,
    kit_build: packout.kitItems.map((item) => ({
      component_id: item.componentId,
      qty_per_unit: Number(item.qtyPerKit) || 0,
      // Refreshed here since components may have been renamed.
      component_name: componentNames.get(item.componentId) ?? item.componentName,
    })),
    // Blank steps are dropped.
    steps: packout.kitSteps.map((step) => step.instruction.trim()).filter(Boolean),
  },
  ...packout.packing.map((layer, i): PackagingLayerJson => ({
    type: layer.type,
    ...(layer.type === 'Other' && { otherType: layer.otherType ?? '' }),
    layer_type: 'packaging',
    id: layer.id,
    contains: [
      {
        id: i === 0 ? packout.kitId : packout.packing[i - 1].id,
        qty_per: Number(layer.qtyPer) > 0 ? Number(layer.qtyPer) : null,
      },
    ],
  })),
]

export const formatQty = (qty: number) =>
  Number.isInteger(qty) ? String(qty) : qty.toFixed(2)

// e.g. "500" with one tier, or "500 @ 1000, 1000 @ 2000" with several.
export const formatByTier = (values: number[] | null | undefined, tiers: FormValues['qty']) =>
  !values?.length
    ? null
    : values.length === 1
      ? formatQty(values[0])
      : values.map((value, i) => `${formatQty(value)} @ ${tiers[i] ?? '—'}`).join(', ')

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
  // isKit?: string
  // kittingRequired?: 'Yes' | 'No'
  // Finished units to estimate at; each entry is one qty tier. Blank until entered.
  qty: (number | undefined)[]
  components: ComponentItem[]
  // convenientCartons?: boolean
  packouts: Packout[]

  // Shipping
  // One entry per qty tier, lined up by index with `qty`.
  totalShipments: ShipmentTier[]
  labelInstructions?: string
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
