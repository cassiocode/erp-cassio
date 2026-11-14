import { listarInsumos } from "@/lib/db/repositories/insumos";
import { listarKits } from "@/lib/db/repositories/vendas";
import FormVenda from "./FormVenda";

export const dynamic = "force-dynamic";

export default function NovaVendaPage() {
  const kits = listarKits().map(({ id, nome, preco_venda_centavos, itens }) => ({
    id,
    nome,
    preco_venda_centavos,
    itens: itens.map(({ insumo_id, quantidade }) => ({ insumo_id, quantidade })),
  }));
  const insumos = listarInsumos({ ativo: 1 }).map(({ id, nome, custo_unitario_centavos, quantidade_estoque }) => ({
    id,
    nome,
    custo_unitario_centavos,
    quantidade_estoque,
  }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nova venda</h1>
      <FormVenda kits={kits} insumos={insumos} />
    </div>
  );
}
