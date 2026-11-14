"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { hojeISO } from "@/lib/datas";
import CamposCompra, { type ValoresCompra } from "../../_components/CamposCompra";

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

const VAZIO = (): ValoresCompra => ({ data_compra: hojeISO(), valor_pago: "", quantidade: "1" });

/** Lança uma nova compra do insumo; a quantidade soma ao estoque. */
export default function FormCompra({ insumoId }: { insumoId: number }) {
  const router = useRouter();
  const [compra, setCompra] = useState<ValoresCompra>(VAZIO);
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    try {
      const resposta = await fetch(`/api/insumos/${insumoId}/compras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...compra, observacao }),
      });
      if (resposta.ok) {
        setCompra(VAZIO());
        setObservacao("");
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Erro ao salvar a compra." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">Nova compra</h2>
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <CamposCompra
        valores={compra}
        aoMudar={(c, v) => setCompra((atual) => ({ ...atual, [c]: v }))}
        erros={erros}
        campoQuantidade="quantidade"
        className={campo}
      />

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observação</span>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={campo}
          placeholder="Ex.: fornecedor, promoção..."
        />
        {erros.observacao && <p className="mt-1 text-xs text-red-600">{erros.observacao}</p>}
      </label>

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Adicionar compra"}
      </button>
    </form>
  );
}
