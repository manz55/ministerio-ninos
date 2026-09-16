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

// Variantes casuales para la alerta más leve (2 domingos) — Joshua pidió
// frases animadas/casuales para esta, ya que la app es de niños. Elegida de
// forma estable por niño (no al azar en cada render) para que no cambie de
// frase cada vez que se vuelve a abrir el panel.
const CHILL_TEMPLATES: ((nombre: string) => string)[] = [
  (n) => `👀 ¿Y ${n}? Ya van 2 domingos sin verlo por aquí.`,
  (n) => `🤔 ${n} se nos perdió hace 2 domingos — ¿todo bien por casa?`,
  (n) => `📭 2 domingos sin noticias de ${n}…`,
  (n) => `🐑 ${n} anda perdido — 2 domingos sin aparecer.`,
]

export function absenceMessage(nombre: string, info: AbsenceInfo): string {
  if (info.tier === 'roja') {
    return `🔴 ${nombre} lleva ${info.missed} domingos sin venir. Vale la pena que alguien contacte a la familia.`
  }
  if (info.tier === 'amarilla') {
    return `🟡 ${nombre} lleva ${info.missed} domingos sin venir — ¿le preguntamos a la familia qué pasó?`
  }
  const idx = [...nombre].reduce((s, c) => s + c.charCodeAt(0), 0) % CHILL_TEMPLATES.length
  return CHILL_TEMPLATES[idx](nombre)
}
