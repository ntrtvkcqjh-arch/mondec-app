"use client";

import { useGameStore } from "@/lib/supabase-store";
import { Sparkles, Building2, Briefcase, X, Check } from "lucide-react";

interface Props {
  onClose: () => void;
}

/**
 * Choix de scénario à l'arrivée dans le cabinet OU rejoué via le bouton
 * « Nouvelle partie » dans la sidebar.
 *
 *  - "Cabinet de zéro" : équipe vide, 50k€ de fonds, légitimité 30/100, à
 *    construire petit à petit en recrutant via les CVs (saisonniers + cascade).
 *  - "Cabinet prêt à jouer" : état seedé classique (5 collaborateurs, dossiers,
 *    145k€ de trésorerie, légitimité 72/100).
 *
 * Quand le joueur a DÉJÀ commencé une partie, on demande confirmation avant
 * d'écraser l'état actuel (déclenche un reset complet si change vraiment de mode).
 */
export function StartModeModal({ onClose }: Props) {
  const store = useGameStore();
  const alreadyPlaying = store.start_mode_chosen;
  const currentMode = store.start_mode;

  function choose(mode: "zero" | "ready") {
    // Si rien n'a encore été choisi, on applique directement
    if (!alreadyPlaying) {
      store.setStartMode(mode);
      onClose();
      return;
    }
    // Sinon, demande confirmation car ça va écraser la partie en cours
    if (mode === currentMode) {
      // Même mode : on ne fait rien (juste ferme)
      onClose();
      return;
    }
    const ok = confirm(
      `⚠️ Changer de scénario va RÉINITIALISER ta partie actuelle.\n\n` +
      `Tu vas perdre :\n` +
      `  • Tous tes dossiers et clients\n` +
      `  • Tous tes salariés et leurs états\n` +
      `  • Tes messages, mails, corrections\n\n` +
      `Continuer vers "${mode === "zero" ? "Cabinet de zéro (équipe vide)" : "Cabinet prêt à jouer (équipe seedée)"}" ?`
    );
    if (!ok) return;
    // Marque le mode visé dans localStorage AVANT le reset, pour que loadGameState
    // après le reload applique le bon scénario.
    try {
      if (mode === "zero") localStorage.setItem("start_mode", "zero");
      else localStorage.removeItem("start_mode");
    } catch {}
    store.resetGame();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-[820px] w-full bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl overflow-hidden relative">
        {/* Bouton fermer — visible UNIQUEMENT si le joueur a déjà choisi un scénario */}
        {alreadyPlaying && (
          <button
            onClick={onClose}
            title="Fermer sans changer"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e] hover:bg-[#E5E5EA] dark:hover:bg-[#3a3a3c] flex items-center justify-center transition-all z-10"
          >
            <X size={14} className="text-[#86868B] dark:text-[#a0a0a5]" />
          </button>
        )}

        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#007AFF]/10 to-[#5856D6]/10 text-[#007AFF] dark:text-[#0A84FF] text-[11px] font-semibold uppercase tracking-wider mb-3">
            <Sparkles size={12} /> {alreadyPlaying ? "Changer de scénario" : "Choix de scénario"}
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] dark:text-white mb-2">
            {alreadyPlaying ? "Nouvelle partie" : "Bienvenue au Cabinet"}
          </h1>
          <p className="text-[14px] text-[#86868B] dark:text-[#98989D] max-w-[540px] mx-auto">
            {alreadyPlaying
              ? "Choisis le scénario sur lequel tu veux rejouer. Attention : changer écrase la partie en cours."
              : "Comment veux-tu démarrer ta partie ?"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {/* OPTION 1 — Cabinet de zéro */}
          <button
            onClick={() => choose("zero")}
            className={`text-left bg-gradient-to-br from-[#FAFAFB] to-white dark:from-[#2c2c2e] dark:to-[#1c1c1e] border-2 rounded-[16px] p-6 hover:shadow-lg transition-all group relative ${
              currentMode === "zero" ? "border-[#FF9500] ring-2 ring-[#FF9500]/20" : "border-[#E5E5EA] dark:border-[#3a3a3c] hover:border-[#FF9500]"
            }`}
          >
            {currentMode === "zero" && (
              <span className="absolute top-3 right-3 text-[9px] font-bold bg-[#FF9500] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check size={9} /> EN COURS
              </span>
            )}
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
              <li>💰 <strong>500 000 €</strong> de fonds de roulement</li>
              <li>👤 <strong>Aucun collaborateur</strong> — c'est toi tout seul</li>
              <li>📋 Aucun dossier client au départ</li>
              <li>📨 <strong>20 CV</strong> spontanés à étudier dans RH (5 comptables, 4 fiscaux, 4 audit, 3 paie, 4 RH)</li>
              <li>📉 Légitimité 30/100 · Réputation 25/100 (à construire)</li>
            </ul>
            <div className="text-[11px] italic text-[#FF9500] dark:text-[#FF9F0A]">
              Recommandé pour : apprendre la gestion RH et la stratégie de recrutement. Budget suffisant pour 4-6 recrutements.
            </div>
          </button>

          {/* OPTION 2 — Cabinet prêt */}
          <button
            onClick={() => choose("ready")}
            className={`text-left bg-gradient-to-br from-[#FAFAFB] to-white dark:from-[#2c2c2e] dark:to-[#1c1c1e] border-2 rounded-[16px] p-6 hover:shadow-lg transition-all group relative ${
              currentMode === "ready" ? "border-[#34C759] ring-2 ring-[#34C759]/20" : "border-[#E5E5EA] dark:border-[#3a3a3c] hover:border-[#34C759]"
            }`}
          >
            {currentMode === "ready" && (
              <span className="absolute top-3 right-3 text-[9px] font-bold bg-[#34C759] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check size={9} /> EN COURS
              </span>
            )}
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
