export const URL_SITE_HAKURYU = "https://hakuryu.lovable.app";

export function montarTextoDivulgacao(conviteHakuryu: string, descricao?: string): string {
  const textoPersonalizado = descricao?.trim() || "Conheça a comunidade Hakuryū.";
  return [
    textoPersonalizado,
    "",
    `[Entrar no Discord do Hakuryū](${conviteHakuryu})`,
    `[Acessar o site Hakuryū](${URL_SITE_HAKURYU})`,
  ].join("\n");
}
