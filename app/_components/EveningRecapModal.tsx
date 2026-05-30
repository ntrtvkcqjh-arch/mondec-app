"use client";

import { useGameStore } from "@/lib/supabase-store";
import { X, Sunset, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";

interface Props {
  onClose: () => void;
}

/**
 * Récap fin de journée : s'ouvre à 18h (game-time) une seule fois par game_day.
 * Symétrique du briefing matinal. Donne le bilan de la journée + prévisions demain.
 */
export function EveningRecapModal({ onClose }: Props) {
  const store = useGameStore();

  // Date d'aujourd'hui (game)
  const today = new Date(2026, 4, 14);
  today.setDate(today.getDate() + store.game_day - 1);
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // Métriques de la journée
  const tempsUtilise = (store.temps_disponible_max ?? 480) - (store.temps_disponible_min ?? 480);
  const tempsUtiliseStr = `${Math.floor(tempsUtilise / 60)}h${String(tempsUtilise % 60).padStart(2, "0")}`;
  const heuresSupCumul = store.heures_sup_cumul ?? 0;
  const messagesNonLus = store.messages.filter((m) => !m.lu).length;
  const messagesTraitesAuj = store.messages.filter((m) => m.repondu).length;
  const dossiersEnCours = store.dossiers.filter((d) => d.etat === "en_cours").length;
  const dossiersAvance = store.dossiers.filter((d) => d.etat === "avance").length;
  const dossiersPerdus = store.dossiers.filter((d) => d.etat === "perdu").length;
  const dossiersSurveillance = store.dossiers.filter((d) => d.etat === "surveillance").length;

  // Équipe
  const stressMoyen = store.agents.length > 0
    ? Math.round(store.agents.reduce((s, a) => s + a.stress, 0) / store.agents.length)
    : 0;
  const agentsAlerte = store.agents.filter((a) => a.stress > 70 || a.fatigue > 70).length;
  const agentsRupture = store.agents.filter((a: any) => a.arc_actuel === "Rupture").length;

  // Prévisions demain (game_day + 1)
  const previsions: string[] = [];
  if (messagesNonLus > 0) previsions.push(`${messagesNonLus} message${messagesNonLus > 1 ? "s" : ""} non lu${messagesNonLus > 1 ? "s" : ""} à traiter`);
  if (agentsRupture > 0) previsions.push(`${agentsRupture} agent${agentsRupture > 1 ? "s" : ""} risque${agentsRupture > 1 ? "nt" : ""} de partir`);
  if (dossiersSurveillance > 0) previsions.push(`${dossiersSurveillance} dossier${dossiersSurveillance > 1 ? "s" : ""} sous surveillance — agir vite`);
  if (heuresSupCumul > 60) previsions.push(`Stress équipe élevé après heures sup d'aujourd'hui — prévoir Récompense ?`);
  if (store.prospects_pending.length > 0) previsions.push(`${store.prospects_pending.length} prospect${store.prospects_pending.length > 1 ? "s" : ""} à traiter`);
  if (store.tresorerie < 30000) previsions.push(`⚠ Trésorerie basse (${(store.tresorerie / 1000).toFixed(0)}k€) — surveiller les dépenses`);
  if (!store.dec_today_deonto || !store.dec_today_mission) previsions.push(`Module DEC ${!store.dec_today_deonto && !store.dec_today_mission ? "pas commencé" : "incomplet"} — streak en risque`);

  // Verdict global de la journée
  let verdict = { emoji: "👍", text: "Bonne journée — cabinet stable.", color: "from-[#34C759] to-[#007AFF]" };
  if (dossiersPerdus > 0 || agentsRupture > 0 || heuresSupCumul > 120) {
    verdict = { emoji: "😰", text: "Journée tendue — décisions difficiles ont coûté.", color: "from-[#FF3B30] to-[#FF9500]" };
  } else if (agentsAlerte > 2 || dossiersSurveillance > 1) {
    verdict = { emoji: "🤔", text: "Journée mitigée — quelques signaux d'alerte à surveiller.", color: "from-[#FF9500] to-[#FFCC00]" };
  } else if (dossiersAvance > 0 && messagesTraitesAuj >= 3) {
    verdict = { emoji: "🎯", text: "Excellente journée — équipe efficace, dossiers qui avancent.", color: "from-[#34C759] to-[#5856D6]" };
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl dark:shadow-black/60 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-transparent dark:border-[#38383a]/60">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-gradient-to-r from-[#5856D6]/10 via-[#AF52DE]/10 to-[#FF9500]/10 dark:from-[#5E5CE6]/15 dark:via-[#BF5AF2]/15 dark:to-[#FF9F0A]/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#5856D6] to-[#AF52DE] flex items-center justify-center shadow-md">
                <Sunset size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[17px] text-[#1D1D1F] dark:text-white tracking-tight">Bilan de ta journée</h3>
                <p className="text-[12px] text-[#86868B] dark:text-[#98989D] capitalize">{dateLabel} · {String(store.game_hour).padStart(2, "0")}h{String(store.game_minute).padStart(2, "0")}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 dark:bg-[#2c2c2e] hover:bg-white dark:hover:bg-[#38383a] flex items-center justify-center">
              <X size={14} className="text-[#86868B] dark:text-[#98989D]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Verdict global */}
          <div className={`rounded-[16px] p-4 bg-gradient-to-br ${verdict.color} text-white shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className="text-[32px]">{verdict.emoji}</div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Verdict de la journée</div>
                <div className="text-[15px] font-semibold mt-0.5">{verdict.text}</div>
              </div>
            </div>
          </div>

          {/* Indicateurs clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatTile label="Temps utilisé" value={tempsUtiliseStr} sub={`/ ${Math.floor((store.temps_disponible_max ?? 480) / 60)}h00`} accent={heuresSupCumul > 0 ? "danger" : "primary"} />
            <StatTile label="Heures sup" value={heuresSupCumul > 0 ? `${Math.floor(heuresSupCumul / 60)}h${String(heuresSupCumul % 60).padStart(2, "0")}` : "—"} sub={heuresSupCumul > 0 ? "stress équipe" : "rien"} accent={heuresSupCumul > 0 ? "danger" : "success"} />
            <StatTile label="Messages traités" value={String(messagesTraitesAuj)} sub={messagesNonLus > 0 ? `${messagesNonLus} non lus` : "tout lu ✓"} accent={messagesNonLus > 0 ? "warning" : "success"} />
            <StatTile label="Stress moyen" value={`${stressMoyen}`} sub={`${agentsAlerte} en alerte`} accent={stressMoyen > 60 ? "danger" : stressMoyen > 40 ? "warning" : "success"} />
          </div>

          {/* Dossiers */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-2">📁 État du portefeuille</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#007AFF]/8 dark:bg-[#0A84FF]/15 rounded-[10px] py-2">
                <div className="text-[18px] font-bold text-[#007AFF] dark:text-[#0A84FF] tabular-nums">{dossiersEnCours}</div>
                <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">En cours</div>
              </div>
              <div className="bg-[#34C759]/8 dark:bg-[#30D158]/15 rounded-[10px] py-2">
                <div className="text-[18px] font-bold text-[#34C759] tabular-nums">{dossiersAvance}</div>
                <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">Avancé</div>
              </div>
              <div className="bg-[#FF9500]/8 dark:bg-[#FF9F0A]/15 rounded-[10px] py-2">
                <div className="text-[18px] font-bold text-[#FF9500] tabular-nums">{dossiersSurveillance}</div>
                <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">Surveillance</div>
              </div>
              <div className="bg-[#FF3B30]/8 dark:bg-[#FF453A]/15 rounded-[10px] py-2">
                <div className="text-[18px] font-bold text-[#FF3B30] tabular-nums">{dossiersPerdus}</div>
                <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">Perdus</div>
              </div>
            </div>
          </div>

          {/* Prévisions demain */}
          {previsions.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-[#FF9500]" /> Demain — à anticiper
              </div>
              <ul className="space-y-1">
                {previsions.map((p, i) => (
                  <li key={i} className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] px-3 py-2 flex items-start gap-2">
                    <span className="text-[#FF9500] font-bold mt-0.5">→</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ressources actuelles */}
          <div className="bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[12px] p-3 grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#86868B] dark:text-[#98989D]">Trésorerie :</span>
              <span className="font-semibold text-[#1D1D1F] dark:text-white tabular-nums">{(store.tresorerie / 1000).toFixed(0)}k€</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#86868B] dark:text-[#98989D]">Légitimité :</span>
              <span className="font-semibold text-[#1D1D1F] dark:text-white tabular-nums">{store.legitimite}/100</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#86868B] dark:text-[#98989D]">Réputation :</span>
              <span className="font-semibold text-[#1D1D1F] dark:text-white tabular-nums">{store.reputation}/100</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#86868B] dark:text-[#98989D]">Streak DEC :</span>
              <span className="font-semibold text-[#FF9500] tabular-nums">{store.dec_streak}j 🔥</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#fafafa] dark:bg-[#161618] border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60 flex items-center justify-between">
          <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">
            Temps reset à minuit · Repos jusqu'à 9h demain
          </p>
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium rounded-[10px] bg-gradient-to-br from-[#5856D6] to-[#AF52DE] text-white shadow-md hover:shadow-lg">
            Bonne soirée 🌙
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: "primary" | "success" | "warning" | "danger" }) {
  const colors = {
    primary: "text-[#007AFF] dark:text-[#0A84FF]",
    success: "text-[#34C759]",
    warning: "text-[#FF9500]",
    danger: "text-[#FF3B30]",
  };
  return (
    <div className="bg-white dark:bg-[#2c2c2e] border border-[#E5E5EA]/40 dark:border-[#38383a]/60 rounded-[10px] p-2.5">
      <div className="text-[9px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider">{label}</div>
      <div className={`text-[18px] font-bold tabular-nums leading-tight mt-0.5 ${colors[accent]}`}>{value}</div>
      <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">{sub}</div>
    </div>
  );
}
