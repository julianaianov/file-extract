const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");
const { chromium, expect } = require("@playwright/test");
expect.configure({timeout:30000});
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
    await page.waitForTimeout(3000);
    console.log("UI entrada:",page.url(),await page.title(),"erros:",JSON.stringify(errors));
    await expect(page.getByRole("dialog")).toContainText("Seus arquivos, em poucos passos");
    await page.getByRole("button", { name: "Etapa 3", exact: true }).click();
    await expect(page.getByRole("dialog").locator("mark")).toHaveText("projeto");
    await page.getByLabel("Experimentar busca no tutorial").fill("amanh");
    await expect(page.getByRole("dialog").locator("mark")).toHaveText("amanh");
    await page.getByRole("button", { name: "Etapa 4", exact: true }).click();
    await page.getByRole("button", { name: /usar/, exact: false }).click();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir tutorial" }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1050 });
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
    fixtures[0] = { ...fixtures[0], filename: "audio-test.wav", file_type: "audio", mime_type: "audio/wav", transcription_status: "pending" };
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
          json: [{ id: 1, original_name: "Documentos de teste",total_files:26,file_size:3000,upload_date:"2026-10-21",status:"completed" },{id:2,original_name:"Outro pacote",total_files:1,file_size:10,upload_date:"2026-10-21",status:"completed"}],
        });
        return;
      }
      expect(u.searchParams.get("uploadId")).toBeTruthy();
      if(u.searchParams.get("uploadId")==="2") { await route.fulfill({json:{files:[{...fixtures[1],id:100,upload_id:2,filename:"Somente outro pacote.txt"}]}});return; }
      const keyword = u.searchParams.get("keyword") || "",
        type = u.searchParams.get("fileType");
      if (keyword) queries.push(keyword);
      const files = fixtures.filter(
        (f) =>
          (!keyword ||
            f.filename.toLowerCase().includes(keyword.toLowerCase())) &&
          (!type || f.file_type === type),
      );
      await route.fulfill({ json: { files: files.map(f => keyword ? { ...f, search_keyword: keyword, search_context: [{ source: "content", lines: [{number: 1, text: "Linha anterior 2", match: false}, {number: 2, text: "Linha anterior 1", match: false}, {number: 3, text: "Encontrado " + keyword, match: true}, {number: 4, text: "Linha posterior 1", match: false}, {number: 5, text: "Linha posterior 2", match: false}] }] } : f), total: files.length } });
    });
    const wav = Buffer.alloc(44 + 16000);
    wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
    await page.route("**/api/files/*", route => new URL(route.request().url()).searchParams.get("action") === "stream" ? route.fulfill({ contentType: "audio/wav", body: wav }) : route.fulfill({ json: { type: "text", content: "Conte\u00fado completo para verificar a pr\u00e9-visualiza\u00e7\u00e3o. Documento 25 encontrado." } }));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".file-card")).toHaveCount(0);
    await page.getByRole("button", {name:/Documentos de teste/}).click();
    await expect(page.locator(".file-card")).toHaveCount(12);
    const player = page.locator("audio").first();
    await expect(player).toHaveAttribute("controls", "");
    await expect(player).toHaveAttribute("preload", "none");
    await player.evaluate(audio => audio.play());
    expect(await player.evaluate(audio => !audio.paused)).toBe(true);
    await player.evaluate(audio => audio.pause());
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
    await expect(page.locator(".search-excerpts mark")).toHaveText("Documento 25");
    await page.getByRole("button", { name: "Abrir Documento 25.pdf", exact: true }).click();
    await expect(page.getByRole("dialog").locator("mark")).toHaveText("Documento 25");
    await page.keyboard.press("Escape");
    await expect(page.locator(".search-excerpts")).toContainText("Linha anterior 2");
    await expect(page.locator(".search-excerpts")).toContainText("Linha posterior 2");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1050 });
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
    const input = page.getByLabel("Selecionar arquivo");
    await input.setInputFiles({
      name: "arquivo.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("invalid"),
    });
    await expect(page.getByRole("button",{name:"Extrair arquivo",exact:true})).toBeVisible();
    fs.writeFileSync("artifacts/oversized.pdf",Buffer.alloc(250 * 1024 * 1024 + 1));
    await input.setInputFiles(path.resolve("artifacts/oversized.pdf"));
    await expect(page.locator(".upload-feedback.error")).toContainText(
      "até 250 MB",
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
    await page.getByRole("button",{name:/Todos os envios/}).click();
    await expect(page.locator(".file-card")).toHaveCount(0);
    await page.getByRole("button",{name:/Outro pacote/}).click();
    await expect(page.locator(".file-card")).toHaveCount(1);
    await expect(page.getByRole("button",{name:"Abrir Somente outro pacote.txt",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Abrir Documento 02.pdf",exact:true})).toHaveCount(0);
    await page.getByRole("textbox",{name:"Buscar arquivos",exact:true}).fill("outro");
    await page.waitForTimeout(500);
    await page.getByRole("button",{name:"Limpar filtros",exact:true}).click();
    await expect(page.getByText("Mostrando somente este envio")).toBeVisible();
    await expect(page.locator(".file-card")).toHaveCount(1);
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
    const sitemap = await context.request.get(base + "/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/guias/extrair-texto-pdf-online");
    const guide = await context.request.get(base + "/guias/extrair-texto-pdf-online");
    expect(guide.status()).toBe(200);
    expect(await guide.text()).toContain("Como extrair texto de PDF online");
    expect(await guide.text()).toContain('rel="canonical"');
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
