import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, CheckCircle2, UserPlus, AlertTriangle, ChevronLeft, ChevronDown, Bug, Zap, Compass, Baby, PersonStanding, User, Pencil, LogIn, Trash2, X, Users, Check, FileWarning, Monitor } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { saveAttendance, newId, getPendingItems, onSynced, readCache, writeCache, pruneDatedCache } from '../lib/offline'
import { useAuth } from '../lib/auth'
import { getEffectiveCategory, hasCategoryChanged, getAgeLabel, requiresBadge, requiresPager } from '../lib/categoryUtils'
import { markRequestResolved } from '../lib/coordinatorRequests'
import { createChildSearcher, searchChildrenSplit, normalizeName } from '../lib/fuzzySearch'
import { CATEGORY_LABELS, CATEGORY_COLORS, NEXT_CATEGORY, ACTIVE_CATEGORIES, isCorderitos, type Category, type TeamColor, type ParentRow, type GuardianRelationship } from '../types/domain'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import { ChildContacts } from '../components/ui/ChildContacts'
import { EditChildModal, type EditableChild } from '../components/ui/EditChildModal'
import { AssignedMaestroField } from '../components/ui/AssignedMaestroField'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { useDebounce } from '../hooks/useDebounce'
import { BalloonBackground } from '../components/ui/BalloonBackground'
import { FloatingIconsBackground } from '../components/ui/FloatingIconsBackground'
import { SaltamontesBackground } from '../components/ui/SaltamontesBackground'
import { Corderitos02Background } from '../components/ui/Corderitos02Background'
import { Corderitos24Background } from '../components/ui/Corderitos24Background'
import { SoftGradientBackground } from '../components/ui/SoftGradientBackground'

// ─── Types ────────────────────────────────────────────────────────────────────

type TodayRecord = {
  id: string
  child_id: string
  category: Category
  badge_number: number | null
  pager_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  children: {
    full_name: string
    allergies: string | null
    medical_notes: string | null
    toilet_trained: boolean | null
    comments: string | null
  }
  assigned_teacher_id: string | null
  assigned_teacher: { full_name: string } | null
  /** Guardado solo en este dispositivo, esperando internet (lib/offline.ts). */
  pending?: boolean
}

type ChildResult = {
  id: string
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  toilet_trained: boolean | null
  comments: string | null
  guardian_relationship: GuardianRelationship | null
  photo_url: string | null
  assigned_maestro_id: string | null
  assigned_maestro_name: string | null
  parent_id: string | null
  parents: { full_name: string; phone: string } | null
  attendance: { session_date: string; badge_number?: number | null }[]
}

const CHILD_SELECT = 'id, full_name, birth_date, category, allergies, medical_notes, toilet_trained, comments, guardian_relationship, photo_url, assigned_maestro_id, assigned_maestro_name, parent_id, parents(full_name, phone)'

/** Botoncito de acción dentro de la tarjeta del niño. */
const CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 bg-white/80 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors'

type RosterChild = Omit<ChildResult, 'attendance'>
type TodayAtt = { child_id: string; badge_number: number | null }

/** Today's check-ins that were saved on this device without internet and
 * haven't uploaded yet, shown in "Registrados hoy" with a "Sin subir" tag. */
async function withPendingRecords(rows: TodayRecord[]): Promise<TodayRecord[]> {
  const { attendance, families } = await getPendingItems()
  if (attendance.length === 0) return rows
  const roster = readCache<RosterChild[]>('roster') ?? []
  const pendingKids = families.flatMap((f) => f.children)
  const known = new Set(rows.map((r) => r.id))
  const pendingRecords: TodayRecord[] = attendance
    .filter((a) => a.session_date === today && !known.has(a.id))
    .map((a) => {
      const c = roster.find((r) => r.id === a.child_id) ?? pendingKids.find((k) => k.id === a.child_id)
      return {
        id: a.id, child_id: a.child_id, category: a.category, badge_number: a.badge_number, pager_number: a.pager_number,
        checked_in_at: a.checked_in_at, checked_out_at: null, assigned_teacher_id: null, assigned_teacher: null, pending: true,
        children: {
          full_name: c?.full_name ?? 'Niño nuevo', allergies: c?.allergies ?? null, medical_notes: c?.medical_notes ?? null,
          toilet_trained: c?.toilet_trained ?? null, comments: c?.comments ?? null,
        },
      }
    })
  return [...pendingRecords, ...rows]
}

/** Roster (server rows or the cached copy) plus whatever was registered on
 * this device without internet and hasn't uploaded yet (lib/offline.ts). */
async function buildRoster(rows: RosterChild[], todayAtt: TodayAtt[]): Promise<ChildResult[]> {
  const pending = await getPendingItems()
  const knownIds = new Set(rows.map((c) => c.id))
  const pendingChildren: RosterChild[] = pending.families.flatMap((f) =>
    f.children.filter((c) => !knownIds.has(c.id)).map((c) => ({
      ...c,
      guardian_relationship: c.guardian_relationship as GuardianRelationship | null,
      photo_url: null,
      parents: { full_name: f.parent.full_name, phone: f.parent.phone ?? '' },
    }))
  )
  const all = pendingChildren.length
    ? [...rows, ...pendingChildren].sort((a, b) => a.full_name.localeCompare(b.full_name))
    : rows
  const attMap = new Map([
    ...todayAtt.map((a) => [a.child_id, a.badge_number] as const),
    ...pending.attendance.filter((a) => a.session_date === today).map((a) => [a.child_id, a.badge_number] as const),
  ])
  return all.map((c) => ({
    ...c,
    attendance: attMap.has(c.id) ? [{ session_date: today, badge_number: attMap.get(c.id) }] : [],
  }))
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_KEY        = 'ministerio_team_session'
const today = format(new Date(), 'yyyy-MM-dd')

function getStoredTeamForToday(): TeamColor | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    if (!raw) return null
    const { color, date } = JSON.parse(raw)
    return date === today ? (color as TeamColor) : null
  } catch { return null }
}

function persistTeam(color: TeamColor) {
  localStorage.setItem(TEAM_KEY, JSON.stringify({ color, date: today }))
}

const TEAM_META: Record<TeamColor, { label: string; bg: string; dot: string; text: string; cardBg: string; cardText: string }> = {
  rojo:     { label: 'Rojo',     bg: 'bg-red-500',    dot: 'bg-red-500',    text: 'text-white',    cardBg: 'bg-red-50',    cardText: 'text-red-700'    },
  amarillo: { label: 'Amarillo', bg: 'bg-yellow-400', dot: 'bg-yellow-400', text: 'text-gray-800', cardBg: 'bg-yellow-50', cardText: 'text-yellow-700' },
  azul:     { label: 'Azul',     bg: 'bg-blue-500',   dot: 'bg-blue-500',   text: 'text-white',    cardBg: 'bg-blue-50',   cardText: 'text-blue-700'   },
}

// Misma paleta que CATEGORY_COLORS (types/domain.ts) y CAT_CONFIG
// (ReportsPage.tsx) — Corderitos azul, Hormiguitas rojo, Saltamontes verde,
// Exploradores naranja. Este es un tercer mapeo independiente (tiles grandes
// de la pantalla de inicio) — mantenerlo sincronizado a mano si la paleta
// vuelve a cambiar. `ages` también viene de CATEGORY_AGE_RANGES a mano.
const TILES = [
  {
    category: 'hormiguitas' as Category,
    icon: Bug,
    ages: '4–6 años',
    cardBg: 'bg-red-100',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-700',
    bar: 'bg-red-500',
    barBg: 'bg-red-200/60',
    textColor: 'text-red-900',
  },
  {
    category: 'saltamontes' as Category,
    icon: Zap,
    ages: '7–9 años',
    cardBg: 'bg-green-100',
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-700',
    bar: 'bg-green-500',
    barBg: 'bg-green-200/60',
    textColor: 'text-green-900',
  },
  {
    category: 'exploradores' as Category,
    icon: Compass,
    ages: '10–12 años',
    cardBg: 'bg-orange-100',
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-700',
    bar: 'bg-orange-500',
    barBg: 'bg-orange-200/60',
    textColor: 'text-orange-900',
  },
  {
    category: 'corderitos_0_2' as Category,
    icon: Baby,
    ages: '1–2 años',
    cardBg: 'bg-sky-100',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-700',
    bar: 'bg-sky-500',
    barBg: 'bg-sky-200/60',
    textColor: 'text-sky-900',
  },
  {
    category: 'corderitos_2_4' as Category,
    icon: PersonStanding,
    ages: '3–4 años',
    cardBg: 'bg-blue-100',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-700',
    bar: 'bg-blue-500',
    barBg: 'bg-blue-200/60',
    textColor: 'text-blue-900',
  },
]

// ─── Team picker screen ───────────────────────────────────────────────────────

