import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Sheet mobile", () => {
  it("mantém o conteúdo do drawer acima de um overlay atenuado", async () => {
    const sheet = await readFile(new URL("../components/ui/sheet.tsx", import.meta.url), "utf8");
    const dashboardShell = await readFile(
      new URL("../components/hakuryu/DashboardShell.tsx", import.meta.url),
      "utf8",
    );

    expect(sheet).toContain("z-40 bg-black/35");
    expect(sheet).toContain("fixed z-50 gap-4");
    expect(sheet).toMatch(/<SheetOverlay\s*\/>\s*<SheetPrimitive\.Content/s);
    expect(sheet).toContain("data-[state=open]:fade-in-0");
    expect(dashboardShell).toContain("z-50 w-[88vw] max-w-sm overflow-y-auto");
    const drawerAberto = dashboardShell.match(
      /<Sheet open=\{open\} onOpenChange=\{setOpen\}>[\s\S]*?<\/Sheet>/,
    )?.[0];
    const corpoNavegacao = dashboardShell.slice(
      0,
      dashboardShell.indexOf("function DashboardShell"),
    );

    expect(drawerAberto).toContain("<SheetContent");
    expect(drawerAberto).toContain("<SidebarBody");
    expect(drawerAberto).toContain("onNavigate={() => setOpen(false)}");
    expect(corpoNavegacao).toContain("Visão Geral");
    expect(corpoNavegacao).toContain("Configurações");
    expect(dashboardShell).toContain('get("previewDrawer") === "open"');
    expect(dashboardShell).toContain("import.meta.env.DEV");
    expect(dashboardShell).not.toContain("relative w-[85vw] max-w-xs");
  });
});
