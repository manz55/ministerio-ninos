import { useEffect, useState, useSyncExternalStore } from 'react'
import { WifiOff, CloudUpload, RefreshCw, AlertTriangle, X } from 'lucide-react'
import { getOfflineState, subscribeOffline, flushOutbox, dismissNotices } from '../../lib/offline'

function useOfflineState() {
  return useSyncExternalStore(subscribeOffline, getOfflineState)
}

/** Franja bajo el encabezado: sin internet, cuántos registros esperan subir,
 * y avisos de la última sincronización (gafete repetido, etc.). */
export function OfflineStatus() {
  const { online, syncing, pending, oldestPendingAt, notices } = useOfflineState()
  const plural = pending === 1 ? 'registro guardado' : 'registros guardados'
  // Con internet, cada registro se guarda aquí y se sube en un segundo: la
  // franja solo sale si algo lleva rato sin subir (internet lento o caído).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(t)
  }, [pending])
  const stuck = pending > 0 && oldestPendingAt !== null && now - oldestPendingAt > 8000

  return (
    <>
      {(!online || stuck) && (
        <div
          className={`px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 text-center ${
            online ? 'bg-sky-50 text-sky-800 border-b border-sky-200' : 'bg-amber-50 text-amber-800 border-b border-amber-200'
          }`}
        >
          {syncing ? (
            <><RefreshCw size={14} className="shrink-0 animate-spin" /> Subiendo {pending} {pending === 1 ? 'registro' : 'registros'}…</>
          ) : !online ? (
            <>
              <WifiOff size={14} className="shrink-0" />
              {pending > 0
                ? <>Sin internet · {pending} {plural} en este dispositivo. Se suben solos al volver la conexión.</>
                : <>Sin internet · puedes seguir registrando, se sube al volver la conexión.</>}
            </>
          ) : (
            <>
              <CloudUpload size={14} className="shrink-0" />
              {pending} {plural} sin subir todavía.
              <button onClick={() => flushOutbox()} className="underline font-semibold hover:no-underline">
                Reintentar ahora
              </button>
            </>
          )}
        </div>
      )}
      {notices.length > 0 && (
        <div className="px-4 py-2.5 text-xs bg-orange-50 text-orange-900 border-b border-orange-200">
          <div className="max-w-4xl mx-auto flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <ul className="flex-1 space-y-1">
              {notices.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            <button onClick={dismissNotices} className="p-0.5 text-orange-500 hover:text-orange-800" title="Entendido">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
