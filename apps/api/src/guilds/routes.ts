import type { FastifyInstance } from "fastify";
import { resolveAuthenticatedSession } from "../auth/routes.js";
import type { GuildRouteDependencies } from "./types.js";

export async function registerGuildRoutes(app: FastifyInstance, dependencies: GuildRouteDependencies): Promise<void> {
  app.get("/api/v1/guilds", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const session = await resolveAuthenticatedSession(request, dependencies.auth);
    if (!session) {
      return reply.code(401).send({
        error: { code: "AUTH_REQUIRED", message: "Please sign in to continue.", requestId: request.id },
      });
    }
    const guilds = await dependencies.repository.listManageableGuilds(session.user.discordUserId);
    return { data: guilds };
  });
}
