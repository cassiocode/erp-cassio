"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Apaga a venda (pede confirmação) e devolve os insumos ao estoque. */
export default function BotaoApagarVenda({ id, descricao }: { id: number; descricao: string }) {
  const router = useRouter();
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!confirm(`Apagar a venda ${descricao}?\nOs insumos voltam para o estoque e não dá para desfazer.`)) return;
    setApagando(true);
    try {
      const resposta = await fetch(`/api/vendas/${id}`, { method: "DELETE" });
      if (!resposta.ok) alert("Não foi possível apagar a venda.");
      router.refresh();
    } finally {
      setApagando(false);
    }
  }

  return (
    <button type="button" onClick={apagar} disabled={apagando} className="text-red-700 hover:underline disabled:opacity-50">
      Apagar
    </button>
  );
}
