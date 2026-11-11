"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, background: "#0a1220", color: "#e6edf6", minHeight: "100dvh" }}>
        <h1 style={{ fontSize: 22 }}>Algo deu errado</h1>
        <p style={{ color: "#8d9bb0" }}>O erro foi registrado. Tente de novo; se continuar, avise o responsável técnico.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#1d8ae6", color: "#fff" }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
