"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buscarFaltas, textoAlertaFaltas, type Falta } from "@/lib/alertas";

type Status = "rascunho" | "pre_venda" | "concluida";

/**
 * Ações da linha: Editar (todas), Concluir (rascunho/pré-venda), Cancelar (venda ou pré-venda: os insumos
 * voltam para o estoque) ou Apagar (rascunho, que não mexeu no estoque).
 */
export default function AcoesVenda({
  id,
  status,
  descricao,
  faltas,
  itens,
}: {
  id: number;
  status: Status;
  descricao: string;
  faltas: Falta[]; // faltas atuais desta pré-venda
  itens: { insumo_id: number; quantidade: number }[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<Response>, erro: string) {
    setOcupado(true);
    try {
      const resposta = await acao();
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        alert(corpo?.erros?.geral ?? erro);
      }
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function concluir() {
    // Pré-venda já tirou do estoque: avisa se ela está sem material. Rascunho vai tirar agora: simula.
    const avisos = status === "pre_venda" ? faltas : await buscarFaltas({ venda_id: id, status: "concluida", itens });
    const pergunta = `Concluir (entregar) a ${descricao}?`;
    const ok = avisos.length > 0 ? confirm(textoAlertaFaltas(avisos, pergunta)) : confirm(pergunta);
    if (!ok) return;
    await executar(
      () =>
        fetch(`/api/vendas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "concluida" }),
        }),
      "Não foi possível concluir a venda.",
    );
  }

  async function apagar() {
    const texto =
      status === "rascunho"
        ? `Apagar o ${descricao}?`
        : `Cancelar a ${descricao}?\nOs insumos dela voltam para o estoque e não dá para desfazer.`;
    if (!confirm(texto)) return;
    await executar(() => fetch(`/api/vendas/${id}`, { method: "DELETE" }), "Não foi possível apagar.");
  }

  return (
    <div className="flex justify-end gap-3 whitespace-nowrap">
      <Link href={`/vendas/${id}/editar`} className="text-blue-700 hover:underline">
        Editar
      </Link>
      {status !== "concluida" && (
        <button type="button" onClick={concluir} disabled={ocupado} className="text-green-700 hover:underline disabled:opacity-50">
          Concluir
        </button>
      )}
      <button type="button" onClick={apagar} disabled={ocupado} className="text-red-700 hover:underline disabled:opacity-50">
        {status === "rascunho" ? "Apagar" : "Cancelar"}
      </button>
    </div>
  );
}
