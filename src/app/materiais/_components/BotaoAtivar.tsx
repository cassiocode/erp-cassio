"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BotaoAtivar({ id, ativo }: { id: number; ativo: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function alternar() {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/materiais/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
      if (!resposta.ok) alert("Não foi possível alterar a situação do material.");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={carregando}
      className={`hover:underline disabled:opacity-50 ${ativo ? "text-red-700" : "text-green-700"}`}
    >
      {ativo ? "Inativar" : "Reativar"}
    </button>
  );
}
