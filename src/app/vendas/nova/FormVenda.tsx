"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CUSTO_ENERGIA_CENTAVOS, formatarMargem, precoComMargem } from "@/lib/custos";
import { buscarFaltas, textoAlertaFaltas } from "@/lib/alertas";
import { hojeISO } from "@/lib/datas";
import { descontoProgressivo, lerPercentual, valorDesconto } from "@/lib/descontos";
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
  margem_lucro_percentual: number | null;
}

interface Item {
  insumo_id: number;
  quantidade: string; // texto do campo
}

const campo =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export type StatusVenda = "rascunho" | "pre_venda" | "concluida";

/** Rascunho ou pré-venda já gravada, para a tela de edição. */
export interface VendaEmEdicao {
  id: number;
  status: StatusVenda;
  data_venda: string;
  data_prevista: string | null;
  kits: { kit_id: number; quantidade: number }[];
  desconto_percentual: number;
  cliente: string | null;
  preco_venda_centavos: number;
  custo_energia_centavos: number;
  observacao: string | null;
  itens: { insumo_id: number; quantidade: number }[];
}

type QtdKits = Record<number, number>; // kit_id -> canecas (0 = fora da venda)

const textoPercentual = (n: number) => String(n).replace(".", ",");

const OPCOES_STATUS: { valor: StatusVenda; rotulo: string; dica: string }[] = [
  { valor: "concluida", rotulo: "Venda", dica: "Entregue agora. Tira do estoque e não volta." },
  { valor: "pre_venda", rotulo: "Pré-venda", dica: "Entrega futura. Já tira do estoque; cancelar devolve." },
  { valor: "rascunho", rotulo: "Rascunho", dica: "Só anotação. Não mexe no estoque." },
];

/**
 * Venda, pré-venda ou rascunho. Cada kit (caneca branca, preta) tem quantidade de canecas: cada caneca traz
 * a caneca, a caixa e o papel. Desconto progressivo sobre o preço dos kits (3+ canecas 5%, 6+ 10%), que
 * pode ser trocado ou tirado. Dá para mudar quantidades, tirar itens, adicionar outros insumos (laço...)
 * e editar o preço final. Com `venda`, edita um rascunho ou pré-venda.
 */
