import { notFound } from "next/navigation";
import { buscarMaterialPorId, listarCategorias } from "@/lib/db/repositories/materiais";
import { centavosParaTexto } from "@/lib/dinheiro";
import FormMaterial from "../../_components/FormMaterial";

export const dynamic = "force-dynamic";

export default async function EditarMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  const material = Number.isInteger(id) ? buscarMaterialPorId(id) : null;
  if (!material) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar material</h1>
      <FormMaterial
        id={material.id}
        categorias={listarCategorias()}
        valores={{
          nome: material.nome,
          categoria: material.categoria ?? "",
          unidade: material.unidade,
          custo: centavosParaTexto(material.custo_unitario_centavos),
          quantidade_estoque: material.quantidade_estoque,
          estoque_minimo: material.estoque_minimo,
        }}
      />
    </div>
  );
}
