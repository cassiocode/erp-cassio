import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deixa abrir o `npm run dev` pela rede local (celular ou outro PC, ex.: http://192.168.0.9:3000).
  // Sem isso o Next bloqueia o JavaScript da página vindo de outro endereço: a tela aparece, mas os
  // botões e formulários não funcionam.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
};

export default nextConfig;
