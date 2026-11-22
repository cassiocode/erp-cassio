import Link from "next/link";
import { formatarMargem, precoComMargem } from "@/lib/custos";
import { listarCategorias } from "@/lib/db/repositories/categorias";
import { listarInsumos } from "@/lib/db/repositories/insumos";
import { formatarData } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import BotaoAtivar from "../_components/BotaoAtivar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ busca?: string; status?: string; categoria?: string }>;

export default async function InsumosPage({ searchParams }: { searchParams: SearchParams }) {
  const { busca = "", status = "ativos", categoria = "" } = await searchParams;
  const categorias = listarCategorias();
  const categoriaId = Number(categoria) || undefined;

  const insumos = listarInsumos({
    busca,
    categoria_id: categoriaId,
    ativo: status === "ativos" ? 1 : status === "inativos" ? 0 : undefined,
  });

  const campo =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Insumos</h1>
          <p className="text-sm text-gray-500">
            Itens que compõem o custo dos produtos: canecas, embalagens, papel, tinta, brindes...
          </p>
        </div>
        <Link
          href="/insumos/novo"
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Novo insumo
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Buscar por nome</span>
          <input name="busca" defaultValue={busca} placeholder="Ex.: caneca" className={campo} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Categoria</span>
          <select name="categoria" defaultValue={categoriaId ?? ""} className={campo}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Situação</span>
          <select name="status" defaultValue={status} className={campo}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-gray-800 px-4 py-1.5 text-sm text-white hover:bg-gray-900">
          Filtrar
        </button>
        <Link href="/insumos" className="py-1.5 text-sm text-gray-600 hover:underline">
          Limpar
        </Link>
      </form>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Custo médio</th>
              <th className="px-3 py-2 text-right">Margem</th>
              <th className="px-3 py-2 text-right">Preço un. total</th>
              <th className="px-3 py-2 text-right">Comprados</th>
              <th className="px-3 py-2 text-right">Em estoque</th>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {insumos.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                  Nenhum insumo encontrado.
                </td>
              </tr>
            )}
            {insumos.map((i) => (
              <tr key={i.id} className={`border-b border-gray-100 ${i.ativo ? "" : "text-gray-400"}`}>
                <td className="px-3 py-2">
                  <div className="font-medium">{i.nome}</div>
                  {i.observacao && <div className="text-xs text-gray-500">{i.observacao}</div>}
                </td>
                <td className="px-3 py-2">
                  {i.categoria_nome ?? <span className="font-medium text-red-600">Sem categoria</span>}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {i.custo_unitario_centavos === null ? "—" : formatarReais(i.custo_unitario_centavos)}
                </td>
                <td className="px-3 py-2 text-right">
                  {i.margem_lucro_percentual === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    formatarMargem(i.margem_lucro_percentual)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {/* Custo médio + margem: o que o insumo soma no preço da venda */}
                  {i.margem_lucro_percentual === null || i.custo_unitario_centavos === null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className="font-medium text-green-700">
                      {formatarReais(precoComMargem(i.custo_unitario_centavos, i.margem_lucro_percentual))}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{i.quantidade_comprada}</td>
                <td
                  className={`px-3 py-2 text-right ${i.quantidade_estoque < 0 ? "font-medium text-red-600" : ""}`}
                >
                  {i.quantidade_estoque}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {i.quantidade_pendente > 0 ? (
                    <Link href={`/insumos/${i.id}/compras`} className="block hover:underline">
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Pendente</span>
                      <div className="text-xs text-amber-800">
                        {i.quantidade_pendente} a chegar
                        {i.proxima_entrega && <> · prev. {formatarData(i.proxima_entrega)}</>}
                      </div>
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-500">Realizada</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      i.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {i.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    <Link href={`/insumos/${i.id}/compras`} className="text-blue-700 hover:underline">
                      Compras
                    </Link>
                    <Link href={`/insumos/${i.id}/editar`} className="text-blue-700 hover:underline">
                      Editar
                    </Link>
                    <BotaoAtivar url={`/api/insumos/${i.id}`} ativo={i.ativo === 1} />
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
