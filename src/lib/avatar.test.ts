import { describe, expect, it } from "vitest";

import {
  discordAvatarUrl,
  discordDefaultAvatarUrl,
  discordGuildAvatarUrl,
} from "./permissions";

describe("avatars do Discord", () => {
  const id = "123456789012345678";

  it("monta avatar global estático e animado", () => {
    expect(discordAvatarUrl(id, "hash-estatico")).toContain(`/avatars/${id}/hash-estatico.png`);
    expect(discordAvatarUrl(id, "a_hash-animado")).toContain(`/avatars/${id}/a_hash-animado.gif`);
  });

  it("monta avatar específico da guild", () => {
    expect(discordGuildAvatarUrl("987654321098765432", id, "guild-hash")).toContain(
      `/guilds/987654321098765432/users/${id}/avatars/guild-hash.png`,
    );
  });

  it("usa o avatar padrão quando não há hash", () => {
    expect(discordAvatarUrl(id, null)).toBe(discordDefaultAvatarUrl(id));
    expect(discordGuildAvatarUrl("987654321098765432", id, null)).toBeNull();
  });
});
