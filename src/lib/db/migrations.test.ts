import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { rodarMigrations } from "./migrations";

describe("migration 2: materiais -> insumos", () => {
  it("converte materiais em insumos e categorias em grupos, sem perder dados", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    rodarMigrations(db, 1); // banco como estava na etapa 1

    const inserir = db.prepare(
      `INSERT INTO materiais (nome, categoria, unidade, custo_unitario_centavos, quantidade_estoque, estoque_minimo, ativo, criado_em, atualizado_em)
       VALUES (?, ?, 'un', ?, ?, 1, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    inserir.run("Caneca branca", "caneca", 1250, 40, 1);
    inserir.run("Caneca preta", "Caneca", 1690, 20, 1); // mesma categoria com outra grafia
    inserir.run("Caixa", "caixa", 480, 25, 0);
    inserir.run("Sem categoria", null, 100, 0, 1);

    rodarMigrations(db);

    const grupos = db.prepare("SELECT nome FROM grupos_insumo ORDER BY nome").all().map((g) => g.nome);
    expect(grupos).toEqual(["Outros", "caixa", "caneca"]);

    const insumos = db
      .prepare(
        `SELECT i.id, i.nome, g.nome AS grupo, i.valor_pago_centavos, i.rendimento, i.custo_unitario_centavos,
                i.quantidade_estoque, i.ativo
           FROM insumos i JOIN grupos_insumo g ON g.id = i.grupo_id ORDER BY i.id`,
      )
      .all()
      .map((linha) => ({ ...linha }));

    expect(insumos).toEqual([
      { id: 1, nome: "Caneca branca", grupo: "caneca", valor_pago_centavos: 1250, rendimento: 1, custo_unitario_centavos: 1250, quantidade_estoque: 40, ativo: 1 },
      { id: 2, nome: "Caneca preta", grupo: "caneca", valor_pago_centavos: 1690, rendimento: 1, custo_unitario_centavos: 1690, quantidade_estoque: 20, ativo: 1 },
      { id: 3, nome: "Caixa", grupo: "caixa", valor_pago_centavos: 480, rendimento: 1, custo_unitario_centavos: 480, quantidade_estoque: 25, ativo: 0 },
      { id: 4, nome: "Sem categoria", grupo: "Outros", valor_pago_centavos: 100, rendimento: 1, custo_unitario_centavos: 100, quantidade_estoque: 0, ativo: 1 },
    ]);

    const tabelaAntiga = db.prepare("SELECT name FROM sqlite_master WHERE name = 'materiais'").get();
    expect(tabelaAntiga).toBeUndefined();
  });

  it("rodar de novo não faz nada (idempotente)", () => {
    const db = new DatabaseSync(":memory:");
    rodarMigrations(db);
    rodarMigrations(db);
    const versoes = db.prepare("SELECT versao FROM schema_migrations ORDER BY versao").all().map((v) => v.versao);
    expect(versoes).toEqual([1, 2]);
  });
});
