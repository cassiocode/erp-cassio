import { dadosDoFormulario } from "../dadosFormulario";
import FormVenda from "./FormVenda";

export const dynamic = "force-dynamic";

export default function NovaVendaPage() {
  const { kits, insumos } = dadosDoFormulario();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nova venda</h1>
      <FormVenda kits={kits} insumos={insumos} />
    </div>
  );
}
