import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { AlertTriangle, ChevronDown, Compass, Pencil, Trash2, Users, Baby, CloudOff, PartyPopper } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { saveAttendance, newId } from '../../lib/offline'
import { getAgeLabel, getEffectiveCategory, hasCategoryChanged, requiresBadge, requiresPager } from '../../lib/categoryUtils'
import { ACTIVE_CATEGORIES, CATEGORY_LABELS, NEXT_CATEGORY, isCorderitos, type Category, type TeamColor } from '../../types/domain'
import { ChildContacts } from '../../components/ui/ChildContacts'
import { EditChildModal, type EditableChild } from '../../components/ui/EditChildModal'
import { AssignedMaestroField } from '../../components/ui/AssignedMaestroField'
import { Confetti, DrawnCheck, Sheet } from '../../components/motion'
import { SPRING } from '../../components/motion/presets'
import { autoAssignTodayTeacher, groupOf, initials, isInToday, today, type ChildResult, type TodayRecord } from './shared'

const NUM_INPUT =
  'w-full px-3 py-3.5 text-[2rem] leading-none font-display font-semibold text-center tabular-nums rounded-2xl border-2 border-gray-200 bg-gray-50/60 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors placeholder:text-gray-300 placeholder:font-medium'

interface Props {
  child: ChildResult | null
  todayRecord?: TodayRecord
  teamColor: TeamColor
  isAdmin: boolean
  onClose: () => void
  onRegistered: (childId: string, badgeNumber: number | null) => void
  onCategoryChanged: (childId: string, category: Category) => void
  onEdited: (childId: string, patch: Partial<EditableChild>) => void
  onDeleted: (childId: string) => void
  onEditAttendance: (id: string, badge: number | null, pager: number | null) => Promise<string | null>
  onRemoveAttendance: (id: string) => Promise<string | null>
}

/** Panel de un niño: registrarlo, o corregir/quitar su registro de hoy. */
export function CheckInSheet(props: Props) {
  // El panel conserva al último niño mientras se cierra para que la
  // animación de salida no se vacíe a media transición.
  const [shown, setShown] = useState<ChildResult | null>(props.child)
  useEffect(() => { if (props.child) setShown(props.child) }, [props.child])
  return (
    <Sheet open={!!props.child} onClose={props.onClose} title={shown ? `Registro de ${shown.full_name}` : 'Registro'}>
      {shown && <SheetBody key={shown.id} {...props} child={props.child ?? shown} />}
    </Sheet>
  )
}

