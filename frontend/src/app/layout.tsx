import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Smart City — Your virtual city, always on",
  description:
    "A virtual smart city platform: discover nearby services, request help, and get matched with an autonomous agent or a human in seconds.",
  themeColor: "#2563eb",
  icons: [{ rel: "icon", url: "/favicon.svg" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <Toaster>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </Toaster>
        </ThemeProvider>
      </body>
    </html>
  );
}
