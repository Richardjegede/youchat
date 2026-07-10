import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouChat - The African Student Super App",
  description:
    "Connect, learn, buy, sell, and grow with students across Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Font classes MUST be on the body tag, not the html tag! */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-black text-white antialiased`}
      >
        <Navbar />

        {/* Main content area with padding for the fixed navbar */}
        <main className="flex-grow pt-20">{children}</main>
      </body>
    </html>
  );
}
