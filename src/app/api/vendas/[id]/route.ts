import { NextResponse } from "next/server";
import { lerId, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { apagarVenda, buscarVenda } from "@/lib/db/repositories/vendas";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const venda = buscarVenda(id);
  return venda ? NextResponse.json(venda) : respostaNaoEncontrado("Venda", "a");
}

// DELETE /api/vendas/:id — apaga a venda e devolve os insumos ao estoque
export async function DELETE(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  return apagarVenda(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Venda", "a");
}
