export type ComponentSource =
  | ''
  | 'LCP Production'
  | 'Customer Supplied'
  | 'Veracore Inventory'

export type ComponentItem = {
  // Stable identity so packs can reference a component even if the list is
  // reordered or trimmed later.
  id: string
  name: string
  finalSize: string
  flatSize: string
  stock: string
  coating: string
  qty: number
  // Per-overview-qty-tier overrides, only meaningful when kittingRequired
  // === 'No'. Parallel to the top-level `qty` tiers array by index; an
  // entry of null/undefined means that tier isn't overridden and falls
  // back to the overview quantity at that index.
  qtyOverrides?: (number | null)[]
  source: ComponentSource
  // Only meaningful when source === 'LCP Production'.
  sourceJobNumber: string

  instruction: string

  type: string
  otherType: string
}

export type PackItem = {
  // References ComponentItem.id. An entry exists only for selected components.
  componentId: string
  qtyPerPack: number
}

export type Pack = {
  id: string
  type: string
  // Only meaningful when type === 'Other'; folded into `type` on submit.
  typeOther?: string
  qty: number
  items: PackItem[]
}

export type QtyTier = {
  qty?: number
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
  convenientCartons?: boolean
  packs: Pack[]

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
