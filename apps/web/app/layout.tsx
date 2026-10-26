import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import HelpChat from "@/components/help-chat";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "MachineMind AI — Technical Manual Assistant",
  description: "Ask questions about your machine manuals using AI-powered RAG technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${grotesk.variable} ${mono.variable} font-sans bg-bg text-ink min-h-screen antialiased`}
      >
        <AuthProvider>
          {children}
          <HelpChat />
        </AuthProvider>
      </body>
    </html>
  );
}
