"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Botão Inativar/Reativar: envia PATCH { ativo } para `url` e recarrega a tela. */
export default function BotaoAtivar({ url, ativo }: { url: string; ativo: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function alternar() {
    setCarregando(true);
    try {
      const resposta = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
      if (!resposta.ok) alert("Não foi possível alterar a situação.");
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
