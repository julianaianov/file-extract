const path = require("path"),
  os = require("os");
module.exports =
  process.platform === "win32"
    ? path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "npm",
        "node_modules",
        "vercel",
        "dist",
        "index.js",
      )
    : require.resolve("vercel/dist/index.js");
