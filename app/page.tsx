"use client";

import dynamic from "next/dynamic";

export const dynamicParams = true;

// Charge le composant uniquement côté client (pas de SSR/prerender)
// Évite l'erreur "Cannot access 't2' before initialization" au build Vercel
const HomeContent = dynamic(() => import("./HomeContent"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAFAFA] via-white to-[#F5F5F7]">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] mx-auto animate-pulse shadow-lg" />
        <p className="text-[#1d1d1f] text-[14px] font-medium tracking-tight">Cabinet DEC</p>
        <p className="text-[#86868b] text-[11px]">Chargement…</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <HomeContent />;
}
