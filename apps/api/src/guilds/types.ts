import type { AuthRouteDependencies } from "../auth/types.js";

export interface AccessibleGuild {
  id: string;
  discordGuildId: string;
  name: string;
  iconUrl: string;
  accessLevel: "owner" | "manage_guild";
}

export interface GuildAccessRepository {
  listManageableGuilds(discordUserId: string): Promise<AccessibleGuild[]>;
}

export interface GuildRouteDependencies {
  auth: AuthRouteDependencies;
  repository: GuildAccessRepository;
}
