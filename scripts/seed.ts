import { caminhoDoBanco } from "../src/lib/db/connection";
import { NomeDuplicadoError } from "../src/lib/db/erros";
import { buscarGrupoPorNome, criarGrupo } from "../src/lib/db/repositories/grupos-insumo";
import { criarInsumo } from "../src/lib/db/repositories/insumos";

// Valores de exemplo: ajuste depois pela tela de insumos
const exemplos = [
  { grupo: "Caneca", nome: "Caneca branca 325ml", unidade: "un", valor_pago_centavos: 1250, rendimento: 1, quantidade_estoque: 40, estoque_minimo: 10, especificacao: "Cerâmica branca para sublimação, classe AAA" },
  { grupo: "Caneca", nome: "Caneca preta 325ml", unidade: "un", valor_pago_centavos: 1690, rendimento: 1, quantidade_estoque: 20, estoque_minimo: 5, especificacao: "Cerâmica preta com área para sublimação" },
  { grupo: "Caixa", nome: "Caixa para caneca", unidade: "un", valor_pago_centavos: 480, rendimento: 1, quantidade_estoque: 25, estoque_minimo: 10, especificacao: null },
  { grupo: "Embalagem", nome: "Plástico bolha", unidade: "embalagem", valor_pago_centavos: 1890, rendimento: 20, quantidade_estoque: 15, estoque_minimo: 20, especificacao: "Rolo que embala cerca de 20 canecas" },
  { grupo: "Papel e tinta", nome: "Papel sublimático A4", unidade: "folha", valor_pago_centavos: 4500, rendimento: 100, quantidade_estoque: 80, estoque_minimo: 20, especificacao: "Pacote com 100 folhas" },
  { grupo: "Papel e tinta", nome: "Tinta sublimática (kit 4 cores)", unidade: "caneca", valor_pago_centavos: 12000, rendimento: 400, quantidade_estoque: 300, estoque_minimo: 50, especificacao: "Kit 4 x 100ml, rendimento estimado" },
  { grupo: "Papel e tinta", nome: "Fita térmica", unidade: "caneca", valor_pago_centavos: 1800, rendimento: 200, quantidade_estoque: 150, estoque_minimo: 30, especificacao: null },
  { grupo: "Brinde", nome: "Bombom", unidade: "un", valor_pago_centavos: 150, rendimento: 1, quantidade_estoque: 60, estoque_minimo: 20, especificacao: null },
];

function grupoId(nome: string): number {
  return (buscarGrupoPorNome(nome) ?? criarGrupo(nome)).id;
}

let criados = 0;
for (const { grupo, ...insumo } of exemplos) {
  try {
    criarInsumo({ ...insumo, grupo_id: grupoId(grupo), fornecedor: null });
    criados++;
  } catch (erro) {
    if (!(erro instanceof NomeDuplicadoError)) throw erro;
  }
}

console.log(`Seed concluído em ${caminhoDoBanco()}: ${criados} criado(s), ${exemplos.length - criados} já existia(m).`);
