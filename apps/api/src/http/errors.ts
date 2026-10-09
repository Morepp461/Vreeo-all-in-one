import type { FastifyReply } from 'fastify';

export function sendApiError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      requestId,
      details,
    },
  });
}
