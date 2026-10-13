// Aviso de "ya le tocaría pasar de grupo" en Reportes. Es solo un aviso: el
// cambio de categoría siempre lo hace un maestro a mano, nunca el sistema.
export function graduationMessage(nombre: string, toLabel: string): string {
  return `${nombre} ya tiene edad para ${toLabel}. Se puede pasar de grupo cuando lo vean conveniente.`
}
