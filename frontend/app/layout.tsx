import type { Metadata } from "next";
import "./globals.css";
import { HospitalProvider } from "@/context/HospitalContext";
import { HeaderNav } from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "CareMatrix | Neobrutalist Healthcare Coordination & Surge Network",
  description: "Real-time Patient Transfer, ML Surge Prediction, and Resource Exchange Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light h-full" style={{ colorScheme: "light" }}>
      <body className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--paper-alt)] text-[var(--ink)] antialiased select-none">
        <HospitalProvider>
          <HeaderNav />
          <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-4 overflow-hidden flex flex-col">
            {children}
          </main>
        </HospitalProvider>
      </body>
    </html>
  );
}