function SheetBody({
  child, todayRecord, teamColor, isAdmin, onClose, onRegistered, onCategoryChanged, onEdited, onDeleted, onEditAttendance, onRemoveAttendance,
}: Props & { child: ChildResult }) {
  const [categoryOverride, setCategoryOverride] = useState<Category | null>(null)
  const category = categoryOverride ?? getEffectiveCategory(child)
  const g = groupOf(category)
  const age = getAgeLabel(child.birth_date)
  const alreadyIn = isInToday(child)
  const needsBadge = requiresBadge(category)
  const needsPager = requiresPager(category)
  const hasAlert = !!(child.allergies || child.medical_notes)
  const graduatesTo = hasCategoryChanged(child) && child.category ? NEXT_CATEGORY[child.category] : null

  const [badge, setBadge] = useState('')
  const [pager, setPager] = useState('')
  const [maestroId, setMaestroId] = useState<string | null>(child.assigned_maestro_id)
  const [maestroName, setMaestroName] = useState<string | null>(child.assigned_maestro_name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ badge: number | null; queued: boolean } | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const badgeRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  // Corrección (ya registrado)
  const [editBadge, setEditBadge] = useState(todayRecord?.badge_number != null ? String(todayRecord.badge_number) : '')
  const [editPager, setEditPager] = useState(todayRecord?.pager_number != null ? String(todayRecord.pager_number) : '')
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => {
    setEditBadge(todayRecord?.badge_number != null ? String(todayRecord.badge_number) : '')
    setEditPager(todayRecord?.pager_number != null ? String(todayRecord.pager_number) : '')
  }, [todayRecord?.badge_number, todayRecord?.pager_number])

  // Foco listo para escribir el gafete (o para que Enter registre en Corderitos).
  useEffect(() => {
    if (alreadyIn) return
    const t = setTimeout(() => (needsBadge ? badgeRef.current : submitRef.current)?.focus(), 280)
    return () => clearTimeout(t)
  }, [alreadyIn, needsBadge])

  async function doCheckIn(badgeNumber: number | null, pagerNumber: number | null) {
    if (!category) { setError('Este niño no tiene grupo asignado. Complétalo en Familias.'); return }
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
    setSubmitting(false)
    if (err) {
      if (err.code === '23505' && err.message.includes('attendance_badge_category_unique')) {
        setError(`El gafete #${badgeNumber} ya lo tiene otro niño en ${CATEGORY_LABELS[category]} hoy.`)
        badgeRef.current?.select()
      } else if (err.code === '23505' && err.message.includes('attendance_pager_category_unique')) {
        setError(`El bíper #${pagerNumber} ya lo tiene otro niño en ${CATEGORY_LABELS[category]} hoy.`)
      } else if (err.code === '23505') {
        setError('Este niño ya fue registrado hoy.')
      } else {
        setError('No se pudo registrar. Intenta de nuevo.')
      }
      return
    }
    setSuccess({ badge: badgeNumber, queued })
    // Sin internet (queued) esto se omite: el check-in ya quedó en cola, y
    // el maestro responsable se puede poner después.
    if (!queued && isCorderitos(category)) {
      const maestroChanged = maestroId !== child.assigned_maestro_id || maestroName !== child.assigned_maestro_name
      if (maestroChanged) {
        await supabase.from('children').update({ assigned_maestro_id: maestroId, assigned_maestro_name: maestroName }).eq('id', child.id)
        onEdited(child.id, { assigned_maestro_id: maestroId, assigned_maestro_name: maestroName })
      }
      if (maestroId) autoAssignTodayTeacher(attendanceId, maestroId)
    }
    // Un momento para ver la palomita y el confeti, y listo para el siguiente.
    setTimeout(() => onRegistered(child.id, badgeNumber), 1100)
  }

  function submitCheckIn(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || success) return
    const pagerNum = pager.trim() ? parseInt(pager, 10) : null
    if (pagerNum !== null && (isNaN(pagerNum) || pagerNum <= 0)) { setError('Número de bíper inválido.'); return }
    if (needsBadge) {
      const num = parseInt(badge, 10)
      if (!badge || isNaN(num) || num <= 0) { setError('Escribe el número de gafete.'); badgeRef.current?.focus(); return }
      doCheckIn(num, pagerNum)
    } else {
      doCheckIn(null, pagerNum)
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault()
    if (!todayRecord || submitting) return
    const b = editBadge.trim() ? parseInt(editBadge, 10) : null
    const pg = editPager.trim() ? parseInt(editPager, 10) : null
    if (needsBadge && (b === null || isNaN(b) || b <= 0)) { setError('Escribe un número de gafete válido.'); return }
    if (pg !== null && (isNaN(pg) || pg <= 0)) { setError('Número de bíper inválido.'); return }
    setSubmitting(true)
    setError(null)
    const err = await onEditAttendance(todayRecord.id, needsBadge ? b : null, pg)
    setSubmitting(false)
    if (err) { setError(err); return }
    onClose()
  }

  async function removeRecord() {
    if (!todayRecord) return
    setSubmitting(true)
    setError(null)
    const err = await onRemoveAttendance(todayRecord.id)
    setSubmitting(false)
    if (err) { setError(err); return }
    onClose()
  }

  async function changeCategory(newCategory: Category) {
    if (newCategory === category) return
    setSavingCategory(true)
    setCategoryError(null)
    const { error: err } = await supabase.from('children').update({ category: newCategory }).eq('id', child.id)
    setSavingCategory(false)
    if (err) { setCategoryError('No se pudo cambiar el grupo.'); return }
    setCategoryOverride(newCategory)
    onCategoryChanged(child.id, newCategory)
  }

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="relative px-6 pt-10 pb-12 flex flex-col items-center text-center overflow-hidden">
        <Confetti />
        <DrawnCheck size={84} className="text-emerald-500" />
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ...SPRING }}
          className="font-display text-2xl font-semibold text-gray-900 mt-3"
        >
          ¡{child.full_name.split(' ')[0]} ya está adentro!
        </motion.p>
        {success.badge !== null && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 420, damping: 16 }}
            className="mt-3 rounded-2xl bg-emerald-600 text-white font-display font-semibold text-3xl px-4 py-2 tabular-nums shadow-lg shadow-emerald-900/15"
          >
            #{success.badge}
          </motion.span>
        )}
        <p className="text-sm text-gray-500 mt-3">
          {CATEGORY_LABELS[category!]}
          {success.queued && <> · <span className="text-amber-700 font-medium">guardado sin internet, se sube solo</span></>}
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 sm:px-6 pt-3 sm:pt-6 pb-6 space-y-4">
      {/* ── Quién ── */}
      <div className="flex items-center gap-3.5 pr-10">
        <span className={`w-14 h-14 rounded-full flex items-center justify-center font-display font-semibold text-xl shrink-0 ${alreadyIn ? 'bg-emerald-500 text-white' : g.avatar}`}>
          {initials(child.full_name)}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-semibold text-gray-900 leading-tight">{child.full_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className={`font-semibold ${g.iconColor}`}>{category ? CATEGORY_LABELS[category] : 'Sin grupo'}</span>
            {age !== null && <> · {age} año{age !== 1 ? 's' : ''}</>}
            {child.parents?.full_name && <> · {child.parents.full_name}</>}
          </p>
        </div>
      </div>

      {/* ── Lo que el maestro DEBE ver antes de recibir al niño ── */}
      {hasAlert && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 space-y-0.5">
            <p className="font-semibold">Alerta médica</p>
            {child.allergies && <p><span className="font-medium">Alergias:</span> {child.allergies}</p>}
            {child.medical_notes && <p><span className="font-medium">Notas:</span> {child.medical_notes}</p>}
          </div>
        </div>
      )}
      {isCorderitos(category) && (
        <div className={`rounded-2xl px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 ${
          child.toilet_trained === true ? 'bg-emerald-50 text-emerald-800' : child.toilet_trained === false ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'
        }`}>
          <Baby size={17} className="shrink-0" />
          {child.toilet_trained === true ? 'Ya va solo al baño' : child.toilet_trained === false ? 'Aún usa pañal / no va solo al baño' : 'No se sabe si ya va solo al baño'}
        </div>
      )}
      {graduatesTo && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <PartyPopper size={16} className="shrink-0" /> Ya cumplió años: puede pasar a {CATEGORY_LABELS[graduatesTo]}.
        </p>
      )}

      {/* ── Acción principal ── */}
      {!alreadyIn ? (
        <form onSubmit={submitCheckIn} className="space-y-3">
          {needsBadge ? (
            <div className={`grid gap-3 ${needsPager ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <label className="block">
                <span className="block text-sm font-semibold text-gray-700 mb-1.5">Gafete</span>
                <input
                  ref={badgeRef}
                  type="number" inputMode="numeric" min={1} enterKeyHint="go"
                  value={badge}
                  onChange={(e) => { setBadge(e.target.value); setError(null) }}
                  placeholder="Núm."
                  className={NUM_INPUT}
                />
              </label>
              {needsPager && (
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-700 mb-1.5">Bíper <span className="font-normal text-gray-400">(opcional)</span></span>
                  <input
                    type="number" inputMode="numeric" min={1} enterKeyHint="go"
                    value={pager}
                    onChange={(e) => { setPager(e.target.value); setError(null) }}
                    placeholder="—"
                    className={NUM_INPUT}
                  />
                </label>
              )}
            </div>
          ) : (
            <>
              {isAdmin && (
                <AssignedMaestroField value={maestroId} onChange={setMaestroId} freeTextValue={maestroName} onFreeTextChange={setMaestroName} compact />
              )}
              <label className="block">
                <span className="block text-sm font-semibold text-gray-700 mb-1.5">Bíper <span className="font-normal text-gray-400">(opcional)</span></span>
                <input
                  type="number" inputMode="numeric" min={1} enterKeyHint="go"
                  value={pager}
                  onChange={(e) => { setPager(e.target.value); setError(null) }}
                  placeholder="—"
                  className={NUM_INPUT}
                />
              </label>
            </>
          )}

          <ErrorNote error={error} />

          <motion.button
            ref={submitRef}
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-display font-semibold text-lg shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Registrando…' : `Registrar en ${category ? CATEGORY_LABELS[category] : '…'}`}
          </motion.button>
          <p className="text-center text-xs text-gray-400 -mt-1 hidden sm:block">Enter para registrar · Esc para cerrar</p>
        </form>
      ) : !todayRecord ? (
        <p className="text-sm text-gray-400">Cargando el registro de hoy…</p>
      ) : todayRecord.pending ? (
        <p className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex gap-2.5">
          <CloudOff size={17} className="shrink-0 mt-0.5" />
          Este registro se hizo sin internet y todavía no se sube. Podrás corregirlo en cuanto se suba.
        </p>
      ) : (
        <form onSubmit={submitCorrection} className="space-y-3">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="font-semibold">Registrado hoy</span> a las {format(new Date(todayRecord.checked_in_at), 'HH:mm')}
            {todayRecord.checked_out_at && <> · ya salió</>}
          </div>
          {(needsBadge || needsPager) && (
            <div className={`grid gap-3 ${needsBadge && needsPager ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {needsBadge && (
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-700 mb-1.5">Gafete</span>
                  <input type="number" inputMode="numeric" min={1} enterKeyHint="done" value={editBadge}
                    onChange={(e) => { setEditBadge(e.target.value); setError(null) }} className={NUM_INPUT} />
                </label>
              )}
              {needsPager && (
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-700 mb-1.5">Bíper</span>
                  <input type="number" inputMode="numeric" min={1} enterKeyHint="done" value={editPager} placeholder="—"
                    onChange={(e) => { setEditPager(e.target.value); setError(null) }} className={NUM_INPUT} />
                </label>
              )}
            </div>
          )}
          <ErrorNote error={error} />
          {(needsBadge || needsPager) && (
            <motion.button type="submit" disabled={submitting} whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-semibold text-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {submitting ? 'Guardando…' : 'Guardar corrección'}
            </motion.button>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {confirmRemove ? (
              <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl bg-red-50 border border-red-200 p-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-red-800 font-medium flex-1 min-w-[10rem]">¿Quitar el registro de hoy? El niño quedará como no registrado.</span>
                <button type="button" onClick={removeRecord} disabled={submitting}
                  className="px-3.5 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">Sí, quitar</button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">No</button>
              </motion.div>
            ) : (
              <motion.button key="ask" type="button" onClick={() => setConfirmRemove(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Quitar registro (fue un error)
              </motion.button>
            )}
          </AnimatePresence>
        </form>
      )}

      {/* ── Más opciones ── */}
      <div className="border-t border-gray-100 pt-2">
        <button type="button" onClick={() => setShowMore((v) => !v)}
          className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
          Más opciones
          <ChevronDown size={16} className={`transition-transform duration-300 ${showMore ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-1 pb-1">
                {child.comments && (
                  <p className="rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-700"><span className="font-semibold">Comentarios:</span> {child.comments}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <OptionButton icon={Users} label={showContacts ? 'Ocultar contactos' : 'Otros contactos'} onClick={() => setShowContacts((v) => !v)} />
                  {isAdmin && <OptionButton icon={Pencil} label="Editar datos del niño" onClick={() => setShowEditModal(true)} />}
                </div>
                {showContacts && <ChildContacts childId={child.id} />}
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <Compass size={15} className="shrink-0 text-gray-400" />
                    <span className="shrink-0">Grupo:</span>
                    <select
                      value={category ?? ''}
                      disabled={savingCategory}
                      onChange={(e) => changeCategory(e.target.value as Category)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white focus:border-indigo-500 focus:outline-none"
                    >
                      {!category && <option value="" disabled>Sin grupo</option>}
                      {ACTIVE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </label>
                )}
                {categoryError && <p className="text-xs text-red-600">{categoryError}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showEditModal && (
        <EditChildModal
          child={child}
          onClose={() => setShowEditModal(false)}
          onSaved={(patch) => { setShowEditModal(false); onEdited(child.id, patch) }}
          onDeleted={() => { setShowEditModal(false); onDeleted(child.id); onClose() }}
        />
      )}
    </div>
  )
}

function OptionButton({ icon: Icon, label, onClick }: { icon: typeof Users; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
      <Icon size={15} /> {label}
    </button>
  )
}

function ErrorNote({ error }: { error: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
          role="alert"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
