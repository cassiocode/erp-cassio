import { listarGrupos } from "@/lib/db/repositories/grupos-insumo";
import FormInsumo from "../_components/FormInsumo";

export const dynamic = "force-dynamic";

export default function NovoInsumoPage() {
  const grupos = listarGrupos({ ativo: 1 }).map(({ id, nome }) => ({ id, nome }));
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Novo insumo</h1>
      <FormInsumo grupos={grupos} />
    </div>
  );
}
