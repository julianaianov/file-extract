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

    await context.addInitScript(() => localStorage.setItem("file-extract:guide:v1","seen"));
    let enabled=false;
    await context.route("**/api/auth/providers",route=>route.fulfill({json:{google:enabled}}));
    await context.route("**/api/billing",route=>route.fulfill({json:{enabled:true,testMode:true,loggedIn:false,freeAvailable:true,tokens:0,tokenCost:1,canManage:false,offers:[]}}));
    const page=await context.newPage();
    await page.goto(base,{waitUntil:"networkidle",timeout:120000});
    await page.getByRole("button",{name:"Entrar / Planos",exact:true}).click();
    await expect(page.getByRole("button",{name:"Entrar com Google",exact:true})).toBeDisabled();
    await expect(page.getByRole("dialog")).toContainText("Login com Google em configura\u00e7\u00e3o");
    enabled=true;await page.reload({waitUntil:"networkidle"});
    await page.getByRole("button",{name:"Entrar / Planos",exact:true}).click();
    const button=page.getByRole("button",{name:"Entrar com Google",exact:true});await expect(button).toBeEnabled();
    await page.route("**/auth/v1/authorize?**",route=>route.fulfill({contentType:"text/html",body:"<p>OAuth flow intercepted for verification</p>"}));
    const pending=page.waitForRequest(request=>request.url().includes("/auth/v1/authorize?"));
    await button.click();const authorization=new URL((await pending).url());
    expect(authorization.searchParams.get("provider")).toBe("google");
    expect(authorization.searchParams.get("redirect_to")).toBe(new URL(base).origin+"/auth/callback");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("s256");
    expect(authorization.searchParams.get("code_challenge").length).toBeGreaterThan(20);
    expect((await context.cookies(base)).some(cookie=>cookie.name.includes("code-verifier"))).toBe(true);
    await page.goto(base+"/?auth=error",{waitUntil:"networkidle"});
    await expect(page.getByRole("dialog")).toContainText("N\u00e3o foi poss\u00edvel concluir o login");
    const callback=await context.request.get(base+"/auth/callback?error=access_denied&error_description=test",{maxRedirects:0});
    expect(callback.status()).toBe(303);
    expect(callback.headers()["location"]).toBe(new URL(base).origin+"/?auth=error");
    expect(callback.headers()["cache-control"]).toContain("no-store");
    console.log("PASS Google: provedor desativado, botao habilitado, OAuth PKCE, retorno correto e cancelamento seguro; login real requer habilitacao externa");
  } finally { await context.close();await browser.close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1});
