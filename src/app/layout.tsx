import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Redditok",
  description: "TikTok-style scroller for subreddit videos"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}

