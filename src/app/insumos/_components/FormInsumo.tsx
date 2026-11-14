"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { custoPorUnidade, formatarReais, paraCentavos } from "@/lib/dinheiro";

export interface ValoresInsumo {
  nome: string;
  valor_pago: string; // texto, ex.: "126,00"
  quantidade_comprada: string;
  quantidade_estoque: string;
  observacao: string;
}

export const VALORES_VAZIOS: ValoresInsumo = {
  nome: "",
  valor_pago: "",
  quantidade_comprada: "1",
  quantidade_estoque: "0",
  observacao: "",
};

/** Custo por unidade para mostrar enquanto digita; null se ainda não dá para calcular. */
function previaCusto(valorPago: string, quantidade: string): number | null {
  const centavos = paraCentavos(valorPago);
  const qtd = Number(quantidade);
  if (centavos === null || !Number.isInteger(qtd) || qtd < 1) return null;
  return custoPorUnidade(centavos, qtd);
}

export default function FormInsumo({
  id,
  valores = VALORES_VAZIOS,
}: {
  id?: number; // se vier, é edição
  valores?: ValoresInsumo;
}) {
  const router = useRouter();
  const [form, setForm] = useState(valores);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const custo = previaCusto(form.valor_pago, form.quantidade_comprada);

  function atualizar(campo: keyof ValoresInsumo, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});

    try {
      const resposta = await fetch(id ? `/api/insumos/${id}` : "/api/insumos", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (resposta.ok) {
        router.push("/insumos");
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Erro ao salvar o insumo." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
  const mensagem = (nome: string) =>
    erros[nome] ? <p className="mt-1 text-xs text-red-600">{erros[nome]}</p> : null;

  return (
    <form onSubmit={enviar} className="max-w-2xl space-y-4 rounded border border-gray-200 bg-white p-5">
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nome *</span>
        <input
          value={form.nome}
          onChange={(e) => atualizar("nome", e.target.value)}
          className={campo}
          placeholder="Ex.: Caneca branca 325ml"
        />
        {mensagem("nome")}
      </label>

      <fieldset className="rounded border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium">Compra</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Total pago (R$) *</span>
            <input
              value={form.valor_pago}
              onChange={(e) => atualizar("valor_pago", e.target.value)}
              inputMode="decimal"
              className={campo}
              placeholder="126,00"
            />
            {mensagem("valor_pago")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Quantidade comprada *</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.quantidade_comprada}
              onChange={(e) => atualizar("quantidade_comprada", e.target.value)}
              className={campo}
            />
            {mensagem("quantidade_comprada")}
          </label>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Custo por unidade:{" "}
          <strong className="text-gray-900">{custo === null ? "—" : formatarReais(custo)}</strong>
          <span className="block text-xs text-gray-500">Ex.: 12 canecas por R$ 126,00 = R$ 10,50 cada.</span>
        </p>
      </fieldset>

      <label className="block text-sm sm:w-1/2">
        <span className="mb-1 block font-medium">Quantidade em estoque</span>
        <input
          type="number"
          step={1}
          value={form.quantidade_estoque}
          onChange={(e) => atualizar("quantidade_estoque", e.target.value)}
          className={campo}
        />
        <span className="mt-1 block text-xs text-gray-500">Pode ficar negativa.</span>
        {mensagem("quantidade_estoque")}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observação</span>
        <textarea
          value={form.observacao}
          onChange={(e) => atualizar("observacao", e.target.value)}
          rows={2}
          className={campo}
        />
        {mensagem("observacao")}
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {enviando ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/insumos")}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
