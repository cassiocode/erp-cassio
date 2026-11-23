import { NextResponse } from "next/server";
import { lerCorpo, respostaErros } from "@/lib/api";
import { listarKitsCadastro, salvarKit } from "@/lib/db/repositories/kits";
import { errosPorCampo } from "@/lib/schemas/comum";
import { kitSchema } from "@/lib/schemas/kits";
import { erroDoKit } from "./erros";

export const dynamic = "force-dynamic";

// GET /api/kits — todos os kits (padrão da venda), com as categorias
export function GET() {
  return NextResponse.json(listarKitsCadastro());
}

// POST /api/kits — cria um kit
export async function POST(request: Request) {
  const resultado = kitSchema.safeParse(await lerCorpo(request));
  if (!resultado.success) return respostaErros(errosPorCampo(resultado.error), 400);
  try {
    return NextResponse.json(salvarKit(null, resultado.data), { status: 201 });
  } catch (erro) {
    return erroDoKit(erro);
  }
}
