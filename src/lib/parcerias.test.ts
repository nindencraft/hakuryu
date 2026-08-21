import { describe, expect, it } from "vitest";

import { encontrarParceriaDuplicada } from "./parcerias";

const existentes = [
  {
    id: 7,
    nome: "Gang Kuro",
    tag: "123456789",
    link_servidor: "https://discord.gg/kuro",
  },
];

describe("encontrarParceriaDuplicada", () => {
  it("detecta a mesma gang pelo identificador ou convite", () => {
    expect(
      encontrarParceriaDuplicada(existentes, {
        id: null,
        nome: "Outro nome",
        tag: "123456789",
        link_servidor: "",
      }),
    ).toMatchObject({ id: 7 });

    expect(
      encontrarParceriaDuplicada(existentes, {
        id: null,
        nome: "Gang Kuro",
        tag: "",
        link_servidor: "https://discord.gg/kuro/",
      }),
    ).toMatchObject({ id: 7 });
  });

  it("não bloqueia a edição do próprio registro", () => {
    expect(
      encontrarParceriaDuplicada(existentes, {
        id: 7,
        nome: "Gang Kuro Atualizada",
        tag: "123456789",
        link_servidor: "https://discord.gg/kuro",
      }),
    ).toBeNull();
  });
});
