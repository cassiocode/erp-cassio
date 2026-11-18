import Link from "next/link";
import { listarCategorias } from "@/lib/db/repositories/categorias";
import BotaoAtivar from "../_components/BotaoAtivar";
import BotaoRenomear from "./BotaoRenomear";
import FormCategoria from "./FormCategoria";

export const dynamic = "force-dynamic";

export default function CategoriasPage() {
  const categorias = listarCategorias();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Categorias de produtos</h1>
        <p className="text-sm text-gray-500">
          O tipo de cada insumo, independente do fornecedor. Ex.: a caneca preta Top e a Trix são da mesma
          categoria. Os kits da venda e o aviso de falta de material olham o estoque somado da categoria.
        </p>
      </div>

      <FormCategoria />

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Insumos ativos</th>
              <th className="px-3 py-2 text-right">Estoque somado</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
            {categorias.map((c) => (
              <tr key={c.id} className={`border-b border-gray-100 ${c.ativo ? "" : "text-gray-400"}`}>
                <td className="px-3 py-2 font-medium">{c.nome}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/insumos?categoria=${c.id}`} className="text-blue-700 hover:underline">
                    {c.quantidade_insumos}
                  </Link>
                </td>
                <td className={`px-3 py-2 text-right ${c.estoque_total < 0 ? "font-medium text-red-600" : ""}`}>
                  {c.estoque_total}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      c.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {c.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    <BotaoRenomear id={c.id} nome={c.nome} />
                    <BotaoAtivar url={`/api/categorias/${c.id}`} ativo={c.ativo === 1} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
