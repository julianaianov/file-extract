import React from "react";
import { siteUrl, siteDescription, siteName } from "@/lib/site";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Extrair ZIP e texto de PDF online | File Extract", template: "%s | File Extract" },
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: siteUrl },
  robots: { index: process.env.VERCEL_ENV !== "preview", follow: true },
  openGraph: { title: "Extrair ZIP e texto de PDF online", description: siteDescription, url: siteUrl, siteName, locale: "pt_BR", type: "website" },
  twitter: { card: "summary_large_image", title: "Extrair ZIP e texto de PDF online", description: siteDescription },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`font-sans antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: siteName, url: siteUrl, description: siteDescription, applicationCategory: "UtilitiesApplication", operatingSystem: "Web", inLanguage: "pt-BR", featureList: ["Extração de arquivos ZIP", "Extração de texto de PDF", "Busca de palavras com contexto", "OCR de imagens", "Reprodução de áudio"] }).replace(/</g, "\\u003c") }} />
        {children}
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}
