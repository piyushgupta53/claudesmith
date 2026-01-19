import type { Metadata, Viewport } from "next";
import { Outfit, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { StorageProvider } from "@/components/providers/StorageProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NavigationRail } from "@/components/navigation/NavigationRail";
import { KeyboardShortcutsHelp } from "@/components/ui/KeyboardShortcutsHelp";
import { Toaster } from "@/components/ui/toaster";

// Primary sans-serif font - clean, geometric, modern
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});


// Serif font for display text - elegant headlines
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Claudesmith",
    template: "%s | Claudesmith",
  },
  description: "Forge powerful AI agents with Claude. Build, configure, and orchestrate intelligent systems.",
  keywords: ["AI", "agents", "Claude", "automation", "LLM", "orchestration"],
  authors: [{ name: "Claudesmith" }],
  creator: "Claudesmith",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <StorageProvider>
            {/* Main app container */}
            <div className="flex h-screen overflow-hidden bg-background">
              {/* Navigation Rail */}
              <NavigationRail />

              {/* Main content area */}
              <main className="flex-1 overflow-hidden relative">
                {/* Ambient background effects */}
                <div className="absolute inset-0 bg-mesh pointer-events-none opacity-30" />

                {/* Content */}
                <div className="relative h-full overflow-y-auto">
                  {children}
                </div>
              </main>
            </div>

            {/* Global overlays */}
            <KeyboardShortcutsHelp />
            <Toaster />
          </StorageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
