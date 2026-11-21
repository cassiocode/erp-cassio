"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { textoAlertaFaltas, type Falta } from "@/lib/alertas";
import { hojeISO } from "@/lib/datas";

/**
 * Ações da entrega: Concluir (entregou: a pré-venda vira venda; o estoque já tinha saído) ou Alterar
 * (abre o campo da nova data de entrega).
 */
export default function AcoesEntrega({
  id,
  descricao,
  dataPrevista,
  faltas,
}: {
  id: number;
  descricao: string;
  dataPrevista: string | null;
  faltas: Falta[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [novaData, setNovaData] = useState(dataPrevista ?? hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(corpo: object, mensagemErro: string): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/vendas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) {
        const r = await resposta.json().catch(() => null);
        setErro(r?.erros?.data_prevista ?? r?.erros?.geral ?? mensagemErro);
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

  async function concluir() {
    const pergunta = `Concluir (entregar) a ${descricao}?`;
    if (!confirm(faltas.length > 0 ? textoAlertaFaltas(faltas, pergunta) : pergunta)) return;
    await enviar({ status: "concluida" }, "Não foi possível concluir a entrega.");
  }

  async function salvarData(evento: React.FormEvent) {
    evento.preventDefault();
    if (await enviar({ data_prevista: novaData }, "Não foi possível alterar a data.")) setAlterando(false);
  }

  if (alterando) {
    return (
      <form onSubmit={salvarData} className="flex flex-col items-end gap-1">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Nova data
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            required
            autoFocus
            aria-label={`Nova data de entrega da ${descricao}`}
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
      <div className="flex justify-end gap-3 whitespace-nowrap">
        <button type="button" onClick={concluir} disabled={ocupado} className="text-green-700 hover:underline disabled:opacity-50">
          Concluir
        </button>
        <button
          type="button"
          onClick={() => setAlterando(true)}
          disabled={ocupado}
          className="text-blue-700 hover:underline disabled:opacity-50"
        >
          Alterar
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
