"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Renomeia a categoria (os insumos e kits dela continuam ligados). */
export default function BotaoRenomear({ id, nome }: { id: number; nome: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function renomear() {
    const novo = prompt("Novo nome da categoria:", nome)?.trim();
    if (!novo || novo === nome) return;
    setOcupado(true);
    try {
      const resposta = await fetch(`/api/categorias/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novo }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        alert(corpo?.erros?.nome ?? corpo?.erros?.geral ?? "Não foi possível renomear.");
      }
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button type="button" onClick={renomear} disabled={ocupado} className="text-blue-700 hover:underline disabled:opacity-50">
      Renomear
    </button>
  );
}
