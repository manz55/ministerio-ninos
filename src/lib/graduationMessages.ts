// Frases casuales para el aviso de "ya le tocaría pasar de categoría" en
// Reportes — Joshua pidió que fuera informal/animado (es una app de niños) y
// que quedara claro que es solo un aviso: el cambio de categoría siempre lo
// hace un maestro a mano, nunca el sistema solo. Elegida de forma estable
// por niño (no al azar en cada render) para que no cambie de frase cada vez
// que se abre el panel.
const TEMPLATES: ((nombre: string, to: string) => string)[] = [
  (n, to) => `🎂 ${n} ya cumplió y le tocaría pasar a ${to} — ustedes deciden cuándo.`,
  (n, to) => `📈 ${n} ya tiene edad para ${to}. Cámbienlo cuando gusten.`,
  (n, to) => `🐑➡️🐜 ${n} se nos creció — ya podría estar en ${to}.`,
  (n, to) => `🎈 ¡Feliz cumple atrasado, ${n}! Ya le tocaría ${to}.`,
  (n, to) => `👀 Ojo: ${n} ya cumple para ${to}, cuando quieran lo mueven.`,
  (n, to) => `🚀 ${n} está listo para ${to} cuando ustedes digan.`,
  (n, to) => `📋 ${n} pasó la edad — ${to} lo espera.`,
  (n, to) => `🧒 ${n} ya no es tan chiquito — hora de pensar en ${to}.`,
  (n, to) => `🕐 Ya es tiempo: ${n} podría subir a ${to}.`,
  (n, to) => `✨ ${n} se graduó de edad para ${to} — muévanlo cuando quieran.`,
  (n, to) => `📣 Aviso amistoso: ${n} ya califica para ${to}.`,
  (n, to) => `🎓 ${n} está listo para el salto a ${to}.`,
  (n, to) => `🐣 ${n} salió del rango de su categoría — bienvenido a ${to} cuando decidan.`,
  (n, to) => `🔔 Recordatorio: ${n} ya podría estar en ${to}.`,
  (n, to) => `📅 Cumpleaños pasó, categoría no — ${n} podría subir a ${to}.`,
  (n, to) => `🌱 ${n} está creciendo rápido, ya le tocaría ${to}.`,
  (n, to) => `🙋 ${n} "levantó la mano" para ${to} (bueno, cumplió años).`,
  (n, to) => `🧭 ${n} ya tiene el mapa para ${to}.`,
  (n, to) => `⏫ ${n} listo para subir a ${to}.`,
  (n, to) => `🎊 ¡Otro año más! ${n} ya podría ir a ${to}.`,
]

export function graduationMessage(nombre: string, toLabel: string): string {
  const idx = [...nombre].reduce((s, c) => s + c.charCodeAt(0), 0) % TEMPLATES.length
  return TEMPLATES[idx](nombre, toLabel)
}
