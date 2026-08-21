import { describe, expect, it } from "vitest";
import { montarTextoDivulgacao, URL_SITE_HAKURYU } from "./divulgacao";

describe("montarTextoDivulgacao", () => {
  it("inclui os links oficiais exigidos em cada anúncio", () => {
    const convite = "https://discord.gg/hakuryu-eterno";
    const texto = montarTextoDivulgacao(convite, "Uma descrição criada pelo Super Owner.");

    expect(texto).toContain(convite);
    expect(texto).toContain(URL_SITE_HAKURYU);
    expect(texto).toContain("Discord do Hakuryū");
    expect(texto).toContain("Uma descrição criada pelo Super Owner.");
  });
});
