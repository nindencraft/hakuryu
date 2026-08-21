import { describe, expect, it } from "vitest";

import { acessoGangPermitido } from "./acesso-gang";

describe("acessoGangPermitido", () => {
  it("mantém o Super Owner autorizado mesmo quando o Discord não respondeu com os cargos", () => {
    expect(acessoGangPermitido(7, true, false)).toBe(true);
  });

  it("autoriza membros somente quando um cargo configurado por ID foi confirmado", () => {
    expect(acessoGangPermitido(7, false, true)).toBe(true);
    expect(acessoGangPermitido(7, false, false)).toBe(false);
  });

  it("não converte uma falha temporária de revalidação em acesso sem ID autorizado", () => {
    expect(acessoGangPermitido(7, false, false)).toBe(false);
  });

  it("permite a liderança oficialmente registrada sem depender de uma consulta transitória ao Discord", () => {
    expect(acessoGangPermitido(7, false, false, true)).toBe(true);
  });

  it("não bloqueia uma sessão que ainda não selecionou gang", () => {
    expect(acessoGangPermitido(null, false, false)).toBe(true);
  });
});
