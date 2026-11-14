import Link from "next/link";
import { descreverDono, type Falta } from "@/lib/alertas";
import { formatarData, hojeISO } from "@/lib/datas";
import { buscarVenda, calcularFaltas, listarVendas, type Venda } from "@/lib/db/repositories/vendas";
import { formatarReais } from "@/lib/dinheiro";
import AcoesVenda from "./AcoesVenda";

export const dynamic = "force-dynamic";

const ROTULO_STATUS: Record<Venda["status"], { texto: string; classe: string }> = {
  pre_venda: { texto: "Pré-venda", classe: "bg-amber-100 text-amber-800" },
  rascunho: { texto: "Rascunho", classe: "bg-gray-200 text-gray-700" },
  concluida: { texto: "Venda", classe: "bg-green-100 text-green-800" },
};

export default function VendasPage() {
  // Pré-vendas primeiro (entrega mais próxima no topo), depois rascunhos, depois vendas concluídas
  const vendas = listarVendas();
  const concluidas = vendas.filter((v) => v.status === "concluida");
  const preVendas = vendas.filter((v) => v.status === "pre_venda");
  const faturamento = concluidas.reduce((s, v) => s + v.preco_venda_centavos, 0);
  const custo = concluidas.reduce((s, v) => s + v.custo_total_centavos, 0);
  const lucro = faturamento - custo;
  const aReceber = preVendas.reduce((s, v) => s + v.preco_venda_centavos, 0);
  const hoje = hojeISO();

  const faltasPorVenda = new Map<number, Falta[]>();
  for (const f of calcularFaltas()) {
    if (f.venda_id !== null) faltasPorVenda.set(f.venda_id, [...(faltasPorVenda.get(f.venda_id) ?? []), f]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendas</h1>
          <p className="text-sm text-gray-500">
            Pré-vendas no topo, pela entrega mais próxima. Venda e pré-venda tiram do estoque; rascunho não.
          </p>
        </div>
        <Link
          href="/vendas/nova"
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Nova venda
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumo titulo={`Faturamento (${concluidas.length} vendas)`} valor={formatarReais(faturamento)} />
        <Resumo titulo="Custo (insumos + energia)" valor={formatarReais(custo)} />
        <Resumo titulo={lucro < 0 ? "Prejuízo" : "Lucro"} valor={formatarReais(lucro)} cor={lucro < 0 ? "text-red-600" : "text-green-700"} />
        <Resumo titulo={`Pré-vendas em aberto (${preVendas.length})`} valor={formatarReais(aReceber)} cor="text-amber-700" />
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Canecas</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2 text-right">Lucro</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma venda registrada.
                </td>
              </tr>
            )}
            {vendas.map((v) => {
              const rotulo = ROTULO_STATUS[v.status];
              const faltas = faltasPorVenda.get(v.id) ?? [];
              const atrasada = v.status !== "concluida" && v.data_prevista !== null && v.data_prevista < hoje;
              const itens = v.status === "rascunho" ? (buscarVenda(v.id)?.itens ?? []) : [];
              const descricao = `${v.status === "pre_venda" ? "pré-venda" : v.status === "rascunho" ? "rascunho" : "venda"} #${v.id}${v.cliente ? ` (${v.cliente})` : ""}`;
              return (
                <tr key={v.id} className={`border-b border-gray-100 ${v.status === "pre_venda" ? "bg-amber-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <span className={`rounded px-2 py-0.5 text-xs ${rotulo.classe}`}>{rotulo.texto}</span>
                      {faltas.length > 0 && (
                        <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Sem material</span>
                      )}
                    </div>
                    {faltas.length > 0 && (
                      <div className="mt-1 text-xs font-medium text-red-600" title={faltas.map((f) => `${f.falta}× ${f.insumo_nome} para ${descreverDono(f)}`).join("\n")}>
                        Falta: {faltas.map((f) => `${f.falta}× ${f.insumo_nome}`).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${atrasada ? "font-medium text-red-600" : ""}`}>
                    {v.data_prevista ? formatarData(v.data_prevista) : <span className="text-gray-400">—</span>}
                    {atrasada && <div className="text-xs">atrasada</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarData(v.data_venda)}</td>
                  <td className="px-3 py-2">
                    {v.cliente ?? <span className="text-gray-400">—</span>}
                    {v.observacao && <div className="text-xs text-gray-500">{v.observacao}</div>}
                  </td>
                  <td className="px-3 py-2">{v.kits_resumo ?? "Avulsa"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatarReais(v.preco_venda_centavos)}
                    {v.desconto_centavos > 0 && (
                      <div className="text-xs text-red-600">
                        desc. {String(v.desconto_percentual).replace(".", ",")}% (− {formatarReais(v.desconto_centavos)})
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{formatarReais(v.custo_total_centavos)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${v.lucro_centavos < 0 ? "text-red-600" : "text-green-700"}`}>
                    {formatarReais(v.lucro_centavos)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AcoesVenda
                      id={v.id}
                      status={v.status}
                      descricao={descricao}
                      faltas={faltas}
                      itens={itens.map(({ insumo_id, quantidade }) => ({ insumo_id, quantidade }))}
                    />
                  </td>
                </tr>
              );
            })}
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
