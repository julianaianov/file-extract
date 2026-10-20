/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg", "pdf-parse", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/ocr": [
      "./lib/tesseract-worker.js",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js/node_modules/**/*",
      "./node_modules/tesseract.js-core/**/*",
      ...["bmp-js","idb-keyval","is-electron","is-url","node-fetch","regenerator-runtime","wasm-feature-detect","zlibjs","whatwg-url","tr46","webidl-conversions"].map(name => "./node_modules/" + name + "/**/*"),
    ],
  },
  images: { unoptimized: true },
  output: "standalone",
};
export default nextConfig;
