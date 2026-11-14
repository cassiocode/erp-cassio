"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Apaga a baixa lançada por engano (pede confirmação) e devolve a quantidade ao estoque. */
export default function BotaoApagarBaixa({ id, descricao }: { id: number; descricao: string }) {
  const router = useRouter();
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!confirm(`Apagar a baixa ${descricao}?\nA quantidade volta para o estoque e não dá para desfazer.`)) return;
    setApagando(true);
    try {
      const resposta = await fetch(`/api/baixas/${id}`, { method: "DELETE" });
      if (!resposta.ok) alert("Não foi possível apagar a baixa.");
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
