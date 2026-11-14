import { caminhoDoBanco } from "../src/lib/db/connection";
import { criarMaterial, NomeDuplicadoError } from "../src/lib/db/repositories/materiais";

const exemplos = [
  { nome: "Caneca branca 325ml", categoria: "caneca", unidade: "un", custo_unitario_centavos: 1250, quantidade_estoque: 40, estoque_minimo: 10 },
  { nome: "Caixa para caneca", categoria: "caixa", unidade: "un", custo_unitario_centavos: 480, quantidade_estoque: 25, estoque_minimo: 10 },
  { nome: "Plástico bolha", categoria: "embalagem", unidade: "pacote", custo_unitario_centavos: 1890, quantidade_estoque: 2, estoque_minimo: 3 },
  { nome: "Bombom", categoria: "doce", unidade: "un", custo_unitario_centavos: 150, quantidade_estoque: 60, estoque_minimo: 20 },
];

let criados = 0;
for (const material of exemplos) {
  try {
    criarMaterial(material);
    criados++;
  } catch (erro) {
    if (!(erro instanceof NomeDuplicadoError)) throw erro;
  }
}

console.log(`Seed concluído em ${caminhoDoBanco()}: ${criados} criado(s), ${exemplos.length - criados} já existia(m).`);
