import Link from "next/link";
import {
  listarCategorias,
  listarMateriais,
} from "@/lib/db/repositories/materiais";
import { formatarReais } from "@/lib/dinheiro";
import BotaoAtivar from "./_components/BotaoAtivar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ busca?: string; categoria?: string; status?: string }>;

export default async function MateriaisPage({ searchParams }: { searchParams: SearchParams }) {
  const { busca = "", categoria = "", status = "ativos" } = await searchParams;

  const materiais = listarMateriais({
    busca,
    categoria: categoria || undefined,
    ativo: status === "ativos" ? 1 : status === "inativos" ? 0 : undefined,
  });
  const categorias = listarCategorias();

  const campo =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Materiais</h1>
        <Link
          href="/materiais/novo"
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Novo material
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Buscar por nome</span>
          <input name="busca" defaultValue={busca} placeholder="Ex.: caneca" className={campo} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Categoria</span>
          <select name="categoria" defaultValue={categoria} className={campo}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
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
        <Link href="/materiais" className="py-1.5 text-sm text-gray-600 hover:underline">
          Limpar
        </Link>
      </form>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Custo unitário</th>
              <th className="px-3 py-2 text-right">Em estoque</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {materiais.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Nenhum material encontrado.
                </td>
              </tr>
            )}
            {materiais.map((m) => {
              const baixo = m.quantidade_estoque <= m.estoque_minimo;
              return (
                <tr key={m.id} className={`border-b border-gray-100 ${m.ativo ? "" : "text-gray-400"}`}>
                  <td className="px-3 py-2 font-medium">{m.nome}</td>
                  <td className="px-3 py-2">{m.categoria ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatarReais(m.custo_unitario_centavos)} / {m.unidade}
                  </td>
                  <td className="px-3 py-2 text-right">{m.quantidade_estoque}</td>
                  <td className="px-3 py-2 text-right">{m.estoque_minimo}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          m.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {baixo && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Estoque baixo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <Link href={`/materiais/${m.id}/editar`} className="text-blue-700 hover:underline">
                        Editar
                      </Link>
                      <BotaoAtivar id={m.id} ativo={m.ativo === 1} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
