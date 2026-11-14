import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { NomeDuplicadoError } from "@/lib/db/erros";
import { criarInsumo, listarInsumos } from "@/lib/db/repositories/insumos";
import { errosPorCampo } from "@/lib/schemas/comum";
import { novoInsumoSchema } from "@/lib/schemas/insumos";

export const dynamic = "force-dynamic";

// GET /api/insumos?busca=&ativo=1|0 (sem "ativo" = todos)
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");

  const insumos = listarInsumos({
    busca: searchParams.get("busca") ?? undefined,
    ativo: ativo === "1" ? 1 : ativo === "0" ? 0 : undefined,
  });
  return NextResponse.json(insumos);
}

// POST /api/insumos — cria o insumo e registra a primeira compra
export async function POST(request: Request) {
  const resultado = novoInsumoSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    return NextResponse.json(criarInsumo(resultado.data), { status: 201 });
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) return respostaErros({ nome: erro.message }, 409);
    throw erro;
  }
}
