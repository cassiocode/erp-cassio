import Link from "next/link";
import { descreverDono, type Falta } from "@/lib/alertas";
import { formatarData, hojeISO } from "@/lib/datas";
import { calcularFaltas, listarVendas } from "@/lib/db/repositories/vendas";
import { formatarReais } from "@/lib/dinheiro";
import AcoesEntrega from "./AcoesEntrega";

export const dynamic = "force-dynamic";

/** Dias entre duas datas AAAA-MM-DD (b - a). */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** "atrasada 2 dias", "hoje", "amanhã", "em 5 dias". */
function quando(dataPrevista: string, hoje: string): { texto: string; classe: string } {
  const dias = diasEntre(hoje, dataPrevista);
  if (dias < 0) return { texto: `atrasada ${-dias} dia${dias === -1 ? "" : "s"}`, classe: "font-medium text-red-600" };
  if (dias === 0) return { texto: "hoje", classe: "font-medium text-amber-700" };
  if (dias === 1) return { texto: "amanhã", classe: "text-amber-700" };
  return { texto: `em ${dias} dias`, classe: "text-gray-500" };
}

export default function EntregasPage() {
  // Entregas a fazer = pré-vendas em aberto, pela entrega mais próxima
  const entregas = listarVendas({ status: "pre_venda" });
  const hoje = hojeISO();

  const atrasadas = entregas.filter((v) => v.data_prevista !== null && v.data_prevista < hoje).length;
  const paraHoje = entregas.filter((v) => v.data_prevista === hoje).length;
  const proximos7 = entregas.filter(
    (v) => v.data_prevista !== null && v.data_prevista > hoje && diasEntre(hoje, v.data_prevista) <= 7,
  ).length;
  const aReceber = entregas.reduce((s, v) => s + v.preco_venda_centavos - (v.valor_pago_centavos ?? 0), 0);
  const canecas = entregas.reduce((s, v) => s + v.quantidade_canecas, 0);

  const faltasPorVenda = new Map<number, Falta[]>();
  for (const f of calcularFaltas()) {
    if (f.venda_id !== null) faltasPorVenda.set(f.venda_id, [...(faltasPorVenda.get(f.venda_id) ?? []), f]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Entregas</h1>
          <p className="text-sm text-gray-500">
            Pré-vendas a entregar, pela data mais próxima. Concluir = entregou (vira venda). Alterar = nova data.
          </p>
        </div>
        <Link href="/vendas/nova" className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          Nova venda
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumo titulo={`A entregar (${canecas} caneca${canecas === 1 ? "" : "s"})`} valor={String(entregas.length)} />
        <Resumo titulo="Atrasadas" valor={String(atrasadas)} cor={atrasadas > 0 ? "text-red-600" : ""} />
        <Resumo titulo="Hoje · próximos 7 dias" valor={`${paraHoje} · ${proximos7}`} cor={paraHoje > 0 ? "text-amber-700" : ""} />
        <Resumo titulo="A receber na entrega" valor={formatarReais(aReceber)} cor="text-amber-700" />
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Canecas</th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">A receber</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {entregas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma entrega pendente.
                </td>
              </tr>
            )}
            {entregas.map((v) => {
              const faltas = faltasPorVenda.get(v.id) ?? [];
              const prazo = v.data_prevista ? quando(v.data_prevista, hoje) : null;
              const falta = v.preco_venda_centavos - (v.valor_pago_centavos ?? 0);
              const atrasada = v.data_prevista !== null && v.data_prevista < hoje;
              return (
                <tr key={v.id} className={`border-b border-gray-100 align-top ${atrasada ? "bg-red-50/50" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="font-medium">{v.data_prevista ? formatarData(v.data_prevista) : "Sem data"}</div>
                    {prazo && <div className={`text-xs ${prazo.classe}`}>{prazo.texto}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatarData(v.data_venda)}
                    <div className="text-xs text-gray-500">#{v.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    {v.cliente ?? <span className="text-gray-400">—</span>}
                    {v.observacao && <div className="text-xs text-gray-500">{v.observacao}</div>}
                  </td>
                  <td className="px-3 py-2">{v.kits_resumo ?? "Avulsa"}</td>
                  <td className="px-3 py-2">
                    {faltas.length > 0 ? (
                      <>
                        <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Sem material</span>
                        <div
                          className="mt-1 text-xs font-medium text-red-600"
                          title={faltas.map((f) => `${f.falta}× ${f.material_nome} para ${descreverDono(f)}`).join("\n")}
                        >
                          Falta: {faltas.map((f) => `${f.falta}× ${f.material_nome}`).join(", ")}
                        </div>
                      </>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatarReais(v.preco_venda_centavos)}
                    {(v.valor_pago_centavos ?? 0) > 0 && (
                      <div className="text-xs text-green-700">pago {formatarReais(v.valor_pago_centavos)}</div>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right font-medium ${falta > 0 ? "text-amber-800" : "text-green-700"}`}
                  >
                    {falta > 0 ? formatarReais(falta) : "pago"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AcoesEntrega
                      id={v.id}
                      descricao={`pré-venda #${v.id}${v.cliente ? ` (${v.cliente})` : ""}`}
                      dataPrevista={v.data_prevista}
                      faltas={faltas}
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
