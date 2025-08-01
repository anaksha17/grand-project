import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mental Health Tracker",
  description: "Track your moods and get AI-driven insights for mental well-being",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body className="font-geist-sans antialiased">
        {children}
        <Script
          src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}