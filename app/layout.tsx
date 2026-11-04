import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;
  const title = "今天吃什么｜把午餐交给一点运气";
  const description = "不知道吃什么？随机一道，看看有没有灵感。";

  return {
    title,
    description,
    metadataBase: origin ? new URL(origin) : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: origin ? [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "今天吃什么" }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: origin ? [`${origin}/og.png`] : undefined,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

