import Link from "next/link";
import { formatarData } from "@/lib/datas";
import { listarVendas } from "@/lib/db/repositories/vendas";
import { formatarReais } from "@/lib/dinheiro";
import BotaoApagarVenda from "./BotaoApagarVenda";

export const dynamic = "force-dynamic";

export default function VendasPage() {
  const vendas = listarVendas();
  const faturamento = vendas.reduce((s, v) => s + v.preco_venda_centavos, 0);
  const custo = vendas.reduce((s, v) => s + v.custo_total_centavos, 0);
  const lucro = faturamento - custo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendas</h1>
          <p className="text-sm text-gray-500">Cada venda tira os insumos do estoque; apagar devolve.</p>
        </div>
        <Link
          href="/vendas/nova"
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Nova venda
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo titulo={`Faturamento (${vendas.length} vendas)`} valor={formatarReais(faturamento)} />
        <Resumo titulo="Custo (insumos + energia)"valor={formatarReais(custo)} />
        <Resumo titulo={lucro < 0 ? "Prejuízo" : "Lucro"} valor={formatarReais(lucro)} cor={lucro < 0 ? "text-red-600" : "text-green-700"} />
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Kit</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2 text-right">Lucro</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma venda registrada.
                </td>
              </tr>
            )}
            {vendas.map((v) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="px-3 py-2">{formatarData(v.data_venda)}</td>
                <td className="px-3 py-2">
                  {v.cliente ?? <span className="text-gray-400">—</span>}
                  {v.observacao && <div className="text-xs text-gray-500">{v.observacao}</div>}
                </td>
                <td className="px-3 py-2">{v.kit_nome ?? "Avulsa"}</td>
                <td className="px-3 py-2 text-right">{formatarReais(v.preco_venda_centavos)}</td>
                <td className="px-3 py-2 text-right">{formatarReais(v.custo_total_centavos)}</td>
                <td className={`px-3 py-2 text-right font-medium ${v.lucro_centavos < 0 ? "text-red-600" : "text-green-700"}`}>
                  {formatarReais(v.lucro_centavos)}
                </td>
                <td className="px-3 py-2 text-right">
                  <BotaoApagarVenda
                    id={v.id}
                    descricao={`de ${formatarData(v.data_venda)}${v.cliente ? ` (${v.cliente})` : ""}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Resumo({ titulo, valor, cor = "" }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={`text-lg font-semibold ${cor}`}>{valor}</div>
    </div>
  );
}
