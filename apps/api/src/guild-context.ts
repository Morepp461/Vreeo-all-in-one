import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { resolveSession } from "./auth/routes.js";
import type { AuthRouteDependencies, AccessibleGuildRecord } from "./auth/types.js";

export interface VreeoGuildContext {
  userId: string;
  guild: AccessibleGuildRecord;
}

declare module "fastify" {
  interface FastifyRequest {
    vreeoGuildContext?: VreeoGuildContext;
  }
}

function sendContextError(reply: FastifyReply, request: FastifyRequest, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).header("Cache-Control", "no-store").send({
    error: { code, message, requestId: request.id },
  });
}

/** Reusable pre-handler: resolve tenant ID from the URL, session from the HttpOnly cookie, and access from server-owned records. */
export function requireGuildContext(dependencies: AuthRouteDependencies) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> => {
    const params = request.params as { guildId?: unknown };
    if (typeof params.guildId !== "string" || !/^\d{1,32}$/.test(params.guildId)) {
      return sendContextError(reply, request, 400, "VALIDATION_ERROR", "The guild ID is invalid.");
    }
    const current = await resolveSession(request, dependencies);
    if (!current) {
      return sendContextError(reply, request, 401, "AUTH_REQUIRED", "Please sign in to continue.");
    }
    const guild = await dependencies.repository.getAccessibleGuild(current.user.id, params.guildId);
    if (!guild) {
      return sendContextError(reply, request, 403, "GUILD_ACCESS_DENIED", "You do not have access to this server.");
    }
    request.vreeoGuildContext = { userId: current.user.id, guild };
  };
}

export async function registerGuildContextRoutes(app: FastifyInstance, dependencies: AuthRouteDependencies): Promise<void> {
  app.get("/api/v1/guilds/:guildId/context", {
    preHandler: requireGuildContext(dependencies),
  }, async (request, reply) => {
    const context = request.vreeoGuildContext;
    if (!context) return sendContextError(reply, request, 500, "INTERNAL_ERROR", "Guild context was not initialized.");
    reply.header("Cache-Control", "no-store");
    return { data: { guildId: context.guild.id, name: context.guild.name, iconUrl: context.guild.iconUrl } };
  });
}
