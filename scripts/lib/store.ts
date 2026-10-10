import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import type { Issue, Assessment } from '../../shared/types.ts'
export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function evidenceHash(issue: Issue): string {
  const { retrievedAt: _, ...content } = issue
  return hash(content)
}
export class Store {
  db: DatabaseSync
  constructor(path = '.data/triage.sqlite') {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, hash TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (key TEXT PRIMARY KEY, issue_id TEXT NOT NULL, input_hash TEXT NOT NULL, rubric TEXT NOT NULL, model TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, result TEXT, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, json TEXT NOT NULL);`)
  }
  saveIssue(issue: Issue) {
    this.db
      .prepare(
        'INSERT INTO issues VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,json=excluded.json',
      )
      .run(issue.id, evidenceHash(issue), JSON.stringify(issue))
  }
  issues(): Issue[] {
    return this.db
      .prepare('SELECT json FROM issues ORDER BY id')
      .all()
      .map((r) => JSON.parse(String(r.json)))
  }
  meta(key: string, value?: unknown): any {
    if (value !== undefined) {
      this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, JSON.stringify(value))
      return value
    }
    const row = this.db.prepare('SELECT json FROM meta WHERE key=?').get(key)
    return row ? JSON.parse(String(row.json)) : undefined
  }
  recover() {
    this.db
      .prepare(
        "UPDATE jobs SET status='retryable-failed',error='Interrupted before result was committed' WHERE status='running'",
      )
      .run()
  }
  job(key: string): any {
    return this.db.prepare('SELECT * FROM jobs WHERE key=?').get(key)
  }
  queue(key: string, issue: string, inputHash: string, rubric: string, model: string, stage: string) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO jobs (key,issue_id,input_hash,rubric,model,stage,status,updated_at) VALUES (?,?,?,?,?,?,'pending',?)",
      )
      .run(key, issue, inputHash, rubric, model, stage, new Date().toISOString())
  }
  start(key: string) {
    this.db
      .prepare(
        "UPDATE jobs SET status='running',attempts=attempts+1,updated_at=? WHERE key=? AND status!='succeeded'",
      )
      .run(new Date().toISOString(), key)
  }
  succeed(key: string, result: Assessment) {
    this.db
      .prepare("UPDATE jobs SET status='succeeded',result=?,error=NULL,updated_at=? WHERE key=?")
      .run(JSON.stringify(result), new Date().toISOString(), key)
  }
  fail(key: string, error: string, retryable: boolean) {
    this.db
      .prepare("UPDATE jobs SET status=?,error=?,updated_at=? WHERE key=? AND status!='succeeded'")
      .run(retryable ? 'retryable-failed' : 'terminal-failed', error, new Date().toISOString(), key)
  }
  results(id: string): Assessment[] {
    return this.db
      .prepare("SELECT result FROM jobs WHERE issue_id=? AND status='succeeded' ORDER BY updated_at DESC")
      .all(id)
      .map((r) => JSON.parse(String(r.result)))
  }
  hasFailure(id: string): boolean {
    return !!this.db
      .prepare(
        "SELECT 1 FROM jobs WHERE issue_id=? AND status IN ('retryable-failed','terminal-failed') LIMIT 1",
      )
      .get(id)
  }
  close() {
    this.db.close()
  }
}
