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
  // Pieces needed at each overview qty tier. Derived — see derivePackoutQtys.
  qty?: number[]
}

// One entry in a packout's ordered packout instructions. Order in the array is
// the step order; step numbers are assigned on save.
export type KitStep = {
  instruction: string
}

// Every per-tier qty array below lines up by index with FormValues.qty.
export type Packout = {
  id: string
  // Units in this packout at each tier.
  qty: number[]
  kitItems: PackoutItem[]
  kitSteps: KitStep[]
  packType: string
  // Only meaningful when packType === 'Other'; folded into `packType` on submit.
  packTypeOther?: string
  unitsPerPack?: number
  // Derived — see derivePackoutQtys.
  totalPacksQty?: number[]

  cartonType: string
  customCartonSource?: string
  packsPerCarton?: number | null
  // Derived — see derivePackoutQtys.
  totalCartons?: number[]
}

const divideQty = (total: number, per?: number | null) =>
  Number(per) > 0 ? total / Number(per) : 0

// Everything on a packout that follows from its unit qtys. These are always
// computed rather than kept in form state (where they'd need syncing and could
// go stale): the Packout step shows them live, and onSubmit folds them into the
// saved data. With a single packout its qty inputs are hidden and it gets the
// full tier qty, so its own (possibly stale) `qty` is ignored.
export const derivePackoutQtys = (
  packout: Packout,
  tiers: FormValues['qty'],
  multiplePackouts: boolean,
) => {
  const qty = tiers.map((tier, i) => Number(multiplePackouts ? packout.qty[i] : tier) || 0)
  const totalPacksQty = qty.map((units) => divideQty(units, packout.unitsPerPack))
  return {
    qty,
    kitItems: packout.kitItems.map((item) => ({
      ...item,
      qty: qty.map((units) => units * (Number(item.qtyPerKit) || 0)),
    })),
    totalPacksQty,
    totalCartons: totalPacksQty.map((packs) => divideQty(packs, packout.packsPerCarton)),
  }
}

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
  // Shipments needed at each qty tier; lines up by index with `qty`.
  totalShipments: (number | undefined)[]
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
