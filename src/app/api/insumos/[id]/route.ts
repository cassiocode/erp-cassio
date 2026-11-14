import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { atualizarInsumo, buscarInsumoPorId, definirInsumoAtivo } from "@/lib/db/repositories/insumos";
import { ativoSchema, errosPorCampo } from "@/lib/schemas/comum";
import { edicaoInsumoSchema } from "@/lib/schemas/insumos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const insumo = buscarInsumoPorId(id);
  return insumo ? NextResponse.json(insumo) : respostaNaoEncontrado("Insumo");
}

// PUT /api/insumos/:id — nome, estoque e observação (total pago e quantidade mudam pelas compras)
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const resultado = edicaoInsumoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    const insumo = atualizarInsumo(id, resultado.data);
    return insumo ? NextResponse.json(insumo) : respostaNaoEncontrado("Insumo");
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}

// PATCH /api/insumos/:id com { "ativo": true|false } — inativa/reativa
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const resultado = ativoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  const insumo = definirInsumoAtivo(id, resultado.data.ativo);
  return insumo ? NextResponse.json(insumo) : respostaNaoEncontrado("Insumo");
}
