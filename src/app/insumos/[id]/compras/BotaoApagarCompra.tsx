"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Apaga a compra (pede confirmação). A quantidade dela sai do estoque. */
export default function BotaoApagarCompra({ id, descricao }: { id: number; descricao: string }) {
  const router = useRouter();
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!confirm(`Apagar a compra ${descricao}?\nA quantidade sai do estoque e não dá para desfazer.`)) return;
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
