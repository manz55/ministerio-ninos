"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { ReceiptPrinter, type PrinterStage } from "./ReceiptPrinter";

type LineaReporte = { label: string; value: string };

type ReporteAsistenciaDescargaProps = {
  titulo: string;
  subtitulo?: string;
  lineas: LineaReporte[];
  totalLabel?: string;
  totalValue: string;
  nota?: string;
  /** Genera el PDF real y regresa el Blob (o una URL ya lista para descargar). */
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
  onGenerate,
  fileName = "reporte.pdf",
}: ReporteAsistenciaDescargaProps) {
  const [stage, setStage] = useState<PrinterStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const canShare = canShareFiles();

  async function handleClick() {
    if (stage === "working") return;

    setError(null);
    setStage("working");
    let result: Blob | string;
    try {
      result = await onGenerate();
    } catch {
      setStage("idle");
      setError("No se pudo generar el reporte. Intenta de nuevo.");
      return;
    }
    setStage("done");
    // Generation already succeeded at this point — a share-sheet cancel or
    // failure falls back to a plain download instead of showing an error,
    // since the report itself is fine either way.
    await entregar(result, fileName, `${titulo}${subtitulo ? ` — ${subtitulo}` : ""}`);
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <ReceiptPrinter.Root stage={stage}>
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <div className="flex size-6 items-center justify-center rounded-md bg-neutral-800 text-neutral-50">
              <Receipt size={13} />
            </div>
          </ReceiptPrinter.Header>

          <ReceiptPrinter.Screen>
            <div className="flex items-center justify-between pb-2">
              <div>
                <p className="text-sm font-medium">{titulo}</p>
                {subtitulo && <p className="text-xs text-neutral-400">{subtitulo}</p>}
              </div>
              <p className="text-sm font-medium">{totalValue}</p>
            </div>
            <ReceiptPrinter.Status />
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper>
            <div className="mb-3 text-center text-sm font-semibold">{titulo}</div>
            <div className="border-t border-dashed border-neutral-300" />
            <div className="py-2">
              {lineas.map((l) => (
                <div key={l.label} className="flex justify-between py-0.5 text-xs">
                  <span className="text-neutral-500">{l.label}</span>
                  <span>{l.value}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-neutral-300" />
            <div className="flex justify-between pt-2 text-sm font-semibold">
              <span>{totalLabel}</span>
              <span>{totalValue}</span>
            </div>
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

      <button
        type="button"
        onClick={handleClick}
        disabled={stage === "working"}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
      >
        {stage === "idle" && (canShare ? "Generar y compartir PDF" : "Generar y descargar PDF")}
        {stage === "working" && "Generando…"}
        {stage === "done" && (canShare ? "Compartir de nuevo" : "Descargar de nuevo")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
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

async function entregar(result: Blob | string, fileName: string, shareText: string) {
  if (typeof result !== "string" && canShareFiles()) {
    try {
      const file = new File([result], fileName, { type: "application/pdf" });
      await navigator.share({ files: [file], title: fileName, text: shareText });
      return;
    } catch (err) {
      // AbortError = user closed the share sheet on purpose — leave it at that,
      // don't dump them into a download they didn't ask for.
      if (err instanceof Error && err.name === "AbortError") return;
      // Any other share failure (e.g. no app can handle the file) falls
      // through to a plain download below so the report isn't lost.
    }
  }

  const url = typeof result === "string" ? result : URL.createObjectURL(result);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof result !== "string") {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
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
