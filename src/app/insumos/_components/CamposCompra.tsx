"use client";

import { custoPorUnidade, formatarReais, paraCentavos } from "@/lib/dinheiro";

export interface ValoresCompra {
  data_compra: string; // AAAA-MM-DD
  valor_pago: string; // texto, ex.: "126,00"
  quantidade: string;
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
      <p className="mt-3 text-sm text-gray-600">
        Custo por unidade nesta compra:{" "}
        <strong className="text-gray-900">{custo === null ? "—" : formatarReais(custo)}</strong>
        <span className="block text-xs text-gray-500">Ex.: 12 canecas por R$ 126,00 = R$ 10,50 cada.</span>
      </p>
    </div>
  );
}
