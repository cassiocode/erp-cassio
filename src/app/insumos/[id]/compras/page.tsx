import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarData, hojeISO } from "@/lib/datas";
import { listarCompras } from "@/lib/db/repositories/compras";
import { buscarInsumoPorId } from "@/lib/db/repositories/insumos";
import { formatarReais } from "@/lib/dinheiro";
import AcoesEntregaCompra from "./AcoesEntregaCompra";
import BotaoApagarCompra from "./BotaoApagarCompra";
import FormCompra from "./FormCompra";

export const dynamic = "force-dynamic";

export default async function ComprasInsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const insumo = Number.isInteger(id) ? buscarInsumoPorId(id) : null;
  if (!insumo) notFound();

  const compras = listarCompras(insumo.id);
  const hoje = hojeISO();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/insumos" className="text-sm text-blue-700 hover:underline">
          ← Insumos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Compras — {insumo.nome}</h1>
        {!insumo.ativo && <p className="text-sm text-gray-500">Insumo inativo.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumo titulo="Em estoque" valor={String(insumo.quantidade_estoque)} alerta={insumo.quantidade_estoque < 0} />
        <Resumo
          titulo="Custo médio por unidade"
          valor={insumo.custo_unitario_centavos === null ? "—" : formatarReais(insumo.custo_unitario_centavos)}
        />
        <Resumo
          titulo="Pendente de entrega"
          valor={
            insumo.quantidade_pendente > 0
              ? `${insumo.quantidade_pendente}${insumo.proxima_entrega ? ` · prev. ${formatarData(insumo.proxima_entrega)}` : ""}`
              : "Nada pendente"
          }
          aviso={insumo.quantidade_pendente > 0}
        />
        <Resumo
          titulo="Total comprado"
          valor={`${insumo.quantidade_comprada} por ${formatarReais(insumo.total_pago_centavos)}`}
        />
      </div>

      <FormCompra insumoId={insumo.id} />

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2 text-right">Quantidade</th>
              <th className="px-3 py-2 text-right">Total pago</th>
              <th className="px-3 py-2 text-right">Custo por unidade</th>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Observação</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma compra registrada.
                </td>
              </tr>
            )}
            {compras.map((c) => (
              <tr key={c.id} className={`border-b border-gray-100 align-top ${c.entregue ? "" : "bg-amber-50/60"}`}>
                <td className="px-3 py-2">{formatarData(c.data_compra)}</td>
                <td className="px-3 py-2 text-right">{c.quantidade}</td>
                <td className="px-3 py-2 text-right">{formatarReais(c.valor_pago_centavos)}</td>
                <td className="px-3 py-2 text-right">{formatarReais(c.custo_unitario_centavos)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {c.entregue ? (
                    <>
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Realizada</span>
                      {c.data_entrega && <div className="text-xs text-gray-500">{formatarData(c.data_entrega)}</div>}
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Pendente</span>
                      {c.data_prevista_entrega && (
                        <div
                          className={`text-xs ${c.data_prevista_entrega < hoje ? "font-medium text-red-600" : "text-amber-800"}`}
                        >
                          prev. {formatarData(c.data_prevista_entrega)}
                          {c.data_prevista_entrega < hoje ? " (atrasada)" : ""}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.observacao}</td>
                <td className="px-3 py-2 text-right">
                  {!c.entregue && (
                    <div className="mb-1">
                      <AcoesEntregaCompra id={c.id} quantidade={c.quantidade} dataPrevista={c.data_prevista_entrega} />
                    </div>
                  )}
                  <BotaoApagarCompra
                    entregue={c.entregue === 1}
                    id={c.id}
                    descricao={`de ${formatarData(c.data_compra)} (${c.quantidade} por ${formatarReais(c.valor_pago_centavos)})`}
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

function Resumo({
  titulo,
  valor,
  alerta = false,
  aviso = false,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
  aviso?: boolean;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={`text-lg font-semibold ${alerta ? "text-red-600" : aviso ? "text-amber-700" : ""}`}>{valor}</div>
    </div>
  );
}
