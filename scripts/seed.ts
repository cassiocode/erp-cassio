import { caminhoDoBanco } from "../src/lib/db/connection";
import { NomeDuplicadoError } from "../src/lib/db/erros";
import { criarInsumo } from "../src/lib/db/repositories/insumos";

// Valores de exemplo: ajuste depois pela tela de insumos
const exemplos = [
  { nome: "Caneca branca 325ml", valor_pago_centavos: 12600, quantidade_comprada: 12, quantidade_estoque: 12, observacao: "Cerâmica branca para sublimação, classe AAA" },
  { nome: "Caneca preta 325ml", valor_pago_centavos: 20280, quantidade_comprada: 12, quantidade_estoque: 12, observacao: "Cerâmica preta com área para sublimação" },
  { nome: "Caixa para caneca", valor_pago_centavos: 12000, quantidade_comprada: 25, quantidade_estoque: 25, observacao: null },
  { nome: "Plástico bolha", valor_pago_centavos: 1890, quantidade_comprada: 20, quantidade_estoque: 20, observacao: "Rolo que embala cerca de 20 canecas" },
  { nome: "Papel sublimático A4", valor_pago_centavos: 4500, quantidade_comprada: 100, quantidade_estoque: 100, observacao: "Pacote com 100 folhas" },
  { nome: "Tinta sublimática (kit 4 cores)", valor_pago_centavos: 12000, quantidade_comprada: 400, quantidade_estoque: 400, observacao: "Rende cerca de 400 canecas" },
  { nome: "Fita térmica", valor_pago_centavos: 1800, quantidade_comprada: 200, quantidade_estoque: 200, observacao: null },
  { nome: "Bombom", valor_pago_centavos: 3000, quantidade_comprada: 20, quantidade_estoque: 20, observacao: null },
];

let criados = 0;
for (const insumo of exemplos) {
  try {
    criarInsumo(insumo);
    criados++;
  } catch (erro) {
    if (!(erro instanceof NomeDuplicadoError)) throw erro;
  }
}

console.log(`Seed concluído em ${caminhoDoBanco()}: ${criados} criado(s), ${exemplos.length - criados} já existia(m).`);
