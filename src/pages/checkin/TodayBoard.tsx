import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { ChevronDown, CloudOff, X, Radio } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CATEGORY_LABELS, isCorderitos, type Category } from '../../types/domain'
import { AnimatedNumber } from '../../components/motion'
import { EASE_OUT } from '../../components/motion/presets'
import { GROUPS, type TodayRecord } from './shared'

/**
 * "Registrados hoy" en vivo, agrupado por grupo. Cada renglón abre el mismo
 * panel del niño (para corregir gafete/bíper o quitar el registro). En compu
 * vive fijo a la derecha; en celular va debajo de los grupos.
 */
export function TodayBoard({
  records,
  onOpen,
  onlyCategory,
  defaultOpen,
  isAdmin,
  userId,
  onTeacherChanged,
}: {
  records: TodayRecord[]
  onOpen: (childId: string) => void
  onlyCategory?: Category | null
  defaultOpen: boolean
  isAdmin: boolean
  userId: string | null
  onTeacherChanged: (recordId: string, teacherId: string | null, teacherName: string | null) => void
}) {
  const groups = GROUPS.filter((g) => !onlyCategory || g.category === onlyCategory)
  const visible = onlyCategory ? records.filter((r) => r.category === onlyCategory) : records
  const [open, setOpen] = useState<Set<Category>>(() => new Set(defaultOpen ? groups.map((g) => g.category) : onlyCategory ? [onlyCategory] : []))
  useEffect(() => {
    if (defaultOpen || onlyCategory) setOpen(new Set(groups.map((g) => g.category)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen, onlyCategory])

  function toggle(cat: Category) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  return (
    <section className="rounded-3xl bg-white/85 backdrop-blur border border-gray-200/70 shadow-sm overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" />
        </span>
        <h2 className="font-display text-lg font-semibold text-gray-900 flex-1">
          {onlyCategory ? `Adentro en ${CATEGORY_LABELS[onlyCategory]}` : 'Registrados hoy'}
        </h2>
        <span className="font-display text-2xl font-semibold text-gray-900 leading-none">
          <AnimatedNumber value={visible.length} />
        </span>
      </header>

      {visible.length === 0 ? (
        <div className="px-4 pb-5 text-sm text-gray-500 flex items-center gap-2">
          <Radio size={15} className="text-gray-400" />
          Aquí aparecen los niños en cuanto se registran, desde cualquier dispositivo.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {groups.map((g) => {
            const recs = visible.filter((r) => r.category === g.category)
            if (recs.length === 0) return null
            const isOpen = open.has(g.category)
            const Icon = g.icon
            return (
              <div key={g.category}>
                {!onlyCategory && <button
                  type="button"
                  onClick={() => toggle(g.category)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50/80 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className={`w-7 h-7 rounded-lg ${g.iconBg} flex items-center justify-center`}>
                    <Icon size={14} className={g.iconColor} />
                  </span>
                  <span className={`flex-1 text-sm font-semibold ${g.text}`}>{CATEGORY_LABELS[g.category]}</span>
                  <span className={`text-sm font-semibold tabular-nums ${g.iconColor}`}><AnimatedNumber value={recs.length} /></span>
                  <ChevronDown size={15} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <AnimatePresence initial={false}>
                        {recs.map((rec) => (
                          <motion.li
                            key={rec.id}
                            layout="position"
                            initial={{ opacity: 0, backgroundColor: 'rgba(16,185,129,0.18)' }}
                            animate={{ opacity: 1, backgroundColor: 'rgba(16,185,129,0)' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.9, ease: EASE_OUT }}
                          >
                            <RecordRow rec={rec} onOpen={onOpen} isAdmin={isAdmin} userId={userId} onTeacherChanged={onTeacherChanged} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function RecordRow({
  rec, onOpen, isAdmin, userId, onTeacherChanged,
}: {
  rec: TodayRecord
  onOpen: (childId: string) => void
  isAdmin: boolean
  userId: string | null
  onTeacherChanged: (recordId: string, teacherId: string | null, teacherName: string | null) => void
}) {
  const hasAlert = !!(rec.children.allergies || rec.children.medical_notes)
  return (
    <div className="px-4 py-2.5">
      <button type="button" onClick={() => onOpen(rec.child_id)} className="w-full flex items-center gap-3 text-left group">
        <span className={`w-12 shrink-0 text-center rounded-lg py-1 font-display font-semibold tabular-nums text-[15px] ${rec.badge_number ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 text-xs py-1.5'}`}>
          {rec.badge_number ? `#${rec.badge_number}` : 'Sin #'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-800 text-sm truncate group-hover:text-indigo-700 transition-colors">{rec.children.full_name}</span>
            {hasAlert && <span className="shrink-0 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center" title="Alerta médica">!</span>}
          </span>
          <span className="block text-xs text-gray-500">
            {format(new Date(rec.checked_in_at), 'HH:mm')}
            {rec.pager_number ? ` · bíper #${rec.pager_number}` : ''}
          </span>
        </span>
        {rec.pending ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5" title="Guardado en este dispositivo — se sube solo al volver el internet">
            <CloudOff size={11} /> Sin subir
          </span>
        ) : rec.checked_out_at ? (
          <span className="shrink-0 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Salió</span>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Adentro</span>
        )}
      </button>
      {isCorderitos(rec.category) && !rec.pending && (
        <div className="mt-1.5 pl-[3.75rem]">
          <AssignedTeacherControl
            attendanceId={rec.id}
            assignedId={rec.assigned_teacher_id}
            assignedName={rec.assigned_teacher?.full_name ?? null}
            canChange={!rec.assigned_teacher_id || rec.assigned_teacher_id === userId || isAdmin}
            onChanged={(id, name) => onTeacherChanged(rec.id, id, name)}
          />
        </div>
      )}
    </div>
  )
}

// Who's personally responsible for a corderito right now (e.g. taking them
// to the bathroom) — restricted to corderitos categories only, since that's
// the age group where one adult needs to be directly accountable.
function AssignedTeacherControl({
  attendanceId, assignedId, assignedName, canChange, onChanged,
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
    const { error: err } = await supabase.rpc('assign_attendance_teacher', { p_attendance_id: attendanceId, p_teacher_id: teacherId || null })
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
            ? `bg-indigo-50 text-indigo-700 ${canChange ? 'hover:bg-indigo-100' : 'cursor-default'}`
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {!canChange && '🔒 '}{assignedName ? `Lo cuida: ${assignedName}` : '+ ¿Quién lo cuida? (baño, etc.)'}
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
          {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Cancelar">
          <X size={13} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
