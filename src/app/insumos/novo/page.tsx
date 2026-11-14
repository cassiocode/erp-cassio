import { listarInsumos } from "@/lib/db/repositories/insumos";
import FormInsumo from "../_components/FormInsumo";

export const dynamic = "force-dynamic";

export default function NovoInsumoPage() {
  const sugestoes = listarInsumos().map(({ id, nome, custo_unitario_centavos, ativo }) => ({
    id,
    nome,
    custo_unitario_centavos,
    ativo,
  }));
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Novo insumo</h1>
      <FormInsumo sugestoes={sugestoes} />
    </div>
  );
}
