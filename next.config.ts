import type { NextConfig } from "next";

// Todo dado do sistema depende do usuário logado e da RLS: sem cache de dados no servidor.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // O log de Server Functions (só em dev) imprime argumentos, inclusive senhas.
  logging: { serverFunctions: false },
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  // PDF das propostas: o renderizador roda no Node e lê as fontes e o logo do disco.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/propostas/[id]/pdf": ["./src/features/proposals/pdf/fonts/**", "./public/brand/logo.png"],
    "/proposta/[token]/pdf": ["./src/features/proposals/pdf/fonts/**", "./public/brand/logo.png"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
