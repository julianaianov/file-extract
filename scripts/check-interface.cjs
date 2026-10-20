const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");
const { chromium, expect } = require("@playwright/test");
const base = process.argv[2] || "http://127.0.0.1:3000",
  cli = require("./vercel-cli.cjs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  try {
    if (base.startsWith("https:")) {
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "curl",
          "/",
          "--deployment",
          base,
          "--",
          "--silent",
          "--show-error",
          "--header",
          "x-vercel-set-bypass-cookie:true",
          "--cookie-jar",
          ".vercel/ui.cookies",
        ],
        {
          encoding: "utf8",
          timeout: 90000,
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true,
        },
      );
      if (result.status !== 0)
        throw Error("Falha ao autenticar o navegador no preview");
      if (fs.existsSync(".vercel/ui.cookies")) {
        const cookies = fs
          .readFileSync(".vercel/ui.cookies", "utf8")
          .split(/\r?\n/)
          .filter(
            (l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")),
          )
          .map((l) => {
            const httpOnly = l.startsWith("#HttpOnly_"),
              parts = l.replace(/^#HttpOnly_/, "").split("\t");
            return {
              domain: parts[0],
              path: parts[2],
              secure: parts[3] === "TRUE",
              name: parts[5],
              value: parts[6],
              httpOnly,
              ...(Number(parts[4]) > 0 ? { expires: Number(parts[4]) } : {}),
            };
          });
        await context.addCookies(cookies);
      }
    }
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Seus arquivos",
    );
    await expect(
      page.getByRole("button", { name: "Filtrar: Todos os arquivos" }),
    ).toBeVisible();
    await expect(page.locator(".stat-number")).toHaveCount(5, {
      timeout: 30000,
    });
    fs.mkdirSync("artifacts", { recursive: true });
    await page.screenshot({
      path: "artifacts/workspace-desktop.png",
      fullPage: true,
    });
    const fixtures = Array.from({ length: 26 }, (_, i) => ({
      id: i + 1,
      upload_id: 1,
      filename: "Documento " + String(i + 1).padStart(2, "0") + ".pdf",
      file_path: "test/" + i,
      file_type: "text",
      file_size: 2048,
      mime_type: "application/pdf",
      extracted_date: "2026-10-20T12:00:00Z",
      content_text: null,
      transcription: null,
      transcription_status: "not_applicable",
      metadata: null,
      upload_name: "Documentos de teste",
    }));
    const queries = [];
    await page.route("**/api/files?*", async (route) => {
      const u = new URL(route.request().url()),
        action = u.searchParams.get("action");
      if (action === "stats") {
        await route.fulfill({
          json: {
            totalFiles: 26,
            totalUploads: 1,
            textFiles: 26,
            audioFiles: 0,
            imageFiles: 0,
            pendingTranscriptions: 0,
          },
        });
        return;
      }
      if (action === "uploads") {
        await route.fulfill({
          json: [{ id: 1, original_name: "Documentos de teste" }],
        });
        return;
      }
      const keyword = u.searchParams.get("keyword") || "",
        type = u.searchParams.get("fileType");
      if (keyword) queries.push(keyword);
      const files = fixtures.filter(
        (f) =>
          (!keyword ||
            f.filename.toLowerCase().includes(keyword.toLowerCase())) &&
          (!type || f.file_type === type),
      );
      await route.fulfill({ json: { files, total: files.length } });
    });
    await page.route("**/api/files/*", (route) =>
      route.fulfill({
        json: {
          type: "text",
          content: "Conteúdo completo para verificar a pré-visualização.",
        },
      }),
    );
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".file-card")).toHaveCount(12);
    await page.getByRole("button", { name: "Próxima página" }).click();
    await expect(
      page.getByRole("button", { name: "Abrir Documento 13.pdf", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Visualização em lista" }).click();
    await expect(page.locator(".file-grid.list-view")).toBeVisible();
    await page
      .getByRole("button", { name: "Abrir Documento 13.pdf", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Conteúdo completo");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Buscar arquivos", exact: true })
      .fill("Documento 25");
    await expect(page.locator(".file-card")).toHaveCount(1, { timeout: 10000 });
    expect(queries.filter((q) => q === "Documento 25").length).toBe(1);
    await page
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await expect(page.locator(".file-card")).toHaveCount(12);
    await page.getByRole("button", { name: "Filtrar: Textos e PDFs" }).click();
    await expect(
      page.getByRole("button", { name: "Texto e PDF", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("tab", { name: "Busca de contexto" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Encontre a conversa por trás das palavras",
      }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Arquivos/ }).click();
    const input = page.getByLabel("Selecionar arquivo ZIP ou PDF");
    await input.setInputFiles({
      name: "arquivo.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("invalid"),
    });
    await expect(page.locator(".upload-feedback.error")).toContainText(
      "ZIP ou PDF",
    );
    await input.setInputFiles({
      name: "grande.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
    });
    await expect(page.locator(".upload-feedback.error")).toContainText(
      "até 4 MB",
    );
    await page.route("**/api/upload", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        json: { success: true, uploadId: 1, totalFiles: 1 },
      });
    });
    await input.setInputFiles({
      name: "sample.pdf",
      mimeType: "application/pdf",
      buffer: require("./pdf-fixture.cjs").makePdf(),
    });
    await page
      .getByRole("button", { name: "Extrair arquivo", exact: true })
      .click();
    await expect(
      page.getByText("1 arquivo na sua biblioteca.", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Visualização em grade" }).click();
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/workspace-mobile.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".orbit-two")
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeLessThan(0.001);
    expect(errors).toEqual([]);
    console.log(
      "PASS interface: desktop/mobile, sem overflow, grade/lista, paginação, busca com debounce, filtros sincronizados, modal/teclado, validação/envio e redução de movimento",
    );
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
