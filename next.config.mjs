/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Facilita empacotar a app em imagem Docker usando modo "standalone"
  output: 'standalone',
}

export default nextConfig
