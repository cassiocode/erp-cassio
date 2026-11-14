import Link from "next/link";
import { listarGrupos } from "@/lib/db/repositories/grupos-insumo";
import { listarInsumos } from "@/lib/db/repositories/insumos";
import { formatarReais } from "@/lib/dinheiro";
import BotaoAtivar from "../_components/BotaoAtivar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ busca?: string; grupo?: string; status?: string }>;

export default async function InsumosPage({ searchParams }: { searchParams: SearchParams }) {
  const { busca = "", grupo = "", status = "ativos" } = await searchParams;
  const grupoId = Number(grupo);

  const insumos = listarInsumos({
    busca,
    grupoId: Number.isInteger(grupoId) && grupoId > 0 ? grupoId : undefined,
    ativo: status === "ativos" ? 1 : status === "inativos" ? 0 : undefined,
  });
  const grupos = listarGrupos();

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
          <span className="mb-1 block text-gray-600">Grupo</span>
          <select name="grupo" defaultValue={grupo} className={campo}>
            <option value="">Todos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
                {g.ativo ? "" : " (inativo)"}
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
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2 text-right">Valor pago</th>
              <th className="px-3 py-2 text-right">Custo por unidade</th>
              <th className="px-3 py-2 text-right">Em estoque</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {insumos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Nenhum insumo encontrado.
                </td>
              </tr>
            )}
            {insumos.map((i) => {
              const baixo = i.quantidade_estoque <= i.estoque_minimo;
              return (
                <tr key={i.id} className={`border-b border-gray-100 ${i.ativo ? "" : "text-gray-400"}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.nome}</div>
                    {i.especificacao && <div className="text-xs text-gray-500">{i.especificacao}</div>}
                  </td>
                  <td className="px-3 py-2">{i.grupo_nome}</td>
                  <td className="px-3 py-2 text-right">
                    {formatarReais(i.valor_pago_centavos)}
                    {i.rendimento > 1 && (
                      <div className="text-xs text-gray-500">
                        rende {i.rendimento} {i.unidade}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatarReais(i.custo_unitario_centavos)}
                    <span className="font-normal text-gray-500"> / {i.unidade}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{i.quantidade_estoque}</td>
                  <td className="px-3 py-2 text-right">{i.estoque_minimo}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          i.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {i.ativo ? "Ativo" : "Inativo"}
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
                      <Link href={`/insumos/${i.id}/editar`} className="text-blue-700 hover:underline">
                        Editar
                      </Link>
                      <BotaoAtivar url={`/api/insumos/${i.id}`} ativo={i.ativo === 1} />
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
