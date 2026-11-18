import type { Metadata } from "next";
import "./globals.css";
import { Outfit, Playfair_Display } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sangeetsarathi.com"),
  title: "Sangeet Sarathi | Premium Musical Instruments",
  description: "Discover the finest musical instruments at Sangeet Sarathi, Palakkad.",
  openGraph: {
    siteName: "Sangeet Sarathi",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${playfair.variable}`}>
        {children}
      </body>
    </html>
  );
}
