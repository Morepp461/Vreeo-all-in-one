import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { resolveAuthenticatedSession } from "../auth/routes.js";
import type { GuildRouteDependencies, GuildContextRecord } from "./types.js";

export interface VreeoGuildContext extends GuildContextRecord {
  userId: string;
  discordUserId: string;
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

/** Reusable guard: the URL carries a Discord guild snowflake; access is resolved only from the session and server-owned database snapshots. */
export function requireGuildContext(dependencies: GuildRouteDependencies) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void | FastifyReply> => {
    const session = await resolveAuthenticatedSession(request, dependencies.auth);
    if (!session) {
      return sendContextError(reply, request, 401, "AUTH_REQUIRED", "Please sign in to continue.");
    }
    const params = request.params as { guildId?: unknown };
    if (typeof params.guildId !== "string" || !/^\d{1,32}$/.test(params.guildId)) {
      return sendContextError(reply, request, 400, "VALIDATION_ERROR", "The guild ID is invalid.");
    }
    const result = await dependencies.repository.resolveGuildContext(params.guildId, session.user.discordUserId);
    if (result.status === "not_found") {
      return sendContextError(reply, request, 404, "GUILD_NOT_FOUND", "The server is not available in VREEO.");
    }
    if (result.status === "forbidden") {
      return sendContextError(reply, request, 403, "GUILD_ACCESS_DENIED", "You do not have management access to this server.");
    }
    request.vreeoGuildContext = {
      ...result.guild,
      userId: session.user.id,
      discordUserId: session.user.discordUserId,
    };
  };
}

export async function registerGuildContextRoutes(app: FastifyInstance, dependencies: GuildRouteDependencies): Promise<void> {
  app.decorateRequest("vreeoGuildContext", null);
  app.get("/api/v1/guilds/:guildId/context", {
    preHandler: requireGuildContext(dependencies),
  }, async (request, reply) => {
    const context = request.vreeoGuildContext;
    if (!context) return sendContextError(reply, request, 500, "INTERNAL_ERROR", "Guild context was not initialized.");
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        guildId: context.discordGuildId,
        name: context.name,
        iconUrl: context.iconUrl,
        accessLevel: context.isOwner ? "owner" : "manage_guild",
      },
    };
  });
}
