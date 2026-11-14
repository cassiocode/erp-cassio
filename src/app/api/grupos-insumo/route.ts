import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { criarGrupo, listarGrupos } from "@/lib/db/repositories/grupos-insumo";
import { errosPorCampo } from "@/lib/schemas/comum";
import { grupoInsumoSchema } from "@/lib/schemas/grupos-insumo";

export const dynamic = "force-dynamic";

// GET /api/grupos-insumo?ativo=1|0 (sem "ativo" = todos)
export function GET(request: Request) {
  const ativo = new URL(request.url).searchParams.get("ativo");
  return NextResponse.json(
    listarGrupos({ ativo: ativo === "1" ? 1 : ativo === "0" ? 0 : undefined }),
  );
}

// POST /api/grupos-insumo com { "nome": "..." }
export async function POST(request: Request) {
  const resultado = grupoInsumoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    return NextResponse.json(criarGrupo(resultado.data.nome), { status: 201 });
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}
