import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Foaier · 个人技术博客",
    template: "%s | Foaier",
  },
  description: "Foaier 的个人技术博客，记录企业系统、后端工程、数据迁移与平台建设实践。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "Foaier · 个人技术博客",
    title: "Foaier · 个人技术博客",
    description: "记录企业系统、后端工程、数据迁移与平台建设实践。",
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
