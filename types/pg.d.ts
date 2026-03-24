declare module 'pg' {
  export interface PoolClient {
    query<T extends object = Record<string, unknown>>(
      queryText: string,
      values?: unknown[]
    ): Promise<{ rows: T[] }>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  export class Pool {
    constructor(config?: string | PoolConfig);
    connect(): Promise<PoolClient>;
  }
}
