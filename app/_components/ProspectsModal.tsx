"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { Sparkles, X, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { SectorTag } from "./SectorTag";

export function ProspectsModal({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const prospects = store.prospects_pending;
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>({});

  if (prospects.length === 0) return null;

  const totalBudget = prospects.reduce((s, p) => s + p.honoraires_annuels, 0);
  const capacite = `${store.dossiers.filter((d) => d.etat === "en_cours").length}/${store.agents.length * 2}`;

  function handleAccept(prospectId: string) {
    const agentId = selectedAgents[prospectId];
    if (!agentId) {
      alert("Sélectionne un collaborateur pour ce client.");
      return;
    }
    store.acceptProspect(prospectId, agentId);
  }

  function handleRefuse(prospectId: string) {
    store.refuseProspect(prospectId);
  }

  function getProfilCouleur(v: number, inverse = false) {
    const high = inverse ? "#FF3B30" : "#34C759";
    const low = inverse ? "#34C759" : "#FF3B30";
    return v > 70 ? high : v > 40 ? "#FF9500" : low;
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl dark:shadow-black/60 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-transparent dark:border-[#38383a]/60">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-gradient-to-r from-[#34C759]/8 to-[#007AFF]/8 dark:from-[#34C759]/12 dark:to-[#007AFF]/12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[28px]">🎉</div>
              <div>
                <h3 className="font-bold text-[18px] text-[#1D1D1F] dark:text-white tracking-tight">Nouveaux prospects</h3>
                <p className="text-[12px] text-[#86868B] dark:text-[#98989D]">{prospects.length} entreprise{prospects.length > 1 ? "s" : ""} souhaite{prospects.length > 1 ? "nt" : ""} rejoindre le cabinet</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 dark:bg-[#2c2c2e] hover:bg-white dark:hover:bg-[#38383a] flex items-center justify-center">
              <X size={14} className="text-[#86868B] dark:text-[#98989D]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {prospects.map((p) => (
            <div key={p.id} className="bg-white dark:bg-[#2c2c2e] rounded-[16px] border border-[#E5E5EA]/40 dark:border-[#38383a]/60 p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-[24px]">🏢</div>
                <div className="flex-1">
                  <h4 className="font-bold text-[15px] text-[#1D1D1F] dark:text-white flex items-center gap-2 flex-wrap">
                    {p.client}
                    {p.secteur_categorie && <SectorTag categorie={p.secteur_categorie} size="sm" />}
                  </h4>
                  <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">
                    {p.secteur} · CA {(p.ca / 1000000).toFixed(1)}M€ · {p.effectif} salariés · {p.forme_juridique}
                  </p>
                  <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">Régime TVA : {p.regime_tva}</p>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-bold text-[#34C759] tabular-nums">+{(p.honoraires_annuels / 1000).toFixed(0)}k€</div>
                  <div className="text-[9px] text-[#86868B] dark:text-[#98989D]">honoraires/an</div>
                </div>
              </div>

              {/* Critères condensés */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {[
                  { label: "Exigeant", value: p.profil_relationnel, inverse: true },
                  { label: "Complexe", value: p.complexite_comptable, inverse: false },
                  { label: "Rentable", value: p.rentabilite, inverse: false },
                  { label: "Urgent", value: p.reactivite_demandee, inverse: true },
                  { label: "Tolérant", value: p.tolerance_erreurs, inverse: false },
                ].map((c) => (
                  <div key={c.label} className="text-center">
                    <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mb-0.5">{c.label}</div>
                    <div className="h-[4px] bg-[#E5E5EA] dark:bg-[#38383a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.value}%`, backgroundColor: getProfilCouleur(c.value, c.inverse) }} />
                    </div>
                    <div className="text-[9px] tabular-nums mt-0.5" style={{ color: getProfilCouleur(c.value, c.inverse) }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Spécialités */}
              <div className="mb-3">
                <div className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-1">Spécialités techniques</div>
                <div className="flex flex-wrap gap-1">
                  {p.specialites_requises.map((s, i) => (
                    <span key={i} className="text-[10px] bg-[#007AFF]/8 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] px-1.5 py-0.5 rounded-md font-medium">{s}</span>
                  ))}
                </div>
              </div>

              {/* Affectation collaborateur */}
              <div className="bg-[#F5F5F7]/60 dark:bg-[#1c1c1e] rounded-[10px] p-2.5">
                <label className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider block mb-1">
                  Affecter à un collaborateur
                </label>
                <select
                  value={selectedAgents[p.id] || ""}
                  onChange={(e) => setSelectedAgents({ ...selectedAgents, [p.id]: e.target.value })}
                  className="w-full text-[12px] p-2 border border-[#E5E5EA] dark:border-[#38383a] rounded-[8px] outline-none focus:border-[#007AFF] bg-white dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white"
                >
                  <option value="">— Choisir un collaborateur —</option>
                  {store.agents.map((a) => {
                    const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
                    const overload = charge >= 3 ? " ⚠ surchargé" : "";
                    const stressed = a.stress > 70 ? " 🔥 stress haut" : "";
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.filiere}) · {charge} dossiers{overload}{stressed}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleRefuse(p.id)}
                  className="px-3 py-2 text-[12px] rounded-[10px] bg-[#FF3B30]/10 dark:bg-[#FF3B30]/15 text-[#FF3B30] hover:bg-[#FF3B30]/15 dark:hover:bg-[#FF3B30]/25 font-medium transition-all flex items-center gap-1">
                  <X size={11} /> Refuser
                </button>
                <button onClick={() => handleAccept(p.id)}
                  disabled={!selectedAgents[p.id]}
                  className={`ml-auto px-4 py-2 text-[12px] font-semibold rounded-[10px] transition-all flex items-center gap-1.5 ${
                    selectedAgents[p.id]
                      ? "bg-gradient-to-br from-[#34C759] to-[#007AFF] text-white shadow-md hover:shadow-lg"
                      : "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] dark:text-[#636366] cursor-not-allowed"
                  }`}>
                  <CheckCircle size={11} /> Accepter et affecter
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-[#fafafa] dark:bg-[#161618] border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60 flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-[#34C759]" />
            <span className="text-[#86868B] dark:text-[#98989D]">Budget total estimé :</span>
            <span className="font-semibold text-[#34C759]">+{(totalBudget / 1000).toFixed(0)}k€/an</span>
          </div>
          <div className="text-[#86868B] dark:text-[#98989D]">Capacité équipe : {capacite}</div>
          <button onClick={onClose} className="ml-auto px-3 py-1.5 text-[12px] rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#38383a]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
