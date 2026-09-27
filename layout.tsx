// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import IdleLogoutGuard from "@/components/IdleLogoutGuard";

export const metadata = {
  title: "MindShift Clinical Companion",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* ClerkProvider goes inside <body>. */}
        <ClerkProvider>
          <IdleLogoutGuard />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
