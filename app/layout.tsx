import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f97316",
};

const SITE_URL = "https://firechecklist.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FireCheck",
  description: "Segurança que se confere",
  applicationName: "FireCheck",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "FireCheck",
    title: "FireCheck",
    description: "Segurança que se confere",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FireCheck — Segurança que se confere",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FireCheck",
    description: "Segurança que se confere",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${plusJakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--mist)] font-[family-name:var(--font-body)]">
        {children}
      </body>
    </html>
  );
}
