"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, RotateCcw, XCircle } from "lucide-react";
import { transitionFor } from "@/lib/motion";

type ToastKind = "success" | "error" | "undo";
type ToastItem = { id: string; kind: ToastKind; message: string; durationMs: number; onUndo?: () => void };
type ToastOptions = Omit<ToastItem, "id" | "durationMs"> & { durationMs?: number };
type ToastContextValue = { show: (options: ToastOptions) => string; dismiss: (id: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useCallback((id: string) => setToast((current) => (current?.id === id ? null : current)), []);
  const show = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = crypto.randomUUID();
    const item: ToastItem = { ...options, id, durationMs: options.durationMs ?? (options.kind === "undo" ? 5000 : 3000) };
    setToast(item);
    timer.current = setTimeout(() => dismiss(id), item.durationMs);
    return id;
  }, [dismiss]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ToastContext.Provider value={{ show, dismiss }}>{children}<ToastViewport toast={toast} dismiss={dismiss} /></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function ToastViewport({ toast, dismiss }: { toast: ToastItem | null; dismiss: (id: string) => void }) {
  const reduced = useReducedMotion();
  return <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+.75rem)] z-50 mx-auto w-full max-w-3xl px-5 sm:px-7">
    <AnimatePresence>
      {toast && <motion.div key={toast.id} role={toast.kind === "error" ? "alert" : "status"} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} transition={transitionFor(Boolean(reduced))} className="pointer-events-auto flex items-center gap-3 rounded-macho-m border border-macho-border bg-macho-card/95 px-4 py-3 shadow-xl">
        {toast.kind === "success" ? <Check size={18} className="text-macho-lime" /> : toast.kind === "error" ? <XCircle size={18} className="text-macho-danger" /> : <RotateCcw size={18} className="text-macho-lime" />}
        <span className="flex-1 text-sm">{toast.message}</span>
        {toast.kind === "undo" && <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => { toast.onUndo?.(); dismiss(toast.id); }} className="min-h-11 min-w-11 text-sm font-semibold text-macho-lime">元に戻す</motion.button>}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
