import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadImagemR2 } from "@/lib/midia.functions";
import type { PastaR2 } from "@/lib/r2.server";

const DIMENSAO_MAXIMA = 2400;
const TAMANHO_MAXIMO_ORIGINAL = 12 * 1024 * 1024;

async function arquivoOtimizado(arquivo: File) {
  if (!arquivo.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem válido.");
  if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
    throw new Error("Selecione uma imagem de até 12 MB antes da otimização.");
  }

  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, DIMENSAO_MAXIMA / bitmap.width, DIMENSAO_MAXIMA / bitmap.height);
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a imagem.");
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((resultado) => {
      if (resultado) resolve(resultado);
      else reject(new Error("Não foi possível otimizar a imagem."));
    }, "image/webp", 0.88);
  });
  const nome = arquivo.name.replace(/\.[a-z0-9]+$/i, "") || "imagem";
  return new File([blob], `${nome}.webp`, { type: "image/webp" });
}

async function conteudoBase64(arquivo: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => resolve(String(leitor.result));
    leitor.readAsDataURL(arquivo);
  });
  return dataUrl.split(",", 2)[1] ?? "";
}

export function CampoImagemR2({
  id,
  label,
  pasta,
  finalidade,
  value,
  onChange,
  descricao = "A imagem será convertida para WebP e limitada a 2400 px por lado.",
}: {
  id: string;
  label: string;
  pasta: PastaR2;
  finalidade?: "administrativo" | "recrutamento" | "explorador";
  value: string;
  onChange: (url: string) => void;
  descricao?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionar(arquivo: File | null) {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const otimizado = await arquivoOtimizado(arquivo);
      const resultado = await uploadImagemR2({
        data: {
          pasta,
          ...(finalidade ? { finalidade } : {}),
          nomeArquivo: otimizado.name,
          tipo: otimizado.type,
          conteudoBase64: await conteudoBase64(otimizado),
        },
      });
      onChange(resultado.url);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/30">
          <img src={value} alt="Prévia da imagem selecionada" className="aspect-[7/3] w-full object-cover" />
        </div>
      ) : null}
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => void selecionar(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" disabled={enviando} onClick={() => input.current?.click()}>
        {enviando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {enviando ? "Enviando imagem..." : value ? "Substituir imagem" : "Selecionar imagem"}
      </Button>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
    </div>
  );
}
