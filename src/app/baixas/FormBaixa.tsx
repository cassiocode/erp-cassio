"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buscarFaltas, textoAlertaFaltas } from "@/lib/alertas";
import { hojeISO } from "@/lib/datas";

export interface InsumoOpcao {
  id: number;
  nome: string;
  quantidade_estoque: number;
}

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/** Lança uma baixa: o insumo, quantas unidades e o motivo (texto livre). Tira do estoque. */
export default function FormBaixa({ insumos }: { insumos: InsumoOpcao[] }) {
  const router = useRouter();
  const [insumoId, setInsumoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const escolhido = insumos.find((i) => String(i.id) === insumoId);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    try {
      // Avisa se a baixa vai deixar alguma pré-venda sem material
      const qtd = Number(quantidade);
      if (escolhido && Number.isInteger(qtd) && qtd > 0) {
        const faltas = await buscarFaltas({ status: "concluida", itens: [{ insumo_id: escolhido.id, quantidade: qtd }] });
        if (faltas.length > 0 && !confirm(textoAlertaFaltas(faltas, "Dar baixa mesmo assim?"))) return;
      }

      const resposta = await fetch("/api/baixas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insumo_id: insumoId, quantidade, motivo, data_baixa: data }),
      });
      if (resposta.ok) {
        setInsumoId("");
        setQuantidade("1");
        setMotivo("");
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Erro ao salvar a baixa." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  const mensagem = (nome: string) =>
    erros[nome] ? <p className="mt-1 text-xs text-red-600">{erros[nome]}</p> : null;

  return (
    <form onSubmit={enviar} className="space-y-4 rounded border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">Nova baixa</h2>
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_10rem]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Insumo *</span>
          <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)} className={campo}>
            <option value="">Escolha o insumo</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} ({i.quantidade_estoque} em estoque)
              </option>
            ))}
          </select>
          {mensagem("insumo_id")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Quantidade *</span>
          <input
            type="number"
            min={1}
            step={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className={campo}
          />
          {mensagem("quantidade")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
          {mensagem("data_baixa")}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Motivo *</span>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={campo}
          placeholder="Ex.: estragou, quebrou na prensa, estampa errada, brinde..."
        />
        {mensagem("motivo")}
      </label>

      {escolhido && Number.isInteger(Number(quantidade)) && Number(quantidade) > 0 && (
        <p className="text-sm text-gray-600">
          Estoque de {escolhido.nome}: {escolhido.quantidade_estoque} → {escolhido.quantidade_estoque - Number(quantidade)}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Dar baixa"}
      </button>
    </form>
  );
}
