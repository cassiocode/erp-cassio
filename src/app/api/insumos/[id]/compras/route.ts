import { NextResponse } from "next/server";
import { lerCorpo, lerId, respostaErros, respostaIdInvalido, respostaNaoEncontrado } from "@/lib/api";
import { listarCompras, registrarCompra } from "@/lib/db/repositories/compras";
import { buscarInsumoPorId } from "@/lib/db/repositories/insumos";
import { errosPorCampo } from "@/lib/schemas/comum";
import { compraSchema } from "@/lib/schemas/insumos";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// GET /api/insumos/:id/compras
export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();
  if (!buscarInsumoPorId(id)) return respostaNaoEncontrado("Insumo");
  return NextResponse.json(listarCompras(id));
}

// POST /api/insumos/:id/compras — registra a compra e soma ao estoque
export async function POST(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const resultado = compraSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  const compra = registrarCompra(id, resultado.data);
  return compra ? NextResponse.json(compra, { status: 201 }) : respostaNaoEncontrado("Insumo");
}
