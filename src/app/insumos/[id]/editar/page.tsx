import { notFound } from "next/navigation";
import { buscarInsumoPorId } from "@/lib/db/repositories/insumos";
import { centavosParaTexto } from "@/lib/dinheiro";
import FormInsumo from "../../_components/FormInsumo";

export const dynamic = "force-dynamic";

export default async function EditarInsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const insumo = Number.isInteger(id) ? buscarInsumoPorId(id) : null;
  if (!insumo) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar insumo</h1>
      <FormInsumo
        id={insumo.id}
        valores={{
          nome: insumo.nome,
          valor_pago: centavosParaTexto(insumo.valor_pago_centavos),
          quantidade_comprada: String(insumo.quantidade_comprada),
          quantidade_estoque: String(insumo.quantidade_estoque),
          observacao: insumo.observacao ?? "",
        }}
      />
    </div>
  );
}