function TeamPickerScreen({
  onConfirm,
  initialCoordinator,
  initialComputerOperator,
}: {
  onConfirm: (color: TeamColor, coordinator: string, computerOperator: string) => void
  initialCoordinator: string
  initialComputerOperator: string
}) {
  const [coordinator, setCoordinator] = useState(initialCoordinator)
  useEffect(() => setCoordinator(initialCoordinator), [initialCoordinator])
  const [computerOperator, setComputerOperator] = useState(initialComputerOperator)
  useEffect(() => setComputerOperator(initialComputerOperator), [initialComputerOperator])

  const TEAMS: { color: TeamColor; hover: string }[] = [
    { color: 'rojo',     hover: 'hover:brightness-110' },
    { color: 'amarillo', hover: 'hover:brightness-105' },
    { color: 'azul',     hover: 'hover:brightness-110' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[70vh] flex flex-col items-center justify-center gap-8 py-8"
    >
      {/* Date */}
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {format(new Date(), 'EEEE', { locale: es })}
        </p>
        <p className="text-3xl font-black text-gray-900 mt-1">
          {format(new Date(), "d 'de' MMMM", { locale: es })}
        </p>
        <p className="text-base text-gray-400 mt-0.5">
          {format(new Date(), 'yyyy')}
        </p>
      </div>

      {/* Coordinator field */}
      <div className="w-full max-w-sm space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
          <User size={12} />
          ¿Quién está de encargado hoy?
        </label>
        <input
          type="text"
          value={coordinator}
          onChange={(e) => setCoordinator(e.target.value)}
          placeholder="Nombre del encargado…"
          autoComplete="off"
          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none shadow-sm"
        />
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 pt-2">
          <Monitor size={12} />
          ¿Quién está en la compu hoy?
        </label>
        <input
          type="text"
          value={computerOperator}
          onChange={(e) => setComputerOperator(e.target.value)}
          placeholder="Nombre del encargado de compu…"
          autoComplete="off"
          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none shadow-sm"
        />
      </div>

      {/* Prompt */}
      <div className="text-center space-y-1">
        <p className="text-xl font-bold text-gray-800">¿Cuál es el equipo de hoy?</p>
        <p className="text-sm text-gray-400">Selecciona antes de registrar niños</p>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-md">
        {TEAMS.map(({ color, hover }) => {
          const m = TEAM_META[color]
          return (
            <motion.button
              key={color}
              onClick={() => onConfirm(color, coordinator.trim(), computerOperator.trim())}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              className={`${m.bg} ${hover} ${m.text} rounded-3xl py-8 flex flex-col items-center gap-4 shadow-lg font-bold transition-all`}
            >
              <div className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-white/70" />
              </div>
              <span className="text-lg font-black tracking-wide">{m.label}</span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Child card ───────────────────────────────────────────────────────────────

function ObservationsPanel({
  allergies,
  medicalNotes,
  toiletTrained,
  comments,
}: {
  allergies: string | null
  medicalNotes: string | null
  toiletTrained: boolean | null
  comments: string | null
}) {
  return (
    <div className="space-y-2">
      {(allergies || medicalNotes) && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">⚠ Alerta médica</p>
          {allergies && <p className="text-sm text-red-700"><span className="font-semibold">Alergias:</span> {allergies}</p>}
          {medicalNotes && <p className="text-sm text-red-700"><span className="font-semibold">Notas:</span> {medicalNotes}</p>}
        </div>
      )}
      {toiletTrained !== null && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            toiletTrained
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          🚼 {toiletTrained ? 'Ya va solo al baño' : 'Aún usa pañal / no va solo al baño'}
        </div>
      )}
      {comments && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-600">
          <span className="font-semibold">Comentarios:</span> {comments}
        </div>
      )}
    </div>
  )
}

// Carries the persistent "maestro responsable" (children.assigned_maestro_id,
// picked from the `maestros` roster) forward into today's per-day claim
// (attendance.assigned_teacher_id, which points at `profiles` — app logins,
// a different table) so a coordinator doesn't have to re-pick the same
// person right after check-in. The two tables aren't linked by an FK, so
// this only fires on an exact, unambiguous name match — anything less
// certain and it just leaves the "Asignar maestro" button for a manual
// pick, same as before this existed. Fire-and-forget: never blocks or
// fails the check-in itself.
async function autoAssignTodayTeacher(attendanceId: string, maestroId: string) {
  const { data: maestro } = await supabase.from('maestros').select('nombre, apellido').eq('id', maestroId).single()
  if (!maestro) return
  const target = normalizeName(`${maestro.nombre} ${maestro.apellido}`)

  const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('active', true)
  if (!profiles) return
  const matches = profiles.filter((p) => normalizeName(p.full_name) === target)
  if (matches.length !== 1) return

  await supabase.rpc('assign_attendance_teacher', { p_attendance_id: attendanceId, p_teacher_id: matches[0].id })
}

// Who's personally responsible for a corderito right now (e.g. taking them
// to the bathroom) — restricted to corderitos categories only, since that's
// the age group where one adult needs to be directly accountable.
function AssignedTeacherControl({
  attendanceId,
  assignedId,
  assignedName,
  canChange,
  onChanged,
}: {
  attendanceId: string
  assignedId: string | null
  assignedName: string | null
  canChange: boolean
  onChanged: (teacherId: string | null, teacherName: string | null) => void
}) {
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[] | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || teachers) return
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => setTeachers((data as { id: string; full_name: string }[]) ?? []))
  }, [open, teachers])

  async function assign(teacherId: string) {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.rpc('assign_attendance_teacher', {
      p_attendance_id: attendanceId,
      p_teacher_id: teacherId || null,
    })
    setSaving(false)
    if (!err) {
      onChanged(teacherId || null, teachers?.find((t) => t.id === teacherId)?.full_name ?? null)
      setOpen(false)
    } else {
      setError('Solo el maestro asignado o un coordinador puede cambiarlo.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => canChange && setOpen(true)}
        disabled={!canChange}
        title={!canChange ? 'Solo el maestro asignado o un coordinador puede cambiarlo' : undefined}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${
          assignedName
            ? `bg-indigo-50 text-indigo-700 border border-indigo-200 ${canChange ? 'hover:bg-indigo-100' : 'cursor-default'}`
            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
        }`}
      >
        {!canChange && '🔒 '}🧑‍🏫 {assignedName ? `Encargado: ${assignedName}` : 'Asignar maestro (baño, etc.)'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          autoFocus
          disabled={saving || !teachers}
          defaultValue={assignedId ?? ''}
          onChange={(e) => assign(e.target.value)}
          className="text-xs px-2 py-1.5 border-2 border-indigo-300 rounded-lg focus:outline-none bg-white"
        >
          <option value="">{teachers ? 'Sin asignar' : 'Cargando…'}</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-300 hover:text-gray-500 rounded-lg">
          <X size={13} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

function ChildCard({
  child,
  teamColor,
  isSelected,
  isAdmin,
  onSelect,
  onDeselect,
  onRegistered,
  onCategoryChanged,
  onEdited,
  onDeleted,
  todayRecord,
  onEditAttendance,
  onRemoveAttendance,
}: {
  child: ChildResult
  teamColor: TeamColor
  isSelected: boolean
  isAdmin: boolean
  onSelect: () => void
  onDeselect: () => void
  onRegistered: (childId: string, badgeNumber: number | null) => void
  onCategoryChanged: (childId: string, newCategory: Category) => void
  onEdited: (childId: string, patch: Partial<EditableChild>) => void
  onDeleted: (childId: string) => void
  /** Today's check-in for this child, if any — lets a tap on an
   * already-registered card fix its gafete/bíper or undo it right here. */
  todayRecord?: TodayRecord
  onEditAttendance: (id: string, badge: number | null, pager: number | null) => Promise<string | null>
  onRemoveAttendance: (id: string) => Promise<string | null>
}) {
  // Overrides getEffectiveCategory() once a coordinator changes the category
  // right here — everything below (needsBadge/needsPager/the check-in insert
  // itself) reads `category`, so this has to win immediately, not just be a
  // cosmetic badge swap, or check-in right after a change would still use
  // the stale category.
  const [categoryOverride, setCategoryOverride] = useState<Category | null>(null)
  const category = categoryOverride ?? getEffectiveCategory(child)
  const categoryChanged = hasCategoryChanged(child)
  const age = getAgeLabel(child.birth_date)
  const alreadyIn = child.attendance.some((a) => a.session_date === today)
  const todayBadgeNumber = child.attendance.find((a) => a.session_date === today)?.badge_number
  const hasAlert = !!(child.allergies || child.medical_notes)
  const missingBirthDate = !child.birth_date
  const needsBadge = requiresBadge(category)
  const needsPager = requiresPager(category)

  const [badge, setBadge] = useState('')
  const [pager, setPager] = useState('')
  // Maestro responsable, editable inline en el paso de confirmar Corderitos
  // — evita un viaje aparte a "Editar niño" justo cuando ya se nota que
  // nadie se lo ha puesto. Se guarda en `children` junto con el check-in.
  const [maestroId, setMaestroId] = useState<string | null>(child.assigned_maestro_id)
  const [maestroName, setMaestroName] = useState<string | null>(child.assigned_maestro_name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStamp, setShowStamp] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [showObservations, setShowObservations] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const badgeRef = useRef<HTMLInputElement>(null)
  const hasObservations = !!(child.allergies || child.medical_notes || child.comments || child.toilet_trained !== null)

  useEffect(() => {
    if (isSelected && needsBadge && !alreadyIn) {
      setTimeout(() => badgeRef.current?.focus(), 50)
    }
  }, [isSelected, needsBadge, alreadyIn])

  // ── Ya registrado hoy: tocar la tarjeta abre corrección de gafete/bíper ──
  const [editBadge, setEditBadge] = useState('')
  const [editPager, setEditPager] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => {
    if (!isSelected || !alreadyIn) return
    setEditBadge(todayRecord?.badge_number != null ? String(todayRecord.badge_number) : '')
    setEditPager(todayRecord?.pager_number != null ? String(todayRecord.pager_number) : '')
    setEditError(null)
    setConfirmRemove(false)
  }, [isSelected, alreadyIn, todayRecord?.badge_number, todayRecord?.pager_number])

  async function saveRecordEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!todayRecord) return
    const b = editBadge.trim() ? parseInt(editBadge, 10) : null
    const pg = editPager.trim() ? parseInt(editPager, 10) : null
    if (needsBadge && (b === null || isNaN(b) || b <= 0)) { setEditError('Ingresa un número de gafete válido.'); return }
    if (pg !== null && (isNaN(pg) || pg <= 0)) { setEditError('Número de bíper inválido.'); return }
    setSavingEdit(true)
    setEditError(null)
    const err = await onEditAttendance(todayRecord.id, needsBadge ? b : null, pg)
    setSavingEdit(false)
    if (err) { setEditError(err); return }
    onDeselect()
  }

  async function removeRecord() {
    if (!todayRecord) return
    setSavingEdit(true)
    setEditError(null)
    const err = await onRemoveAttendance(todayRecord.id)
    setSavingEdit(false)
    if (err) { setEditError(err); return }
    onDeselect()
  }

  async function doCheckIn(badgeNumber: number | null, pagerNumber: number | null) {
    if (!category) { setError('Este niño no tiene categoría asignada. Complétala en Familias.'); return }
    setSubmitting(true)
    setError(null)
    const attendanceId = newId()
    const { queued, error: err } = await saveAttendance({
      id: attendanceId,
      child_id: child.id,
      session_date: today,
      team_color: teamColor,
      category,
      badge_number: badgeNumber,
      pager_number: pagerNumber,
      checked_in_at: new Date().toISOString(),
    }, child.full_name)
    if (err) {
      setSubmitting(false)
      if (err.code === '23505' && err.message.includes('attendance_badge_category_unique')) {
        setError(`El gafete #${badgeNumber} ya está en uso en ${CATEGORY_LABELS[category]} hoy.`)
      } else if (err.code === '23505' && err.message.includes('attendance_pager_category_unique')) {
        setError(`El bíper #${pagerNumber} ya está en uso en ${CATEGORY_LABELS[category]} hoy.`)
      } else if (err.code === '23505') {
        setError('Este niño ya fue registrado hoy.')
      } else {
        setError('Error al registrar. Intenta de nuevo.')
      }
      return
    }
    // Category no longer auto-syncs to age on check-in — a coordinator's
    // manual category change (FamiliesPage) must stick until someone moves
    // it again by hand, even past the child's next birthday. The 🎉 badge
    // above (hasCategoryChanged) still nudges that a child can graduate;
    // moving them is a deliberate edit, not something check-in does silently.
    setSubmitting(false)
    setBadge('')
    setPager('')
    setShowStamp(true)
    // Sin internet (queued) esto se omite: el check-in en sí ya quedó en
    // cola, y el maestro responsable se puede poner después.
    if (!queued && isCorderitos(category)) {
      // El maestro responsable pudo haberse puesto o cambiado justo aquí en
      // el paso de confirmar (ver el bloque de Corderitos más abajo) — se
      // guarda junto con el check-in en vez de forzar un viaje aparte a
      // "Editar niño".
      const maestroChanged = maestroId !== child.assigned_maestro_id || maestroName !== child.assigned_maestro_name
      if (maestroChanged) {
        await supabase.from('children').update({ assigned_maestro_id: maestroId, assigned_maestro_name: maestroName }).eq('id', child.id)
        onEdited(child.id, { assigned_maestro_id: maestroId, assigned_maestro_name: maestroName })
      }
      if (maestroId) autoAssignTodayTeacher(attendanceId, maestroId)
    }
    setTimeout(() => {
      setShowStamp(false)
      onRegistered(child.id, badgeNumber)
    }, 1600)
  }

  async function changeCategory(newCategory: Category) {
    setShowCategoryPicker(false)
    if (newCategory === category) return
    setSavingCategory(true)
    setCategoryError(null)
    const { error } = await supabase.from('children').update({ category: newCategory }).eq('id', child.id)
    setSavingCategory(false)
    if (error) { setCategoryError('No se pudo cambiar la categoría.'); return }
    setCategoryOverride(newCategory)
    onCategoryChanged(child.id, newCategory)
  }

  // Auto-check-in for no-badge, non-corderitos categories reads fresh values
  // via this ref instead of depending on `doCheckIn`/`needsBadge`/`alreadyIn`
  // directly — those change identity every render, so including them as
  // effect deps would either miss updates (stale closure) or re-fire the
  // check-in on every unrelated re-render while still selected. Corderitos is
  // excluded here on purpose — it gets a manual confirm step below so the
  // maestro always sees allergy/medical/baño info before registering a baby.
  const latest = useRef({ needsBadge, alreadyIn, category, doCheckIn })
  latest.current = { needsBadge, alreadyIn, category, doCheckIn }

  useEffect(() => {
    if (!isSelected) return
    const { needsBadge, alreadyIn, category, doCheckIn } = latest.current
    if (!needsBadge && !isCorderitos(category) && !alreadyIn && category) {
      doCheckIn(null, null)
    }
  }, [isSelected])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(badge, 10)
    if (!badge || isNaN(num) || num <= 0) { setError('Ingresa un número válido.'); return }
    doCheckIn(num, pager ? parseInt(pager, 10) : null)
  }

  // El card entero es el blanco de tap/click para seleccionar — antes solo
  // el bloque del encabezado (nombre/categoría) lo era, así que tocar más
  // abajo (donde antes solo había padding vacío) no hacía nada. Cada control
  // interactivo dentro (observaciones, contactos, cambiar categoría, editar
  // niño, el formulario de gafete/bíper) para la propagación del click para
  // no disparar selección/deselección de paso.
  // Ya registrado también se puede tocar: abre la corrección de gafete/bíper.
  const canToggleSelect = !submitting && !!category
  return (
    <div className="relative">
    <div
      className={`rounded-2xl border-2 overflow-hidden transition-all ${canToggleSelect ? 'cursor-pointer' : ''} ${
        alreadyIn
          ? isSelected ? 'border-emerald-400 bg-emerald-50 shadow-md' : 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300'
          : isSelected
          ? 'border-indigo-500 bg-white shadow-lg shadow-indigo-900/5 ring-4 ring-indigo-100'
          : 'border-transparent bg-white shadow-sm hover:border-indigo-200'
      }`}
      role="button"
      tabIndex={canToggleSelect ? 0 : -1}
      onClick={canToggleSelect ? (isSelected ? onDeselect : onSelect) : undefined}
      onKeyDown={canToggleSelect ? (e) => {
        // Solo cuando el foco está en la tarjeta misma. Antes el Enter del
        // campo de gafete subía hasta aquí, cancelaba el envío del
        // formulario y cerraba la tarjeta — "das enter y no registra".
        if (e.target !== e.currentTarget) return
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (isSelected) onDeselect(); else onSelect()
      } : undefined}
    >
      {/* ── Card header ── */}
      <div className="w-full text-left px-4 pt-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-display font-semibold text-gray-900 text-lg leading-tight truncate">{child.full_name}</p>
              {hasAlert && <AlertTriangle size={15} className="text-red-500 shrink-0" />}
              {missingBirthDate && (
                <span title="Sin fecha de nacimiento" className="shrink-0">
                  <FileWarning size={15} className="text-amber-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-x-2 gap-y-1 min-w-0 flex-wrap">
              <CategoryBadge category={category} size="sm" />
              {categoryChanged && child.category && NEXT_CATEGORY[child.category] && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                  🎉 Ya cumplió años, puede pasar a {CATEGORY_LABELS[NEXT_CATEGORY[child.category]!]}
                </span>
              )}
              <span className="text-sm text-gray-400 truncate min-w-0">
                {age !== null ? `${age} año${age !== 1 ? 's' : ''} · ` : ''}{child.parents?.full_name ?? 'Sin responsable'}
              </span>
            </div>
          </div>

          {alreadyIn && (
            // "Gafete" verde: el número es lo que el maestro busca con la
            // vista al revisar quién ya entró.
            <div className="flex flex-col items-center shrink-0 rounded-xl bg-emerald-600 text-white px-2.5 py-1.5 min-w-[3.5rem] shadow-sm">
              <CheckCircle2 size={14} className="opacity-90" />
              <span className="font-display text-lg font-semibold leading-none mt-0.5 tabular-nums">
                {todayBadgeNumber ? `#${todayBadgeNumber}` : 'Listo'}
              </span>
            </div>
          )}
          {!alreadyIn && !needsBadge && isSelected && submitting && (
            <span className="text-sm text-gray-400 shrink-0">Registrando…</span>
          )}
        </div>
      </div>

      {/* ── Acciones de la tarjeta: una sola fila de botoncitos con ícono
          (antes eran tres renglones de texto gris sueltos que se veían
          como relleno). Cada uno para la propagación para no
          seleccionar/deseleccionar la tarjeta de paso. ── */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {hasObservations && (
          <button
            type="button"
            onClick={() => setShowObservations((v) => !v)}
            className={`${CHIP} ${hasAlert ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : ''}`}
          >
            {hasAlert ? <AlertTriangle size={12} /> : null}
            {showObservations ? 'Ocultar observaciones' : 'Observaciones'}
          </button>
        )}
        <button type="button" onClick={() => setShowContacts((v) => !v)} className={CHIP}>
          <Users size={12} />
          {showContacts ? 'Ocultar contactos' : 'Contactos'}
        </button>
        {isAdmin && (
          showCategoryPicker ? (
            <select
              autoFocus
              disabled={savingCategory}
              defaultValue={category ?? ''}
              onChange={(e) => changeCategory(e.target.value as Category)}
              onBlur={() => setShowCategoryPicker(false)}
              className="text-xs px-2 py-1 border-2 border-indigo-300 rounded-full focus:border-indigo-500 focus:outline-none bg-white"
            >
              {!category && <option value="" disabled>Sin categoría</option>}
              {ACTIVE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          ) : (
            <button type="button" onClick={() => setShowCategoryPicker(true)} className={CHIP}>
              <Compass size={12} />
              Categoría
            </button>
          )
        )}
        {isAdmin && (
          <button type="button" onClick={() => setShowEditModal(true)} className={CHIP}>
            <Pencil size={12} />
            Editar
          </button>
        )}
        {categoryError && <p className="text-xs text-red-600 w-full">{categoryError}</p>}
      </div>

      {(showObservations || showContacts) && (
        <div className="px-4 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {showObservations && (
            <ObservationsPanel
              allergies={child.allergies}
              medicalNotes={child.medical_notes}
              toiletTrained={child.toilet_trained}
              comments={child.comments}
            />
          )}
          {showContacts && <ChildContacts childId={child.id} />}
        </div>
      )}

      {/* ── Inline badge form ── */}
      {isSelected && needsBadge && !alreadyIn && (
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">

          {hasAlert && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">⚠ Alerta médica</p>
              {child.allergies && (
                <p className="text-sm text-red-700"><span className="font-semibold">Alergias:</span> {child.allergies}</p>
              )}
              {child.medical_notes && (
                <p className="text-sm text-red-700"><span className="font-semibold">Notas:</span> {child.medical_notes}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                Gafete <span className="text-red-500">*</span>
              </label>
              <input
                ref={badgeRef}
                type="number"
                inputMode="numeric"
                min={1}
                value={badge}
                onChange={(e) => { setBadge(e.target.value); setError(null) }}
                placeholder="Núm."
                className="w-full px-3 py-4 text-3xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center"
              />
            </div>

            {needsPager && (
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Biper <span className="text-gray-300 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={pager}
                  onChange={(e) => setPager(e.target.value)}
                  placeholder="Núm."
                  className="w-full px-3 py-4 text-3xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !badge}
              className="px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-2xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition-colors"
            >
              {submitting ? '…' : '✓'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </form>
      )}

      {/* ── Corderitos: confirm step with baby-specific info before registering ── */}
      {isSelected && !needsBadge && isCorderitos(category) && !alreadyIn && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!submitting) doCheckIn(null, pager ? parseInt(pager, 10) : null) }}
          className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          {hasAlert && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">⚠ Alerta médica</p>
              {child.allergies && (
                <p className="text-sm text-red-700"><span className="font-semibold">Alergias:</span> {child.allergies}</p>
              )}
              {child.medical_notes && (
                <p className="text-sm text-red-700"><span className="font-semibold">Notas:</span> {child.medical_notes}</p>
              )}
            </div>
          )}

          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              child.toilet_trained === true
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : child.toilet_trained === false
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            🚼{' '}
            {child.toilet_trained === true
              ? 'Ya va solo al baño'
              : child.toilet_trained === false
              ? 'Aún usa pañal / no va solo al baño'
              : 'Sin especificar si ya va al baño'}
          </div>

          {isAdmin && (
            <AssignedMaestroField
              value={maestroId}
              onChange={setMaestroId}
              freeTextValue={maestroName}
              onFreeTextChange={setMaestroName}
              compact
            />
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              Número de biper <span className="text-gray-300 font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={pager}
              onChange={(e) => setPager(e.target.value)}
              placeholder="Núm."
              className="w-full px-3 py-4 text-3xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDeselect}
              className="flex-1 py-3.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-3.5 text-base font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Registrando…' : 'Registrar ✓'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </form>
      )}

      {/* ── Ya registrado: corregir gafete/bíper o quitar el registro ── */}
      {isSelected && alreadyIn && (
        <form onSubmit={saveRecordEdit} onClick={(e) => e.stopPropagation()} className="px-4 pb-4 space-y-3 border-t border-green-200/70 pt-4">
          {!todayRecord ? (
            <p className="text-sm text-gray-400">Cargando registro de hoy…</p>
          ) : todayRecord.pending ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Este registro se hizo sin internet y todavía no se sube. Podrás corregirlo en cuanto se suba.
            </p>
          ) : (
            <>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Corregir registro de hoy</p>
              {(needsBadge || needsPager) && (
                <div className="flex gap-3 items-end">
                  {needsBadge && (
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Gafete</label>
                      <input
                        type="number" inputMode="numeric" min={1} autoFocus
                        value={editBadge}
                        onChange={(e) => { setEditBadge(e.target.value); setEditError(null) }}
                        className="w-full px-3 py-3 text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center bg-white"
                      />
                    </div>
                  )}
                  {needsPager && (
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Bíper <span className="text-gray-300 font-normal">(op.)</span></label>
                      <input
                        type="number" inputMode="numeric" min={1}
                        value={editPager}
                        onChange={(e) => { setEditPager(e.target.value); setEditError(null) }}
                        className="w-full px-3 py-3 text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center bg-white"
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition-colors"
                    title="Guardar"
                  >
                    {savingEdit ? '…' : '✓'}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {confirmRemove ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-700 font-medium">¿Quitar el registro de hoy?</span>
                    <button type="button" onClick={removeRecord} disabled={savingEdit}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                      Sí, quitar
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(false)}
                      className="px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
                      No
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={13} /> Quitar registro (fue un error)
                  </button>
                )}
                <button type="button" onClick={onDeselect} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
                  Cerrar
                </button>
              </div>
            </>
          )}
          {editError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{editError}</p>
          )}
        </form>
      )}
    </div>

    {/* ── Stamp ── */}
    <AnimatePresence>
      {showStamp && (
        <motion.div
          initial={{ scale: 0, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: -12, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="absolute -top-4 right-4 w-28 h-28 rounded-full border-4 border-[#b3402f]
                     flex items-center justify-center text-center font-black text-[#b3402f]
                     bg-red-50/90 pointer-events-none z-10 text-sm leading-tight select-none"
        >
          REGISTRADO<br />✓
        </motion.div>
      )}
    </AnimatePresence>

    {showEditModal && (
      <EditChildModal
        child={child}
        onClose={() => setShowEditModal(false)}
        onSaved={(patch) => { setShowEditModal(false); onEdited(child.id, patch) }}
        onDeleted={() => { setShowEditModal(false); onDeleted(child.id) }}
      />
    )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckInPage() {
  const { isAdmin, session } = useAuth()
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [todayCounts, setTodayCounts] = useState<Partial<Record<Category, number>>>({})
  const [totalToday, setTotalToday] = useState(0)
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([])
  // Which category groups in "Registrados hoy" are expanded — starts empty
  // (all collapsed) so a busy Sunday's full 40+-child list doesn't force
  // scrolling past every category just to check one.
  const [expandedTodayCategories, setExpandedTodayCategories] = useState<Set<Category>>(new Set())
  function toggleTodayCategory(cat: Category) {
    setExpandedTodayCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<string | null>(null)
  const [expandedObservationId, setExpandedObservationId] = useState<string | null>(null)
  const [deleteRecordError, setDeleteRecordError] = useState<string | null>(null)
  const [editingBadgeRecordId, setEditingBadgeRecordId] = useState<string | null>(null)
  const [badgeEditValue, setBadgeEditValue] = useState('')
  const [badgeEditError, setBadgeEditError] = useState<string | null>(null)
  const [savingBadgeEdit, setSavingBadgeEdit] = useState(false)
  // Same as FamiliesPage's version — the family/child is already saved by the
  // time this could go wrong, so a failure here means Mensajes bookkeeping
  // didn't close the loop, not that any data was lost.
  const [resolveWarning, setResolveWarning] = useState(false)
  const [children, setChildren] = useState<ChildResult[]>([])
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [teamColor, setTeamColor]         = useState<TeamColor>(getStoredTeamForToday() ?? 'rojo')
  const [teamConfirmed, setTeamConfirmed]   = useState(() => getStoredTeamForToday() !== null)
  const [coordinatorName, setCoordinatorName] = useState('')
  const [editingCoordinator, setEditingCoordinator] = useState(false)
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null)
  const [computerOperatorName, setComputerOperatorName] = useState('')
  const [editingComputerOperator, setEditingComputerOperator] = useState(false)
  const [computerOperatorError, setComputerOperatorError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewFamily, setShowNewFamily] = useState(() => searchParams.get('nueva') !== null)
  // Carried over when a coordinator jumps here from a maestro's request in
  // the Mensajes page — pre-fills the form with whatever structured fields
  // that request had, instead of making the coordinator retype what they
  // just read.
  const location = useLocation()
  const newFamilyPrefill = (location.state ?? {}) as {
    childName?: string; birthDate?: string; parentName?: string; phone?: string; alerts?: string; requestId?: string
  }

  // ── Búsqueda global ──
  const [globalSearch, setGlobalSearch] = useState('')
  const debouncedGlobal = useDebounce(globalSearch.trim(), 280)

  // ── Padrón general (niños ya existentes en la base de datos) ──
  const [allChildren, setAllChildren] = useState<ChildResult[]>([])
  const [loadingAllChildren, setLoadingAllChildren] = useState(false)
  const [showAllChildren, setShowAllChildren] = useState(false)

  const countsShownFromCache = useRef(false)
  const fetchCounts = useCallback(async () => {
    const cacheKey = `today_records:${today}`
    const apply = async (rows: TodayRecord[]) => {
      // Más los check-ins hechos sin internet que todavía no suben.
      const records = await withPendingRecords(rows)
      const counts: Partial<Record<Category, number>> = {}
      for (const row of records) counts[row.category] = (counts[row.category] ?? 0) + 1
      setTodayCounts(counts)
      setTotalToday(records.length)
      setTodayRecords(records)
    }
    // Igual que fetchRoster: la primera vez se pinta al instante lo último
    // que se vio hoy en este dispositivo, sin esperar a la red.
    const cached = readCache<TodayRecord[]>(cacheKey)
    if (!countsShownFromCache.current && cached) {
      countsShownFromCache.current = true
      await apply(cached)
    }
    // `assigned_teacher:profiles(...)` must name the exact FK — attendance
    // has two of them (assigned_teacher_id and deleted_by, added 2026-08-31
    // for the papelera feature), so a bare `profiles(...)` is ambiguous and
    // PostgREST rejects the whole query (PGRST201). That silently emptied
    // today's counts/list for everyone since the day deleted_by was added,
    // because the missing `{ error }` check below let it fail with no signal
    // anywhere — found only when a full week of real Sunday data staying at
    // zero was reported.
    const { data, error } = await supabase
      .from('attendance')
      .select('id, child_id, category, badge_number, pager_number, checked_in_at, checked_out_at, assigned_teacher_id, assigned_teacher:profiles!attendance_assigned_teacher_id_fkey(full_name), children(full_name, allergies, medical_notes, toilet_trained, comments)')
      .eq('session_date', today)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
    if (error) console.error('fetchCounts failed:', error)
    if (data) writeCache(cacheKey, data)
    await apply((data as unknown as TodayRecord[] | null) ?? cached ?? [])
  }, [])

  useEffect(() => { pruneDatedCache(today); fetchCounts() }, [fetchCounts])

  // `today` se calcula una sola vez al cargar — si la tablet/celular dejó la
  // app abierta desde el domingo pasado (o desde anoche), todo seguía
  // escribiendo y leyendo en la fecha vieja y borrar un registro "de hoy"
  // fallaba para los maestros. Al cambiar de día se recarga la página.
  useEffect(() => {
    const checkDay = () => {
      if (format(new Date(), 'yyyy-MM-dd') !== today) window.location.reload()
    }
    const interval = setInterval(checkDay, 60_000)
    document.addEventListener('visibilitychange', checkDay)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', checkDay) }
  }, [])

  // Keeps every maestro's screen in sync — a check-in (or its deletion) made
  // from any other device today shows up here without needing to refresh.
  useEffect(() => {
    const channel = supabase
      .channel('attendance-today-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `session_date=eq.${today}` },
        (payload) => {
          fetchCounts()
          if (payload.eventType === 'INSERT') {
            const { child_id: childId, badge_number: badgeNumber } = payload.new as { child_id: string; badge_number: number | null }
            const mark = (c: ChildResult) =>
              c.id === childId && !c.attendance.some((a) => a.session_date === today)
                ? { ...c, attendance: [...c.attendance, { session_date: today, badge_number: badgeNumber }] }
                : c
            setChildren((prev) => prev.map(mark))
            setAllChildren((prev) => prev.map(mark))
          } else if (
            payload.eventType === 'DELETE' ||
            // "Borrar" es un soft-delete (UPDATE de deleted_at), no un DELETE —
            // sin esto los demás dispositivos seguían viendo al niño como
            // registrado y no lo dejaban volver a registrar.
            (payload.eventType === 'UPDATE' && (payload.new as { deleted_at: string | null }).deleted_at)
          ) {
            const childId = ((payload.eventType === 'DELETE' ? payload.old : payload.new) as { child_id: string }).child_id
            const unmark = (c: ChildResult) =>
              c.id === childId ? { ...c, attendance: c.attendance.filter((a) => a.session_date !== today) } : c
            setChildren((prev) => prev.map(unmark))
            setAllChildren((prev) => prev.map(unmark))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCounts])

  // "¿Quién está de encargado hoy?" used to live in localStorage — per
  // device, not shared — so it could show something different (or nothing)
  // on every phone. Now it's one row per day, fetched once and kept live
  // via realtime so a coordinator's edit reaches every open session.
  useEffect(() => {
    supabase.from('daily_coordinator').select('name').eq('session_date', today).maybeSingle()
      .then(({ data }) => { if (data?.name) setCoordinatorName(data.name) })
    supabase.from('daily_computer_operator').select('name').eq('session_date', today).maybeSingle()
      .then(({ data }) => { if (data?.name) setComputerOperatorName(data.name) })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('daily-coordinator-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_coordinator', filter: `session_date=eq.${today}` },
        (payload) => {
          const row = payload.new as { name?: string } | undefined
          if (row?.name) setCoordinatorName(row.name)
        }
      )
      .subscribe()
    const operatorChannel = supabase
      .channel('daily-computer-operator-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_computer_operator', filter: `session_date=eq.${today}` },
        (payload) => {
          const row = payload.new as { name?: string } | undefined
          if (row?.name) setComputerOperatorName(row.name)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel); supabase.removeChannel(operatorChannel) }
  }, [])

  // Carga el padrón completo una sola vez (no solo al abrir "Ver padrón
  // completo") porque también alimenta la búsqueda global difusa de abajo —
  // con ~170 niños es más simple y más rápido buscar en el navegador que
  // pegarle a Postgres por cada tecla, y de paso resuelve que `ilike` no
  // ignora tildes (buscar "jose" nunca encontraba "José").
  // Con internet lento, la primera consulta puede tardar decenas de
  // segundos (o nunca llegar). La primera vez se pinta de inmediato la
  // última copia guardada en este dispositivo y luego se reemplaza con la
  // del servidor si responde.
  const rosterShownFromCache = useRef(false)
  const rosterLoaded = useRef(false)
  const fetchRoster = useCallback(async () => {
    // Solo la primera carga muestra "Cargando…"; los refrescos posteriores
    // (después de registrar, editar, etc.) van por detrás sin vaciar la
    // lista ni cerrar la tarjeta abierta.
    if (!rosterLoaded.current) setLoadingAllChildren(true)
    const attKey = `today_att:${today}`
    const cachedRoster = readCache<RosterChild[]>('roster')
    const cachedAtt = readCache<TodayAtt[]>(attKey) ?? []
    if (!rosterShownFromCache.current && cachedRoster) {
      rosterShownFromCache.current = true
      setAllChildren(await buildRoster(cachedRoster, cachedAtt))
      rosterLoaded.current = true
      setLoadingAllChildren(false)
    }
    const [{ data: fetchedAll }, { data: fetchedTodayAtt }] = await Promise.all([
      supabase
        .from('children')
        .select(CHILD_SELECT)
        .is('deleted_at', null)
        .order('full_name'),
      supabase
        .from('attendance')
        .select('child_id, badge_number')
        .eq('session_date', today)
        .is('deleted_at', null),
    ])
    // Sin internet se usa la última copia guardada. Una lista vacía tampoco
    // la pisa: pasa cuando el token venció y la consulta salió como anónima
    // (RLS devuelve [] sin error).
    const all = (fetchedAll as RosterChild[] | null)?.length ? (fetchedAll as RosterChild[]) : cachedRoster ?? []
    if (fetchedAll?.length) writeCache('roster', fetchedAll)
    const todayAtt = fetchedTodayAtt ?? cachedAtt
    if (fetchedTodayAtt) writeCache(attKey, fetchedTodayAtt)
    setAllChildren(await buildRoster(all, todayAtt))
    rosterLoaded.current = true
    setLoadingAllChildren(false)
  }, [])

  useEffect(() => { fetchRoster() }, [fetchRoster])

  // Cuando la cola sin conexión termina de subir, se recargan las listas
  // para cambiar las copias locales por los registros reales.
  useEffect(() => onSynced(() => { fetchRoster(); fetchCounts() }), [fetchRoster, fetchCounts])

  // Auto-refresco: después de cualquier acción (registrar, corregir gafete,
  // editar niño, cambiar categoría…) se vuelve a pedir todo por detrás,
  // agrupando varias acciones seguidas en una sola consulta. Así lo que se
  // ve siempre coincide con el servidor sin tener que salir y volver a entrar.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { fetchRoster(); fetchCounts() }, 600)
  }, [fetchRoster, fetchCounts])
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])

  // Cambios a niños hechos desde otro dispositivo (Familias, otro maestro
  // editando) también refrescan la lista de este.
  useEffect(() => {
    const channel = supabase
      .channel('children-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => scheduleRefresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scheduleRefresh])

  function loadAllChildren() {
    setShowAllChildren(true)
  }

  const globalSearcher = useMemo(() => createChildSearcher(allChildren), [allChildren])
  const globalResults = useMemo(
    () =>
      debouncedGlobal.length < 2
        ? { exact: [], suggestions: [] }
        : (() => {
            const { exact, suggestions } = searchChildrenSplit(globalSearcher, debouncedGlobal)
            return { exact: exact.slice(0, 20), suggestions: suggestions.slice(0, 8) }
          })(),
    [debouncedGlobal, globalSearcher]
  )

  // Abrir una categoría solía volver a pedirle a Supabase TODOS los niños +
  // la asistencia de hoy desde cero cada vez — exactamente la misma consulta
  // que fetchRoster ya hizo una vez al cargar la página. Eso era el origen
  // de la lentitud al entrar a una categoría. allChildren ya vive en memoria
  // y se mantiene al día (realtime de asistencia + las mutaciones locales de
  // registro/cambio de categoría), así que ahora solo se filtra ahí mismo,
  // sin ida y vuelta al servidor. Este efecto también re-filtra solo si
  // allChildren cambia mientras una categoría está abierta (por ejemplo, un
  // cambio de categoría hecho desde la misma tarjeta).
  useEffect(() => {
    if (!activeCategory) return
    setChildren(allChildren.filter((c) => getEffectiveCategory(c) === activeCategory))
  }, [activeCategory, allChildren])

  function openCategory(category: Category) {
    // startTransition mantiene el home interactivo mientras React prepara la nueva vista
    startTransition(() => {
      setActiveCategory(category)
      setFilter('')
      setSelectedId(null)
      setGlobalSearch('')
    })
  }

  function handleBack() {
    setActiveCategory(null)
    setChildren([])
    setSelectedId(null)
    fetchCounts()
  }

  function handleRegistered(childId: string, badgeNumber: number | null) {
    scheduleRefresh()
    const mark = (c: ChildResult) =>
      c.id === childId ? { ...c, attendance: [...c.attendance, { session_date: today, badge_number: badgeNumber }] } : c
    setChildren((prev) => prev.map(mark))
    setAllChildren((prev) => prev.map(mark))
    setSelectedId(null)
    // Clears whichever search box was used (global or the per-category
    // filter — clearing an already-empty one is a harmless no-op) so a
    // maestro can go straight into typing the next child's name instead of
    // having to tap the "×" themselves first. Fires after ChildCard's own
    // 1.6s success stamp, so there's already been time to see it confirmed.
    setGlobalSearch('')
    setFilter('')
    // Deriving category from data avoids depending on activeCategory
    const child = [...children, ...globalResults.exact, ...globalResults.suggestions, ...allChildren].find((c) => c.id === childId)
    const cat = child ? getEffectiveCategory(child) : activeCategory
    if (cat) {
      setTodayCounts((prev) => ({ ...prev, [cat]: (prev[cat] ?? 0) + 1 }))
      setTotalToday((n) => n + 1)
    }
  }

  // Patches allChildren so every list derived from it (category view,
  // global search, "Ver registro completo") picks up a manual category
  // change immediately — the useEffect above re-filters `children` off
  // this automatically, which also makes the card vanish from a now-wrong
  // category view without needing a re-open.
  function handleCategoryChanged(childId: string, newCategory: Category) {
    const patch = (c: ChildResult) => (c.id === childId ? { ...c, category: newCategory } : c)
    setAllChildren((prev) => prev.map(patch))
    scheduleRefresh()
  }

  // Same idea as handleCategoryChanged — allChildren is the source both
  // `children` (category view) and the global search results derive from,
  // so patching/removing there is enough to update every list on screen.
  function handleChildEdited(childId: string, patch: Partial<ChildResult>) {
    setAllChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, ...patch } : c)))
    scheduleRefresh()
  }

  function handleChildDeleted(childId: string) {
    setAllChildren((prev) => prev.filter((c) => c.id !== childId))
    scheduleRefresh()
  }

  // Refreshes whichever list(s) are currently on screen so a newly-added
  // family shows up immediately — otherwise it only appears after manually
  // leaving and re-entering the category or re-typing the search.
  async function handleFamilySaved(parent: ParentRow) {
    setShowNewFamily(false)
    if (searchParams.get('nueva') !== null) setSearchParams({})
    // Resolving happens here — the moment the family is actually saved —
    // instead of a manual "marcar como resuelta" button a coordinator could
    // click without doing the work. There's deliberately no other way to
    // resolve a request now.
    if (newFamilyPrefill.requestId) {
      const ok = await markRequestResolved(newFamilyPrefill.requestId, session?.user.id ?? null)
      if (!ok) setResolveWarning(true)
    }
    // Domingo en la mañana no hay tiempo de guardar la familia y luego ir a
    // buscar al niño de nuevo para ponerle gafete — el primer niño de la
    // familia recién guardada queda directo en su categoría, seleccionado
    // y listo para el paso de gafete/biper (lo que ChildCard ya muestra
    // cuando isSelected es true).
    const firstChild = parent.children[0]
    if (firstChild?.category) {
      await openCategory(firstChild.category)
      setSelectedId(firstChild.id)
    } else if (activeCategory) {
      openCategory(activeCategory)
    }
    // El padrón (allChildren) alimenta la búsqueda global y difusa, así que
    // se refresca siempre, esté o no abierto el panel "Ver padrón completo".
    fetchRoster()
  }

  async function confirmTeam(color: TeamColor, coordinator: string, computerOperator: string) {
    setTeamColor(color)
    setTeamConfirmed(true)
    persistTeam(color)
    // Solo se escribe si es nuevo/cambió — evita una llamada inútil cuando
    // el nombre ya estaba puesto desde otro dispositivo.
    if (coordinator && coordinator !== coordinatorName) saveCoordinator(coordinator)
    if (computerOperator && computerOperator !== computerOperatorName) saveComputerOperator(computerOperator)
  }

  // Quitar / corregir un registro de hoy — lo usan tanto la lista de
  // "Registrados hoy" como la tarjeta del niño (tocar una tarjeta ya
  // registrada). Devuelven el mensaje de error, o null si salió bien.
  async function removeAttendance(id: string): Promise<string | null> {
    const rec = todayRecords.find((r) => r.id === id)
    const { data: { session: s } } = await supabase.auth.getSession()
    // Marcar (no borrar): queda en la papelera (Usuarios) hasta que alguien
    // lo restaure o el dueño lo purgue de verdad.
    // .select() forces PostgREST to report which rows were actually
    // marked — without it, an update silently blocked by RLS still returns
    // no error, and the record would falsely look deleted here while
    // reappearing on the next reload/refetch.
    const { data, error } = await supabase.from('attendance')
      .update({ deleted_at: new Date().toISOString(), deleted_by: s?.user.id })
      .eq('id', id).select('id')
    if (error || !data || data.length === 0) return 'No se pudo quitar el registro. Revisa la conexión e intenta de nuevo.'
    setTodayRecords((prev) => prev.filter((r) => r.id !== id))
    // El niño vuelve a quedar disponible para registrarse (con el gafete
    // correcto) en este mismo dispositivo, sin esperar a recargar.
    if (rec) {
      const unmark = (c: ChildResult) =>
        c.id === rec.child_id ? { ...c, attendance: c.attendance.filter((a) => a.session_date !== today) } : c
      setChildren((prev) => prev.map(unmark))
      setAllChildren((prev) => prev.map(unmark))
      setTodayCounts((prev) => ({ ...prev, [rec.category]: Math.max(0, (prev[rec.category] ?? 0) - 1) }))
      setTotalToday((n) => Math.max(0, n - 1))
    }
    scheduleRefresh()
    return null
  }

  async function editAttendanceNumbers(id: string, badge: number | null, pager: number | null): Promise<string | null> {
    const rec = todayRecords.find((r) => r.id === id)
    const { data, error } = await supabase
      .from('attendance')
      .update({ badge_number: badge, pager_number: pager })
      .eq('id', id)
      .select('id')
    if (error || !data || data.length === 0) {
      const cat = rec ? ` en ${CATEGORY_LABELS[rec.category]}` : ''
      if (error?.code === '23505' && error.message.includes('attendance_badge_category_unique')) return `El gafete #${badge} ya está en uso hoy${cat}.`
      if (error?.code === '23505' && error.message.includes('attendance_pager_category_unique')) return `El bíper #${pager} ya está en uso hoy${cat}.`
      return 'No se pudo guardar. Revisa la conexión e intenta de nuevo.'
    }
    setTodayRecords((prev) => prev.map((r) => (r.id === id ? { ...r, badge_number: badge, pager_number: pager } : r)))
    if (rec) {
      const patch = (c: ChildResult) =>
        c.id === rec.child_id
          ? { ...c, attendance: c.attendance.map((a) => (a.session_date === today ? { ...a, badge_number: badge } : a)) }
          : c
      setChildren((prev) => prev.map(patch))
      setAllChildren((prev) => prev.map(patch))
    }
    scheduleRefresh()
    return null
  }

  async function deleteAttendanceRecord(id: string) {
    setDeleteRecordError(null)
    const err = await removeAttendance(id)
    if (err) { setDeleteRecordError(err); return }
    setConfirmDeleteRecordId(null)
  }

  function startBadgeEdit(rec: TodayRecord) {
    setEditingBadgeRecordId(rec.id)
    setBadgeEditValue(String(rec.badge_number ?? ''))
    setBadgeEditError(null)
  }

  async function saveBadgeEdit(id: string) {
    const num = parseInt(badgeEditValue, 10)
    if (!badgeEditValue || isNaN(num) || num <= 0) { setBadgeEditError('Número inválido.'); return }
    const rec = todayRecords.find((r) => r.id === id)
    setSavingBadgeEdit(true)
    setBadgeEditError(null)
    const err = await editAttendanceNumbers(id, num, rec?.pager_number ?? null)
    setSavingBadgeEdit(false)
    if (err) { setBadgeEditError(err); return }
    setEditingBadgeRecordId(null)
  }

  const recordByChild = useMemo(() => new Map(todayRecords.map((r) => [r.child_id, r])), [todayRecords])

  function renderCard(child: ChildResult) {
    return (
      <ChildCard
        key={child.id}
        child={child}
        teamColor={teamColor}
        isAdmin={isAdmin}
        onCategoryChanged={handleCategoryChanged}
        onEdited={handleChildEdited}
        onDeleted={handleChildDeleted}
        isSelected={selectedId === child.id}
        onSelect={() => setSelectedId(child.id)}
        onDeselect={() => setSelectedId(null)}
        onRegistered={handleRegistered}
        todayRecord={recordByChild.get(child.id)}
        onEditAttendance={editAttendanceNumbers}
        onRemoveAttendance={removeAttendance}
      />
    )
  }

  async function saveCoordinator(name: string) {
    setEditingCoordinator(false)
    if (!name || name === coordinatorName) return
    setCoordinatorError(null)
    const { error } = await supabase.rpc('set_daily_coordinator', { p_session_date: today, p_name: name })
    if (!error) setCoordinatorName(name)
    else setCoordinatorError('No se pudo guardar el encargado. Revisa la conexión e intenta de nuevo.')
  }

  async function saveComputerOperator(name: string) {
    setEditingComputerOperator(false)
    if (!name || name === computerOperatorName) return
    setComputerOperatorError(null)
    const { error } = await supabase.rpc('set_daily_computer_operator', { p_session_date: today, p_name: name })
    if (!error) setComputerOperatorName(name)
    else setComputerOperatorError('No se pudo guardar el encargado de compu. Revisa la conexión e intenta de nuevo.')
  }

  // Already-registered-today children float to the top (sorted by badge
  // number, so you can scan "1, 2, 3…" and immediately tell who you have),
  // then everyone else alphabetically — instead of one alphabetical list
  // where who's actually checked in today is scattered and easy to miss.
  const sortedChildren = useMemo(() => {
    const todayBadge = (c: ChildResult) => c.attendance.find((a) => a.session_date === today)?.badge_number
    return [...children].sort((a, b) => {
      const aIn = a.attendance.some((att) => att.session_date === today)
      const bIn = b.attendance.some((att) => att.session_date === today)
      if (aIn !== bIn) return aIn ? -1 : 1
      if (aIn && bIn) {
        const aBadge = todayBadge(a) ?? Infinity
        const bBadge = todayBadge(b) ?? Infinity
        if (aBadge !== bBadge) return aBadge - bBadge
      }
      return a.full_name.localeCompare(b.full_name)
    })
  }, [children])

  const categorySearcher = useMemo(() => createChildSearcher(sortedChildren), [sortedChildren])
  const filteredChildren = useMemo(
    () => (filter.trim() ? searchChildrenSplit(categorySearcher, filter) : { exact: sortedChildren, suggestions: [] }),
    [filter, sortedChildren, categorySearcher]
  )

  const registeredCount = useMemo(
    () => children.filter((c) => c.attendance.some((a) => a.session_date === today)).length,
    [children]
  )

  const isSearching = debouncedGlobal.length >= 2
  // Debounce means there's a brief window where the input already shows what
  // was typed but the results haven't caught up yet — the dots (same visual
  // language as a chat app's "typing…" bubble) fill that gap instead of the
  // list just sitting there stale for 280ms.
  const isTyping = globalSearch.trim().length >= 2 && globalSearch.trim() !== debouncedGlobal

  // Team must be confirmed before anything else each day
  if (!teamConfirmed) {
    return <TeamPickerScreen onConfirm={confirmTeam} initialCoordinator={coordinatorName} initialComputerOperator={computerOperatorName} />
  }

  if (showNewFamily) {
    return (
      <NewFamilyStep
        existingChildren={allChildren}
        prefillName={newFamilyPrefill.parentName}
        prefillPhone={newFamilyPrefill.phone}
        prefillChildName={newFamilyPrefill.childName}
        prefillChildBirthDate={newFamilyPrefill.birthDate}
        prefillChildComments={newFamilyPrefill.alerts}
        onSaved={handleFamilySaved}
        onCancel={() => { setShowNewFamily(false); if (searchParams.get('nueva') !== null) setSearchParams({}) }}
      />
    )
  }

  // ── Category view ──────────────────────────────────────────────────────────
  if (activeCategory) {
    const tile = TILES.find((t) => t.category === activeCategory)!
    return (
      <>
      {/* Full-viewport background */}
      <div className={`fixed inset-0 -z-10 ${
        activeCategory === 'saltamontes' ? 'bg-white' :
        activeCategory === 'exploradores' ? 'bg-sky-50' :
        activeCategory === 'corderitos_0_2' ? 'bg-pink-50/70' :
        activeCategory === 'corderitos_2_4' ? 'bg-rose-50/70' :
        'bg-emerald-50/70'
      }`} />
      {activeCategory === 'hormiguitas'    && <BalloonBackground />}
      {activeCategory === 'exploradores'   && <FloatingIconsBackground />}
      {activeCategory === 'saltamontes'    && <SaltamontesBackground />}
      {activeCategory === 'corderitos_0_2' && <Corderitos02Background />}
      {activeCategory === 'corderitos_2_4' && <Corderitos24Background />}
      <div className="relative z-[2] space-y-4">
        {/* Header — sticky right below the app's own sticky header (which is
            z-[3]; this whole category view used to be z-10, painting its
            content ABOVE that header instead of scrolling under it) so the
            back button never scrolls out of reach. */}
        <div
          className="sticky z-10 flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm"
          style={{ top: 'calc(var(--app-header-h, calc(4.5rem + env(safe-area-inset-top))) + 0.5rem)' }}
        >
          <button
            onClick={handleBack}
            className="p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 font-bold text-lg leading-tight ${tile.iconColor}`}>
              <tile.icon size={18} />
              {CATEGORY_LABELS[activeCategory]}
            </div>
            <p className="text-xs text-gray-400">{tile.ages}</p>
          </div>
          {!loadingAllChildren && (
            <span className="text-sm font-semibold text-gray-500 shrink-0">
              {registeredCount}/{children.length}
            </span>
          )}
        </div>

        {resolveWarning && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            La familia se guardó bien, pero no se pudo marcar el mensaje como resuelto en Mensajes — probablemente por la conexión. Avísale al dueño para que lo marque a mano si sigue apareciendo como pendiente.
          </p>
        )}

        {/* Filter */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setSelectedId(null) }}
            placeholder="Buscar por nombre…"
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none bg-white"
            autoFocus
          />
        </div>

        {/* Children list */}
        {loadingAllChildren ? (
          <p className="text-center text-gray-400 py-10 text-lg">Cargando…</p>
        ) : filteredChildren.exact.length === 0 && filteredChildren.suggestions.length === 0 ? (
          <div className="text-center py-12 space-y-4 text-gray-400">
            <p className="text-base">{filter ? `Sin resultados para "${filter}"` : 'No hay niños en esta categoría todavía'}</p>
            {session && (
              <button
                onClick={() => setShowNewFamily(true)}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-colors"
              >
                <UserPlus size={18} />
                Registrar familia nueva
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredChildren.exact.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
                {filteredChildren.exact.map((child) => (
                  renderCard(child)
                ))}
              </div>
            )}
            {filteredChildren.suggestions.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">¿Quisiste decir…?</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
                  {filteredChildren.suggestions.map((child) => (
                    renderCard(child)
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loadingAllChildren && children.length > 0 && session && (
          <button
            onClick={() => setShowNewFamily(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 transition-colors"
          >
            <UserPlus size={15} />
            ¿Primera vez? Registrar familia nueva
          </button>
        )}
      </div>
      </>
    )
  }

  // ── Grid / home view ───────────────────────────────────────────────────────

  return (
    <>
    <SoftGradientBackground />
    <div className="relative z-[2] space-y-4">

      {/* ── Tarjeta del día: fecha + conteo a la izquierda, equipo como
          bloque de color a la derecha, y los dos encargados abajo en
          renglones propios (antes iban apretados bajo la fecha y el de
          "compu" se partía en dos líneas en celular). ── */}
      <section className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0 px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {format(new Date(), 'EEEE', { locale: es })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight">
              {format(new Date(), "d 'de' MMMM", { locale: es })}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              {totalToday > 0
                ? `${totalToday} niño${totalToday !== 1 ? 's' : ''} registrado${totalToday !== 1 ? 's' : ''} hoy`
                : <span className="text-gray-400 font-medium">Aún nadie registrado hoy</span>}
            </p>
          </div>
          <button
            onClick={() => setTeamConfirmed(false)}
            className={`shrink-0 w-28 sm:w-36 flex flex-col items-center justify-center gap-1 px-3 ${TEAM_META[teamColor].bg} ${TEAM_META[teamColor].text} hover:brightness-95 active:brightness-90 transition`}
            title="Cambiar equipo"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Equipo</span>
            <span className="font-display text-xl font-semibold leading-none">{TEAM_META[teamColor].label}</span>
            <span className="text-[11px] font-medium opacity-80 underline underline-offset-2">Cambiar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-gray-100 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {/* Encargado del día */}
          <div className="flex items-center gap-3 px-5 py-3 min-w-0">
            <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <User size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Encargado</p>
              {editingCoordinator ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={coordinatorName}
                  onBlur={(e) => saveCoordinator(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCoordinator((e.target as HTMLInputElement).value.trim())
                    if (e.key === 'Escape') setEditingCoordinator(false)
                  }}
                  placeholder="Nombre…"
                  className="w-full text-sm border-b-2 border-indigo-400 focus:outline-none font-semibold text-gray-800 bg-transparent"
                />
              ) : (
                <button onClick={() => setEditingCoordinator(true)} className="group flex items-center gap-1.5 max-w-full text-left">
                  <span className={`truncate text-sm ${coordinatorName ? 'font-semibold text-gray-800' : 'text-indigo-600 font-medium'}`}>
                    {coordinatorName || 'Agregar nombre'}
                  </span>
                  <Pencil size={11} className="shrink-0 text-gray-400 group-hover:text-indigo-600" />
                </button>
              )}
              {coordinatorError && <p className="text-[11px] text-red-600 mt-0.5">{coordinatorError}</p>}
            </div>
          </div>
          {/* Encargado de compu */}
          <div className="flex items-center gap-3 px-5 py-3 min-w-0">
            <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Monitor size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">En la compu</p>
              {editingComputerOperator ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={computerOperatorName}
                  onBlur={(e) => saveComputerOperator(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveComputerOperator((e.target as HTMLInputElement).value.trim())
                    if (e.key === 'Escape') setEditingComputerOperator(false)
                  }}
                  placeholder="Nombre…"
                  className="w-full text-sm border-b-2 border-indigo-400 focus:outline-none font-semibold text-gray-800 bg-transparent"
                />
              ) : (
                <button onClick={() => setEditingComputerOperator(true)} className="group flex items-center gap-1.5 max-w-full text-left">
                  <span className={`truncate text-sm ${computerOperatorName ? 'font-semibold text-gray-800' : 'text-indigo-600 font-medium'}`}>
                    {computerOperatorName || 'Agregar nombre'}
                  </span>
                  <Pencil size={11} className="shrink-0 text-gray-400 group-hover:text-indigo-600" />
                </button>
              )}
              {computerOperatorError && <p className="text-[11px] text-red-600 mt-0.5">{computerOperatorError}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Búsqueda global ── */}
      <div className="relative">
        {isTyping ? (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        ) : (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
        )}
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => { setGlobalSearch(e.target.value); setSelectedId(null) }}
          placeholder="Buscar niño por nombre…"
          className="w-full pl-12 pr-10 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none bg-white shadow-sm"
        />
        {globalSearch && (
          <button
            onClick={() => setGlobalSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Resultados de búsqueda global ── */}
      {isSearching ? (
        <div className={`space-y-2.5 transition-opacity ${isTyping ? 'opacity-50' : 'opacity-100'}`}>
          {loadingAllChildren && allChildren.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-base">Cargando registro…</p>
          )}
          {!(loadingAllChildren && allChildren.length === 0) && globalResults.exact.length === 0 && globalResults.suggestions.length === 0 && (
            <div className="text-center py-10 space-y-4 bg-white rounded-2xl border border-gray-200">
              <p className="text-gray-400">Sin resultados para "{debouncedGlobal}"</p>
              {session && (
                <button
                  onClick={() => setShowNewFamily(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus size={16} /> Registrar familia nueva
                </button>
              )}
            </div>
          )}
          {globalResults.exact.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
              {globalResults.exact.map((child) => (
                renderCard(child)
              ))}
            </div>
          )}
          {globalResults.suggestions.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">¿Quisiste decir…?</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
                {globalResults.suggestions.map((child) => (
                  renderCard(child)
                ))}
              </div>
            </div>
          )}
          {(globalResults.exact.length > 0 || globalResults.suggestions.length > 0) && session && (
            <button
              onClick={() => setShowNewFamily(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 transition-colors"
            >
              <UserPlus size={15} /> ¿Primera vez? Registrar familia nueva
            </button>
          )}
        </div>
      ) : (
      <>

      {/* ── Label ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
        O selecciona el grupo
      </p>

      {/* ── Grupos. En celular/tablet son renglones (ícono · nombre ·
          conteo grande): antes eran cuadros en 2 columnas, el quinto
          quedaba solo en su fila y "Corderitos 1-2 años" se partía en dos
          líneas desalineando las alturas. En pantalla grande, 5 columnas. ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 lg:gap-3">
        {TILES.map(({ category, icon: Icon, ages, cardBg, iconBg, iconColor, bar, barBg, textColor }, i) => {
          const count = todayCounts[category] ?? 0
          return (
            <motion.button
              key={category}
              onClick={() => openCategory(category)}
              whileTap={{ scale: 0.98 }}
              className={`relative overflow-hidden rounded-2xl text-left border border-black/5 shadow-sm hover:shadow-md transition-shadow ${cardBg}
                flex lg:flex-col items-center lg:items-stretch gap-3.5 px-4 py-3.5 lg:p-5 ${i === TILES.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
            >
              <span className={`rounded-xl ${iconBg} flex items-center justify-center w-11 h-11 shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-display font-semibold text-[17px] leading-tight ${textColor}`}>
                  {CATEGORY_LABELS[category]}
                </span>
                <span className={`block text-xs ${iconColor} opacity-80 mt-0.5`}>{ages}</span>
                <span className={`block h-1.5 w-full rounded-full ${barBg} mt-2.5`}>
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: count > 0 ? `${Math.min(count * 10, 100)}%` : '0%' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`block h-1.5 rounded-full ${bar}`}
                  />
                </span>
              </span>
              <span className={`shrink-0 text-right lg:text-left ${textColor}`}>
                <span className="block font-display text-3xl font-semibold leading-none tabular-nums">{count}</span>
                <span className={`block text-[11px] font-medium ${iconColor} mt-0.5`}>{count === 1 ? 'registrado' : 'registrados'}</span>
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* ── Padrón general: niños ya existentes en la base de datos ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Niños registrados en el sistema{allChildren.length > 0 ? ` · ${allChildren.length}` : ''}
            </p>
          </div>
          {showAllChildren && (
            <button
              onClick={() => setShowAllChildren(false)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Ocultar
            </button>
          )}
        </div>

        {!showAllChildren ? (
          <button
            onClick={loadAllChildren}
            disabled={loadingAllChildren}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
          >
            <Users size={15} />
            {loadingAllChildren ? 'Cargando…' : `Ver registro completo${allChildren.length > 0 ? ` (${allChildren.length})` : ''}`}
          </button>
        ) : allChildren.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm bg-white rounded-2xl border border-gray-200">
            No hay niños registrados todavía.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
            {allChildren.map((child) => (
              renderCard(child)
            ))}
          </div>
        )}
      </div>

      {/* ── Registros de hoy ── */}
      {todayRecords.length > 0 && (
        <div className="space-y-2 pt-1">
          {deleteRecordError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{deleteRecordError}</p>
          )}
          <div className="flex items-center gap-2 px-1">
            <LogIn size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Registrados hoy · {todayRecords.length}
            </p>
          </div>
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-3 lg:items-start">
            {TILES.map((tile) => {
              const catRecords = todayRecords.filter((r) => r.category === tile.category)
              if (catRecords.length === 0) return null
              const Icon = tile.icon
              const isOpen = expandedTodayCategories.has(tile.category)
              return (
                <div key={tile.category} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => toggleTodayCategory(tile.category)}
                    className="flex items-center gap-2 px-1 py-1 w-full text-left"
                  >
                    <div className={`p-1 rounded-md ${tile.iconBg}`}>
                      <Icon size={12} className={tile.iconColor} />
                    </div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${tile.iconColor}`}>
                      {CATEGORY_LABELS[tile.category]} · {catRecords.length}
                    </p>
                    <ChevronDown
                      size={14}
                      className={`ml-auto shrink-0 transition-transform ${tile.iconColor} ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && catRecords.map((rec) => {
              const isConfirming = confirmDeleteRecordId === rec.id
              const hasObs = !!(
                rec.children.allergies || rec.children.medical_notes ||
                rec.children.toilet_trained !== null || rec.children.comments
              )
              const hasObsAlert = !!(rec.children.allergies || rec.children.medical_notes)
              const isExpanded = expandedObservationId === rec.id
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  // Toda la fila abre la corrección del gafete (antes solo
                  // el pequeño "#12"). Los botones/campos de adentro hacen
                  // lo suyo y no la disparan.
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button,input,select,textarea,a')) return
                    if (rec.pending || !rec.badge_number || editingBadgeRecordId === rec.id || isConfirming) return
                    startBadgeEdit(rec)
                  }}
                  className={`rounded-2xl border px-4 py-3 shadow-sm transition-colors ${!rec.pending && rec.badge_number ? 'cursor-pointer' : ''} ${
                    isConfirming ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                  }`}
                >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight truncate flex items-center gap-1.5">
                      {rec.children.full_name}
                      {hasObsAlert && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full border font-semibold text-xs px-2 py-0.5 ${CATEGORY_COLORS[rec.category]}`}>
                        {CATEGORY_LABELS[rec.category]}
                      </span>
                      {rec.badge_number && editingBadgeRecordId === rec.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            autoFocus
                            value={badgeEditValue}
                            onChange={(e) => setBadgeEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveBadgeEdit(rec.id)
                              if (e.key === 'Escape') setEditingBadgeRecordId(null)
                            }}
                            className="w-14 px-1.5 py-0.5 text-xs font-bold border-2 border-indigo-300 rounded-md focus:border-indigo-500 focus:outline-none text-center"
                          />
                          <button
                            onClick={() => saveBadgeEdit(rec.id)}
                            disabled={savingBadgeEdit}
                            className="p-1 text-emerald-500 hover:text-emerald-600 rounded-md hover:bg-emerald-50"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingBadgeRecordId(null)}
                            className="p-1 text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-100"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ) : rec.badge_number && rec.pending ? (
                        <span className="pl-2 pr-1.5 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full">
                          #{rec.badge_number}
                        </span>
                      ) : rec.badge_number ? (
                        <button
                          onClick={() => startBadgeEdit(rec)}
                          className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 transition-all"
                          title="Editar número de gafete"
                        >
                          #{rec.badge_number}
                          <Pencil size={10} className="text-indigo-400" />
                        </button>
                      ) : null}
                      {rec.pager_number && (
                        <span className="text-xs text-gray-400 font-medium">
                          📟 #{rec.pager_number}
                        </span>
                      )}
                    </div>
                    {editingBadgeRecordId === rec.id && badgeEditError && (
                      <p className="text-[11px] text-red-600 mt-1">{badgeEditError}</p>
                    )}
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => deleteAttendanceRecord(rec.id)}
                        className="px-2.5 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors"
                      >
                        Borrar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteRecordId(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">
                          {format(new Date(rec.checked_in_at), 'HH:mm')}
                        </span>
                        {!rec.pending && (
                          <button
                            onClick={() => setConfirmDeleteRecordId(rec.id)}
                            className="p-1 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {rec.pending ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5" title="Guardado en este dispositivo — se sube solo al volver el internet">
                          Sin subir
                        </span>
                      ) : rec.checked_out_at ? (
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                          Salió
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                          Adentro
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(hasObs || isCorderitos(rec.category)) && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {hasObs && (
                      <button
                        type="button"
                        onClick={() => setExpandedObservationId(isExpanded ? null : rec.id)}
                        className={`text-xs font-medium transition-colors ${
                          hasObsAlert ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-indigo-600'
                        }`}
                      >
                        {isExpanded ? 'Ocultar observaciones' : '+ Ver observaciones'}
                      </button>
                    )}
                    {isCorderitos(rec.category) && !rec.pending && (
                      <AssignedTeacherControl
                        attendanceId={rec.id}
                        assignedId={rec.assigned_teacher_id}
                        assignedName={rec.assigned_teacher?.full_name ?? null}
                        canChange={!rec.assigned_teacher_id || rec.assigned_teacher_id === session?.user.id || isAdmin}
                        onChanged={(teacherId, teacherName) => {
                          setTodayRecords((prev) => prev.map((r) => r.id === rec.id
                            ? { ...r, assigned_teacher_id: teacherId, assigned_teacher: teacherName ? { full_name: teacherName } : null }
                            : r))
                        }}
                      />
                    )}
                  </div>
                )}
                {isExpanded && hasObs && (
                  <div className="mt-2">
                    <ObservationsPanel
                      allergies={rec.children.allergies}
                      medicalNotes={rec.children.medical_notes}
                      toiletTrained={rec.children.toilet_trained}
                      comments={rec.children.comments}
                    />
                  </div>
                )}
                </motion.div>
              )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      </>
      )}

    </div>
    </>
  )
}
