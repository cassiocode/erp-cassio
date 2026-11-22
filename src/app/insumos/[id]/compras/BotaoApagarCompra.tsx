"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Apaga a compra (pede confirmação). Se já tinha chegado, a quantidade dela sai do estoque. */
export default function BotaoApagarCompra({
  id,
  descricao,
  entregue = true,
}: {
  id: number;
  descricao: string;
  entregue?: boolean;
}) {
  const router = useRouter();
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    const efeito = entregue ? "A quantidade sai do estoque e não dá para desfazer." : "Ela ainda não tinha chegado: o estoque não muda.";
    if (!confirm(`Apagar a compra ${descricao}?\n${efeito}`)) return;
    setApagando(true);
    try {
      const resposta = await fetch(`/api/compras/${id}`, { method: "DELETE" });
      if (!resposta.ok) alert("Não foi possível apagar a compra.");
      router.refresh();
    } finally {
      setApagando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={apagar}
      disabled={apagando}
      className="text-red-700 hover:underline disabled:opacity-50"
    >
      Apagar
    </button>
  );
}
