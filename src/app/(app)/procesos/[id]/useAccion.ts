"use client";

import { useState, useTransition } from "react";

/** Ejecuta una server action dentro de una transición y guarda el mensaje de error, si lo hay. */
export function useAccion() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onOk?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });
  }

  return { isPending, error, run };
}
