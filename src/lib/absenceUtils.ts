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

// El emoji al frente sigue marcando la urgencia (chill/amarilla/roja); el
// cuerpo de la frase es uno de 20 únicos, elegido de forma estable por niño
// (no al azar en cada render) para que no cambie de frase cada vez que se
// abre el panel, y para que no se repitan las mismas 4-5 frases entre varios
// niños de la misma categoría de urgencia.
const TIER_EMOJI: Record<AbsenceTier, string> = { chill: '👀', amarilla: '🟡', roja: '🔴' }

const BODY_TEMPLATES: ((n: string, m: number) => string)[] = [
  (n, m) => `¿Y ${n}? Ya van ${m} domingos sin verl@ por aquí.`,
  (n, m) => `${n} se nos perdió — lleva ${m} domingos sin venir.`,
  (n, m) => `${m} domingos sin noticias de ${n}…`,
  (n, m) => `${n} anda perdid@ — ${m} domingos sin aparecer.`,
  (n, m) => `¿Alguien sabe de ${n}? Van ${m} domingos sin venir.`,
  (n, m) => `${n} lleva ${m} domingos sin venir — vale la pena preguntar qué pasó.`,
  (n, m) => `Se extraña a ${n} — ${m} domingos sin asistir.`,
  (n, m) => `${m} domingos y ${n} no ha vuelto a aparecer.`,
  (n, m) => `${n} no ha cruzado la puerta en ${m} domingos.`,
  (n, m) => `${n}: ${m} domingos consecutivos sin registrar entrada.`,
  (n, m) => `Extrañamos a ${n} — ya van ${m} domingos.`,
  (n, m) => `${n} se nos desvió del camino — ${m} domingos sin venir.`,
  (n, m) => `Pensando en ${n}, que lleva ${m} domingos sin aparecer.`,
  (n, m) => `${m} domingos marcados sin ${n} en la lista.`,
  (n, m) => `${n} se nos escondió — ${m} domingos sin venir.`,
  (n, m) => `${n} lleva ${m} domingos de ausencia — ¿le avisamos a la familia?`,
  (n, m) => `El lugar de ${n} sigue vacío, van ${m} domingos.`,
  (n, m) => `Cero registros de ${n} en los últimos ${m} domingos.`,
  (n, m) => `¿Cómo estará ${n}? ${m} domingos sin verl@ por aquí.`,
  (n, m) => `${m} domingos y ${n} sigue sin aparecer — quizás valga una llamada.`,
]

export function absenceMessage(nombre: string, info: AbsenceInfo): string {
  if (!info.tier) return ''
  const idx = [...nombre].reduce((s, c) => s + c.charCodeAt(0), 0) % BODY_TEMPLATES.length
  return `${TIER_EMOJI[info.tier]} ${BODY_TEMPLATES[idx](nombre, info.missed)}`
}
