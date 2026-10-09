import { PrismaClient } from "@prisma/client";

export type DatabaseClient = PrismaClient;

export interface CreateDatabaseClientOptions {
  url?: string;
}

/**
 * Create an explicit database client for an application or worker process.
 * The caller owns the connection lifecycle and must call $disconnect on shutdown.
 */
export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
  if (options.url) {
    return new PrismaClient({ datasources: { db: { url: options.url } } });
  }
  return new PrismaClient();
}

export { PrismaClient };
