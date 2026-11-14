"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ValoresIniciais {
  nome: string;
  categoria: string;
  unidade: string;
  custo: string; // texto, ex.: "12,50"
  quantidade_estoque: number;
  estoque_minimo: number;
}

const VAZIO: ValoresIniciais = {
  nome: "",
  categoria: "",
  unidade: "un",
  custo: "",
  quantidade_estoque: 0,
  estoque_minimo: 0,
};

const CATEGORIAS_SUGERIDAS = ["caneca", "caixa", "embalagem", "doce", "outro"];

export default function FormMaterial({
  id,
  valores = VAZIO,
  categorias = [],
}: {
  id?: number; // se vier, é edição
  valores?: ValoresIniciais;
  categorias?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(valores);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const sugestoes = Array.from(new Set([...CATEGORIAS_SUGERIDAS, ...categorias]));

  function atualizar(campo: keyof ValoresIniciais, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});

    try {
      const resposta = await fetch(id ? `/api/materiais/${id}` : "/api/materiais", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (resposta.ok) {
        router.push("/materiais");
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Erro ao salvar o material." });
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
    <form onSubmit={enviar} className="max-w-xl space-y-4 rounded border border-gray-200 bg-white p-5">
      {erros.geral && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>
      )}

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

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Categoria</span>
          <input
            value={form.categoria}
            onChange={(e) => atualizar("categoria", e.target.value)}
            list="categorias-sugeridas"
            className={campo}
          />
          <datalist id="categorias-sugeridas">
            {sugestoes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {mensagem("categoria")}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Unidade *</span>
          <input
            value={form.unidade}
            onChange={(e) => atualizar("unidade", e.target.value)}
            className={campo}
            placeholder="un, pacote, kg"
          />
          {mensagem("unidade")}
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Custo unitário (R$) *</span>
        <input
          value={form.custo}
          onChange={(e) => atualizar("custo", e.target.value)}
          inputMode="decimal"
          className={campo}
          placeholder="12,50"
        />
        {mensagem("custo")}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Quantidade em estoque</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.quantidade_estoque}
            onChange={(e) => atualizar("quantidade_estoque", e.target.value)}
            className={campo}
          />
          {mensagem("quantidade_estoque")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Estoque mínimo</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.estoque_minimo}
            onChange={(e) => atualizar("estoque_minimo", e.target.value)}
            className={campo}
          />
          {mensagem("estoque_minimo")}
        </label>
      </div>

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
          onClick={() => router.push("/materiais")}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
