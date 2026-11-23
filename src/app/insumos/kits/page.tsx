import Link from "next/link";
import { listarCategorias } from "@/lib/db/repositories/categorias";
import { listarKitsCadastro } from "@/lib/db/repositories/kits";
import FormKit from "./FormKit";

export const dynamic = "force-dynamic";

export default function PadraoVendaPage() {
  const kits = listarKitsCadastro();
  // Ativas + as inativas que algum kit ainda usa
  const usadas = new Set(kits.flatMap((k) => k.itens.map((i) => i.categoria_id)));
  const categorias = listarCategorias()
    .filter((c) => c.ativo === 1 || usadas.has(c.id))
    .map(({ id, nome, estoque_total }) => ({ id, nome, estoque_total }));

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/insumos" className="text-sm text-blue-700 hover:underline">
          ← Insumos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Padrão da venda</h1>
        <p className="text-sm text-gray-500">
          Os kits que aparecem na nova venda: o preço de cada caneca e o que sai do estoque a cada uma vendida.
          Mudar aqui vale para as próximas vendas; as já gravadas não mudam.
        </p>
      </div>

      {kits.map((k) => (
        <FormKit
          key={k.id}
          kit={{
            id: k.id,
            nome: k.nome,
            preco_venda_centavos: k.preco_venda_centavos,
            ativo: k.ativo,
            itens: k.itens.map(({ categoria_id, quantidade }) => ({ categoria_id, quantidade })),
          }}
          categorias={categorias}
        />
      ))}
      <FormKit categorias={categorias} />
    </div>
  );
}
