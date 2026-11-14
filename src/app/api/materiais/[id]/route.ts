import { NextResponse } from "next/server";
import {
  atualizarMaterial,
  buscarMaterialPorId,
  definirAtivo,
  NomeDuplicadoError,
} from "@/lib/db/repositories/materiais";
import { ativoSchema, errosPorCampo, materialSchema } from "@/lib/schemas/materiais";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

function lerId(texto: string): number | null {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const respostaIdInvalido = () =>
  NextResponse.json({ erros: { geral: "ID inválido" } }, { status: 400 });
const respostaNaoEncontrado = () =>
  NextResponse.json({ erros: { geral: "Material não encontrado" } }, { status: 404 });

export async function GET(_request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const material = buscarMaterialPorId(id);
  return material ? NextResponse.json(material) : respostaNaoEncontrado();
}

// PUT /api/materiais/:id — atualiza todos os campos editáveis
export async function PUT(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const corpo = await request.json().catch(() => null);
  const resultado = materialSchema.safeParse(corpo ?? {});
  if (!resultado.success) {
    return NextResponse.json({ erros: errosPorCampo(resultado.error) }, { status: 400 });
  }

  try {
    const material = atualizarMaterial(id, resultado.data);
    return material ? NextResponse.json(material) : respostaNaoEncontrado();
  } catch (erro) {
    if (erro instanceof NomeDuplicadoError) {
      return NextResponse.json({ erros: { nome: erro.message } }, { status: 409 });
    }
    throw erro;
  }
}

// PATCH /api/materiais/:id com { "ativo": true|false } — inativa/reativa
export async function PATCH(request: Request, { params }: Contexto) {
  const id = lerId((await params).id);
  if (id === null) return respostaIdInvalido();

  const corpo = await request.json().catch(() => null);
  const resultado = ativoSchema.safeParse(corpo ?? {});
  if (!resultado.success) {
    return NextResponse.json({ erros: errosPorCampo(resultado.error) }, { status: 400 });
  }

  const material = definirAtivo(id, resultado.data.ativo);
  return material ? NextResponse.json(material) : respostaNaoEncontrado();
}
