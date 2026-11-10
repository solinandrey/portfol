import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Две стороны сайта — два шрифта: Archivo на стороне дизайна (у него есть ось ширины,
// заголовкам становится просторнее от этапа к этапу), JetBrains Mono на стороне кода.
const sans = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  // адрес сайта: от него считаются ссылки на картинку для превью
  metadataBase: new URL("https://andreysol.in"),
  title: "Andrey Solin — Product designer",
  description: "Product designer. Before that, about eight years of frontend.",
  openGraph: { title: "Andrey Solin — Product designer", description: "Product designer. Before that, about eight years of frontend.", url: "/", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
