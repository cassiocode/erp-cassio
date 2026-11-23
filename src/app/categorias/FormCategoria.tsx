"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Cadastro de categoria nova (só o nome). Mostra a confirmação e destaca a nova na lista. */
export default function FormCategoria() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCriada(null);
    if (nome.trim() === "") {
      setErro("Digite o nome da categoria.");
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (resposta.ok) {
        const categoria = (await resposta.json()) as { id: number; nome: string };
        setNome("");
        setCriada(categoria.nome);
        // ?nova= destaca a linha na tabela
        router.replace(`/categorias?nova=${categoria.id}`, { scroll: false });
        router.refresh();
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErro(corpo?.erros?.nome ?? corpo?.erros?.geral ?? "Não foi possível criar a categoria.");
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mb-4 flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nova categoria</span>
        <input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErro(null);
          }}
          placeholder="Ex.: Caneca mágica"
          className={`w-72 rounded border bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
            erro ? "border-red-500 ring-1 ring-red-400" : "border-gray-300"
          }`}
        />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {enviando ? "Criando..." : "Criar categoria"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {criada && (
        <p className="w-full rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ Categoria <strong>{criada}</strong> criada (destacada na lista abaixo). Já dá para escolher no cadastro de insumo.
        </p>
      )}
    </form>
  );
}
