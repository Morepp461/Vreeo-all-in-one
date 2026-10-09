import type { DiscordOAuthGuild } from "./types.js";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
export function canManageDiscordGuild(guild: DiscordOAuthGuild): boolean {
 if (guild.owner) return true;
 if (!/^\d{1,24}$/.test(guild.permissions)) return false;
 try { return (BigInt(guild.permissions) & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n; } catch { return false; }
}
