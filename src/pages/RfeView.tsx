import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { derivePackoutQtys, formatByTier, packLayerName } from '@/lib/form'
import { loadRfe, type LoadedRfe } from '@/lib/loadRfe'

// Set by the "Hide empty fields" toggle; read by every FieldRow.
const HideEmptyContext = createContext(false)

// Label/value table for a group of fields. Rows respect the "Hide empty
// fields" toggle.
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

const yesNo = (value?: boolean) => (value ? 'Yes' : 'No')

function RfeView() {
  const { rfeId } = useParams<{ rfeId: string }>()
  const [loading, setLoading] = useState(true)
  const [rfe, setRfe] = useState<LoadedRfe | null>(null)
  const [hideEmpty, setHideEmpty] = useState(false)

  useEffect(() => {
    if (!rfeId) return
    loadRfe(rfeId).then((loaded) => {
      setRfe(loaded)
      setLoading(false)
    })
  }, [rfeId])

  if (loading) {
    return (
      <div className="min-h-svh p-4 pt-16 bg-gray-100">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!rfe) {
    return (
      <div className="min-h-svh p-4 pt-16 bg-gray-100">
        <p className="text-sm text-muted-foreground">RFE not found.</p>
      </div>
    )
  }

  const { versionNumber, values } = rfe
  const title = (
    <>
      <h1 className="text-xl font-bold">{values.name || 'Untitled RFE'}</h1>
      <p className="text-sm text-muted-foreground">Version {versionNumber ?? '—'}</p>
    </>
  )

  return (
    <HideEmptyContext.Provider value={hideEmpty}>
      <div className="min-h-svh p-4 pt-16 bg-gray-100 print:bg-white print:p-0">
        <div className="mx-auto max-w-3xl bg-background text-foreground rounded-lg border p-8 print:border-0 print:rounded-none">
          <div className="mb-6 flex items-start justify-between print:hidden">
            <div>{title}</div>
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

          <div className="hidden print:block mb-6">{title}</div>

          <div className="flex flex-col gap-6">
            <Section title="Request for Estimate">
              <FieldTable>
                <FieldRow label="Name" value={values.name} />
                <FieldRow label="Due Date" value={values.dueDate?.toLocaleDateString()} />
                <FieldRow label="Customer" value={values.customer} />
                <FieldRow label="Customer Number" value={values.customerNumber} />
                <FieldRow label="Sales Rep" value={values.salesRep} />
                <FieldRow label="Job Type" value={values.jobType} />
                <FieldRow label="Previous Job Number" value={values.prevJobNumber} />
                <FieldRow label="Changes from Previous Job" value={values.changesFromPrev} />
                <FieldRow label="Description" value={values.description} />
                <FieldRow label="Quantity(s)" value={values.qty.join(', ')} />
              </FieldTable>
            </Section>

            <Section title="Components">
              {values.components.length === 0 ? (
                <p className="text-sm text-muted-foreground">No components.</p>
              ) : (
                values.components.map((c, i) => (
                  <div key={c.id} className="flex flex-col gap-1 pb-2">
                    <p className="font-bold underline">
                      Component {i + 1}
                      {c.name ? ` — ${c.name}` : ''}
                    </p>
                    <FieldTable>
                      <FieldRow label="Name" value={c.name} />
                      <FieldRow label="Type" value={c.type} />
                      <FieldRow label="Finished Size" value={c.finalSize} />
                      <FieldRow label="Flat Size" value={c.flatSize} />
                      <FieldRow label="Stock" value={c.stock} />
                      <FieldRow label="Coating" value={c.coating} />
                      <FieldRow label="Source" value={c.source} />
                      <FieldRow label="Source Job Number" value={c.sourceJobNumber} />
                    </FieldTable>
                  </div>
                ))
              )}
            </Section>

            <Section title="Packouts">
              {values.packouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No packouts.</p>
              ) : (
                values.packouts.map((packout, i) => {
                  const steps = packout.kitSteps.filter((step) => step.instruction)
                  const derived = derivePackoutQtys(packout, values.qty, values.packouts.length > 1)
                  return (
                    <div key={packout.id} className="flex flex-col gap-1 pb-2">
                      <p className="font-bold underline">Packout {i + 1}</p>
                      {/* A lone component is the unit itself, so there's no kit build. */}
                      {values.components.length !== 1 && packout.kitItems.length > 0 && (
                        <table className="mb-1 w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border px-3 py-1 text-left">Component</th>
                              <th className="border px-3 py-1 text-left">Per Unit</th>
                              {packout.qty.map((units, t) => (
                                <th key={t} className="border px-3 py-1 text-left">
                                  {units} units
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {packout.kitItems.map((item, k) => (
                              <tr key={item.componentId}>
                                <td className="border px-3 py-1">
                                  {item.componentName || 'Untitled component'}
                                </td>
                                <td className="border px-3 py-1">{item.qtyPerKit}</td>
                                {(derived.kitItemPieces[k] ?? []).map((pieces, t) => (
                                  <td key={t} className="border px-3 py-1">{pieces}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <FieldTable>
                        {values.packouts.length > 1 && (
                          <FieldRow label="Units" value={formatByTier(packout.qty, values.qty)} />
                        )}
                        <FieldRow
                          label="Packing"
                          value={
                            packout.packing.length > 0 && (
                              <ol className="list-decimal pl-5">
                                {packout.packing.map((layer, l) => {
                                  const inner = l === 0 ? 'units' : packLayerName(packout.packing[l - 1])
                                  const totals = derived.packTotals[l]
                                  return (
                                    <li key={layer.id}>
                                      {packLayerName(layer)}
                                      {layer.qtyPer != null && ` — ${layer.qtyPer} ${inner} per pack`}
                                      {totals && `; ${formatByTier(totals, values.qty)} total`}
                                    </li>
                                  )
                                })}
                              </ol>
                            )
                          }
                        />
                        <FieldRow
                          label="Kit Steps"
                          value={
                            steps.length > 0 && (
                              <ol className="list-decimal pl-5">
                                {steps.map((step, s) => (
                                  <li key={s}>{step.instruction}</li>
                                ))}
                              </ol>
                            )
                          }
                        />
                      </FieldTable>
                    </div>
                  )
                })
              )}
            </Section>

            <Section title="Shipping">
              <FieldTable>
                <FieldRow label="Total Number of Shipments" value={formatByTier(values.totalShipments.map((s) => Number(s.qty) || 0), values.qty)} />
                <FieldRow
                  label="Overage Instructions"
                  value={
                    values.totalShipments
                      .map((s, i) => (s.overageAction ? `${s.overageAction}${values.qty.length > 1 ? ` @ ${values.qty[i] ?? '—'}` : ''}` : null))
                      .filter(Boolean)
                      .join('; ') || null
                  }
                />
                <FieldRow label="Shipment Method" value={values.shipMethod} />
                <FieldRow label="Label Instructions" value={values.labelInstructions} />
                <FieldRow
                  label="Advanced Shipping Notice (ASN) Required"
                  value={yesNo(values.asnRequired)}
                />
                {values.asnRequired && (
                  <FieldRow label="ASN Instructions" value={values.asnInstructions} />
                )}
                <FieldRow
                  label="Approval Needed Prior to Ship"
                  value={yesNo(values.approvalNeededPriorToShip)}
                />
                <FieldRow label="International Shipment" value={yesNo(values.internationalShipment)} />
                {values.internationalShipment && (
                  <>
                    <FieldRow label="USNPC Code" value={values.usnpcCode} />
                    <FieldRow label="Customs Value" value={values.customsValue} />
                    <FieldRow label="Customs Description" value={values.customsDescription} />
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
