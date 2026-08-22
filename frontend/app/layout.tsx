import type { Metadata } from "next";
import "./globals.css";
import { HospitalProvider } from "@/context/HospitalContext";
import { HeaderNav } from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "CareMatrix | Clinical Operations & Healthcare Coordination Mesh",
  description: "Real-time Patient Transfer, ML Surge Forecasting, and Regional Resource Exchange Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light h-full" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--paper-alt)] text-[var(--ink)] antialiased select-none" suppressHydrationWarning>
        <HospitalProvider>
          <HeaderNav />
          <main className="flex-1 w-full max-w-7xl mx-auto p-2.5 md:p-4 overflow-hidden flex flex-col min-h-0">
            {children}
          </main>
        </HospitalProvider>
      </body>
    </html>
  );
}
