import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { criarCategoria, listarCategorias } from "@/lib/db/repositories/categorias";
import { categoriaSchema } from "@/lib/schemas/categorias";
import { errosPorCampo } from "@/lib/schemas/comum";

export const dynamic = "force-dynamic";

// GET /api/categorias?ativo=1|0 (sem "ativo" = todas)
export function GET(request: Request) {
  const ativo = new URL(request.url).searchParams.get("ativo");
  return NextResponse.json(listarCategorias({ ativo: ativo === "1" ? 1 : ativo === "0" ? 0 : undefined }));
}

// POST /api/categorias {"nome": "..."}
export async function POST(request: Request) {
  const resultado = categoriaSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  try {
    return NextResponse.json(criarCategoria(resultado.data.nome), { status: 201 });
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}
