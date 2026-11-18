import { listarInsumos } from "@/lib/db/repositories/insumos";
import { listarKits } from "@/lib/db/repositories/vendas";

/** Kits e insumos ativos no formato que o formulário de venda usa (nova venda e edição). */
export function dadosDoFormulario() {
  const kits = listarKits().map(({ id, nome, preco_venda_centavos, itens }) => ({
    id,
    nome,
    preco_venda_centavos,
    itens: itens.map(({ categoria_id, nome, quantidade }) => ({ categoria_id, nome, quantidade })),
  }));
  const insumos = listarInsumos({ ativo: 1 }).map(
    ({ id, nome, custo_unitario_centavos, quantidade_estoque, margem_lucro_percentual, categoria_id, categoria_nome }) => ({
      id,
      nome,
      categoria_id,
      categoria_nome,
      custo_unitario_centavos,
      quantidade_estoque,
      margem_lucro_percentual,
    }),
  );
  return { kits, insumos };
}
