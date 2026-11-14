import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estoque de Canecas",
  description: "Controle de insumos, produtos e vendas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const link = "text-sm text-blue-700 hover:underline";
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <span className="font-semibold">Estoque de Canecas</span>
            <Link href="/insumos" className={link}>
              Insumos
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
