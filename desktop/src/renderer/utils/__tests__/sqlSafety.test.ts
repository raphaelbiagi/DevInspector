import { describe, it, expect } from 'vitest'
import { assessSql, describeStatement } from '../sqlSafety'

describe('assessSql', () => {
  it('trata leitura como segura', () => {
    expect(assessSql('SELECT * FROM users').risk).toBe('read')
    expect(assessSql('PRAGMA table_info(users)').risk).toBe('read')
    expect(assessSql('WITH t AS (SELECT 1) SELECT * FROM t').risk).toBe('read')
  })

  it('marca DROP e ALTER como destrutivos', () => {
    expect(assessSql('DROP TABLE users').risk).toBe('destructive')
    expect(assessSql('ALTER TABLE users ADD COLUMN x TEXT').risk).toBe('destructive')
    expect(assessSql('VACUUM').risk).toBe('destructive')
  })

  it('distingue DELETE com e sem WHERE', () => {
    expect(assessSql('DELETE FROM users').risk).toBe('destructive')
    expect(assessSql('DELETE FROM users WHERE id = 1').risk).toBe('write')
  })

  it('distingue UPDATE com e sem WHERE', () => {
    expect(assessSql('UPDATE users SET name = "x"').risk).toBe('destructive')
    expect(assessSql('UPDATE users SET name = "x" WHERE id = 1').risk).toBe('write')
  })

  it('classifica INSERT como escrita não destrutiva', () => {
    expect(assessSql('INSERT INTO users (name) VALUES ("a")').risk).toBe('write')
  })

  it('não se deixa enganar por WHERE dentro de string literal', () => {
    // O literal contém "WHERE", mas o comando não tem cláusula WHERE de verdade
    expect(assessSql(`DELETE FROM logs`).risk).toBe('destructive')
    expect(assessSql(`UPDATE logs SET msg = 'onde WHERE mora'`).risk).toBe('destructive')
  })

  it('ignora comentários ao classificar', () => {
    expect(assessSql('-- DROP TABLE users\nSELECT 1').risk).toBe('read')
    expect(assessSql('/* DROP TABLE users */ SELECT 1').risk).toBe('read')
  })

  it('usa o maior risco em scripts com vários comandos', () => {
    const result = assessSql('INSERT INTO a VALUES (1); DROP TABLE b;')
    expect(result.risk).toBe('destructive')
    expect(result.statements.length).toBe(2)
  })

  it('é indiferente a maiúsculas e espaços', () => {
    expect(assessSql('   drop   table   users  ').risk).toBe('destructive')
  })

  it('considera query vazia como leitura', () => {
    expect(assessSql('').risk).toBe('read')
    expect(assessSql('   ').risk).toBe('read')
  })
})

describe('describeStatement', () => {
  it('colapsa espaços e trunca', () => {
    expect(describeStatement('DELETE   FROM\n  users')).toBe('DELETE FROM users')
    expect(describeStatement('x'.repeat(200))).toHaveLength(121) // 120 + reticências
  })
})
