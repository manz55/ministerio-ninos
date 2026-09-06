"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  FEED_DURATION_SECONDS,
  FEED_STEP_KEYFRAMES,
  FEED_STEP_TIMES,
  perforatedEdgeClipPath,
} from "./receipt-printer.utils";

export type PrinterStage = "idle" | "working" | "done";

type PrinterContextValue = {
  stage: PrinterStage;
  shouldMove: boolean;
};

const PrinterContext = createContext<PrinterContextValue | null>(null);

function usePrinterContext(component: string) {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error(`${component} debe usarse dentro de ReceiptPrinter.Root`);
  }
  return ctx;
}

const easeOut = [0.23, 1, 0.32, 1] as const;
const CLIP_PATH = perforatedEdgeClipPath();

// ---------- Root ----------

type RootProps = {
  stage: PrinterStage;
  children: ReactNode;
  className?: string;
};

function Root({ stage, children, className }: RootProps) {
  const reduceMotion = useReducedMotion();
  return (
    <PrinterContext.Provider value={{ stage, shouldMove: !reduceMotion }}>
      <section
        data-stage={stage}
        className={`relative flex w-full max-w-sm flex-col items-center ${className ?? ""}`}
      >
        {children}
      </section>
    </PrinterContext.Provider>
  );
}

// ---------- Machine (the printer body) ----------

function Machine({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={`relative isolate w-full overflow-hidden rounded-3xl bg-neutral-900 p-3 pb-6 shadow-[0_20px_36px_-20px_rgba(0,0,0,0.55)] ${className ?? ""}`}
      {...props}
    >
      {children}
      {/* ranura de salida */}
      <div
        aria-hidden
        className="absolute inset-x-6 bottom-3 z-40 h-1.5 rounded-full bg-black shadow-inner"
      />
    </div>
  );
}

function Header({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`flex items-center justify-between px-1 pb-3 ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}

function Screen({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`rounded-2xl bg-neutral-950 px-4 py-3 text-neutral-50 ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}

// ---------- Status (spinner <-> check con crossfade) ----------

function StatusIcon({ stage }: { stage: PrinterStage }) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="sync">
        {stage === "done" ? (
          <motion.svg
            key="check"
            viewBox="0 0 20 20"
            className="col-start-1 row-start-1 size-4 text-emerald-400"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.16, ease: easeOut }}
          >
            <path
              d="M4 10.5 8 14l8-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        ) : stage === "working" ? (
          <motion.svg
            key="spinner"
            viewBox="0 0 20 20"
            className="col-start-1 row-start-1 size-4 animate-spin text-neutral-400 motion-reduce:animate-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.16, ease: easeOut }}
          >
            <path
              d="M10 3a7 7 0 1 0 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </motion.svg>
        ) : (
          // idle — a plain static dot, not a spinner, so "ready and waiting"
          // doesn't read as "stuck loading" before anyone has clicked anything.
          <motion.svg
            key="idle"
            viewBox="0 0 20 20"
            className="col-start-1 row-start-1 size-4 text-neutral-500"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.16, ease: easeOut }}
          >
            <circle cx="10" cy="10" r="3.5" fill="currentColor" />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}

type StatusProps = { children?: ReactNode };

function Status({ children }: StatusProps) {
  const { stage } = usePrinterContext("ReceiptPrinter.Status");
  const label =
    children ??
    { idle: "Listo para generar", working: "Generando reporte", done: "Reporte listo" }[stage];

  return (
    <div className="flex items-center gap-2">
      <StatusIcon stage={stage} />
      <div className="relative grid min-w-0 flex-1 overflow-hidden" aria-live="polite" role="status">
        <AnimatePresence initial={false} mode="sync">
          <motion.span
            key={stage}
            className="col-start-1 row-start-1 truncate text-xs font-medium text-neutral-300"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: easeOut }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Output (ventana + avance a pasos) ----------

function Output({ children, className }: { children: ReactNode; className?: string }) {
  const { stage, shouldMove } = usePrinterContext("ReceiptPrinter.Output");
  const visible = stage === "done";

  return (
    <div className={`relative -mt-1 h-72 w-full overflow-hidden px-3 ${className ?? ""}`}>
      {visible && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-0 z-20 h-2 bg-black/50 blur-[6px]"
        />
      )}
      <motion.div
        aria-hidden={stage !== "done"}
        initial={false}
        animate={
          shouldMove
            ? { transform: visible ? FEED_STEP_KEYFRAMES.map((v) => `translateY(${v})`) : 'translateY(-100%)', opacity: 1 }
            : { transform: visible ? 'translateY(0%)' : 'translateY(-100%)', opacity: 1 }
        }
        transition={{
          transform: {
            duration: shouldMove && visible ? FEED_DURATION_SECONDS : 0,
            ease: "linear",
            times: shouldMove && visible ? FEED_STEP_TIMES : undefined,
          },
        }}
        className="relative shadow-[0_8px_20px_rgba(0,0,0,0.22)]"
      >
        {children}
      </motion.div>
    </div>
  );
}

function Paper({ children, className, ...props }: ComponentPropsWithoutRef<"article">) {
  return (
    <article
      className={`bg-neutral-50 px-5 pb-6 pt-6 font-mono text-neutral-900 ${className ?? ""}`}
      style={{ clipPath: CLIP_PATH }}
      {...props}
    >
      {children}
    </article>
  );
}

export const ReceiptPrinter = {
  Root,
  Machine,
  Header,
  Screen,
  Status,
  Output,
  Paper,
};
