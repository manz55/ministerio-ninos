/**
 * Genera el clip-path de dientes (borde perforado) para el papel.
 * Puramente geométrico — no depende del alto del contenido, solo del ancho relativo (%).
 */
export function perforatedEdgeClipPath(toothCount = 32, toothDepth = 4) {
  const points = Array.from({ length: toothCount * 2 }, (_, i) => {
    const x = 100 - ((i + 1) * 100) / (toothCount * 2);
    const y = i % 2 === 0 ? "100%" : `calc(100% - ${toothDepth}px)`;
    return `${x}% ${y}`;
  }).join(", ");

  return `polygon(0 0, 100% 0, 100% calc(100% - ${toothDepth}px), ${points})`;
}

/**
 * El papel no se desliza suave: avanza a pasitos, como el motor paso a paso
 * de una impresora térmica real. Cada valor repetido crea una micro-pausa
 * antes del siguiente avance. Son porcentajes relativos, así que sirven
 * para cualquier alto de recibo sin tener que recalcular nada.
 */
export const FEED_STEP_KEYFRAMES = [
  "-100%", "-91%", "-91%", "-81%", "-81%", "-70%", "-70%", "-58%", "-58%",
  "-45%", "-45%", "-32%", "-32%", "-20%", "-20%", "-10%", "-10%", "-3%",
  "-3%", "0%",
];

export const FEED_STEP_TIMES = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6,
  0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];

export const FEED_DURATION_SECONDS = 1.75;
