import Link from "next/link";
import { notFound } from "next/navigation";
import { lerId } from "@/lib/api";
import { buscarVenda, calcularFaltas } from "@/lib/db/repositories/vendas";
import { dadosDoFormulario } from "../../dadosFormulario";
import FormVenda from "../../nova/FormVenda";

export const dynamic = "force-dynamic";

export default async function EditarVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = lerId((await params).id);
  const venda = id === null ? null : buscarVenda(id);
  if (!venda) notFound();

  if (venda.status === "concluida") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Venda #{venda.id}</h1>
        <p className="text-sm text-gray-600">Venda concluída não pode ser alterada.</p>
        <Link href="/vendas" className="text-sm text-blue-700 hover:underline">
          Voltar para vendas
        </Link>
      </div>
    );
  }

  const { kits, insumos } = dadosDoFormulario();
  // Insumo inativo que já está na venda continua aparecendo
  const faltando = venda.itens.filter((i) => !insumos.some((x) => x.id === i.insumo_id));
  const todos = [
    ...insumos,
    ...faltando.map((i) => ({
      id: i.insumo_id,
      nome: i.nome,
      custo_unitario_centavos: i.custo_unitario_centavos,
      quantidade_estoque: 0,
      margem_lucro_percentual: null,
    })),
  ];

  // Material que falta para esta pré-venda (estoque negativo, entrega mais próxima tem prioridade)
  const faltas: Record<number, number> = {};
  for (const f of calcularFaltas()) {
    if (f.venda_id === venda.id) faltas[f.insumo_id] = (faltas[f.insumo_id] ?? 0) + f.falta;
  }

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-3 text-2xl font-semibold">
        Editar {venda.status === "pre_venda" ? "pré-venda" : "rascunho"} #{venda.id}
        {Object.keys(faltas).length > 0 && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700">Sem material</span>
        )}
      </h1>
      <FormVenda
        kits={kits}
        insumos={todos}
        faltas={faltas}
        venda={{
          id: venda.id,
          status: venda.status,
          data_venda: venda.data_venda,
          data_prevista: venda.data_prevista,
          kit_id: venda.kit_id,
          cliente: venda.cliente,
          preco_venda_centavos: venda.preco_venda_centavos,
          custo_energia_centavos: venda.custo_energia_centavos,
          observacao: venda.observacao,
          itens: venda.itens.map(({ insumo_id, quantidade }) => ({ insumo_id, quantidade })),
        }}
      />
    </div>
  );
}
