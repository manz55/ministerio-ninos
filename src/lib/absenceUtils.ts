export type AbsenceTier = 'chill' | 'amarilla' | 'roja'

export interface AbsenceInfo {
  missed: number
  lastSeen: string | null
  tier: AbsenceTier | null
}

/**
 * Cuenta domingos "perdidos" para un niño: no calendario puro, sino domingos
 * que aparecen en `globalSessionDates` (fechas donde SÍ hubo servicio, según
 * lo que ya está en `attendance`) posteriores al último domingo en que el
 * niño asistió. Si nunca ha asistido, cuenta desde su fecha de registro —
 * así un niño que se registró y nunca volvió también aparece.
 *
 * Ejemplo real que dio Joshua: un niño vino el domingo 13 y no volvió más —
 * se cuentan los domingos con servicio después del 13, no los días del
 * calendario.
 */
export function computeAbsence(
  registeredAt: string,
  lastSeen: string | null,
  globalSessionDates: string[],
): AbsenceInfo {
  const floor = (lastSeen ?? registeredAt).slice(0, 10)
  const missed = globalSessionDates.filter((d) => d > floor).length
  let tier: AbsenceTier | null = null
  if (missed >= 6) tier = 'roja'
  else if (missed >= 3) tier = 'amarilla'
  else if (missed >= 2) tier = 'chill'
  return { missed, lastSeen, tier }
}

// Un mensaje claro por nivel (el color de la tarjeta ya marca la urgencia).
// Joshua pidió que no sonaran genéricos ni a chiste: siempre la misma frase
// para el mismo caso, con lo que conviene hacer.
export function absenceMessage(nombre: string, info: AbsenceInfo): string {
  if (!info.tier) return ''
  const m = info.missed
  if (info.tier === 'roja') return `${nombre} lleva ${m} domingos sin venir. Vale la pena llamar a la familia.`
  if (info.tier === 'amarilla') return `${nombre} lleva ${m} domingos sin venir. Sería bueno preguntar si todo está bien.`
  return `${nombre} no ha venido los últimos ${m} domingos.`
}
