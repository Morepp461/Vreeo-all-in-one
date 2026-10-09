import type { AuthRouteDependencies } from "../auth/types.js";

export interface AccessibleGuild {
  id: string;
  discordGuildId: string;
  name: string;
  iconUrl: string;
  accessLevel: "owner" | "manage_guild";
}

export interface GuildContextRecord {
  guildId: string;
  discordGuildId: string;
  name: string;
  iconUrl: string;
  isOwner: boolean;
  roleIds: string[];
}

export type GuildContextLookup =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; guild: GuildContextRecord };

export interface GuildAccessRepository {
  listManageableGuilds(discordUserId: string): Promise<AccessibleGuild[]>;
  resolveGuildContext(discordGuildId: string, discordUserId: string): Promise<GuildContextLookup>;
}

export interface GuildRouteDependencies {
  auth: AuthRouteDependencies;
  repository: GuildAccessRepository;
}