export default function FormVenda({
  kits,
  insumos,
  venda,
  faltas = {},
}: {
  kits: KitOpcao[];
  insumos: InsumoOpcao[];
  venda?: VendaEmEdicao;
  faltas?: Record<number, number>; // pré-venda sem material: insumo_id -> quantidade que falta
}) {
  const router = useRouter();
  const kitInicial = venda ? null : (kits[0] ?? null); // venda nova começa com 1 caneca branca
  const [status, setStatus] = useState<StatusVenda>(venda?.status ?? "concluida");
  const [dataPrevista, setDataPrevista] = useState(venda?.data_prevista ?? "");
  const [qtdKits, setQtdKits] = useState<QtdKits>(() =>
    venda
      ? Object.fromEntries(venda.kits.map((k) => [k.kit_id, k.quantidade]))
      : kitInicial
        ? { [kitInicial.id]: 1 }
        : {},
  );
  const [itens, setItens] = useState<Item[]>(
    (venda?.itens ?? kitInicial?.itens ?? []).map((i) => ({ insumo_id: i.insumo_id, quantidade: String(i.quantidade) })),
  );
  // Desconto: automático (progressivo) até você digitar outro valor ou tirar
  const canecasIniciais = venda ? venda.kits.reduce((s, k) => s + k.quantidade, 0) : kitInicial ? 1 : 0;
  const [descontoTexto, setDescontoTexto] = useState(
    textoPercentual(venda ? venda.desconto_percentual : descontoProgressivo(canecasIniciais)),
  );
  const [descontoManual, setDescontoManual] = useState(
    venda ? venda.desconto_percentual !== descontoProgressivo(canecasIniciais) : false,
  );
  const [preco, setPreco] = useState(
    venda
      ? centavosParaTexto(venda.preco_venda_centavos)
      : kitInicial
        ? centavosParaTexto(kitInicial.preco_venda_centavos)
        : "",
  );
  const [cliente, setCliente] = useState(venda?.cliente ?? "");
  const [data, setData] = useState(venda?.data_venda ?? hojeISO());
  const [observacao, setObservacao] = useState(venda?.observacao ?? "");
  const [comEnergia, setComEnergia] = useState(venda ? venda.custo_energia_centavos > 0 : true);
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

  const totalCanecas = (q: QtdKits) => Object.values(q).reduce((s, n) => s + n, 0);
  const totalKits = (q: QtdKits) => kits.reduce((s, k) => s + (q[k.id] ?? 0) * k.preco_venda_centavos, 0);
  const canecas = totalCanecas(qtdKits);
  const descontoAuto = descontoProgressivo(canecas);
  const descontoPct = lerPercentual(descontoTexto);
  const brutoKits = totalKits(qtdKits);
  const descontoValor = valorDesconto(brutoKits, descontoPct ?? 0);

  /** Insumos que fazem parte de algum kit da venda: não levam margem (já estão no preço do kit). */
  const insumosDosKits = (q: QtdKits) =>
    new Set(kits.filter((k) => (q[k.id] ?? 0) > 0).flatMap((k) => k.itens.map((i) => i.insumo_id)));

  /** Preço unitário com margem, se a margem vale para o item (insumo fora dos kits e com margem); senão null. */
  function precoUnitarioComMargem(insumoId: number, q: QtdKits = qtdKits): number | null {
    const insumo = porId.get(insumoId);
    if (insumosDosKits(q).has(insumoId) || !insumo) return null;
    if (insumo.margem_lucro_percentual === null || insumo.custo_unitario_centavos === null) return null;
    return precoComMargem(insumo.custo_unitario_centavos, insumo.margem_lucro_percentual);
  }

  /** Preço sugerido: kits com desconto + extras com margem. */
  function sugerido(q: QtdKits, lista: Item[], textoDesconto: string): number {
    const extras = lista.reduce((soma, item) => {
      const qtd = Number(item.quantidade);
      const unitario = precoUnitarioComMargem(item.insumo_id, q);
      return unitario === null || !Number.isInteger(qtd) || qtd <= 0 ? soma : soma + qtd * unitario;
    }, 0);
    const bruto = totalKits(q);
    return bruto - valorDesconto(bruto, lerPercentual(textoDesconto) ?? 0) + extras;
  }

  /**
   * Aplica uma mudança (kits, itens ou desconto) e ajusta o preço pela diferença do sugerido,
   * mantendo o que você editou à mão no preço.
   */
  function aplicar(mudanca: { q?: QtdKits; lista?: Item[]; desconto?: string; manual?: boolean }) {
    const q = mudanca.q ?? qtdKits;
    const lista = mudanca.lista ?? itens;
    const manual = mudanca.manual ?? descontoManual;
    // Desconto automático acompanha a quantidade de canecas
    const desconto = mudanca.desconto ?? (manual ? descontoTexto : textoPercentual(descontoProgressivo(totalCanecas(q))));
    const diferenca = sugerido(q, lista, desconto) - sugerido(qtdKits, itens, descontoTexto);
    setQtdKits(q);
    setItens(lista);
    setDescontoTexto(desconto);
    setDescontoManual(manual);
    const atual = paraCentavos(preco);
    if (atual === null) setPreco(centavosParaTexto(sugerido(q, lista, desconto)));
    else if (diferenca !== 0) setPreco(centavosParaTexto(Math.max(0, atual + diferenca)));
  }

  const mudarItens = (lista: Item[]) => aplicar({ lista });

  /** Muda a quantidade de canecas de um kit: os insumos do kit acompanham (caneca, caixa, papel). */
  function mudarQtdKit(kit: KitOpcao, novaQtd: number) {
    const qtd = Math.max(0, Math.floor(novaQtd) || 0);
    const delta = qtd - (qtdKits[kit.id] ?? 0);
    if (delta === 0) return;
    let lista = [...itens];
    for (const ki of kit.itens) {
      const atual = lista.find((i) => i.insumo_id === ki.insumo_id);
      const nova = (atual ? Number(atual.quantidade) || 0 : 0) + ki.quantidade * delta;
      lista = atual
        ? nova > 0
          ? lista.map((i) => (i.insumo_id === ki.insumo_id ? { ...i, quantidade: String(nova) } : i))
          : lista.filter((i) => i.insumo_id !== ki.insumo_id)
        : nova > 0
          ? [...lista, { insumo_id: ki.insumo_id, quantidade: String(nova) }]
          : lista;
    }
    aplicar({ q: { ...qtdKits, [kit.id]: qtd }, lista });
  }

  function adicionarInsumo() {
    const id = Number(novoInsumo);
    if (!id) return;
    mudarItens(
      itens.some((i) => i.insumo_id === id)
        ? itens.map((i) => (i.insumo_id === id ? { ...i, quantidade: String(Number(i.quantidade) + 1) } : i))
        : [...itens, { insumo_id: id, quantidade: "1" }],
    );
    setNovoInsumo("");
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    try {
      const prevista = status === "concluida" ? null : dataPrevista || null;
      // Antes de tirar do estoque, avisa se vai faltar material para alguma pré-venda (ou para esta)
      if (status !== "rascunho") {
        const faltas = await buscarFaltas({ venda_id: venda?.id ?? null, status, data_prevista: prevista, cliente, itens });
        if (faltas.length > 0 && !confirm(textoAlertaFaltas(faltas, "Salvar mesmo assim?"))) return;
      }

      const resposta = await fetch(venda ? `/api/vendas/${venda.id}` : "/api/vendas", {
        method: venda ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          data_prevista: prevista,
          data_venda: data,
          kits: kits.filter((k) => (qtdKits[k.id] ?? 0) > 0).map((k) => ({ kit_id: k.id, quantidade: qtdKits[k.id] })),
          desconto_percentual: descontoTexto,
          cliente,
          preco_venda: preco,
          com_energia: comEnergia,
          observacao,
          itens,
        }),
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

  // Faltas da pré-venda gravada, só dos itens que continuam nela
  const semMaterial = itens
    .filter((i) => (faltas[i.insumo_id] ?? 0) > 0)
    .map((i) => ({ nome: porId.get(i.insumo_id)?.nome ?? `Insumo ${i.insumo_id}`, falta: faltas[i.insumo_id] }));

  const mensagem = (nome: string) =>
    erros[nome] ? <p className="mt-1 text-xs text-red-600">{erros[nome]}</p> : null;
  const disponiveis = insumos.filter((i) => !itens.some((item) => item.insumo_id === i.id));

  return (
    <form onSubmit={enviar} className="max-w-3xl space-y-5 rounded border border-gray-200 bg-white p-5">
      {erros.geral && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erros.geral}</p>}

      <div>
        <span className="mb-2 block text-sm font-medium">Tipo</span>
        <div className="flex flex-wrap gap-2">
          {OPCOES_STATUS.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setStatus(o.valor)}
              className={`rounded border px-4 py-2 text-sm ${
                o.valor === status ? "border-blue-600 bg-blue-50 font-medium text-blue-800" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">{OPCOES_STATUS.find((o) => o.valor === status)?.dica}</p>
        {mensagem("status")}
        {semMaterial.length > 0 && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <strong>⚠️ Pré-venda sem material.</strong> Não há estoque de:{" "}
            {semMaterial.map(({ nome, falta }) => `${falta}× ${nome}`).join(", ")}. Reponha o estoque (nova compra)
            ou ajuste os itens.
          </div>
        )}
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Canecas</span>
        <div className="flex flex-wrap gap-3">
          {kits.map((k) => {
            const qtd = qtdKits[k.id] ?? 0;
            return (
              <div
                key={k.id}
                className={`flex items-center gap-3 rounded border px-3 py-2 text-sm ${
                  qtd > 0 ? "border-blue-600 bg-blue-50" : "border-gray-300"
                }`}
              >
                <span className={qtd > 0 ? "font-medium text-blue-800" : ""}>
                  {k.nome} — {formatarReais(k.preco_venda_centavos)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mudarQtdKit(k, qtd - 1)}
                    disabled={qtd === 0}
                    aria-label={`Menos ${k.nome}`}
                    className="h-7 w-7 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={qtd}
                    onChange={(e) => mudarQtdKit(k, Number(e.target.value))}
                    aria-label={`Quantidade de ${k.nome}`}
                    className="w-14 rounded border border-gray-300 px-2 py-1 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => mudarQtdKit(k, qtd + 1)}
                    aria-label={`Mais ${k.nome}`}
                    className="h-7 w-7 rounded border border-gray-300 bg-white hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {mensagem("kits")}

        <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="mb-1 block font-medium">Desconto nas canecas (%)</span>
            <input
              value={descontoTexto}
              onChange={(e) => {
                setDescontoManual(true);
                aplicar({ desconto: e.target.value, manual: true });
              }}
              inputMode="decimal"
              className="w-28 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => aplicar({ desconto: textoPercentual(descontoAuto), manual: false })}
            disabled={!descontoManual}
            className="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-40"
          >
            Usar automático ({descontoAuto}%)
          </button>
          <button
            type="button"
            onClick={() => aplicar({ desconto: "0", manual: true })}
            disabled={descontoPct === 0}
            className="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-40"
          >
            Tirar desconto
          </button>
          <span className="pb-2 text-xs text-gray-500">
            {canecas} caneca{canecas === 1 ? "" : "s"} · automático: 3+ = 5%, 6+ = 10%
            {descontoManual ? " · desconto digitado" : ""}
          </span>
        </div>
        {descontoPct === null && <p className="mt-1 text-xs text-red-600">Use um número de 0 a 100, como 5 ou 20.</p>}
        {mensagem("desconto_percentual")}
        {brutoKits > 0 && (
          <p className="mt-2 text-sm text-gray-700">
            Canecas: {formatarReais(brutoKits)}
            {descontoValor > 0 && (
              <>
                {" "}
                − desconto {textoPercentual(descontoPct ?? 0)}%:{" "}
                <span className="font-medium text-red-600">− {formatarReais(descontoValor)}</span> ={" "}
                <strong>{formatarReais(brutoKits - descontoValor)}</strong>
              </>
            )}
          </p>
        )}
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
                <th className="px-3 py-2 text-right">Custo + margem</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    Nenhum insumo. Escolha um kit ou adicione abaixo.
                  </td>
                </tr>
              )}
              {itens.map((item) => {
                const insumo = porId.get(item.insumo_id);
                const custo = insumo?.custo_unitario_centavos ?? 0;
                const comMargem = precoUnitarioComMargem(item.insumo_id);
                const unitarioFinal = comMargem ?? custo; // sem margem (ou item do kit): o próprio custo
                const qtd = Number(item.quantidade);
                const falta = faltas[item.insumo_id] ?? 0;
                return (
                  <tr key={item.insumo_id} className={`border-b border-gray-100 ${falta > 0 ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-2">
                      {insumo?.nome ?? `Insumo ${item.insumo_id}`}
                      {insumo && (
                        <span className={`ml-2 text-xs ${insumo.quantidade_estoque < 1 ? "text-red-600" : "text-gray-500"}`}>
                          ({insumo.quantidade_estoque} em estoque)
                        </span>
                      )}
                      {falta > 0 && (
                        <div className="mt-1 text-xs font-semibold text-red-600">
                          ⚠️ Não há esse material: falta{falta > 1 ? "m" : ""} {falta} para esta pré-venda
                        </div>
                      )}
                      {comMargem !== null && insumo?.margem_lucro_percentual != null && (
                        <div className="text-xs text-green-700">
                          margem {formatarMargem(insumo.margem_lucro_percentual)} (soma no preço de venda)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          mudarItens(
                            itens.map((i) => (i.insumo_id === item.insumo_id ? { ...i, quantidade: e.target.value } : i)),
                          )
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{formatarReais(custo)}</td>
                    <td className={`px-3 py-2 text-right ${comMargem !== null ? "font-medium text-green-700" : "text-gray-500"}`}>
                      {formatarReais(unitarioFinal)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number.isInteger(qtd) && qtd > 0 ? formatarReais(qtd * unitarioFinal) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => mudarItens(itens.filter((i) => i.insumo_id !== item.insumo_id))}
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

      <div className={`grid gap-4 ${status === "concluida" ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
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
          <span className="mb-1 block font-medium">{status === "concluida" ? "Data da venda" : "Data do pedido"}</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
          {mensagem("data_venda")}
        </label>
        {status !== "concluida" && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Entrega prevista{status === "pre_venda" ? " *" : ""}</span>
            <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className={campo} />
            {mensagem("data_prevista")}
          </label>
        )}
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
          {enviando
            ? "Salvando..."
            : venda
              ? "Salvar alterações"
              : status === "concluida"
                ? "Registrar venda"
                : status === "pre_venda"
                  ? "Registrar pré-venda"
                  : "Salvar rascunho"}
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
