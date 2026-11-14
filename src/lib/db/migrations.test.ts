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
      .prepare(
        `SELECT id, nome, valor_pago_centavos, quantidade_comprada, custo_unitario_centavos,
                quantidade_estoque, observacao, ativo
           FROM insumos ORDER BY id`,
      )
      .all()
      .map((linha) => ({ ...linha }));

    expect(insumos).toEqual([
      { id: 1, nome: "Caneca branca", valor_pago_centavos: 1250, quantidade_comprada: 2, custo_unitario_centavos: 625, quantidade_estoque: 40, observacao: "Classe AAA", ativo: 1 },
      { id: 2, nome: "Caneca preta", valor_pago_centavos: 1690, quantidade_comprada: 1, custo_unitario_centavos: 1690, quantidade_estoque: 20, observacao: null, ativo: 1 },
      { id: 3, nome: "Caixa", valor_pago_centavos: 480, quantidade_comprada: 1, custo_unitario_centavos: 480, quantidade_estoque: 25, observacao: null, ativo: 0 },
      { id: 4, nome: "Sem categoria", valor_pago_centavos: 100, quantidade_comprada: 1, custo_unitario_centavos: 100, quantidade_estoque: 0, observacao: null, ativo: 1 },
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
    expect(versoes).toEqual([1, 2, 3]);
  });
});
