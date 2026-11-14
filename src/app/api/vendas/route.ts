import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { ItemInvalidoError, listarVendas, registrarVenda } from "@/lib/db/repositories/vendas";
import { errosPorCampo } from "@/lib/schemas/comum";
import { vendaSchema } from "@/lib/schemas/vendas";

export const dynamic = "force-dynamic";

// GET /api/vendas
export function GET() {
  return NextResponse.json(listarVendas());
}

// POST /api/vendas — registra a venda e tira os insumos do estoque
export async function POST(request: Request) {
  const resultado = vendaSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  try {
    return NextResponse.json(registrarVenda(resultado.data), { status: 201 });
  } catch (erro) {
    if (erro instanceof ItemInvalidoError) return respostaErros({ itens: erro.message }, 400);
    throw erro;
  }
}
