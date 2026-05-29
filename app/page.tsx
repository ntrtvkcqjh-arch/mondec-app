"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import HomeContent from "./HomeContent";

export default function Page() {
  // Guard de montage : on attend que le client soit hydraté avant de render
  // l'arbre complet. Évite les erreurs TDZ liées au bundling Next.js.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAFAFA] via-white to-[#F5F5F7]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] mx-auto animate-pulse shadow-lg" />
          <p className="text-[#1d1d1f] text-[14px] font-medium tracking-tight">Cabinet DEC</p>
          <p className="text-[#86868b] text-[11px]">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}
