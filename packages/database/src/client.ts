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
  const clientOptions = options.url ? { datasources: { db: { url: options.url } } } : undefined;
  return new PrismaClient(clientOptions);
}

export { PrismaClient };
