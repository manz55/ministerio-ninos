import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, isFuture,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface Props {
  value: Date
  onChange: (d: Date) => void
  disableFuture?: boolean
  disableSundays?: boolean
  /** Días a marcar con un puntito (p. ej. domingos con registros). */
  markedDates?: Set<string>
  /** Contenido propio del botón (por defecto: ícono + fecha). */
  children?: ReactNode
  triggerClassName?: string
  /** Alinear el calendario al centro del botón en vez de a la izquierda. */
  center?: boolean
}

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

export function DatePicker({ value, onChange, disableFuture = true, disableSundays = false, markedDates, children, triggerClassName, center = false }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1))
  const ref = useRef<HTMLDivElement>(null)
  // Si la fecha cambia desde afuera (flechas), el calendario abre en ese mes.
  useEffect(() => { setView(new Date(value.getFullYear(), value.getMonth(), 1)) }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const monthStart = startOfMonth(view)
  const monthEnd   = endOfMonth(view)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  function isDisabled(day: Date) {
    if (disableFuture && isFuture(day) && !isToday(day)) return true
    if (disableSundays && day.getDay() === 0) return true
    return false
  }

  function pick(day: Date) {
    if (isDisabled(day)) return
    onChange(day)
    setOpen(false)
  }

  const prevMonth = () => setView((v) => subMonths(v, 1))
  const nextMonth = () => {
    const next = addMonths(view, 1)
    if (disableFuture && next > new Date()) return
    setView(next)
  }

  return (
    <div className={`relative ${children ? 'block' : 'inline-block'}`} ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? 'flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-2xl font-medium text-gray-700 hover:border-indigo-400 transition-colors shadow-sm text-sm'}
      >
        {children ?? (
          <>
            <Calendar size={15} className="text-indigo-500" />
            <span className="inline-block first-letter:uppercase">
              {format(value, "d 'de' MMMM yyyy", { locale: es })}
            </span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-72 ${center ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-gray-900 text-sm inline-block first-letter:uppercase">
                {format(view, 'MMMM yyyy', { locale: es })}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-30"
                disabled={disableFuture && addMonths(view, 1) > new Date()}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day, i) => {
                const outside  = !isSameMonth(day, view)
                const selected = isSameDay(day, value)
                const today    = isToday(day)
                const disabled = isDisabled(day) || outside
                const marked = !outside && markedDates?.has(format(day, 'yyyy-MM-dd'))

                return (
                  <button
                    key={i}
                    onClick={() => pick(day)}
                    disabled={disabled}
                    className={[
                      'relative rounded-lg py-1.5 text-xs font-medium transition-colors',
                      outside || disabled ? 'text-gray-300 cursor-default' : 'text-gray-700 hover:bg-indigo-50 cursor-pointer',
                      selected ? '!bg-indigo-600 !text-white hover:!bg-indigo-700' : '',
                      today && !selected ? 'ring-1 ring-inset ring-indigo-400 text-indigo-600' : '',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                    {marked && <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-emerald-500'}`} />}
                  </button>
                )
              })}
            </div>

            {/* Quick: "Hoy" shortcut */}
            {disableFuture && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => pick(new Date())}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Ir a hoy
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
