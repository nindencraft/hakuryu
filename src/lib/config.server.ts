/**
 * Leitura de configuração — server-only.
 * Nunca leia process.env no escopo de módulo: no runtime de edge as
 * variáveis só existem no momento da requisição.
 */

export type AppConfig = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  discordClientId: string;
  discordClientSecret: string;
  discordBotToken: string;
  discordGuildId: string;
  discordOwnerId: string;
  sessionSecret: string;
};

export class ConfigError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(
      `Configuração ausente: ${missing.join(", ")}. Adicione esses valores nos segredos do projeto.`,
    );
    this.name = "ConfigError";
    this.missing = missing;
  }
}

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getConfig(): AppConfig {
  const values = {
    supabaseUrl: read("HAKURYU_SUPABASE_URL"),
    supabaseServiceKey: read("HAKURYU_SUPABASE_SERVICE_ROLE_KEY"),
    discordClientId: read("DISCORD_CLIENT_ID"),
    discordClientSecret: read("DISCORD_CLIENT_SECRET"),
    discordBotToken: read("DISCORD_BOT_TOKEN"),
    discordGuildId: read("DISCORD_GUILD_ID"),
    discordOwnerId: read("DISCORD_OWNER_ID"),
    sessionSecret: read("HAKURYU_SESSION_SECRET"),
  };

  const required: (keyof AppConfig)[] = [
    "supabaseUrl",
    "supabaseServiceKey",
    "discordClientId",
    "discordClientSecret",
    "discordBotToken",
    "sessionSecret",
  ];

  const envNames: Record<string, string> = {
    supabaseUrl: "HAKURYU_SUPABASE_URL",
    supabaseServiceKey: "HAKURYU_SUPABASE_SERVICE_ROLE_KEY",
    discordClientId: "DISCORD_CLIENT_ID",
    discordClientSecret: "DISCORD_CLIENT_SECRET",
    discordBotToken: "DISCORD_BOT_TOKEN",
    discordGuildId: "DISCORD_GUILD_ID",
    sessionSecret: "HAKURYU_SESSION_SECRET",
  };

  const missing = required.filter((k) => !values[k]).map((k) => envNames[k]!);
  if (missing.length > 0) throw new ConfigError(missing);

  return values;
}

export function isConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}
