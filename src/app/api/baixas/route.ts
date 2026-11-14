import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { listarBaixas, registrarBaixa } from "@/lib/db/repositories/baixas";
import { baixaSchema } from "@/lib/schemas/baixas";
import { errosPorCampo } from "@/lib/schemas/comum";

export const dynamic = "force-dynamic";

// GET /api/baixas
export function GET() {
  return NextResponse.json(listarBaixas());
}

// POST /api/baixas — registra a baixa e tira a quantidade do estoque
export async function POST(request: Request) {
  const resultado = baixaSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);

  const baixa = registrarBaixa(resultado.data);
  return baixa ? NextResponse.json(baixa, { status: 201 }) : respostaErros({ insumo_id: "Insumo não encontrado" }, 400);
}
