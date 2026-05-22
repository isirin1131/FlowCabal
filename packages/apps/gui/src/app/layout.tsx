import type { Metadata } from "next";
import { Source_Serif_4, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FlowCabal",
  description: "FlowCabal — AI 辅助小说创作工作流",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`h-full ${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="h-full flex flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
