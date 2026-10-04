import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import AppToaster from "@/components/AppToaster";
import BanGuard from "@/components/BanGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground flex flex-col h-screen overflow-hidden`}
      >
        <Providers>
          <BanGuard />
          {children}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}