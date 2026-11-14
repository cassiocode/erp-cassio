import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { definirGrupoAtivo, renomearGrupo } from "@/lib/db/repositories/grupos-insumo";
import { ativoSchema, errosPorCampo } from "@/lib/schemas/comum";
import { grupoInsumoSchema } from "@/lib/schemas/grupos-insumo";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// PUT /api/grupos-insumo/:id com { "nome": "..." } — renomeia
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const resultado = grupoInsumoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    const grupo = renomearGrupo(id, resultado.data.nome);
    return grupo ? NextResponse.json(grupo) : respostaNaoEncontrado("Grupo");
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}

// PATCH /api/grupos-insumo/:id com { "ativo": true|false } — inativa/reativa
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const resultado = ativoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  const grupo = definirGrupoAtivo(id, resultado.data.ativo);
  return grupo ? NextResponse.json(grupo) : respostaNaoEncontrado("Grupo");
}
