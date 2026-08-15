import { getPostgresPool, isPostgresActive, withTransaction } from './postgresDb';
import {
  getDatabase as getSqliteDatabase,
  scheduleDbSave,
  hashPassword,
  verifyPassword,
  generateToken,
  recordAuditLog,
  getNextRevision,
  getCurrentRevision
} from './sqliteDb';

export {
  hashPassword,
  verifyPassword,
  generateToken,
  recordAuditLog,
  getNextRevision,
  getCurrentRevision,
  withTransaction
};

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Unified parameterized query runner supporting both PostgreSQL and SQLite fallback
export async function query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  // If PostgreSQL is active, execute via PostgreSQL pool
  if (isPostgresActive()) {
    const pool = getPostgresPool();
    if (pool) {
      const res = await pool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount || res.rows.length
      };
    }
  }

  // SQLite fallback: convert $1, $2, ... placeholders to ? for SQLite compatibility
  const sqlite = getSqliteDatabase();
  let sqliteSql = sql;
  // Replace $1, $2 with ?
  sqliteSql = sqliteSql.replace(/\$(\d+)/g, '?');

  const trimmed = sqliteSql.trim();
  const isSelect = trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('WITH');

  if (isSelect) {
    const stmt = sqlite.prepare(sqliteSql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return { rows, rowCount: rows.length };
  } else {
    sqlite.run(sqliteSql, params);
    scheduleDbSave();
    return { rows: [], rowCount: 1 };
  }
}

// Get active database engine name
export function getActiveEngine(): 'postgresql' | 'sqlite' {
  return isPostgresActive() ? 'postgresql' : 'sqlite';
}
