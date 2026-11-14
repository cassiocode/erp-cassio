"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatarReais } from "@/lib/dinheiro";
import { filtrarPorNome, normalizarTexto } from "@/lib/texto";

export interface SugestaoInsumo {
  id: number;
  nome: string;
  custo_unitario_centavos: number | null;
  ativo: number;
}

/**
 * Campo Nome do novo insumo com lista dos insumos já cadastrados, filtrada enquanto digita.
 * Escolher um item abre as compras dele, para lançar uma nova compra em vez de cadastrar de novo.
 */
export default function CampoNomeComSugestoes({
  valor,
  aoMudar,
  sugestoes,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  sugestoes: SugestaoInsumo[];
  className: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1); // item marcado pelas setas

  const filtradas = filtrarPorNome(sugestoes, valor);
  const jaExiste = sugestoes.some((s) => normalizarTexto(s.nome) === normalizarTexto(valor));
  const mostrarLista = aberto && filtradas.length > 0;

  function abrir(s: SugestaoInsumo) {
    setAberto(false);
    router.push(`/insumos/${s.id}/compras`);
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && mostrarLista && destaque >= 0) {
      e.preventDefault(); // não envia o formulário
      abrir(filtradas[destaque]);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
          setAberto(true);
          setDestaque(-1);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={teclado}
        className={className}
        placeholder="Ex.: Caneca branca 325ml"
        autoComplete="off"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls="sugestoes-insumo"
      />

      {jaExiste && (
        <p className="mt-1 text-xs text-amber-700">Já existe um insumo com este nome. Escolha-o na lista para lançar uma nova compra.</p>
      )}

      {mostrarLista && (
        <ul
          id="sugestoes-insumo"
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border border-gray-200 bg-white text-sm shadow-lg"
        >
          <li className="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
            Já cadastrados ({filtradas.length}) — clique para lançar uma nova compra
          </li>
          {filtradas.map((s, indice) => (
            <li
              key={s.id}
              role="option"
              aria-selected={indice === destaque}
              // onMouseDown em vez de onClick: acontece antes do blur que fecha a lista
              onMouseDown={(e) => {
                e.preventDefault();
                abrir(s);
              }}
              onMouseEnter={() => setDestaque(indice)}
              className={`flex cursor-pointer justify-between gap-3 px-3 py-2 ${
                indice === destaque ? "bg-blue-50" : ""
              } ${s.ativo ? "" : "text-gray-400"}`}
            >
              <span>
                {s.nome}
                {!s.ativo && " (inativo)"}
              </span>
              {s.custo_unitario_centavos !== null && (
                <span className="text-gray-500">{formatarReais(s.custo_unitario_centavos)} / un</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
