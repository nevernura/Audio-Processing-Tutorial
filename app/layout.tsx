import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio Signal Lab",
  description: "Interactive audio tutorial with upload spectrograms and synced sound galleries.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
