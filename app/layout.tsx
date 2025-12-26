import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chillaxBold = localFont({
  src: "./fonts/Chillax-Bold.ttf",
  variable: "--font-chillax-bold",
  weight: "700",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "İnanç Sözlük",
  description: "İnanç Sözlük",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${chillaxBold.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
