"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo vivo da entrada: trama de pontos, linhas de luz que atravessam a tela ("estender")
 * e uma luz que acompanha o ponteiro. Sem ponteiro (celular), a luz flutua sozinha.
 * Com "reduzir movimento", tudo fica parado (CSS em globals.css, .auth-backdrop).
 */
export function AuthBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = 0.5;
    let y = 0.35;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX / window.innerWidth;
      y = e.clientY / window.innerHeight;
      el.dataset.pointer = "1";
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="auth-backdrop" aria-hidden="true">
      <div className="auth-backdrop__grid" />
      <div className="auth-backdrop__orb auth-backdrop__orb--blue" />
      <div className="auth-backdrop__orb auth-backdrop__orb--gold" />
      <div className="auth-backdrop__rays">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="auth-backdrop__spot" />
    </div>
  );
}
