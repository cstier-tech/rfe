import { Fragment, useEffect, useState } from 'react'
import { ChevronRightIcon, MoreVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type RfeVersion = {
  id: string
  rfe_id: string
  version_number: number | null
  created_at: string
  rfe_name: string | null
  customer_name: string | null
  due_date: string | null
  job_type: string | null
}

type ComponentRow = {
  id: string
  version_id: string
  component_name: string | null
  final_size: string | null
  stock: string | null
  coating: string | null
  flat_size: string | null
  quantity: string | null
  source: string | null
}

type PackRow = {
  id: number
  version_id: string
  pack_type: string | null
  qty_per_pack: string | null
  num_of_packs: string | null
}

type QuantityRow = {
  id: string
  version_id: string | null
  quantity: number | null
}

// One row per RFE — the latest version of it, since that's what carries the
// name/due date/customer/job type this table shows.
function latestPerRfe(versions: RfeVersion[]) {
  const latest = new Map<string, RfeVersion>()
  for (const version of versions) {
    const current = latest.get(version.rfe_id)
    if (
      !current ||
      (version.version_number ?? 0) > (current.version_number ?? 0)
    ) {
      latest.set(version.rfe_id, version)
    }
  }
  return [...latest.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
}

function groupByVersionId<T extends { version_id: string | null }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    if (!row.version_id) continue
    grouped.set(row.version_id, [...(grouped.get(row.version_id) ?? []), row])
  }
  return grouped
}

// Every version of each RFE (not just the latest), newest first, for the
// version history table in the expanded row.
function groupByRfeId(versions: RfeVersion[]) {
  const grouped = new Map<string, RfeVersion[]>()
  for (const version of versions) {
    grouped.set(version.rfe_id, [...(grouped.get(version.rfe_id) ?? []), version])
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))
  }
  return grouped
}

function Dashboard() {
  const navigate = useNavigate()
  const [rfes, setRfes] = useState<RfeVersion[]>([])
  const [versionsByRfe, setVersionsByRfe] = useState(
    new Map<string, RfeVersion[]>(),
  )
  const [componentsByVersion, setComponentsByVersion] = useState(
    new Map<string, ComponentRow[]>(),
  )
  const [packsByVersion, setPacksByVersion] = useState(
    new Map<string, PackRow[]>(),
  )
  const [quantitiesByVersion, setQuantitiesByVersion] = useState(
    new Map<string, QuantityRow[]>(),
  )
  const [expanded, setExpanded] = useState(new Set<string>())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [versions, components, packs, quantities] = await Promise.all([
        supabase.from('RFE Versions').select('*'),
        supabase.from('Components').select('*'),
        supabase.from('Packs').select('*'),
        supabase.from('RFE Quantities').select('*'),
      ])

      for (const { error } of [versions, components, packs, quantities]) {
        if (error) console.error(error)
      }

      setRfes(latestPerRfe(versions.data ?? []))
      setVersionsByRfe(groupByRfeId(versions.data ?? []))
      setComponentsByVersion(groupByVersionId(components.data ?? []))
      setPacksByVersion(groupByVersionId(packs.data ?? []))
      setQuantitiesByVersion(groupByVersionId(quantities.data ?? []))
      setLoading(false)
    }

    load()
  }, [])

  const toggle = (rfeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(rfeId)) next.delete(rfeId)
      else next.add(rfeId)
      return next
    })
  }

  return (
    <div className="min-h-svh p-4 pt-16 bg-gray-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-lg font-semibold">RFEs</h1>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rfes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RFEs submitted yet.</p>
        ) : (
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfes.map((rfe) => {
                  const isOpen = expanded.has(rfe.rfe_id)
                  return (
                    <Fragment key={rfe.rfe_id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggle(rfe.rfe_id)}
                        aria-expanded={isOpen}
                      >
                        <TableCell>
                          <ChevronRightIcon
                            className={cn(
                              'size-4 text-muted-foreground transition-transform',
                              isOpen && 'rotate-90',
                            )}
                          />
                        </TableCell>
                        <TableCell>{rfe.rfe_name || '—'}</TableCell>
                        <TableCell>
                          {rfe.due_date
                            ? new Date(rfe.due_date).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>{rfe.customer_name || '—'}</TableCell>
                        <TableCell>{rfe.job_type || '—'}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Actions"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/rfe/${rfe.rfe_id}/edit`)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(`/rfe/${rfe.rfe_id}/duplicate`)
                                }
                              >
                                Duplicate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${rfe.rfe_id}-details`}>
                          <TableCell colSpan={6} className="whitespace-normal bg-muted/30">
                            <div className="flex flex-col gap-4 p-2">
                              <DetailTable
                                title="Versions"
                                rows={versionsByRfe.get(rfe.rfe_id) ?? []}
                                columns={[
                                  {
                                    label: 'Version',
                                    render: (r) => r.version_number ?? '—',
                                  },
                                  {
                                    label: 'Created',
                                    render: (r) =>
                                      new Date(r.created_at).toLocaleString(),
                                  },
                                ]}
                              />
                              <DetailTable
                                title="Quantities"
                                rows={quantitiesByVersion.get(rfe.id) ?? []}
                                columns={[
                                  { label: 'Quantity', render: (r) => r.quantity ?? '—' },
                                ]}
                              />
                              <DetailTable
                                title="Components"
                                rows={componentsByVersion.get(rfe.id) ?? []}
                                columns={[
                                  { label: 'Name', render: (r) => r.component_name || '—' },
                                  { label: 'Final Size', render: (r) => r.final_size || '—' },
                                  { label: 'Flat Size', render: (r) => r.flat_size || '—' },
                                  { label: 'Stock', render: (r) => r.stock || '—' },
                                  { label: 'Coating', render: (r) => r.coating || '—' },
                                  { label: 'Qty', render: (r) => r.quantity || '—' },
                                  { label: 'Source', render: (r) => r.source || '—' },
                                ]}
                              />
                              <DetailTable
                                title="Packs"
                                rows={packsByVersion.get(rfe.id) ?? []}
                                columns={[
                                  { label: 'Pack Type', render: (r) => r.pack_type || '—' },
                                  { label: 'Qty per Pack', render: (r) => r.qty_per_pack || '—' },
                                  { label: 'Num of Packs', render: (r) => r.num_of_packs || '—' },
                                ]}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

type Column<T> = {
  label: string
  render: (row: T) => React.ReactNode
}

function DetailTable<T extends { id: string | number }>({
  title,
  rows,
  columns,
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.label}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.label}>{col.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default Dashboard
