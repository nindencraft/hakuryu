import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "hakuryu-theme";

type Theme = "light" | "dark";

function aplicarTema(tema: Theme) {
  document.documentElement.classList.toggle("dark", tema === "dark");
  document.documentElement.style.colorScheme = tema;
}

function temaInicial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const salvo = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (salvo === "dark" || salvo === "light") return salvo;
  } catch {
    // O modo visual continua funcionando mesmo quando o storage está bloqueado.
  }
  return "light";
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Theme>("light");

  useEffect(() => {
    const atual = temaInicial();
    aplicarTema(atual);
    setTema(atual);
  }, []);

  function alternarTema() {
    const proximo: Theme = tema === "dark" ? "light" : "dark";
    aplicarTema(proximo);
    setTema(proximo);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, proximo);
    } catch {
      // A alternância atual continua válida mesmo sem persistência disponível.
    }
  }

  const escuro = tema === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={alternarTema}
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={escuro}
      title={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      className="fixed right-4 bottom-4 z-[60] rounded-full border-primary/45 bg-background/90 shadow-[var(--shadow-gold)] backdrop-blur-md transition-transform hover:-translate-y-0.5"
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
