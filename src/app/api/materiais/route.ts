import { NextResponse } from "next/server";
import {
  criarMaterial,
  listarMateriais,
  NomeDuplicadoError,
} from "@/lib/db/repositories/materiais";
import { errosPorCampo, materialSchema } from "@/lib/schemas/materiais";

export const dynamic = "force-dynamic";

// GET /api/materiais?busca=&categoria=&ativo=1|0 (sem "ativo" = todos)
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");

  const materiais = listarMateriais({
    busca: searchParams.get("busca") ?? undefined,
    categoria: searchParams.get("categoria") || undefined,
    ativo: ativo === "1" ? 1 : ativo === "0" ? 0 : undefined,
  });
  return NextResponse.json(materiais);
}

// POST /api/materiais
export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const resultado = materialSchema.safeParse(corpo ?? {});
  if (!resultado.success) {
    return NextResponse.json({ erros: errosPorCampo(resultado.error) }, { status: 400 });
  }

  try {
    const material = criarMaterial(resultado.data);
    return NextResponse.json(material, { status: 201 });
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) {
      return NextResponse.json({ erros: { nome: erro.message } }, { status: 409 });
    }
    throw erro;
  }
}
