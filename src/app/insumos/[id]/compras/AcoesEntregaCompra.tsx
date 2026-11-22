"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { hojeISO } from "@/lib/datas";

/**
 * Compra pendente de entrega: "Chegou" (a quantidade entra no estoque) ou "Alterar previsão" (nova data
 * prevista de entrega).
 */
export default function AcoesEntregaCompra({
  id,
  quantidade,
  dataPrevista,
}: {
  id: number;
  quantidade: number;
  dataPrevista: string | null;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [novaData, setNovaData] = useState(dataPrevista ?? hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(corpo: object): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/compras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) {
        const r = await resposta.json().catch(() => null);
        setErro(r?.erros?.data_prevista_entrega ?? r?.erros?.geral ?? "Não foi possível salvar.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErro("Não foi possível conectar ao servidor.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function chegou() {
    if (!confirm(`A compra chegou? ${quantidade} unidade(s) entram no estoque hoje.`)) return;
    await enviar({ entregue: true, data_entrega: hojeISO() });
  }

  if (alterando) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await enviar({ data_prevista_entrega: novaData })) setAlterando(false);
        }}
        className="flex flex-col items-end gap-1"
      >
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Nova previsão
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            required
            autoFocus
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <div className="flex gap-3 whitespace-nowrap">
          <button type="submit" disabled={ocupado || !novaData} className="text-blue-700 hover:underline disabled:opacity-50">
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setAlterando(false);
              setErro(null);
              setNovaData(dataPrevista ?? hojeISO());
            }}
            className="text-gray-600 hover:underline"
          >
            Cancelar
          </button>
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3 whitespace-nowrap">
        <button type="button" onClick={chegou} disabled={ocupado} className="text-green-700 hover:underline disabled:opacity-50">
          Chegou
        </button>
        <button
          type="button"
          onClick={() => setAlterando(true)}
          disabled={ocupado}
          className="text-blue-700 hover:underline disabled:opacity-50"
        >
          Alterar previsão
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
