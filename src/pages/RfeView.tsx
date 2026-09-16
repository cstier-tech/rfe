import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

type RfeVersionRow = {
  id: string
  rfe_id: string
  version_number: number | null
  rfe_name: string | null
  customer_name: string | null
  customer_number: string | null
  sales_rep: string | null
  job_type: string | null
  previous_job_number: string | null
  changes_from_prev: string | null
  description: string | null
  due_date: string | null
  kitting_required: string | null
  convenient_cartons: boolean | null
  num_of_shipments: string | number | null
  ship_method: string | null
  asn_required: boolean | null
  asn_instructions: string | null
  approval_required: boolean | null
  intl_shipment: boolean | null
  usnpc_code: string | null
  customs_value: string | null
  customs_description: string | null
}

type ComponentRow = {
  id: string
  component_name: string | null
  final_size: string | null
  flat_size: string | null
  stock: string | null
  coating: string | null
  quantity: string | null
  source: string | null
  job_number: string | null
  sort_order: string | null
  type: string | null
  other_type: string | null
}

type PackRow = {
  id: number
  pack_type: string | null
  num_of_packs: string | null
}

type PackItemRow = {
  pack_id: number
  component_id: string
  qty_per_pack: string | null
}

type QuantityRow = {
  quantity: number | null
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p>
      <span className="font-bold">{label}:</span>{' '}
      <span>{value === '' || value == null ? '—' : value}</span>
    </p>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h2 className="text-base font-bold border-b pb-1">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function RfeView() {
  const { rfeId } = useParams<{ rfeId: string }>()
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState<RfeVersionRow | null>(null)
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [packs, setPacks] = useState<PackRow[]>([])
  const [packItems, setPackItems] = useState<PackItemRow[]>([])
  const [quantities, setQuantities] = useState<QuantityRow[]>([])

  useEffect(() => {
    if (!rfeId) return

    const load = async () => {
      const { data: versions, error: versionsError } = await supabase
        .from('RFE Versions')
        .select('*')
        .eq('rfe_id', rfeId)

      if (versionsError) console.error(versionsError)

      const latestVersion = (versions ?? []).reduce<RfeVersionRow | null>(
        (latest, v) =>
          !latest || (v.version_number ?? 0) > (latest.version_number ?? 0)
            ? v
            : latest,
        null,
      )

      if (!latestVersion) {
        setLoading(false)
        return
      }

      setVersion(latestVersion)

      const [componentsRes, packsRes, packItemsRes, quantitiesRes] =
        await Promise.all([
          supabase
            .from('Components')
            .select('*')
            .eq('version_id', latestVersion.id),
          supabase.from('Packs').select('*').eq('version_id', latestVersion.id),
          supabase
            .from('Pack Items')
            .select('*')
            .eq('version_id', latestVersion.id),
          supabase
            .from('RFE Quantities')
            .select('*')
            .eq('version_id', latestVersion.id),
        ])

      for (const { error } of [componentsRes, packsRes, packItemsRes, quantitiesRes]) {
        if (error) console.error(error)
      }

      setComponents(
        [...(componentsRes.data ?? [])].sort(
          (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
        ),
      )
      setPacks(packsRes.data ?? [])
      setPackItems(packItemsRes.data ?? [])
      setQuantities(quantitiesRes.data ?? [])
      setLoading(false)
    }

    load()
  }, [rfeId])

  if (loading) {
    return (
      <div className="min-h-svh p-4 pt-16 bg-gray-100">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!version) {
    return (
      <div className="min-h-svh p-4 pt-16 bg-gray-100">
        <p className="text-sm text-muted-foreground">RFE not found.</p>
      </div>
    )
  }

  const componentNameById = new Map(
    components.map((c) => [c.id, c.component_name || 'Untitled component']),
  )

  return (
    <div className="min-h-svh p-4 pt-16 bg-gray-100 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl bg-background text-foreground rounded-lg border p-8 print:border-0 print:rounded-none">
        <div className="mb-6 flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-xl font-bold">{version.rfe_name || 'Untitled RFE'}</h1>
            <p className="text-sm text-muted-foreground">
              Version {version.version_number ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Print
          </button>
        </div>

        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold">{version.rfe_name || 'Untitled RFE'}</h1>
          <p className="text-sm">Version {version.version_number ?? '—'}</p>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Request for Estimate">
            <Field label="Name" value={version.rfe_name} />
            <Field
              label="Due Date"
              value={
                version.due_date
                  ? new Date(version.due_date).toLocaleDateString()
                  : null
              }
            />
            <Field label="Customer" value={version.customer_name} />
            <Field label="Customer Number" value={version.customer_number} />
            <Field label="Sales Rep" value={version.sales_rep} />
            <Field label="Job Type" value={version.job_type} />
            <Field label="Previous Job Number" value={version.previous_job_number} />
            <Field label="Changes from Previous Job" value={version.changes_from_prev} />
            <Field label="Description" value={version.description} />
            <Field label="Kitting Required" value={version.kitting_required} />
            {quantities.length === 0 ? (
              <Field label="Quantities" value={null} />
            ) : (
              quantities.map((q, i) => (
                <Field
                  key={i}
                  label={`Quantity ${i + 1}`}
                  value={q.quantity ?? null}
                />
              ))
            )}
          </Section>

          <Section title="Components">
            {components.length === 0 ? (
              <p className="text-sm text-muted-foreground">No components.</p>
            ) : (
              components.map((c, i) => (
                <div key={c.id} className="flex flex-col gap-1 pb-2">
                  <p className="font-bold underline">
                    Component {i + 1}
                    {c.component_name ? ` — ${c.component_name}` : ''}
                  </p>
                  <Field label="Name" value={c.component_name} />
                  <Field label="Finished Size" value={c.final_size} />
                  <Field label="Flat Size" value={c.flat_size} />
                  <Field label="Stock" value={c.stock} />
                  <Field label="Coating" value={c.coating} />
                  <Field label="Qty" value={c.quantity} />
                  <Field label="Source" value={c.source} />
                  <Field label="Source Job Number" value={c.job_number} />
                </div>
              ))
            )}
          </Section>

          <Section title="Packs">
            <Field
              label="Pack in Convenient Cartons"
              value={version.convenient_cartons ? 'Yes' : 'No'}
            />
            {packs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No packs.</p>
            ) : (
              packs.map((pack, i) => (
                <div key={pack.id} className="flex flex-col gap-1 pb-2">
                  <p className="font-bold underline">Pack {i + 1}</p>
                  <Field label="Pack Type" value={pack.pack_type} />
                  <Field label="Num of Packs" value={pack.num_of_packs} />
                  {packItems
                    .filter((item) => item.pack_id === pack.id)
                    .map((item, j) => (
                      <Field
                        key={j}
                        label={
                          componentNameById.get(item.component_id) ??
                          'Unknown component'
                        }
                        value={`${item.qty_per_pack ?? '—'} per pack`}
                      />
                    ))}
                </div>
              ))
            )}
          </Section>

          <Section title="Shipping">
            <Field label="Total Number of Shipments" value={version.num_of_shipments} />
            <Field label="Shipment Method" value={version.ship_method} />
            <Field
              label="Advanced Shipping Notice (ASN) Required"
              value={version.asn_required ? 'Yes' : 'No'}
            />
            {version.asn_required && (
              <Field label="ASN Instructions" value={version.asn_instructions} />
            )}
            <Field
              label="Approval Needed Prior to Ship"
              value={version.approval_required ? 'Yes' : 'No'}
            />
            <Field
              label="International Shipment"
              value={version.intl_shipment ? 'Yes' : 'No'}
            />
            {version.intl_shipment && (
              <>
                <Field label="USNPC Code" value={version.usnpc_code} />
                <Field label="Customs Value" value={version.customs_value} />
                <Field
                  label="Customs Description"
                  value={version.customs_description}
                />
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

export default RfeView
