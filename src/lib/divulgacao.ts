export const URL_SITE_HAKURYU = "https://hakuryu.lovable.app";

export function montarTextoDivulgacao(conviteHakuryu: string): string {
  return [
    "**Conheça a comunidade Hakuryū.**",
    "Gerencie sua gang, acompanhe notícias e participe da comunidade Gakuran.",
    "",
    `[Entrar no Discord do Hakuryū](${conviteHakuryu})`,
    `[Acessar o site Hakuryū](${URL_SITE_HAKURYU})`,
  ].join("\n");
}
