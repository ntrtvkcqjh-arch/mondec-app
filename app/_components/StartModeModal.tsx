"use client";

import { useGameStore } from "@/lib/supabase-store";
import { Sparkles, Building2, Briefcase } from "lucide-react";

interface Props {
  onClose: () => void;
}

/**
 * Choix de scénario à l'arrivée dans le cabinet. Affiché 1x au premier
 * démarrage, après la saisie de la clé API.
 *
 *  - "Cabinet de zéro" : équipe vide, 50k€ de fonds, légitimité 30/100, à
 *    construire petit à petit en recrutant via les CVs (saisonniers + cascade).
 *  - "Cabinet prêt à jouer" : état seedé classique (5 collaborateurs, dossiers,
 *    145k€ de trésorerie, légitimité 72/100).
 */
export function StartModeModal({ onClose }: Props) {
  const store = useGameStore();

  function choose(mode: "zero" | "ready") {
    store.setStartMode(mode);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-[820px] w-full bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#007AFF]/10 to-[#5856D6]/10 text-[#007AFF] dark:text-[#0A84FF] text-[11px] font-semibold uppercase tracking-wider mb-3">
            <Sparkles size={12} /> Choix de scénario
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] dark:text-white mb-2">
            Bienvenue au Cabinet
          </h1>
          <p className="text-[14px] text-[#86868B] dark:text-[#98989D] max-w-[540px] mx-auto">
            Comment veux-tu démarrer ta partie ? Tu peux changer plus tard via le bouton « Réinitialiser le jeu ».
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {/* OPTION 1 — Cabinet de zéro */}
          <button
            onClick={() => choose("zero")}
            className="text-left bg-gradient-to-br from-[#FAFAFB] to-white dark:from-[#2c2c2e] dark:to-[#1c1c1e] border-2 border-[#E5E5EA] dark:border-[#3a3a3c] rounded-[16px] p-6 hover:border-[#007AFF] hover:shadow-lg transition-all group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#FF9500] to-[#FF3B30] flex items-center justify-center text-white shadow-md">
                <Building2 size={24} />
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-bold text-[#1D1D1F] dark:text-white">Cabinet de zéro</div>
                <div className="text-[11px] text-[#86868B] dark:text-[#98989D]">Mode défi · construis ton équipe</div>
              </div>
            </div>
            <ul className="text-[12px] text-[#3a3a3c] dark:text-[#d1d1d6] space-y-1.5 mb-4">
              <li>💰 <strong>50 000 €</strong> de fonds de roulement</li>
              <li>👤 <strong>Aucun collaborateur</strong> — c'est toi tout seul</li>
              <li>📋 Aucun dossier client au départ</li>
              <li>📨 <strong>6 CV</strong> spontanés à étudier dans RH</li>
              <li>📉 Légitimité 30/100 · Réputation 25/100 (à construire)</li>
            </ul>
            <div className="text-[11px] italic text-[#FF9500] dark:text-[#FF9F0A]">
              Recommandé pour : apprendre la gestion RH et la stratégie de recrutement.
            </div>
          </button>

          {/* OPTION 2 — Cabinet prêt */}
          <button
            onClick={() => choose("ready")}
            className="text-left bg-gradient-to-br from-[#FAFAFB] to-white dark:from-[#2c2c2e] dark:to-[#1c1c1e] border-2 border-[#E5E5EA] dark:border-[#3a3a3c] rounded-[16px] p-6 hover:border-[#34C759] hover:shadow-lg transition-all group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#34C759] to-[#007AFF] flex items-center justify-center text-white shadow-md">
                <Briefcase size={24} />
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-bold text-[#1D1D1F] dark:text-white">Cabinet prêt à jouer</div>
                <div className="text-[11px] text-[#86868B] dark:text-[#98989D]">Mode classique · démarre la simulation</div>
              </div>
            </div>
            <ul className="text-[12px] text-[#3a3a3c] dark:text-[#d1d1d6] space-y-1.5 mb-4">
              <li>💰 <strong>145 000 €</strong> de trésorerie</li>
              <li>👥 <strong>5 collaborateurs</strong> seedés (managers, stagiaires, RH)</li>
              <li>📂 <strong>25-30 dossiers actifs</strong> répartis par filière</li>
              <li>🎯 Légitimité 72/100 · Réputation 68/100</li>
              <li>⚡ Boss Fight Bilan 30/06/2026 en cours</li>
            </ul>
            <div className="text-[11px] italic text-[#34C759] dark:text-[#30D158]">
              Recommandé pour : se concentrer sur la pratique technique DEC.
            </div>
          </button>
        </div>

        <div className="px-8 py-4 bg-[#F2F2F7] dark:bg-[#2c2c2e] text-center">
          <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">
            Quel que soit ton choix, <strong>la partie ne s'arrête jamais</strong>. Même si tous tes salariés partent, de nouveaux CV arrivent et tu reconstruis.
          </p>
        </div>
      </div>
    </div>
  );
}
