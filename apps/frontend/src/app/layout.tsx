import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "GrowEasy CRM - AI CSV Importer",
  description: "AI-Powered CSV Importer for GrowEasy CRM with dynamic column mapping and real-time streaming progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
