import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  formatUnitCounts,
  type SavedUnitBuildItem,
  type SavedUnitCount,
} from '@/lib/form'
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
  source: string | null
  job_number: string | null
  sort_order: string | null
  type: string | null
  other_type: string | null
}

type AssemblyRow = {
  id: number
  num_of_units: SavedUnitCount[] | null
  unit_build: SavedUnitBuildItem[] | null
  pack_type: string | null
  units_per_pack: string | null
  steps: { step: number; instruction: string }[] | null
}

type QuantityRow = {
  quantity: number | null
}

// Set by the "Hide empty fields" toggle; read by every Field.
const HideEmptyContext = createContext(false)

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const hideEmpty = useContext(HideEmptyContext)
  if (hideEmpty && (value === '' || value == null)) return null

  return (
    <p>
      <span className="font-bold">{label}:</span>{' '}
      <span>{value === '' || value == null ? '—' : value}</span>
    </p>
  )
}

// Label/value table for a group of fields. Rows respect the same "Hide empty
// fields" toggle as Field.
function FieldTable({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>{children}</tbody>
    </table>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const hideEmpty = useContext(HideEmptyContext)
  if (hideEmpty && (value === '' || value == null)) return null

  return (
    <tr>
      <th className="w-56 border px-3 py-1 text-left align-top font-bold">
        {label}
      </th>
      <td className="border px-3 py-1 whitespace-pre-wrap">
        {value === '' || value == null ? '—' : value}
      </td>
    </tr>
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
  const [assemblies, setAssemblies] = useState<AssemblyRow[]>([])
  const [quantities, setQuantities] = useState<QuantityRow[]>([])
  const [hideEmpty, setHideEmpty] = useState(false)

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

      const [componentsRes, assembliesRes, quantitiesRes] = await Promise.all([
        supabase
          .from('Components')
          .select('*')
          .eq('version_id', latestVersion.id),
        supabase
          .from('Assemblies')
          .select('*')
          .eq('version_id', latestVersion.id)
          .order('id', { ascending: true }),
        supabase
          .from('RFE Quantities')
          .select('*')
          .eq('version_id', latestVersion.id),
      ])

      for (const { error } of [componentsRes, assembliesRes, quantitiesRes]) {
        if (error) console.error(error)
      }

      setComponents(
        [...(componentsRes.data ?? [])].sort(
          (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
        ),
      )
      setAssemblies(assembliesRes.data ?? [])
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

  return (
    <HideEmptyContext.Provider value={hideEmpty}>
      <div className="min-h-svh p-4 pt-16 bg-gray-100 print:bg-white print:p-0">
        <div className="mx-auto max-w-3xl bg-background text-foreground rounded-lg border p-8 print:border-0 print:rounded-none">
          <div className="mb-6 flex items-start justify-between print:hidden">
            <div>
              <h1 className="text-xl font-bold">
                {version.rfe_name || 'Untitled RFE'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Version {version.version_number ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hideEmpty"
                  checked={hideEmpty}
                  onCheckedChange={setHideEmpty}
                />
                <Label htmlFor="hideEmpty">Hide empty fields</Label>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Print
              </button>
            </div>
          </div>

          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold">
              {version.rfe_name || 'Untitled RFE'}
            </h1>
            <p className="text-sm">Version {version.version_number ?? '—'}</p>
          </div>

          <div className="flex flex-col gap-6">
            <Section title="Request for Estimate">
              <FieldTable>
                <FieldRow label="Name" value={version.rfe_name} />
                <FieldRow
                  label="Due Date"
                  value={
                    version.due_date
                      ? new Date(version.due_date).toLocaleDateString()
                      : null
                  }
                />
                <FieldRow label="Customer" value={version.customer_name} />
                <FieldRow
                  label="Customer Number"
                  value={version.customer_number}
                />
                <FieldRow label="Sales Rep" value={version.sales_rep} />
                <FieldRow label="Job Type" value={version.job_type} />
                <FieldRow
                  label="Previous Job Number"
                  value={version.previous_job_number}
                />
                <FieldRow
                  label="Changes from Previous Job"
                  value={version.changes_from_prev}
                />
                <FieldRow label="Description" value={version.description} />
                {quantities.length === 0 ? (
                  <FieldRow label="Quantities" value={null} />
                ) : (
                  quantities.map((q, i) => (
                    <FieldRow
                      key={i}
                      label={`Quantity ${i + 1}`}
                      value={q.quantity ?? null}
                    />
                  ))
                )}
              </FieldTable>
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
                    <FieldTable>
                      <FieldRow label="Name" value={c.component_name} />
                      <FieldRow label="Finished Size" value={c.final_size} />
                      <FieldRow label="Flat Size" value={c.flat_size} />
                      <FieldRow label="Stock" value={c.stock} />
                      <FieldRow label="Coating" value={c.coating} />
                      <FieldRow label="Source" value={c.source} />
                      <FieldRow
                        label="Source Job Number"
                        value={c.job_number}
                      />
                    </FieldTable>
                  </div>
                ))
              )}
            </Section>

            <Section title="Assemblies">
              {assemblies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assemblies.</p>
              ) : (
                assemblies.map((assembly, i) => (
                  <div key={assembly.id} className="flex flex-col gap-1 pb-2">
                    <p className="font-bold underline">Assembly {i + 1}</p>
                    {/* A lone assembly gets every unit, and a lone component is
                      the unit itself, so unit qty only matters when both vary. */}
                    {assemblies.length > 1 && components.length !== 1 && (
                      <Field
                        label="Unit Qty"
                        value={formatUnitCounts(assembly.num_of_units)}
                      />
                    )}
                    {components.length !== 1 &&
                      (assembly.unit_build?.length ?? 0) > 0 && (
                        <table className="mt-1 w-fit border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border px-3 py-1 text-left">
                                Component
                              </th>
                              <th className="border px-3 py-1 text-left">
                                Qty per Unit
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(assembly.unit_build ?? []).map((item, j) => (
                              <tr key={j}>
                                <td className="border px-3 py-1">
                                  {item.component_name || 'Untitled component'}
                                </td>
                                <td className="border px-3 py-1">
                                  {item.qty_per_unit ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    <Field label="Pack Type" value={assembly.pack_type} />
                    <Field
                      label="Units per Pack"
                      value={assembly.units_per_pack}
                    />
                    {(assembly.steps?.length ?? 0) === 0 ? (
                      <Field label="Instructions" value={null} />
                    ) : (
                      <div>
                        <span className="font-bold">Instructions:</span>
                        <ol className="list-decimal pl-8">
                          {[...(assembly.steps ?? [])]
                            .sort((a, b) => a.step - b.step)
                            .map((step) => (
                              <li key={step.step}>{step.instruction}</li>
                            ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))
              )}
            </Section>

            <Section title="Shipping">
              <FieldTable>
                <FieldRow
                  label="Total Number of Shipments"
                  value={version.num_of_shipments}
                />
                <FieldRow label="Shipment Method" value={version.ship_method} />
                <FieldRow
                  label="Advanced Shipping Notice (ASN) Required"
                  value={version.asn_required ? 'Yes' : 'No'}
                />
                {version.asn_required && (
                  <FieldRow
                    label="ASN Instructions"
                    value={version.asn_instructions}
                  />
                )}
                <FieldRow
                  label="Approval Needed Prior to Ship"
                  value={version.approval_required ? 'Yes' : 'No'}
                />
                <FieldRow
                  label="International Shipment"
                  value={version.intl_shipment ? 'Yes' : 'No'}
                />
                {version.intl_shipment && (
                  <>
                    <FieldRow label="USNPC Code" value={version.usnpc_code} />
                    <FieldRow label="Customs Value" value={version.customs_value} />
                    <FieldRow
                      label="Customs Description"
                      value={version.customs_description}
                    />
                  </>
                )}
              </FieldTable>
            </Section>
          </div>
        </div>
      </div>
    </HideEmptyContext.Provider>
  )
}

export default RfeView
