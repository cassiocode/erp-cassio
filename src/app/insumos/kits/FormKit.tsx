"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { centavosParaTexto } from "@/lib/dinheiro";

export interface CategoriaOpcao {
  id: number;
  nome: string;
  estoque_total: number;
}

export interface KitEmEdicao {
  id: number;
  nome: string;
  preco_venda_centavos: number;
  ativo: number;
  itens: { categoria_id: number; quantidade: number }[];
}

interface Linha {
  categoria_id: number;
  quantidade: string;
}

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/**
 * Edita (ou cria, sem `kit`) um kit do padrão da venda: nome, preço por caneca, se aparece na venda e
 * as categorias com quantidade que entram em cada caneca vendida.
 */
export default function FormKit({ kit, categorias }: { kit?: KitEmEdicao; categorias: CategoriaOpcao[] }) {
  const router = useRouter();
  const [nome, setNome] = useState(kit?.nome ?? "");
  const [preco, setPreco] = useState(kit ? centavosParaTexto(kit.preco_venda_centavos) : "");
  const [ativo, setAtivo] = useState(kit ? kit.ativo === 1 : true);
  const [linhas, setLinhas] = useState<Linha[]>(
    (kit?.itens ?? []).map((i) => ({ categoria_id: i.categoria_id, quantidade: String(i.quantidade) })),
  );
  const [nova, setNova] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(Boolean(kit)); // card de kit novo começa fechado

  const nomeCategoria = new Map(categorias.map((c) => [c.id, c]));
  const disponiveis = categorias.filter((c) => !linhas.some((l) => l.categoria_id === c.id));

  function adicionar() {
    const id = Number(nova);
    if (!id) return;
    setLinhas([...linhas, { categoria_id: id, quantidade: "1" }]);
    setNova("");
    setSalvo(false);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    setSalvo(false);
    try {
      const resposta = await fetch(kit ? `/api/kits/${kit.id}` : "/api/kits", {
        method: kit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, preco_venda: preco, ativo, itens: linhas }),
      });
      if (resposta.ok) {
        if (kit) setSalvo(true);
        else {
          setNome("");
          setPreco("");
          setLinhas([]);
          setAberto(false);
        }
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Não foi possível salvar o kit." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  const mensagem = (n: string) => (erros[n] ? <p className="mt-1 text-xs text-red-600">{erros[n]}</p> : null);

  if (!kit && !aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-sm font-medium text-blue-700 hover:bg-gray-50"
      >
        + Novo kit
      </button>
    );
  }

  return (
    <form
      onSubmit={enviar}
      onChange={() => setSalvo(false)}
      className={`space-y-4 rounded border bg-white p-5 ${ativo ? "border-gray-200" : "border-gray-200 opacity-70"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{kit ? kit.nome : "Novo kit"}</h2>
        {kit && !ativo && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Fora da venda</span>}
      </div>
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Caneca mágica" className={campo} />
          {mensagem("nome")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preço por caneca (R$) *</span>
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="34,90" className={campo} />
          {mensagem("preco_venda")}
        </label>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">O que entra em cada caneca vendida</span>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">Categoria</th>
                <th className="w-28 px-3 py-2">Qtd.</th>
                <th className="px-3 py-2 text-right">Estoque somado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    Nenhuma categoria. Adicione abaixo (ex.: caneca, caixa, papel).
                  </td>
                </tr>
              )}
              {linhas.map((l) => {
                const c = nomeCategoria.get(l.categoria_id);
                return (
                  <tr key={l.categoria_id} className="border-b border-gray-100">
                    <td className="px-3 py-2">{c?.nome ?? `Categoria ${l.categoria_id}`}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={l.quantidade}
                        onChange={(e) =>
                          setLinhas(linhas.map((x) => (x.categoria_id === l.categoria_id ? { ...x, quantidade: e.target.value } : x)))
                        }
                        aria-label={`Quantidade de ${c?.nome ?? "categoria"}`}
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className={`px-3 py-2 text-right ${c && c.estoque_total <= 0 ? "font-medium text-red-600" : "text-gray-600"}`}>
                      {c?.estoque_total ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setLinhas(linhas.filter((x) => x.categoria_id !== l.categoria_id));
                          setSalvo(false);
                        }}
                        className="text-red-700 hover:underline"
                      >
                        Tirar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mensagem("itens")}
        <div className="mt-2 flex gap-2">
          <select value={nova} onChange={(e) => setNova(e.target.value)} className={campo} aria-label="Categoria para adicionar">
            <option value="">Adicionar categoria...</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.estoque_total} em estoque)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adicionar}
            disabled={!nova}
            className="whitespace-nowrap rounded bg-gray-800 px-4 text-sm text-white hover:bg-gray-900 disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Na venda, cada categoria usa o insumo de maior estoque dela (dá para trocar na linha).
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Aparece na nova venda
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {enviando ? "Salvando..." : kit ? "Salvar kit" : "Criar kit"}
        </button>
        {!kit && (
          <button type="button" onClick={() => setAberto(false)} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
            Cancelar
          </button>
        )}
        {salvo && <span className="text-sm text-green-700">✓ Salvo. As próximas vendas usam este padrão.</span>}
      </div>
    </form>
  );
}
