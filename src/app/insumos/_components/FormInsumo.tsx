"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { custoPorUnidade, formatarReais, paraCentavos } from "@/lib/dinheiro";

export interface ValoresInsumo {
  nome: string;
  grupo_id: string; // "" = nenhum escolhido
  unidade: string;
  valor_pago: string; // texto, ex.: "45,00"
  rendimento: string;
  quantidade_estoque: string;
  estoque_minimo: string;
  fornecedor: string;
  especificacao: string;
}

export interface OpcaoGrupo {
  id: number;
  nome: string;
}

export const VALORES_VAZIOS: ValoresInsumo = {
  nome: "",
  grupo_id: "",
  unidade: "un",
  valor_pago: "",
  rendimento: "1",
  quantidade_estoque: "0",
  estoque_minimo: "0",
  fornecedor: "",
  especificacao: "",
};

/** Custo por unidade para mostrar enquanto digita; null se ainda não dá para calcular. */
function previaCusto(valorPago: string, rendimento: string): number | null {
  const centavos = paraCentavos(valorPago);
  const rende = Number(rendimento);
  if (centavos === null || !Number.isInteger(rende) || rende < 1) return null;
  return custoPorUnidade(centavos, rende);
}

export default function FormInsumo({
  id,
  valores = VALORES_VAZIOS,
  grupos: gruposIniciais,
}: {
  id?: number; // se vier, é edição
  valores?: ValoresInsumo;
  grupos: OpcaoGrupo[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(valores);
  const [grupos, setGrupos] = useState(gruposIniciais);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState<string | null>(null); // null = campo fechado
  const [erroNovoGrupo, setErroNovoGrupo] = useState("");

  const custo = previaCusto(form.valor_pago, form.rendimento);

  function atualizar(campo: keyof ValoresInsumo, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function criarGrupo() {
    setErroNovoGrupo("");
    const resposta = await fetch("/api/grupos-insumo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoGrupo ?? "" }),
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      setErroNovoGrupo(corpo?.erros?.nome ?? "Não foi possível criar o grupo.");
      return;
    }
    setGrupos((atual) =>
      [...atual, { id: corpo.id, nome: corpo.nome }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    );
    atualizar("grupo_id", String(corpo.id));
    setNovoGrupo(null);
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

      <div className="grid grid-cols-2 gap-4">
        <div className="text-sm">
          <label htmlFor="grupo" className="mb-1 block font-medium">
            Grupo *
          </label>
          <select
            id="grupo"
            value={form.grupo_id}
            onChange={(e) => atualizar("grupo_id", e.target.value)}
            className={campo}
          >
            <option value="">Escolha...</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
          {mensagem("grupo_id")}

          {novoGrupo === null ? (
            <button
              type="button"
              onClick={() => setNovoGrupo("")}
              className="mt-1 text-xs text-blue-700 hover:underline"
            >
              + Novo grupo
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={novoGrupo}
                onChange={(e) => setNovoGrupo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    criarGrupo();
                  }
                }}
                placeholder="Nome do grupo"
                className={campo}
              />
              <button
                type="button"
                onClick={criarGrupo}
                className="rounded bg-gray-800 px-3 text-xs text-white hover:bg-gray-900"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNovoGrupo(null);
                  setErroNovoGrupo("");
                }}
                className="px-1 text-xs text-gray-600 hover:underline"
              >
                Cancelar
              </button>
            </div>
          )}
          {erroNovoGrupo && <p className="mt-1 text-xs text-red-600">{erroNovoGrupo}</p>}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Unidade de uso *</span>
          <input
            value={form.unidade}
            onChange={(e) => atualizar("unidade", e.target.value)}
            className={campo}
            placeholder="un, folha, ml, cm"
          />
          {mensagem("unidade")}
        </label>
      </div>

      <fieldset className="rounded border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium">Custo</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Valor pago na compra (R$) *</span>
            <input
              value={form.valor_pago}
              onChange={(e) => atualizar("valor_pago", e.target.value)}
              inputMode="decimal"
              className={campo}
              placeholder="45,00"
            />
            {mensagem("valor_pago")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Rende quantas unidades?</span>
            <input
              type="number"
              min={1}
              step={1}
              value={form.rendimento}
              onChange={(e) => atualizar("rendimento", e.target.value)}
              className={campo}
            />
            {mensagem("rendimento")}
          </label>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Custo por unidade:{" "}
          <strong className="text-gray-900">
            {custo === null ? "—" : `${formatarReais(custo)} / ${form.unidade || "un"}`}
          </strong>
          <span className="block text-xs text-gray-500">
            Ex.: pacote de papel R$ 45,00 que rende 100 folhas = R$ 0,45 por folha.
          </span>
        </p>
      </fieldset>

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

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fornecedor</span>
        <input
          value={form.fornecedor}
          onChange={(e) => atualizar("fornecedor", e.target.value)}
          className={campo}
        />
        {mensagem("fornecedor")}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Especificação</span>
        <textarea
          value={form.especificacao}
          onChange={(e) => atualizar("especificacao", e.target.value)}
          rows={2}
          className={campo}
          placeholder="Ex.: Cerâmica 325ml, classe AAA"
        />
        {mensagem("especificacao")}
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
