import { NextResponse } from "next/server";
import { lerId, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { apagarCompra } from "@/lib/db/repositories/compras";

export const dynamic = "force-dynamic";

// DELETE /api/compras/:id — apaga a compra e tira a quantidade dela do estoque
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  return apagarCompra(id) ? new NextResponse(null, { status: 204 }) : respostaNaoEncontrado("Compra", "a");
}
