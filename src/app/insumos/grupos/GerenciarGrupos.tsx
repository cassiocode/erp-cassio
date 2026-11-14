"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BotaoAtivar from "../../_components/BotaoAtivar";

interface Grupo {
  id: number;
  nome: string;
  ativo: number;
  total_insumos: number;
}

async function enviarNome(url: string, metodo: "POST" | "PUT", nome: string): Promise<string | null> {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
  if (resposta.ok) return null;
  const corpo = await resposta.json().catch(() => null);
  return corpo?.erros?.nome ?? "Não foi possível salvar o grupo.";
}

export default function GerenciarGrupos({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState("");
  const [erroNovo, setErroNovo] = useState("");
  const [editando, setEditando] = useState<{ id: number; nome: string; erro: string } | null>(null);

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    const erro = await enviarNome("/api/grupos-insumo", "POST", novo);
    setErroNovo(erro ?? "");
    if (!erro) {
      setNovo("");
      router.refresh();
    }
  }

  async function salvarNome() {
    if (!editando) return;
    const erro = await enviarNome(`/api/grupos-insumo/${editando.id}`, "PUT", editando.nome);
    if (erro) {
      setEditando({ ...editando, erro });
      return;
    }
    setEditando(null);
    router.refresh();
  }

  const campo =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="max-w-2xl">
      <form onSubmit={criar} className="mb-4">
        <div className="flex gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Nome do novo grupo"
            className={`${campo} flex-1`}
          />
          <button type="submit" className="rounded bg-blue-700 px-4 py-1.5 text-sm text-white hover:bg-blue-800">
            Adicionar grupo
          </button>
        </div>
        {erroNovo && <p className="mt-1 text-xs text-red-600">{erroNovo}</p>}
      </form>

      <div className="rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2 text-right">Insumos</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                  Nenhum grupo cadastrado.
                </td>
              </tr>
            )}
            {grupos.map((g) => (
              <tr key={g.id} className={`border-b border-gray-100 ${g.ativo ? "" : "text-gray-400"}`}>
                <td className="px-3 py-2">
                  {editando?.id === g.id ? (
                    <div>
                      <input
                        autoFocus
                        value={editando.nome}
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value, erro: "" })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarNome();
                          if (e.key === "Escape") setEditando(null);
                        }}
                        className={campo}
                      />
                      {editando.erro && <p className="mt-1 text-xs text-red-600">{editando.erro}</p>}
                    </div>
                  ) : (
                    <span className="font-medium">{g.nome}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{g.total_insumos}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      g.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {g.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    {editando?.id === g.id ? (
                      <>
                        <button type="button" onClick={salvarNome} className="text-blue-700 hover:underline">
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          className="text-gray-600 hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditando({ id: g.id, nome: g.nome, erro: "" })}
                          className="text-blue-700 hover:underline"
                        >
                          Renomear
                        </button>
                        <BotaoAtivar url={`/api/grupos-insumo/${g.id}`} ativo={g.ativo === 1} />
                      </>
                    )}
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
