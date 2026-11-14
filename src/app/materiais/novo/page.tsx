import { listarCategorias } from "@/lib/db/repositories/materiais";
import FormMaterial from "../_components/FormMaterial";

export const dynamic = "force-dynamic";

export default function NovoMaterialPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Novo material</h1>
      <FormMaterial categorias={listarCategorias()} />
    </div>
  );
}
