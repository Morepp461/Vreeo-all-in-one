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
  return new PrismaClient(options.url ? { datasources: { db: { url: options.url } } } : {});
}

export { PrismaClient };
