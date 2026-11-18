import { notFound } from "next/navigation";
import { listarCategorias } from "@/lib/db/repositories/categorias";
import { buscarInsumoPorId } from "@/lib/db/repositories/insumos";
import FormInsumo from "../../_components/FormInsumo";

export const dynamic = "force-dynamic";

export default async function EditarInsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const insumo = Number.isInteger(id) ? buscarInsumoPorId(id) : null;
  if (!insumo) notFound();
  // Ativas + a atual do insumo (mesmo que tenha sido inativada)
  const categorias = listarCategorias()
    .filter((c) => c.ativo === 1 || c.id === insumo.categoria_id)
    .map(({ id, nome }) => ({ id, nome }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar insumo</h1>
      <FormInsumo insumo={insumo} categorias={categorias} />
    </div>
  );
}
