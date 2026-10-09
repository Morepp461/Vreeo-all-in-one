import type { Readable } from "node:stream";

export interface PutObjectInput {
  key: string;
  body: Readable;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  body: Readable;
  contentType: string;
  sizeBytes?: number;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * Provider-neutral object-storage boundary.
 * Implementations must not log object bodies or credentials.
 */
export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<Omit<StoredObject, "body">>;
  getObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}
