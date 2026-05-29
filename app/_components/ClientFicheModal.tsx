"use client";

import { useGameStore } from "@/lib/supabase-store";
import type { Dossier } from "@/lib/supabase-store";
import { X, AlertTriangle, CheckCircle, Star } from "lucide-react";

interface Props {
  dossier: Dossier;
  onClose: () => void;
}

function Critere({ label, value, lowLabel, highLabel, color }: { label: string; value: number; lowLabel: string; highLabel: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-[#1D1D1F]">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{value}/100</span>
      </div>
      <div className="h-[6px] bg-[#E5E5EA] rounded-full overflow-hidden mb-1">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between text-[9px] text-[#86868B]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function ClientFicheModal({ dossier: d, onClose }: Props) {
  const store = useGameStore();
  const agent = store.agents.find((x) => x.id === d.agent_id);
  const incompat = store.computeIncompatibilites(d.id, d.agent_id);

  const profil = d.profil_relationnel || 50;
  const complexite = d.complexite_comptable || 50;
  const rentabilite = d.rentabilite || 50;
  const reactivite = d.reactivite_demandee || 50;
  const tolerance = d.tolerance_erreurs || 50;

  // Suggestions de profil idéal
  function getProfilIdeal(): string {
    const parts: string[] = [];
    if (profil > 70) parts.push("agent sociable");
    if (complexite > 70) parts.push("expert senior (Manager+)");
    if (reactivite > 70) parts.push("disponible");
    if (tolerance < 40) parts.push("méticuleux (pas stagiaire)");
    return parts.length > 0 ? parts.join(" + ") : "n'importe quel collaborateur compétent";
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 bg-gradient-to-r from-[#F5F5F7] to-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[36px]">🏢</div>
              <div>
                <h3 className="font-bold text-[18px] text-[#1D1D1F] tracking-tight flex items-center gap-2">
                  {d.client}
                  {d.is_vip && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#AF52DE] to-[#5856D6] text-white">⭐ VIP</span>}
                </h3>
                <p className="text-[12px] text-[#86868B]">{d.secteur || "Secteur N/A"} · CA {((d.ca || 0) / 1000000).toFixed(1)}M€ · {d.effectif || 0} salariés</p>
                <p className="text-[11px] text-[#86868B] mt-0.5">Régime TVA : {d.regime_tva || "—"} · Forme : {d.forme_juridique || "—"} · Ancienneté : {d.anciennete_annees || 0} ans</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
              <X size={14} className="text-[#86868B]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 5 critères aléatoires */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">Caractéristiques du client</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Critere label="🧠 Profil relationnel" value={profil} lowLabel="Patient" highLabel="Exigeant" color={profil > 70 ? "#FF3B30" : profil > 40 ? "#FF9500" : "#34C759"} />
              <Critere label="📊 Complexité comptable" value={complexite} lowLabel="Simple" highLabel="Très complexe" color={complexite > 70 ? "#AF52DE" : complexite > 40 ? "#5856D6" : "#34C759"} />
              <Critere label="💰 Rentabilité" value={rentabilite} lowLabel="Faible marge" highLabel="Très rentable" color={rentabilite > 70 ? "#34C759" : rentabilite > 40 ? "#FF9500" : "#FF3B30"} />
              <Critere label="⚡ Réactivité demandée" value={reactivite} lowLabel="Détendu" highLabel="Urgences fréquentes" color={reactivite > 70 ? "#FF3B30" : reactivite > 40 ? "#FF9500" : "#34C759"} />
              <Critere label="🤝 Tolérance aux erreurs" value={tolerance} lowLabel="Aucune tolérance" highLabel="Indulgent" color={tolerance < 40 ? "#FF3B30" : tolerance < 70 ? "#FF9500" : "#34C759"} />
            </div>
          </div>

          {/* Spécialités requises */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">🔧 Spécialités techniques requises</div>
            <div className="flex flex-wrap gap-1.5">
              {(d.specialites_requises || []).map((s, i) => (
                <span key={i} className="text-[11px] bg-[#007AFF]/8 text-[#007AFF] px-2 py-1 rounded-md font-medium">{s}</span>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-[#86868B] bg-[#F5F5F7] rounded-[8px] p-2.5">
              <strong className="text-[#1D1D1F]">Profil collaborateur idéal :</strong> {getProfilIdeal()}
            </div>
          </div>

          {/* Collaborateur affecté + Incompatibilités */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">👤 Collaborateur affecté</div>
            {agent ? (
              <div className="bg-white rounded-[12px] border border-[#E5E5EA]/40 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: agent.avatar_color }}>
                  {agent.initiales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1D1D1F]">{agent.nom}</div>
                  <div className="text-[11px] text-[#86868B]">{agent.role} · Stress {agent.stress} · Confiance {agent.confiance_joueur}</div>
                </div>
                {incompat.length === 0 ? (
                  <div className="flex items-center gap-1 text-[11px] text-[#34C759]">
                    <CheckCircle size={12} /> Adapté
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-[#FF3B30]">
                    <AlertTriangle size={12} /> {incompat.length} risque{incompat.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#86868B] italic">Aucun collaborateur affecté.</p>
            )}

            {/* Alertes incompatibilité */}
            {incompat.length > 0 && (
              <div className="mt-2 bg-[#FF3B30]/5 border border-[#FF3B30]/15 rounded-[10px] p-3">
                <div className="text-[10px] font-semibold text-[#FF3B30] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Alertes d'incompatibilité
                </div>
                <ul className="space-y-0.5">
                  {incompat.map((w, i) => (
                    <li key={i} className="text-[11px] text-[#3a3a3c] flex items-start gap-1">
                      <span className="text-[#FF3B30] font-bold mt-0.5">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Économique */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">💼 Économique</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
                <div className="text-[18px] font-bold text-[#34C759] tabular-nums">{((d.honoraires_annuels || 0) / 1000).toFixed(0)}k€</div>
                <div className="text-[9px] text-[#86868B]">Honoraires/an</div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
                <div className="text-[18px] font-bold text-[#007AFF] tabular-nums">{d.satisfaction || 0}%</div>
                <div className="text-[9px] text-[#86868B]">Satisfaction</div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
                <div className="text-[18px] font-bold text-[#1D1D1F] tabular-nums">{d.cas_traites}</div>
                <div className="text-[9px] text-[#86868B]">Cas traités</div>
              </div>
            </div>
          </div>

          {/* Statut dossier */}
          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">📁 Statut du dossier</div>
            <div className="bg-[#F5F5F7] rounded-[12px] p-3 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#86868B]">Phase</span>
                <span className="font-semibold text-[#1D1D1F]">{d.phase}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#86868B]">État</span>
                <span className={`font-semibold ${d.etat === "perdu" ? "text-[#FF3B30]" : d.etat === "avance" ? "text-[#34C759]" : d.etat === "surveillance" ? "text-[#FF9500]" : "text-[#007AFF]"}`}>
                  {d.etat === "en_cours" ? "EN COURS" : d.etat === "avance" ? "AVANCÉ" : d.etat === "cloture" ? "CLÔTURÉ" : d.etat === "perdu" ? "PERDU" : "SURVEILLANCE"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#86868B] w-20">Progression</span>
                <div className="flex-1 h-[4px] bg-[#E5E5EA] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.progression}%`, backgroundColor: "#007AFF" }} />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-10 text-right">{d.progression}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#86868B] w-20">Qualité</span>
                <div className="flex-1 h-[4px] bg-[#E5E5EA] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.qualite}%`, backgroundColor: d.qualite >= 70 ? "#34C759" : d.qualite >= 50 ? "#FF9500" : "#FF3B30" }} />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-10 text-right">{d.qualite}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
