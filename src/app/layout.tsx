import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "./Nav";
import { AuthProvider, SignedIn } from "@/components/Editing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golf tracker",
  description: "My golf rounds, scorecards and stats",
  appleWebApp: { title: "Golf", capable: true },
  // Private: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the phone tab bar sit clear of the iPhone home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e121a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className={`${geistSans.variable} antialiased`}>
        <AuthProvider>
          <Nav />
          <SignedIn>{children}</SignedIn>
        </AuthProvider>
      </body>
    </html>
  );
}
