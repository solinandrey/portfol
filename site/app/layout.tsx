import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DESCRIPTION, SITE, TITLE } from "@/lib/site";

// Две стороны сайта — два шрифта: Archivo на стороне дизайна (у него есть ось ширины,
// заголовкам становится просторнее от этапа к этапу), JetBrains Mono на стороне кода.
const sans = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  // адрес сайта: от него считаются основной адрес страницы и ссылка на картинку для превью
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // подтверждение владения сайтом для Google Search Console
  verification: { google: "2MzYPagGj9dXDdG-DU_fOKuxhw_umWxI-XP06WYlMPU" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", type: "website", siteName: "Andrey Solin" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
