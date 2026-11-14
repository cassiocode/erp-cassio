"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CUSTO_ENERGIA_CENTAVOS } from "@/lib/custos";
import { hojeISO } from "@/lib/datas";
import { centavosParaTexto, formatarReais, paraCentavos } from "@/lib/dinheiro";

export interface KitOpcao {
  id: number;
  nome: string;
  preco_venda_centavos: number;
  itens: { insumo_id: number; quantidade: number }[];
}

export interface InsumoOpcao {
  id: number;
  nome: string;
  custo_unitario_centavos: number | null;
  quantidade_estoque: number;
}

interface Item {
  insumo_id: number;
  quantidade: string; // texto do campo
}

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/**
 * Nova venda: escolher o kit (caneca branca ou preta) já traz a caneca, a caixa e o preço sugerido.
 * Dá para mudar quantidades, tirar itens, adicionar outros insumos (laço...) e editar o preço.
 */
export default function FormVenda({ kits, insumos }: { kits: KitOpcao[]; insumos: InsumoOpcao[] }) {
  const router = useRouter();
  const kitInicial = kits[0] ?? null;
  const [kitId, setKitId] = useState<number | null>(kitInicial?.id ?? null);
  const [itens, setItens] = useState<Item[]>(
    kitInicial?.itens.map((i) => ({ insumo_id: i.insumo_id, quantidade: String(i.quantidade) })) ?? [],
  );
  const [preco, setPreco] = useState(kitInicial ? centavosParaTexto(kitInicial.preco_venda_centavos) : "");
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [comEnergia, setComEnergia] = useState(true);
  const [novoInsumo, setNovoInsumo] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const porId = new Map(insumos.map((i) => [i.id, i]));
  const custoInsumos = itens.reduce((soma, item) => {
    const qtd = Number(item.quantidade);
    const custo = porId.get(item.insumo_id)?.custo_unitario_centavos ?? 0;
    return soma + (Number.isInteger(qtd) && qtd > 0 ? qtd * custo : 0);
  }, 0);
  const custoTotal = custoInsumos + (comEnergia ? CUSTO_ENERGIA_CENTAVOS : 0);
  const precoCentavos = paraCentavos(preco);
  const lucro = precoCentavos === null ? null : precoCentavos - custoTotal;

  /** Troca o kit: sai o que era do kit anterior, entra o do novo; os extras ficam. */
  function escolherKit(novo: KitOpcao) {
    const anterior = kits.find((k) => k.id === kitId);
    const doAnterior = new Set(anterior?.itens.map((i) => i.insumo_id));
    setItens((atuais) => {
      const extras = atuais.filter((i) => !doAnterior.has(i.insumo_id));
      const doNovo = novo.itens
        .filter((i) => !extras.some((e) => e.insumo_id === i.insumo_id))
        .map((i) => ({ insumo_id: i.insumo_id, quantidade: String(i.quantidade) }));
      return [...doNovo, ...extras];
    });
    setKitId(novo.id);
    setPreco(centavosParaTexto(novo.preco_venda_centavos));
  }

  function adicionarInsumo() {
    const id = Number(novoInsumo);
    if (!id) return;
    setItens((atuais) =>
      atuais.some((i) => i.insumo_id === id)
        ? atuais.map((i) => (i.insumo_id === id ? { ...i, quantidade: String(Number(i.quantidade) + 1) } : i))
        : [...atuais, { insumo_id: id, quantidade: "1" }],
    );
    setNovoInsumo("");
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    try {
      const resposta = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_venda: data, kit_id: kitId, cliente, preco_venda: preco, com_energia: comEnergia, observacao, itens }),
      });
      if (resposta.ok) {
        router.push("/vendas");
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErros(corpo?.erros ?? { geral: "Erro ao salvar a venda." });
    } catch {
      setErros({ geral: "Não foi possível conectar ao servidor." });
    } finally {
      setEnviando(false);
    }
  }

  const mensagem = (nome: string) =>
    erros[nome] ? <p className="mt-1 text-xs text-red-600">{erros[nome]}</p> : null;
  const disponiveis = insumos.filter((i) => !itens.some((item) => item.insumo_id === i.id));

  return (
    <form onSubmit={enviar} className="max-w-3xl space-y-5 rounded border border-gray-200 bg-white p-5">
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <div>
        <span className="mb-2 block text-sm font-medium">Kit</span>
        <div className="flex flex-wrap gap-2">
          {kits.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => escolherKit(k)}
              className={`rounded border px-4 py-2 text-sm ${
                k.id === kitId ? "border-blue-600 bg-blue-50 font-medium text-blue-800" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {k.nome} — {formatarReais(k.preco_venda_centavos)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Insumos da venda</span>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">Insumo</th>
                <th className="w-24 px-3 py-2">Qtd.</th>
                <th className="px-3 py-2 text-right">Custo un.</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    Nenhum insumo. Escolha um kit ou adicione abaixo.
                  </td>
                </tr>
              )}
              {itens.map((item) => {
                const insumo = porId.get(item.insumo_id);
                const custo = insumo?.custo_unitario_centavos ?? 0;
                const qtd = Number(item.quantidade);
                return (
                  <tr key={item.insumo_id} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      {insumo?.nome ?? `Insumo ${item.insumo_id}`}
                      {insumo && (
                        <span className={`ml-2 text-xs ${insumo.quantidade_estoque < 1 ? "text-red-600" : "text-gray-500"}`}>
                          ({insumo.quantidade_estoque} em estoque)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          setItens((atuais) =>
                            atuais.map((i) => (i.insumo_id === item.insumo_id ? { ...i, quantidade: e.target.value } : i)),
                          )
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{formatarReais(custo)}</td>
                    <td className="px-3 py-2 text-right">
                      {Number.isInteger(qtd) && qtd > 0 ? formatarReais(qtd * custo) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setItens((atuais) => atuais.filter((i) => i.insumo_id !== item.insumo_id))}
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

        <div className="mt-3 flex gap-2">
          <select value={novoInsumo} onChange={(e) => setNovoInsumo(e.target.value)} className={campo}>
            <option value="">Adicionar insumo (laço, papel...)</option>
            {disponiveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
                {i.custo_unitario_centavos !== null ? ` — ${formatarReais(i.custo_unitario_centavos)}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adicionarInsumo}
            disabled={!novoInsumo}
            className="whitespace-nowrap rounded bg-gray-800 px-4 text-sm text-white hover:bg-gray-900 disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={comEnergia} onChange={(e) => setComEnergia(e.target.checked)} />
          Custo de energia — {formatarReais(CUSTO_ENERGIA_CENTAVOS)}
          <span className="text-xs text-gray-500">(desmarque se não usou)</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preço de venda (R$) *</span>
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" className={campo} />
          {mensagem("preco_venda")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cliente</span>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={campo} />
          {mensagem("cliente")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Data da venda</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
          {mensagem("data_venda")}
        </label>
      </div>

      <div className="grid gap-3 rounded border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-gray-500">{comEnergia ? "Custo (insumos + energia)" : "Custo dos insumos"}</div>
          <div className="text-lg font-semibold">{formatarReais(custoTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Preço de venda</div>
          <div className="text-lg font-semibold">{precoCentavos === null ? "—" : formatarReais(precoCentavos)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{lucro !== null && lucro < 0 ? "Prejuízo" : "Lucro"}</div>
          <div className={`text-lg font-semibold ${lucro !== null && lucro < 0 ? "text-red-600" : "text-green-700"}`}>
            {lucro === null ? "—" : formatarReais(lucro)}
          </div>
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observação</span>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={campo}
          placeholder="Ex.: tema da estampa, frete..."
        />
        {mensagem("observacao")}
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {enviando ? "Salvando..." : "Registrar venda"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/vendas")}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
