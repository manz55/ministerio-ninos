"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Receipt, X } from "lucide-react";
import { ReceiptPrinter, type PrinterStage } from "./ReceiptPrinter";

type LineaReporte = { label: string; value: string };

type ReporteAsistenciaDescargaProps = {
  titulo: string;
  subtitulo?: string;
  /** Desglose línea por línea (p. ej. por categoría). Si se omite, el recibo solo muestra título/subtítulo/nota — sigue usando la misma animación de compartir/descargar. */
  lineas?: LineaReporte[];
  totalLabel?: string;
  totalValue?: string;
  nota?: string;
  /** Ícono del recibo — por defecto el ícono de recibo; pásale otro (p. ej. de hoja de cálculo) para diferenciar un CSV de un PDF a simple vista. */
  icon?: ReactNode;
  /** Genera el archivo real y regresa el Blob (o una URL ya lista para descargar). */
  onGenerate: () => Promise<Blob | string>;
  fileName?: string;
};

export function ReporteAsistenciaDescarga({
  titulo,
  subtitulo,
  lineas,
  totalLabel = "Total",
  totalValue,
  nota,
  icon,
  onGenerate,
  fileName = "reporte.pdf",
}: ReporteAsistenciaDescargaProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<PrinterStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Blob | string | null>(null);
  const canShare = canShareFiles();
  const extension = (fileName.split(".").pop() || "pdf").toUpperCase();
  const shareText = `${titulo}${subtitulo ? ` — ${subtitulo}` : ""}`;

  function closeIfIdle() {
    if (stage === "working") return; // don't yank the modal out from under an in-flight generation
    setOpen(false);
    // Reset so reopening always starts with a fresh "Generar" — the date
    // range behind this modal could change while it's closed, and reusing a
    // cached file from before would silently hand out the wrong dates.
    setStage("idle");
    setError(null);
    setResultado(null);
  }

  async function handleGenerate() {
    if (stage === "working") return;

    setError(null);
    setStage("working");
    let result: Blob | string;
    try {
      result = await onGenerate();
    } catch (err) {
      setStage("idle");
      // A caller can throw a specific message (rango inválido, sin registros…) —
      // show that instead of a generic one when it's there.
      setError(err instanceof Error && err.message ? err.message : "No se pudo generar el reporte. Intenta de nuevo.");
      return;
    }
    setResultado(result);
    setStage("done");
  }

  async function handleShare() {
    if (!resultado || typeof resultado === "string") return;
    try {
      const file = new File([resultado], fileName, { type: mimeTypeFor(fileName) });
      await navigator.share({ files: [file], title: fileName, text: shareText });
    } catch (err) {
      // AbortError = user backed out of the share sheet on purpose — not an error.
      if (err instanceof Error && err.name === "AbortError") return;
      setError("No se pudo abrir el menú de compartir. Puedes descargarlo con el otro botón.");
    }
  }

  function handleDownload() {
    if (!resultado) return;
    const url = typeof resultado === "string" ? resultado : URL.createObjectURL(resultado);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof resultado !== "string") {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }

  const iconEl = icon ?? <Receipt size={15} />;

  return (
    <>
      {/* Compact trigger — the full animated ticket only shows once opened, so this
          doesn't reserve a tall empty block in the page before anyone's asked for it. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-left text-neutral-50 transition hover:bg-neutral-800"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
          {iconEl}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{titulo}</p>
          {subtitulo && <p className="truncate text-xs text-neutral-400">{subtitulo}</p>}
        </div>
        {totalValue && <p className="shrink-0 text-sm font-semibold">{totalValue}</p>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={closeIfIdle}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-sm flex-col items-center gap-3"
            >
              <button
                type="button"
                onClick={closeIfIdle}
                aria-label="Cerrar"
                className="self-end text-neutral-300 transition hover:text-white disabled:opacity-40"
                disabled={stage === "working"}
              >
                <X size={20} />
              </button>

              <ReceiptPrinter.Root stage={stage}>
                <ReceiptPrinter.Machine>
                  <ReceiptPrinter.Header>
                    <div className="flex size-6 items-center justify-center rounded-md bg-neutral-800 text-neutral-50">
                      {iconEl}
                    </div>
                  </ReceiptPrinter.Header>

                  <ReceiptPrinter.Screen>
                    <div className="flex items-center justify-between pb-2">
                      <div>
                        <p className="text-sm font-medium">{titulo}</p>
                        {subtitulo && <p className="text-xs text-neutral-400">{subtitulo}</p>}
                      </div>
                      {totalValue && <p className="text-sm font-medium">{totalValue}</p>}
                    </div>
                    <ReceiptPrinter.Status />
                  </ReceiptPrinter.Screen>
                </ReceiptPrinter.Machine>

                <ReceiptPrinter.Output>
                  <ReceiptPrinter.Paper>
                    <div className="mb-3 text-center text-sm font-semibold">{titulo}</div>
                    <div className="border-t border-dashed border-neutral-300" />
                    {lineas && (
                      <div className="py-2">
                        {lineas.map((l) => (
                          <div key={l.label} className="flex justify-between py-0.5 text-xs">
                            <span className="text-neutral-500">{l.label}</span>
                            <span>{l.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!lineas && subtitulo && (
                      <p className="py-3 text-center text-xs text-neutral-500">{subtitulo}</p>
                    )}
                    {(lineas || totalValue) && <div className="border-t border-dashed border-neutral-300" />}
                    {totalValue && (
                      <div className="flex justify-between pt-2 text-sm font-semibold">
                        <span>{totalLabel}</span>
                        <span>{totalValue}</span>
                      </div>
                    )}
                    {nota && <p className="mt-3 text-center text-[11px] text-neutral-500">{nota}</p>}
                    <div
                      aria-hidden
                      className="mt-4 h-5 opacity-80"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, #171717 0px, #171717 2px, transparent 2px, transparent 5px, #171717 5px, #171717 6px, transparent 6px, transparent 10px)",
                      }}
                    />
                  </ReceiptPrinter.Paper>
                </ReceiptPrinter.Output>
              </ReceiptPrinter.Root>

              {stage === "done" ? (
                // Once the file is ready, compartir and descargar are two
                // independent actions — sharing to WhatsApp shouldn't be the
                // only way to get the file, since not every share target
                // actually saves a copy for the coordinator to keep.
                <div className="flex w-full max-w-sm gap-2">
                  {canShare && (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex-1 rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
                    >
                      Compartir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                  >
                    Descargar {extension}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={stage === "working"}
                  className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  {stage === "idle" ? `Generar ${extension}` : "Generando…"}
                </button>
              )}
              {error && <p className="text-xs text-red-200">{error}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** True when this browser can hand a file to the native share sheet (WhatsApp, Telegram, correo…) — mobile Safari 16.4+ and Android Chrome, not desktop. */
function canShareFiles() {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([""], "probe.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function mimeTypeFor(fileName: string) {
  return fileName.toLowerCase().endsWith(".csv") ? "text/csv" : "application/pdf";
}

// ---------- Ejemplo de uso ----------
//
// <ReporteAsistenciaDescarga
//   titulo="Reporte de asistencia"
//   subtitulo="Domingo 30 de agosto"
//   lineas={[
//     { label: "Corderitos", value: "9" },
//     { label: "Hormiguitas", value: "14" },
//     { label: "Saltamontes", value: "11" },
//     { label: "Exploradores", value: "8" },
//   ]}
//   totalLabel="Total de niños"
//   totalValue="42"
//   nota="Generado por: Coordinador Ricky"
//   fileName="reporte-asistencia.pdf"
//   onGenerate={async () => {
//     const res = await fetch("/api/reportes/asistencia");
//     return await res.blob();
//   }}
// />
