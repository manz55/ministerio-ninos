/** Solo en el build de demo (npm run build:demo): avisa que los datos son
 * inventados y permite volver a empezar. */
export function DemoBar() {
  function reset() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('ministerio_demo_db') || k.startsWith('offline_cache:')).forEach((k) => localStorage.removeItem(k))
    } catch { /* sin localStorage */ }
    window.location.reload()
  }
  return (
    <div className="px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 text-center bg-amber-100 text-amber-900 border-b border-amber-200">
      <span>Versión de prueba · familias inventadas · nada se guarda en la base de datos real</span>
      <button onClick={reset} className="underline font-semibold hover:no-underline shrink-0">Reiniciar</button>
    </div>
  )
}
