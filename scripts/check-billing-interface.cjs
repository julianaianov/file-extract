const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect=baseExpect.configure({timeout:30000});
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

    await context.addInitScript(()=>localStorage.setItem("file-extract:guide:v1","seen"));
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    let available=false,admin=false,read=false;
    await page.route("**/api/billing",route=>route.fulfill({json:{enabled:true,isAdmin:admin,testMode:false,paymentsAvailable:available,email:"teste@example.invalid",loggedIn:true,freeAvailable:true,tokens:0,tokenCost:1,canManage:false,offers:[{kind:"tokens",tokens:20,amount:1490,currency:"brl"},{kind:"subscription",tokens:100,amount:2990,currency:"brl",interval:"month"}]}}));
    await page.route("**/api/auth/providers",route=>route.fulfill({json:{google:true}}));
    await page.goto(base,{waitUntil:"networkidle",timeout:120000});
    await page.getByRole("button",{name:"0 tokens",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await expect(dialog).toContainText("Pagamentos temporariamente indisponíveis");
    await expect(dialog.getByRole("button",{name:/Comprar tokens/})).toBeDisabled();
    await expect(dialog.getByRole("button",{name:/Assinar/})).toBeDisabled();
    await expect(dialog.getByText(/Modo de teste/)).toHaveCount(0);
    available=true;await page.evaluate(()=>window.dispatchEvent(new Event("billing-updated")));
    await expect(dialog.getByRole("button",{name:/Comprar tokens/})).toBeEnabled();
    await expect(dialog.getByRole("button",{name:/Assinar/})).toBeEnabled();
    await expect(dialog.getByText(/Pagamentos temporariamente indisponíveis/)).toHaveCount(0);
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await page.route("**/api/admin/notifications",async route=>{
     if(route.request().method()==="POST"){read=true;await route.fulfill({json:{success:true}});return;}
     await route.fulfill({json:{unread:read?0:1,notifications:[{id:1,kind:"user.created",created_at:"2026-10-21T12:00:00Z",read_at:read?"2026-10-21T12:01:00Z":null,payload:{email:"novo@example.invalid"}}]}});
    });
    admin=true;await page.evaluate(()=>window.dispatchEvent(new Event("billing-updated")));
    await expect(page.getByRole("button",{name:"Administrador",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Administrador",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("sem cobrança por extração");
    await expect(page.getByRole("dialog").getByRole("button",{name:/Comprar tokens/})).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:/Notificações administrativas/}).click();
    await expect(page.getByRole("dialog")).toContainText("novo@example.invalid");
    await page.getByRole("button",{name:"Marcar todas como lidas",exact:true}).click();
    await expect(page.getByRole("button",{name:"Marcar todas como lidas",exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    console.log("PASS: interface de produção bloqueia compras enquanto a Stripe está indisponível e libera após atualização, sem banner de teste e sem overflow mobile");
  }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
