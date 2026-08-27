import { useEffect, useState } from 'react'
import { Search, Repeat, Pencil, CalendarDays, ChevronLeft, Check, AlertCircle, X } from 'lucide-react'
import { CATEGORY_LABELS, ACTIVE_CATEGORIES, type Category } from '../../types/domain'
import type { useCoderState } from '../../hooks/useCoderState'

// Busca-y-toca: escribe un nombre parcial (igual que en Registro — no hace
// falta el nombre completo), toca al niño, y luego toca la acción. Reemplaza
// tener que escribir una oración completa como comando, que era lento y
// exigía saber el nombre completo — el motivo por el que Coder se sentía
// pesado de usar en la práctica.
export function CoderPicker({ state }: { state: ReturnType<typeof useCoderState> }) {
  const {
    pickerQuery, setPickerQuery, pickerResults, selectedChild, activeAction,
    pickerBusy, pickerError, pickerDone,
    selectChild, backToSearch, backToActions, setActiveAction,
    submitCategory, submitRename, submitBirthdate,
  } = state

  const [renameValue, setRenameValue] = useState('')
  const [dateValue, setDateValue] = useState('')

  useEffect(() => {
    setRenameValue(selectedChild?.full_name ?? '')
    setDateValue(selectedChild?.birth_date ?? '')
  }, [selectedChild])

  if (pickerDone) {
    return (
      <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 px-0.5">
        <Check size={15} className="shrink-0" /> {pickerDone}
      </p>
    )
  }

  if (!selectedChild) {
    const results = [...pickerResults.exact, ...pickerResults.suggestions].slice(0, 6)
    return (
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="Nombre del niño (con una parte basta)…"
            autoFocus
            className="w-full pl-9 pr-8 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
          />
          {pickerQuery && (
            <button
              onClick={() => setPickerQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 rounded-md"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {pickerQuery.trim() && (
          results.length === 0 ? (
            <p className="text-xs text-gray-400 px-0.5">No encontré a nadie parecido a "{pickerQuery}".</p>
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChild(c)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm font-semibold text-gray-800 truncate">{c.full_name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{c.category ? CATEGORY_LABELS[c.category] : 'Sin categoría'}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{selectedChild.full_name}</p>
          <p className="text-xs text-gray-400">{selectedChild.category ? CATEGORY_LABELS[selectedChild.category] : 'Sin categoría'}</p>
        </div>
        <button onClick={backToSearch} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold shrink-0">
          Cambiar
        </button>
      </div>

      {activeAction === null && (
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => setActiveAction('category')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors">
            <Repeat size={15} className="text-indigo-500" />
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">Categoría</span>
          </button>
          <button onClick={() => setActiveAction('rename')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors">
            <Pencil size={15} className="text-indigo-500" />
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">Nombre</span>
          </button>
          <button onClick={() => setActiveAction('birthdate')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors">
            <CalendarDays size={15} className="text-indigo-500" />
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">Fecha nac.</span>
          </button>
        </div>
      )}

      {activeAction === 'category' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVE_CATEGORIES.map((cat: Category) => (
              <button
                key={cat}
                disabled={pickerBusy}
                onClick={() => submitCategory(cat)}
                className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-40"
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <BackLink onClick={backToActions} />
        </div>
      )}

      {activeAction === 'rename' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="flex-1 min-w-0 px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
            />
            <button
              onClick={() => submitRename(renameValue)}
              disabled={pickerBusy || !renameValue.trim()}
              className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 shrink-0"
            >
              {pickerBusy ? '…' : 'Guardar'}
            </button>
          </div>
          <BackLink onClick={backToActions} />
        </div>
      )}

      {activeAction === 'birthdate' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateValue}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateValue(e.target.value)}
              autoFocus
              className="flex-1 min-w-0 px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
            />
            <button
              onClick={() => submitBirthdate(dateValue)}
              disabled={pickerBusy || !dateValue}
              className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 shrink-0"
            >
              {pickerBusy ? '…' : 'Guardar'}
            </button>
          </div>
          <BackLink onClick={backToActions} />
        </div>
      )}

      {pickerError && (
        <p className="text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {pickerError}
        </p>
      )}
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
      <ChevronLeft size={12} /> Atrás
    </button>
  )
}
