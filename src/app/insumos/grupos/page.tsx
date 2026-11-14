import { listarGrupos } from "@/lib/db/repositories/grupos-insumo";
import GerenciarGrupos from "./GerenciarGrupos";

export const dynamic = "force-dynamic";

export default function GruposInsumoPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Grupos de insumo</h1>
      <p className="mb-4 text-sm text-gray-500">
        Organize os insumos (ex.: Caneca, Embalagem, Papel e tinta, Brinde). Crie conforme a necessidade.
      </p>
      <GerenciarGrupos grupos={listarGrupos()} />
    </div>
  );
}
