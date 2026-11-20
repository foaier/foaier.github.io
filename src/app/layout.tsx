import type { Metadata } from "next";
import "./globals.css";
import "./reading.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Foaier · 个人技术博客",
    template: "%s | Foaier",
  },
  description: "Foaier 的个人技术博客，用人话聊 AI、知识库、Agent 与后端工程，记录学习和实践。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "Foaier · 个人技术博客",
    title: "Foaier · 个人技术博客",
    description: "用人话聊 AI、知识库、Agent 与后端工程，记录学习和实践。",
    url: siteUrl,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
