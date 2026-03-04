/**
 * Mock D1 Implementation for Local Development
 *
 * This is a simple in-memory D1 database that stores data in a JSON file
 * in the cache directory (cache/local-d1.json).
 * It's only used when running locally (IS_LAMBDA != "true").
 * In production, the actual Cloudflare D1 binding is used.
 */

interface D1Result {
  results: any[];
  success: boolean;
}

interface D1PreparedStatement {
  bind: (...values: any[]) => D1PreparedStatement;
  first: () => any | null;
  all: () => Promise<D1Result>;
  run: () => Promise<D1Result>;
}

class MockD1PreparedStatement implements D1PreparedStatement {
  private values: any[] = [];
  private sql: string;
  private db: MockD1Database;

  constructor(sql: string, db: MockD1Database) {
    this.sql = sql;
    this.db = db;
  }

  bind(...values: any[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  first(): any | null {
    const results = this.db.execute(this.sql, this.values);
    return results.results.length > 0 ? results.results[0] : null;
  }

  async all(): Promise<D1Result> {
    return this.db.execute(this.sql, this.values);
  }

  async run(): Promise<D1Result> {
    return this.db.execute(this.sql, this.values);
  }
}

class MockD1Database {
  private data: Map<string, any[]> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const fs = require("fs");
      const path = require("path");
      const cacheFile = path.join(process.cwd(), "cache", "mock-d1.json");

      if (fs.existsSync(cacheFile)) {
        const fileData = fs.readFileSync(cacheFile, "utf8");
        const parsedData = JSON.parse(fileData);
        for (const [table, rows] of Object.entries(parsedData)) {
          this.data.set(table, rows as any[]);
        }
      }
    } catch (error) {
      console.log("No existing mock D1 data, starting fresh");
    }
  }

  private saveData() {
    try {
      const fs = require("fs");
      const path = require("path");
      const cacheFile = path.join(process.cwd(), "cache", "mock-d1.json");
      const cacheDir = path.dirname(cacheFile);

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const serializedData: Record<string, any[]> = {};
      for (const [table, rows] of this.data.entries()) {
        serializedData[table] = rows;
      }

      fs.writeFileSync(cacheFile, JSON.stringify(serializedData, null, 2));
    } catch (error) {
      console.error("Failed to save mock D1 data:", error);
    }
  }

  execute(sql: string, values: any[] = []): D1Result {
    const upperSql = sql.toUpperCase();

    if (upperSql.startsWith("SELECT")) {
      return this.executeSelect(sql, values);
    } else if (upperSql.startsWith("INSERT") || upperSql.startsWith("UPDATE")) {
      return this.executeInsertOrUpdate(sql, values);
    } else {
      return { results: [], success: false };
    }
  }

  private executeSelect(sql: string, values: any[]): D1Result {
    const tableName = this.extractTableName(sql);
    const rows = this.data.get(tableName) ?? [];
    return { results: rows, success: true };
  }

  private executeInsertOrUpdate(sql: string, values: any[]): D1Result {
    const tableName = this.extractTableName(sql);
    const upperSql = sql.toUpperCase();

    let rows = this.data.get(tableName) ?? [];

    if (upperSql.includes("INSERT OR REPLACE")) {
      const newRow = this.extractValuesFromInsert(sql, values);
      const date = newRow.date;
      rows = rows.filter((r: any) => r.date !== date);
      rows.push(newRow);
      this.data.set(tableName, rows);
      this.saveData();
    }

    return { results: [], success: true };
  }

  private extractTableName(sql: string): string {
    const match = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    if (!match) {
      throw new Error(`Could not extract table name from SQL: ${sql}`);
    }
    return match[1];
  }

  private extractValuesFromInsert(
    sql: string,
    values: any[],
  ): Record<string, any> {
    const match = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match) return {};

    const columns = match[1].split(",").map((c) => c.trim());
    const row: Record<string, any> = {};

    columns.forEach((col, index) => {
      let value = values[index];

      if (
        col === "deduplicatedUsage" ||
        col === "summarizedUsage" ||
        col === "posts"
      ) {
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.error("Failed to parse JSON for column:", col);
          }
        }
      }

      row[col] = value;
    });

    return row;
  }

  prepare(sql: string): D1PreparedStatement {
    return new MockD1PreparedStatement(sql, this);
  }

  batch(statements: D1PreparedStatement[]): Promise<D1Result> {
    for (const stmt of statements) {
      stmt.run();
    }
    return Promise.resolve({ results: [], success: true });
  }
}

const mockD1 = new MockD1Database();
export { mockD1 };
