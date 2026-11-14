import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { GrupoInvalidoError, NomeDuplicadoError } from "@/lib/db/erros";
import { criarInsumo, listarInsumos } from "@/lib/db/repositories/insumos";
import { errosPorCampo } from "@/lib/schemas/comum";
import { insumoSchema } from "@/lib/schemas/insumos";

export const dynamic = "force-dynamic";

// GET /api/insumos?busca=&grupo=<id>&ativo=1|0 (sem "ativo" = todos)
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const grupo = Number(searchParams.get("grupo"));

  const insumos = listarInsumos({
    busca: searchParams.get("busca") ?? undefined,
    grupoId: Number.isInteger(grupo) && grupo > 0 ? grupo : undefined,
    ativo: ativo === "1" ? 1 : ativo === "0" ? 0 : undefined,
  });
  return NextResponse.json(insumos);
}

// POST /api/insumos
export async function POST(request: Request) {
  const resultado = insumoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    return NextResponse.json(criarInsumo(resultado.data), { status: 201 });
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    if (erro instanceof GrupoInvalidoError) return respostaErros({ grupo_id: erro.message }, 400);
    throw erro;
  }
}
