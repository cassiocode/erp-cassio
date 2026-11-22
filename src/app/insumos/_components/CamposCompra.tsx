"use client";

import { custoPorUnidade, formatarReais, paraCentavos } from "@/lib/dinheiro";

export interface ValoresCompra {
  data_compra: string; // AAAA-MM-DD
  valor_pago: string; // texto, ex.: "126,00"
  quantidade: string;
  entregue: "sim" | "nao"; // a compra já chegou? "nao" = pendente de entrega (não entra no estoque)
  data_prevista_entrega: string; // AAAA-MM-DD, só se pendente
}

/** Valores iniciais de uma compra nova (já chegou, hoje). */
export const compraVazia = (hoje: string): ValoresCompra => ({
  data_compra: hoje,
  valor_pago: "",
  quantidade: "1",
  entregue: "sim",
  data_prevista_entrega: "",
});

/** Campos de entrega no formato da API. */
export function entregaParaApi(v: ValoresCompra) {
  return {
    entregue: v.entregue === "sim",
    data_prevista_entrega: v.entregue === "sim" ? null : v.data_prevista_entrega || null,
  };
}

/** Custo por unidade para mostrar enquanto digita; null se ainda não dá para calcular. */
function previaCusto(valorPago: string, quantidade: string): number | null {
  const centavos = paraCentavos(valorPago);
  const qtd = Number(quantidade);
  if (centavos === null || !Number.isInteger(qtd) || qtd < 1) return null;
  return custoPorUnidade(centavos, qtd);
}

/** Data, total pago e quantidade de uma compra, com o custo por unidade calculado na hora. */
export default function CamposCompra({
  valores,
  aoMudar,
  erros,
  campoQuantidade,
  className,
}: {
  valores: ValoresCompra;
  aoMudar: (campo: keyof ValoresCompra, valor: string) => void;
  erros: Record<string, string>;
  campoQuantidade: string; // nome do campo de quantidade na API (para mostrar o erro certo)
  className: string;
}) {
  const custo = previaCusto(valores.valor_pago, valores.quantidade);
  const mensagem = (nome: string) =>
    erros[nome] ? <p className="mt-1 text-xs text-red-600">{erros[nome]}</p> : null;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Data da compra</span>
          <input
            type="date"
            value={valores.data_compra}
            onChange={(e) => aoMudar("data_compra", e.target.value)}
            className={className}
          />
          {mensagem("data_compra")}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Total pago (R$) *</span>
          <input
            value={valores.valor_pago}
            onChange={(e) => aoMudar("valor_pago", e.target.value)}
            inputMode="decimal"
            className={className}
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
            value={valores.quantidade}
            onChange={(e) => aoMudar("quantidade", e.target.value)}
            className={className}
          />
          {mensagem(campoQuantidade)}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <fieldset>
          <legend className="mb-1 font-medium">Entrega realizada?</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={valores.entregue === "sim"}
                onChange={() => aoMudar("entregue", "sim")}
              />
              Sim, já chegou
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={valores.entregue === "nao"}
                onChange={() => aoMudar("entregue", "nao")}
              />
              Não, pendente de entrega
            </label>
          </div>
        </fieldset>
        {valores.entregue === "nao" && (
          <label className="block">
            <span className="mb-1 block font-medium">Previsão de entrega *</span>
            <input
              type="date"
              value={valores.data_prevista_entrega}
              onChange={(e) => aoMudar("data_prevista_entrega", e.target.value)}
              required
              className={className}
            />
            {mensagem("data_prevista_entrega")}
          </label>
        )}
        <p className="w-full text-xs text-gray-500">
          {valores.entregue === "sim"
            ? "A quantidade entra no estoque agora."
            : "Não entra no estoque até você marcar \"Chegou\" na tela de compras do insumo."}
        </p>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Custo por unidade nesta compra:{" "}
        <strong className="text-gray-900">{custo === null ? "—" : formatarReais(custo)}</strong>
        <span className="block text-xs text-gray-500">Ex.: 12 canecas por R$ 126,00 = R$ 10,50 cada.</span>
      </p>
    </div>
  );
}
