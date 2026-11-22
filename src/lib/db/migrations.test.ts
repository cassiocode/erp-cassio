import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { rodarMigrations } from "./migrations";

function tabelaExiste(db: DatabaseSync, nome: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nome) !== undefined;
}

describe("migrations", () => {
  it("leva os materiais da etapa 1 até os insumos atuais sem perder dados", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    rodarMigrations(db, 1); // banco como estava na etapa 1

    const inserir = db.prepare(
      `INSERT INTO materiais (nome, categoria, unidade, custo_unitario_centavos, quantidade_estoque, estoque_minimo, ativo, criado_em, atualizado_em)
       VALUES (?, ?, 'un', ?, ?, 1, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    inserir.run("Caneca branca", "caneca", 1250, 40, 1);
    inserir.run("Caneca preta", "Caneca", 1690, 20, 1);
    inserir.run("Caixa", "caixa", 480, 25, 0);
    inserir.run("Sem categoria", null, 100, 0, 1);

    rodarMigrations(db, 2);
    db.exec("UPDATE insumos SET especificacao = 'Classe AAA', rendimento = 2, custo_unitario_centavos = 625 WHERE id = 1");

    rodarMigrations(db);

    const insumos = db
      .prepare("SELECT id, nome, quantidade_estoque, observacao, ativo FROM insumos ORDER BY id")
      .all()
      .map((linha) => ({ ...linha }));

    expect(insumos).toEqual([
      { id: 1, nome: "Caneca branca", quantidade_estoque: 40, observacao: "Classe AAA", ativo: 1 },
      { id: 2, nome: "Caneca preta", quantidade_estoque: 20, observacao: null, ativo: 1 },
      { id: 3, nome: "Caixa", quantidade_estoque: 25, observacao: null, ativo: 0 },
      { id: 4, nome: "Sem categoria", quantidade_estoque: 0, observacao: null, ativo: 1 },
    ]);

    // O total pago/quantidade de cada insumo vira a primeira compra dele
    const compras = db
      .prepare("SELECT insumo_id, data_compra, quantidade, valor_pago_centavos FROM compras_insumo ORDER BY insumo_id")
      .all()
      .map((linha) => ({ ...linha }));

    expect(compras).toEqual([
      { insumo_id: 1, data_compra: "2026-01-01", quantidade: 2, valor_pago_centavos: 1250 },
      { insumo_id: 2, data_compra: "2026-01-01", quantidade: 1, valor_pago_centavos: 1690 },
      { insumo_id: 3, data_compra: "2026-01-01", quantidade: 1, valor_pago_centavos: 480 },
      { insumo_id: 4, data_compra: "2026-01-01", quantidade: 1, valor_pago_centavos: 100 },
    ]);

    expect(tabelaExiste(db, "materiais")).toBe(false);
    expect(tabelaExiste(db, "grupos_insumo")).toBe(false);
    expect(tabelaExiste(db, "insumos_novo")).toBe(false);

    // Estoque negativo passa a ser aceito
    db.exec("UPDATE insumos SET quantidade_estoque = -5 WHERE id = 1");
    expect(db.prepare("SELECT quantidade_estoque FROM insumos WHERE id = 1").get()?.quantidade_estoque).toBe(-5);
  });

  it("rodar de novo não faz nada (idempotente)", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db);
    rodarMigrations(db);
    const versoes = db.prepare("SELECT versao FROM schema_migrations ORDER BY versao").all().map((v) => v.versao);
    expect(versoes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("migration 5 liga os kits padrão aos insumos ativos pelo nome", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db, 4);
    const inserir = db.prepare(
      "INSERT INTO insumos (nome, quantidade_estoque, ativo, criado_em, atualizado_em) VALUES (?, 0, ?, 'x', 'x')",
    );
    inserir.run("Caneca branca antiga", 0); // inativa: ignorada
    inserir.run("Caneca branca 325ml - Live", 1);
    inserir.run("Caneca Preta 325 - Top", 1);
    inserir.run("Caixa Para Caneca De Porcelana 325 ML", 1);
    inserir.run("Laço Azul", 1);
    inserir.run("Tinta Sublimática", 1); // não é papel: ignorada

    rodarMigrations(db, 5);

    const kits = db
      .prepare(
        `SELECT k.nome AS kit, k.preco_venda_centavos AS preco, i.nome AS insumo
           FROM kits k JOIN kit_itens ki ON ki.kit_id = k.id JOIN insumos i ON i.id = ki.insumo_id
          ORDER BY k.ordem, i.nome`,
      )
      .all()
      .map((l) => ({ ...l }));
    expect(kits).toEqual([
      { kit: "Caneca branca", preco: 2990, insumo: "Caixa Para Caneca De Porcelana 325 ML" },
      { kit: "Caneca branca", preco: 2990, insumo: "Caneca branca 325ml - Live" },
      { kit: "Caneca preta", preco: 3490, insumo: "Caixa Para Caneca De Porcelana 325 ML" },
      { kit: "Caneca preta", preco: 3490, insumo: "Caneca Preta 325 - Top" },
    ]);
  });

  it("migration 11 transforma o kit das vendas antigas em 1 caneca, sem desconto", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db, 10);
    const kit = db.prepare("SELECT id FROM kits WHERE nome = 'Caneca preta'").get()?.id;
    db.prepare(
      "INSERT INTO vendas (data_venda, kit_id, preco_venda_centavos, criado_em) VALUES ('2026-11-01', ?, 3490, 'x')",
    ).run(kit as number);
    rodarMigrations(db);
    expect({ ...db.prepare("SELECT kit_id, quantidade, preco_unitario_centavos FROM venda_kits").get() }).toEqual({
      kit_id: kit,
      quantidade: 1,
      preco_unitario_centavos: 3490,
    });
    expect({ ...db.prepare("SELECT desconto_percentual, desconto_centavos FROM vendas").get() }).toEqual({
      desconto_percentual: 0,
      desconto_centavos: 0,
    });
  });

  it("migration 6 põe 1 folha de papel de sublimação em cada kit", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db, 4);
    const inserir = db.prepare(
      "INSERT INTO insumos (nome, quantidade_estoque, ativo, criado_em, atualizado_em) VALUES (?, 0, 1, 'x', 'x')",
    );
    inserir.run("Caneca branca 325ml - Live");
    inserir.run("Tinta Genesis Sublimática");
    inserir.run("Papel Sublimação Fundo Rosa - Jojo");

    rodarMigrations(db, 13); // a 14 troca o insumo do kit pela categoria

    const itens = db
      .prepare(
        `SELECT k.nome AS kit, i.nome AS insumo, ki.quantidade
           FROM kits k JOIN kit_itens ki ON ki.kit_id = k.id JOIN insumos i ON i.id = ki.insumo_id
          WHERE i.nome LIKE 'Papel%' OR i.nome LIKE 'Tinta%' ORDER BY k.ordem`,
      )
      .all()
      .map((l) => ({ ...l }));
    expect(itens).toEqual([
      { kit: "Caneca branca", insumo: "Papel Sublimação Fundo Rosa - Jojo", quantidade: 1 },
      { kit: "Caneca preta", insumo: "Papel Sublimação Fundo Rosa - Jojo", quantidade: 1 },
    ]);
  });

  it("migrations 13 e 14 categorizam os insumos pelo nome e ligam os kits às categorias", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db, 12);
    const inserir = db.prepare(
      "INSERT INTO insumos (nome, quantidade_estoque, ativo, criado_em, atualizado_em) VALUES (?, 1, 1, 'x', 'x')",
    );
    [
      "Caneca branca 325ml - Live",
      "Caneca branca 325ml - Metalnox",
      "Caneca Preta 325 - Top",
      "Caneca Preta 325 - Trix",
      "Caixa Para Caneca De Porcelana 325 ML",
      "Caixa 12x12x11 Papelão Simples",
      "Papel Sublimação Fundo Rosa - Jojo",
      "Tinta Genesis Sublimática",
      "Laço Lilas - Fácil",
      "Trufa Branco 30g - Cacau Show",
      "Tablete Branco 9g - Cacau Show",
      "Fita térmica",
    ].forEach((n) => inserir.run(n));
    const id = (nome: string) => Number(db.prepare("SELECT id FROM insumos WHERE nome = ?").get(nome)?.id);
    const kit = (nome: string) => Number(db.prepare("SELECT id FROM kits WHERE nome = ?").get(nome)?.id);
    const ligar = db.prepare("INSERT INTO kit_itens (kit_id, insumo_id) VALUES (?, ?)");
    ligar.run(kit("Caneca preta"), id("Caneca Preta 325 - Top"));
    ligar.run(kit("Caneca preta"), id("Caixa Para Caneca De Porcelana 325 ML"));

    rodarMigrations(db);

    const categorias = db
      .prepare("SELECT i.nome AS insumo, c.nome AS categoria FROM insumos i JOIN categorias c ON c.id = i.categoria_id ORDER BY i.id")
      .all()
      .map((l) => [l.insumo, l.categoria]);
    expect(categorias).toEqual([
      ["Caneca branca 325ml - Live", "Caneca cor branca"],
      ["Caneca branca 325ml - Metalnox", "Caneca cor branca"],
      ["Caneca Preta 325 - Top", "Caneca Cor Preta c/ Tarja Branca"],
      ["Caneca Preta 325 - Trix", "Caneca Cor Preta c/ Tarja Branca"],
      ["Caixa Para Caneca De Porcelana 325 ML", "Caixa para caneca"],
      ["Caixa 12x12x11 Papelão Simples", "Caixa de envio"],
      ["Papel Sublimação Fundo Rosa - Jojo", "Papel de sublimação"],
      ["Tinta Genesis Sublimática", "Tinta de sublimação"],
      ["Laço Lilas - Fácil", "Laço"],
      ["Trufa Branco 30g - Cacau Show", "Trufa"],
      ["Tablete Branco 9g - Cacau Show", "Tablete de chocolate"],
      ["Fita térmica", "Outros"],
    ]);

    const kits = db
      .prepare(
        `SELECT k.nome AS kit, c.nome AS categoria FROM kit_itens ki
           JOIN kits k ON k.id = ki.kit_id JOIN categorias c ON c.id = ki.categoria_id ORDER BY k.ordem, c.nome`,
      )
      .all()
      .map((l) => [l.kit, l.categoria]);
    // O kit branco estava sem itens: liga na base pelo nome do kit
    expect(kits).toEqual([
      ["Caneca branca", "Caneca cor branca"],
      ["Caneca preta", "Caixa para caneca"],
      ["Caneca preta", "Caneca Cor Preta c/ Tarja Branca"],
    ]);
  });
});
