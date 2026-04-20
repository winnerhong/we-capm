import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DevNav } from "@/components/dev-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://we-capm.vercel.app"
  ),
  title: {
    default: "토리로 TORIRO - 숲에서 자라는 가족의 시간",
    template: "%s | 토리로",
  },
  description:
    "작은 도토리 하나가 숲으로 가는 길이 됩니다. 가족과 아이가 함께하는 자연 체험 플랫폼.",
  keywords: ["가족 체험", "숲 체험", "아이 놀이", "자연 교육", "스탬프 랠리", "ESG"],
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "토리로",
    title: "토리로 - 숲에서 자라는 가족의 시간",
    description: "작은 도토리 하나가 숲으로 가는 길이 됩니다",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "토리로 TORIRO",
    description: "숲에서 자라는 가족의 시간",
  },
  other: { "theme-color": "#2D5A3D" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        {process.env.NODE_ENV === "development" && <DevNav />}
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){
              if(location.hostname==='localhost'){
                navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})});
              } else {
                navigator.serviceWorker.register('/sw.js');
              }
            }`,
          }}
        />
      </body>
    </html>
  );
}
