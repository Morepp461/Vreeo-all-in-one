import { PrismaClient } from "@prisma/client";

export type DatabaseClient = PrismaClient;

/**
 * Create an explicit database client for an application or worker process.
 * The caller owns the connection lifecycle and must call $disconnect on shutdown.
 */
export function createDatabaseClient(): DatabaseClient {
  return new PrismaClient();
}

export { PrismaClient };
