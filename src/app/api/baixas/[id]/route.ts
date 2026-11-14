import { NextResponse } from "next/server";
import { lerId, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { apagarBaixa, buscarBaixa } from "@/lib/db/repositories/baixas";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  const baixa = buscarBaixa(id);
  return baixa ? NextResponse.json(baixa) : respostaNaoEncontrado("Baixa", "a");
}

// DELETE /api/baixas/:id — apaga a baixa e devolve a quantidade ao estoque
export async function DELETE(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  return apagarBaixa(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Baixa", "a");
}
