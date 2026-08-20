import { getConfig } from "./config.server";
import { montarTextoDivulgacao } from "./divulgacao";
import { enviarMensagemParaCanal, garantirConviteInfinito } from "./discord.server";
import { normalizarLinkEvento } from "./event-link";
import { listarGangs } from "./gangs.server";
import { lerConfigGang } from "./settings.server";

const CHAVE_CANAL_DIVULGACAO = "canal_divulgacao";

export type ResultadoDivulgacao = {
  enviados: string[];
  ignorados: { gang: string; motivo: string }[];
  falhas: { gang: string; motivo: string }[];
};

function normalizarImagemDivulgacao(valor: string): string {
  const imagemUrl = normalizarLinkEvento(valor, "A URL da imagem de divulgação");
  if (!imagemUrl) throw new Error("Informe uma URL válida para a imagem de divulgação.");
  return imagemUrl;
}

export async function publicarDivulgacaoGlobal(imagemBruta: string): Promise<ResultadoDivulgacao> {
  const imagemUrl = normalizarImagemDivulgacao(imagemBruta);
  const { discordGuildId } = getConfig();
  if (!discordGuildId) {
    throw new Error("Defina o DISCORD_GUILD_ID do servidor oficial Hakuryū antes de publicar.");
  }

  const conviteHakuryu = await garantirConviteInfinito(discordGuildId);
  if (!conviteHakuryu) {
    throw new Error("Não foi possível criar ou localizar o convite permanente do Discord Hakuryū.");
  }

  const resultado: ResultadoDivulgacao = { enviados: [], ignorados: [], falhas: [] };
  const canaisUsados = new Set<string>();
  const gangs = await listarGangs();

  for (const gang of gangs) {
    const canalId = (await lerConfigGang(gang.id, CHAVE_CANAL_DIVULGACAO))?.replace(/\D/g, "");
    if (!canalId) {
      resultado.ignorados.push({ gang: gang.nome, motivo: "Canal de divulgação não configurado." });
      continue;
    }
    if (canaisUsados.has(canalId)) {
      resultado.ignorados.push({ gang: gang.nome, motivo: "Canal já utilizado por outra gang." });
      continue;
    }
    canaisUsados.add(canalId);

    const envio = await enviarMensagemParaCanal(canalId, {
      title: "🐉 Divulgação Hakuryū",
      description: montarTextoDivulgacao(conviteHakuryu),
      image: { url: imagemUrl },
      timestamp: new Date().toISOString(),
    });
    if (envio.ok) resultado.enviados.push(gang.nome);
    else resultado.falhas.push({ gang: gang.nome, motivo: envio.motivo });
  }

  return resultado;
}
