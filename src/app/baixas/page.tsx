import { formatarData } from "@/lib/datas";
import { listarBaixas } from "@/lib/db/repositories/baixas";
import { listarInsumos } from "@/lib/db/repositories/insumos";
import { formatarReais } from "@/lib/dinheiro";
import BotaoApagarBaixa from "./BotaoApagarBaixa";
import FormBaixa from "./FormBaixa";

export const dynamic = "force-dynamic";

export default function BaixasPage() {
  const baixas = listarBaixas();
  const insumos = listarInsumos({ ativo: 1 }).map(({ id, nome, quantidade_estoque }) => ({ id, nome, quantidade_estoque }));
  const perdido = baixas.reduce((s, b) => s + b.custo_total_centavos, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Baixas de estoque</h1>
        <p className="text-sm text-gray-500">
          Insumos que saíram do estoque sem venda (estrago, quebra...). Apagar uma baixa devolve ao estoque.
        </p>
      </div>

      <FormBaixa insumos={insumos} />

      <div className="rounded border border-gray-200 bg-white px-4 py-3 sm:w-72">
        <div className="text-xs text-gray-500">Valor perdido ({baixas.length} baixas)</div>
        <div className="text-lg font-semibold text-red-600">{formatarReais(perdido)}</div>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Insumo</th>
              <th className="px-3 py-2 text-right">Qtd.</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2 text-right">Custo un.</th>
              <th className="px-3 py-2 text-right">Valor perdido</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {baixas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma baixa registrada.
                </td>
              </tr>
            )}
            {baixas.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="px-3 py-2">{formatarData(b.data_baixa)}</td>
                <td className="px-3 py-2">{b.insumo_nome}</td>
                <td className="px-3 py-2 text-right">{b.quantidade}</td>
                <td className="px-3 py-2">{b.motivo}</td>
                <td className="px-3 py-2 text-right">{formatarReais(b.custo_unitario_centavos)}</td>
                <td className="px-3 py-2 text-right">{formatarReais(b.custo_total_centavos)}</td>
                <td className="px-3 py-2 text-right">
                  <BotaoApagarBaixa id={b.id} descricao={`de ${b.quantidade}× ${b.insumo_nome} (${formatarData(b.data_baixa)})`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
