import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { buscarCategoria, definirCategoriaAtiva, renomearCategoria } from "@/lib/db/repositories/categorias";
import { categoriaSchema } from "@/lib/schemas/categorias";
import { ativoSchema, errosPorCampo } from "@/lib/schemas/comum";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const categoria = buscarCategoria(id);
  return categoria ? NextResponse.json(categoria) : respostaNaoEncontrado("Categoria", "a");
}

// PUT /api/categorias/:id {"nome": "..."} — renomeia
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const resultado = categoriaSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  try {
    const categoria = renomearCategoria(id, resultado.data.nome);
    return categoria ? NextResponse.json(categoria) : respostaNaoEncontrado("Categoria", "a");
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}

// PATCH /api/categorias/:id {"ativo": true|false} — inativa/reativa
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const resultado = ativoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  const categoria = definirCategoriaAtiva(id, resultado.data.ativo);
  return categoria ? NextResponse.json(categoria) : respostaNaoEncontrado("Categoria", "a");
}
