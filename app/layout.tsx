import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopFlow — متابعة ميزانية المحل",
  description: "نظام متابعة ميزانية وحركة أموال المحل لحظياً",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#173B35",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}