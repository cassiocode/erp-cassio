import { notFound } from "next/navigation";
import { listarGrupos } from "@/lib/db/repositories/grupos-insumo";
import { buscarInsumoPorId } from "@/lib/db/repositories/insumos";
import { centavosParaTexto } from "@/lib/dinheiro";
import FormInsumo from "../../_components/FormInsumo";

export const dynamic = "force-dynamic";

export default async function EditarInsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const insumo = Number.isInteger(id) ? buscarInsumoPorId(id) : null;
  if (!insumo) notFound();

  // Grupos ativos + o grupo atual do insumo (mesmo se estiver inativo)
  const grupos = listarGrupos()
    .filter((g) => g.ativo === 1 || g.id === insumo.grupo_id)
    .map(({ id, nome }) => ({ id, nome }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar insumo</h1>
      <FormInsumo
        id={insumo.id}
        grupos={grupos}
        valores={{
          nome: insumo.nome,
          grupo_id: String(insumo.grupo_id),
          unidade: insumo.unidade,
          valor_pago: centavosParaTexto(insumo.valor_pago_centavos),
          rendimento: String(insumo.rendimento),
          quantidade_estoque: String(insumo.quantidade_estoque),
          estoque_minimo: String(insumo.estoque_minimo),
          fornecedor: insumo.fornecedor ?? "",
          especificacao: insumo.especificacao ?? "",
        }}
      />
    </div>
  );
}
