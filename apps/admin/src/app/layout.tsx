import type { Metadata } from "next";
import { tokensToCssVariables } from "@xolt/ui-tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xolt Admin",
  description: "Xolt internal admin dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Single source of truth: @xolt/ui-tokens, rendered to :root CSS variables. */}
        <style>{`:root {\n  ${tokensToCssVariables()}\n}`}</style>
        {children}
      </body>
    </html>
  );
}
