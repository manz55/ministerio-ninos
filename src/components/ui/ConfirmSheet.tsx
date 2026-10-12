import { AlertTriangle } from 'lucide-react'
import { Sheet } from '../motion'

/** Confirmación (borrar, etc.) en el mismo panel que el resto de la app. */
export function ConfirmSheet({ open, title, message, confirmLabel = 'Confirmar', destructive = false, busy = false, onConfirm, onClose }: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-6 pt-4 sm:pt-7 pb-6 space-y-4">
        <div className="flex items-start gap-3 pr-8">
          {destructive && (
            <span className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </span>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h2>
            {message && <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-3 rounded-2xl text-white font-semibold disabled:opacity-60 transition-colors ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {busy ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
