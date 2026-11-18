"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hojeISO } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import CamposCompra, { type ValoresCompra } from "./CamposCompra";
import CampoNomeComSugestoes, { type SugestaoInsumo } from "./CampoNomeComSugestoes";

/** Dados já gravados do insumo, para a tela de edição. */
export interface InsumoEmEdicao {
  id: number;
  nome: string;
  quantidade_estoque: number;
  observacao: string | null;
  margem_lucro_percentual: number | null;
  categoria_id: number | null;
  custo_unitario_centavos: number | null;
  quantidade_comprada: number;
}

/** Categoria que dá para escolher (ativas + a atual do insumo, mesmo inativa). */
export interface CategoriaOpcao {
  id: number;
  nome: string;
}

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/**
 * Formulário de insumo.
 * - Novo: nome + primeira compra (data, total pago, quantidade). O estoque começa com a quantidade comprada.
 * - Edição: nome, estoque e observação. Total pago e quantidade mudam pela tela de compras.
 */
export default function FormInsumo({
  insumo,
  sugestoes,
  categorias,
}: {
  insumo?: InsumoEmEdicao; // se vier, é edição
  sugestoes?: SugestaoInsumo[]; // insumos já cadastrados, para o campo Nome do cadastro novo
  categorias: CategoriaOpcao[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(insumo?.nome ?? "");
  const [categoriaId, setCategoriaId] = useState(insumo?.categoria_id ? String(insumo.categoria_id) : "");
  const [observacao, setObservacao] = useState(insumo?.observacao ?? "");
  const [estoque, setEstoque] = useState(String(insumo?.quantidade_estoque ?? 0));
  const [compra, setCompra] = useState<ValoresCompra>({ data_compra: hojeISO(), valor_pago: "", quantidade: "1" });
  const [margem, setMargem] = useState(
    insumo?.margem_lucro_percentual == null ? "" : String(insumo.margem_lucro_percentual).replace(".", ","),
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});

    const corpo = insumo
      ? { nome, categoria_id: categoriaId, quantidade_estoque: estoque, observacao, margem_lucro: margem }
      : {
          nome,
          categoria_id: categoriaId,
          observacao,
          margem_lucro: margem,
          data_compra: compra.data_compra,
          valor_pago: compra.valor_pago,
          quantidade_comprada: compra.quantidade,
        };

    try {
      const resposta = await fetch(insumo ? `/api/insumos/${insumo.id}` : "/api/insumos", {
        method: insumo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (resposta.ok) {
        router.push("/insumos");
        router.refresh();
        return;
      }
      const resultado = await resposta.json().catch(() => null);
      setErros(resultado?.erros ?? { geral: "Erro ao salvar o insumo." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  const mensagem = (campoApi: string) =>
    erros[campoApi] ? <p className="mt-1 text-xs text-red-600">{erros[campoApi]}</p> : null;

  return (
    <form onSubmit={enviar} className="max-w-2xl space-y-4 rounded border border-gray-200 bg-white p-5">
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nome *</span>
        {sugestoes ? (
          <CampoNomeComSugestoes valor={nome} aoMudar={setNome} sugestoes={sugestoes} className={campo} />
        ) : (
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        )}
        {mensagem("nome")}
      </label>

      <label className="block text-sm sm:w-1/2">
        <span className="mb-1 block font-medium">Categoria *</span>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={campo}>
          <option value="">Escolha...</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-500">
          Ex.: a caneca preta Top e a Trix são &quot;Caneca Cor Preta c/ Tarja Branca&quot;. Nova categoria: aba{" "}
          <Link href="/categorias" className="text-blue-700 hover:underline">
            Categorias
          </Link>
          .
        </span>
        {mensagem("categoria_id")}
      </label>

      {insumo ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <span>
              Custo médio:{" "}
              <strong>
                {insumo.custo_unitario_centavos === null ? "—" : formatarReais(insumo.custo_unitario_centavos)}
              </strong>{" "}
              <span className="text-gray-500">({insumo.quantidade_comprada} comprados)</span>
            </span>
            <Link href={`/insumos/${insumo.id}/compras`} className="text-blue-700 hover:underline">
              Ver compras / nova compra
            </Link>
          </div>

          <label className="block text-sm sm:w-1/2">
            <span className="mb-1 block font-medium">Quantidade em estoque</span>
            <input
              type="number"
              step={1}
              value={estoque}
              onChange={(e) => setEstoque(e.target.value)}
              className={campo}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Para ajustes. Compras novas somam sozinhas. Pode ficar negativa.
            </span>
            {mensagem("quantidade_estoque")}
          </label>
        </>
      ) : (
        <fieldset className="rounded border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium">Primeira compra</legend>
          <CamposCompra
            valores={compra}
            aoMudar={(c, v) => setCompra((atual) => ({ ...atual, [c]: v }))}
            erros={erros}
            campoQuantidade="quantidade_comprada"
            className={campo}
          />
          <p className="mt-2 text-xs text-gray-500">O estoque começa com a quantidade comprada.</p>
        </fieldset>
      )}

      <label className="block text-sm sm:w-1/2">
        <span className="mb-1 block font-medium">Margem de lucro (%)</span>
        <input
          value={margem}
          onChange={(e) => setMargem(e.target.value)}
          inputMode="decimal"
          placeholder="Ex.: 50"
          className={campo}
        />
        <span className="mt-1 block text-xs text-gray-500">
          Opcional. Usada só na venda: ao adicionar este insumo, o preço sobe custo + margem. Vazio = não mexe no preço.
        </span>
        {mensagem("margem_lucro")}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observação</span>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={campo} />
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
