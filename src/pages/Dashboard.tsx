import { Fragment, useEffect, useState } from 'react'
import { Check, ChevronRightIcon, MoreVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { formatByTier, packLayerName, type PackoutBuild } from '@/lib/form'
import { loadPackoutBuild } from '@/lib/loadRfe'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  source: string | null
  sort_order: string | null
  type: string | null
  other_type: string | null
}

type PackoutRow = {
  id: number
  version_id: string
  packout_build: PackoutBuild | null
}

type QuantityRow = {
  id: string
  version_id: string | null
  quantity: number | null
}

type RfeRow = {
  id: string
  is_job: boolean | null
  switched_to_job_date: string | null
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
  const [packoutsByVersion, setPackoutsByVersion] = useState(
    new Map<string, PackoutRow[]>(),
  )
  const [quantitiesByVersion, setQuantitiesByVersion] = useState(
    new Map<string, QuantityRow[]>(),
  )
  const [rfeById, setRfeById] = useState(new Map<string, RfeRow>())
  const [expanded, setExpanded] = useState(new Set<string>())
  const [pendingDelete, setPendingDelete] = useState<RfeVersion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [versions, components, packouts, quantities, rfes] =
        await Promise.all([
          supabase.from('RFE Versions').select('*'),
          supabase.from('Components').select('*'),
          supabase.from('Packouts').select('*').order('id', { ascending: true }),
          supabase.from('RFE Quantities').select('*'),
          supabase.from('RFEs').select('*'),
        ])

      for (const { error } of [versions, components, packouts, quantities, rfes]) {
        if (error) console.error(error)
      }

      const sortedComponents = [...(components.data ?? [])].sort(
        (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
      )

      setRfes(latestPerRfe(versions.data ?? []))
      setVersionsByRfe(groupByRfeId(versions.data ?? []))
      setComponentsByVersion(groupByVersionId(sortedComponents))
      setPackoutsByVersion(groupByVersionId(packouts.data ?? []))
      setQuantitiesByVersion(groupByVersionId(quantities.data ?? []))
      setRfeById(new Map((rfes.data ?? []).map((r) => [r.id, r])))
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

  const switchToJob = async (rfeId: string) => {
    const switchedToJobDate = new Date().toISOString()
    const { error } = await supabase
      .from('RFEs')
      .update({ is_job: true, switched_to_job_date: switchedToJobDate })
      .eq('id', rfeId)

    if (error) {
      console.error(error)
      return
    }

    setRfeById((prev) => {
      const next = new Map(prev)
      next.set(rfeId, { id: rfeId, is_job: true, switched_to_job_date: switchedToJobDate })
      return next
    })
  }

  // Child rows (versions, quantities, components, packouts, packout qtys,
  // packout items) are removed by ON DELETE CASCADE foreign keys in the DB,
  // so deleting the RFE row is enough.
  const deleteRfe = async (rfeId: string) => {
    const { error } = await supabase.from('RFEs').delete().eq('id', rfeId)

    if (error) {
      console.error(error)
      return
    }

    setRfes((prev) => prev.filter((r) => r.rfe_id !== rfeId))
    setVersionsByRfe((prev) => {
      const next = new Map(prev)
      next.delete(rfeId)
      return next
    })
    setRfeById((prev) => {
      const next = new Map(prev)
      next.delete(rfeId)
      return next
    })
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(rfeId)
      return next
    })
  }

  const pendingDeleteVersionCount = pendingDelete
    ? (versionsByRfe.get(pendingDelete.rfe_id)?.length ?? 0)
    : 0

  return (
    <div className="min-h-svh p-4 pt-16">
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
                  <TableHead>Job</TableHead>
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
                        <TableCell>
                          {rfeById.get(rfe.rfe_id)?.is_job ? (
                            <Check className="size-4 text-green-600" />
                          ) : null}
                        </TableCell>
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
                                onClick={() => navigate(`/rfe/${rfe.rfe_id}/view`)}
                              >
                                View
                              </DropdownMenuItem>
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
                              <DropdownMenuItem
                                onClick={() => switchToJob(rfe.rfe_id)}
                              >
                                Switch to Job
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setPendingDelete(rfe)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${rfe.rfe_id}-details`}>
                          <TableCell colSpan={7} className="whitespace-normal bg-muted/30">
                            <div className="flex flex-col gap-4 p-2">
                              <DetailTable
                                bgColor='bg-sky-600/3'
                                borderColor='border-sky-950/20'
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
                                bgColor='bg-orange-600/3'
                                borderColor='border-orange-950/20'
                                title="Quantities"
                                rows={quantitiesByVersion.get(rfe.id) ?? []}
                                columns={[
                                  { label: 'Quantity', render: (r) => r.quantity ?? '—' },
                                ]}
                              />
                              <DetailTable
                                bgColor='bg-purple-600/3'
                                borderColor='border-purple-950/20'
                                title="Components"
                                rows={componentsByVersion.get(rfe.id) ?? []}
                                columns={[
                                  { label: 'Name', render: (r) => r.component_name || '—' },
                                  { label: 'Finished Size', render: (r) => r.final_size || '—' },
                                  { label: 'Flat Size', render: (r) => r.flat_size || '—' },
                                  { label: 'Stock', render: (r) => r.stock || '—' },
                                  { label: 'Coating', render: (r) => r.coating || '—' },
                                  { label: 'Source', render: (r) => r.source || '—' },
                                ]}
                              />
                              <PackoutsDetail
                                packouts={packoutsByVersion.get(rfe.id) ?? []}
                                tiers={(quantitiesByVersion.get(rfe.id) ?? []).map((q) => q.quantity ?? undefined)}
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{pendingDelete?.rfe_name || 'Untitled RFE'}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the RFE and all{' '}
              {pendingDeleteVersionCount} version
              {pendingDeleteVersionCount === 1 ? '' : 's'}, including their
              components and packouts. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (pendingDelete) deleteRfe(pendingDelete.rfe_id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  borderColor,
  bgColor
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
  borderColor?: string
  bgColor?: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className={`rounded-sm border ${bgColor} ${borderColor}`} >
          <Table className={borderColor}>
            <TableHeader className={borderColor}>
              <TableRow className={borderColor}>
                {columns.map((col) => (
                  <TableHead className={borderColor} key={col.label}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow className={borderColor} key={row.id}>
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

function PackoutsDetail({ packouts, tiers }: { packouts: PackoutRow[]; tiers: (number | undefined)[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Builds</p>
      {packouts.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-sm border bg-green-600/3 border-green-950/20 p-2">
          {packouts.map((packout, i) => {
            const build = loadPackoutBuild(packout.packout_build)
            return (
              <div key={packout.id} className="flex flex-col gap-0.5 text-sm">
                <p className="font-medium">
                  Packout {i + 1} ({formatByTier(build.qty, tiers) ?? '—'} units)
                </p>
                {build.kitItems.map((item, j) => (
                  <p key={j} className="pl-3 text-muted-foreground">
                    {item.componentName || 'Untitled component'}: {item.qtyPerKit ?? '—'} per unit
                  </p>
                ))}
                {build.packing.map((layer, j) => (
                  <p key={layer.id} className="pl-3 text-muted-foreground">
                    Packed: {layer.qtyPer ?? '—'}{' '}
                    {j === 0 ? 'units' : packLayerName(build.packing[j - 1])} per {packLayerName(layer)}
                  </p>
                ))}
                {build.kitSteps.length > 0 && (
                  <ol className="mt-1 list-decimal pl-8 text-muted-foreground">
                    {build.kitSteps.map((step, s) => (
                      <li key={s}>{step.instruction}</li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dashboard
