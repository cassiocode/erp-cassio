import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { ItemInvalidoError, listarVendas, registrarVenda, STATUS_VENDA, type StatusVenda } from "@/lib/db/repositories/vendas";
import { errosPorCampo } from "@/lib/schemas/comum";
import { vendaSchema } from "@/lib/schemas/vendas";

export const dynamic = "force-dynamic";

// GET /api/vendas?status=pre_venda — pré-vendas primeiro (entrega mais próxima), depois rascunhos e concluídas
export function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  const filtro = STATUS_VENDA.includes(status as StatusVenda) ? { status: status as StatusVenda } : {};
  return NextResponse.json(listarVendas(filtro));
}

// POST /api/vendas — cria rascunho, pré-venda (tira do estoque) ou venda concluída (tira do estoque)
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
