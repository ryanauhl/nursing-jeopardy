import type { Metadata } from "next";
import { Anton, Oswald } from "next/font/google";
import "./globals.css";

// Anton stands in for Swiss 911 Ultra Compressed (the dollar values); Oswald
// carries categories and clue text. Both are self-hosted by next/font, so the
// board still renders correctly with the wifi down.
const anton = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const oswald = Oswald({
  variable: "--font-board",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trivia Board",
  description: "A local trivia board for game night.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
