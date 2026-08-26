import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getCategoryFromBirthDate, hasCategoryChanged } from '../lib/categoryUtils'
import { createChildSearcher, searchChildrenSplit } from '../lib/fuzzySearch'
import { parseCommand, resolveCategoryLabel, parseSpanishDate } from '../lib/coderCommands'
import { CATEGORY_LABELS, type Category, type CoordinatorRequest } from '../types/domain'

export type ChildRow = { id: string; full_name: string; birth_date: string | null; category: Category | null }
type ActionStatus = 'thinking' | 'done'
type ActionState = { status: ActionStatus; name: string; to: Category }

export type PendingCommand =
  | { type: 'rename'; newName: string; candidates: ChildRow[] }
  | { type: 'category'; target: Category; targetLabel: string; candidates: ChildRow[] }
  | { type: 'birthdate'; isoDate: string; displayDate: string; candidates: ChildRow[] }

// Shared behind both CoderPage (the full Dock tab) and the mini header
// popover, so the command bar and the requests inbox behave identically in
// both places — same alerts, same live sync, same confirm-before-write
// safety, just presented at two different sizes.
export function useCoderState() {
  const { session } = useAuth()
  // CoderHeaderLink and CoderPage can both be mounted at once (the header
  // link lives in Layout, always on screen) — each needs its own realtime
  // channel name, or the second `.channel(sameName)` collides with the
  // first's subscription instead of opening an independent one.
  const instanceId = useId()
  const [children, setChildren] = useState<ChildRow[]>([])
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [actions, setActions] = useState<Record<string, ActionState>>({})
  const [commandText, setCommandText] = useState('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const [commandResult, setCommandResult] = useState<{ status: 'thinking' | 'done'; message: string } | null>(null)

  const fetchChildren = useCallback(async () => {
    const { data } = await supabase.from('children').select('id, full_name, birth_date, category')
    setChildren((data ?? []) as ChildRow[])
  }, [])

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, profiles!coordinator_requests_author_id_fkey(full_name)')
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as CoordinatorRequest[])
  }, [])

  useEffect(() => { fetchChildren() }, [fetchChildren])
  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel(`coder-state-children-sync-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => fetchChildren())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [instanceId, fetchChildren])

  useEffect(() => {
    const channel = supabase
      .channel(`coder-state-requests-sync-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [instanceId, fetchRequests])

  const alerts = useMemo(
    () =>
      children
        .filter(hasCategoryChanged)
        .filter((c) => !(c.id in actions))
        .map((c) => ({ id: c.id, name: c.full_name, to: getCategoryFromBirthDate(c.birth_date) as Category }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [children, actions]
  )

  const missingBirthDate = useMemo(() => children.filter((c) => !c.birth_date).length, [children])

  async function resolveRequest(id: string) {
    setResolvingId(id)
    await supabase
      .from('coordinator_requests')
      .update({ status: 'resuelta', resolved_by: session?.user.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setResolvingId(null)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  async function graduate(a: { id: string; name: string; to: Category }) {
    setActions((prev) => ({ ...prev, [a.id]: { status: 'thinking', name: a.name, to: a.to } }))
    const { error } = await supabase.rpc('sync_child_category', { p_child_id: a.id, p_category: a.to })
    if (error) {
      setActions((prev) => { const next = { ...prev }; delete next[a.id]; return next })
      return
    }
    await new Promise((r) => setTimeout(r, 550))
    setActions((prev) => ({ ...prev, [a.id]: { status: 'done', name: a.name, to: a.to } }))
    setTimeout(() => {
      setActions((prev) => { const next = { ...prev }; delete next[a.id]; return next })
    }, 2200)
  }

  function fillTemplate(template: string) {
    setCommandText(template)
    setCommandError(null)
    setPendingCommand(null)
  }

  function submitCommand() {
    setCommandError(null)
    setPendingCommand(null)
    const parsed = parseCommand(commandText)
    if (!parsed) {
      setCommandError('No entendí ese comando. Toca una de las tarjetas de arriba para ver cómo escribirlo, o prueba: "cambiar categoría de <nombre> a <categoría>".')
      return
    }
    const searcher = createChildSearcher(children)
    const { exact, suggestions } = searchChildrenSplit(searcher, parsed.nameQuery)
    const candidates = [...exact, ...suggestions].slice(0, 6)
    if (candidates.length === 0) {
      setCommandError(`No encontré a ningún niño parecido a "${parsed.nameQuery}".`)
      return
    }
    if (parsed.type === 'rename') {
      if (!parsed.newName) { setCommandError('Falta el nombre nuevo.'); return }
      setPendingCommand({ type: 'rename', newName: parsed.newName, candidates })
    } else if (parsed.type === 'birthdate') {
      const iso = parseSpanishDate(parsed.dateText)
      if (!iso) { setCommandError(`No entendí la fecha "${parsed.dateText}". Usa día/mes/año, ej. 15/03/2020.`); return }
      setPendingCommand({ type: 'birthdate', isoDate: iso, displayDate: parsed.dateText, candidates })
    } else {
      const target = resolveCategoryLabel(parsed.targetLabel)
      if (target === null) { setCommandError(`No reconozco la categoría "${parsed.targetLabel}".`); return }
      if (target === 'ambiguous') { setCommandError('¿Cuál Corderitos? Especifica "0-2 años" o "2-4 años".'); return }
      setPendingCommand({ type: 'category', target, targetLabel: CATEGORY_LABELS[target], candidates })
    }
  }

  async function executeCommand(child: ChildRow) {
    if (!pendingCommand) return
    const cmd = pendingCommand
    setPendingCommand(null)
    setCommandResult({ status: 'thinking', message: '' })
    const { error } =
      cmd.type === 'rename'
        ? await supabase.from('children').update({ full_name: cmd.newName }).eq('id', child.id)
        : cmd.type === 'birthdate'
        ? await supabase.from('children').update({ birth_date: cmd.isoDate }).eq('id', child.id)
        : await supabase.rpc('sync_child_category', { p_child_id: child.id, p_category: cmd.target })
    if (error) {
      setCommandResult(null)
      setCommandError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    await new Promise((r) => setTimeout(r, 500))
    setCommandResult({
      status: 'done',
      message:
        cmd.type === 'rename'
          ? `Listo — ahora se llama "${cmd.newName}".`
          : cmd.type === 'birthdate'
          ? `Listo — la fecha de nacimiento de ${child.full_name} quedó en ${cmd.displayDate}.`
          : `Listo — ${child.full_name} ahora está en ${cmd.targetLabel}.`,
    })
    setCommandText('')
    setTimeout(() => setCommandResult(null), 3000)
  }

  return {
    children, requests, resolvingId, actions,
    commandText, setCommandText, commandError, setCommandError,
    pendingCommand, setPendingCommand, commandResult,
    alerts, missingBirthDate,
    resolveRequest, graduate, fillTemplate, submitCommand, executeCommand,
  }
}
