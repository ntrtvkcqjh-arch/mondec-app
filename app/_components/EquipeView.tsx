"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import {
  Users, Heart, Filter, ArrowUpDown, GitBranch, Grid3x3, Lock,
  X, MessageSquare, Award, BookOpen, Megaphone, CheckCircle
} from "lucide-react";

function EmotionChip({ emotion, small }: { emotion: string; small?: boolean }) {
  const map: Record<string, string> = {
    "Stable": "bg-[#34C759]/10 text-[#34C759]",
    "Concentré": "bg-[#007AFF]/10 text-[#007AFF]",
    "Anxieux": "bg-[#FF9500]/10 text-[#FF9500]",
    "Frustré": "bg-[#FF3B30]/10 text-[#FF3B30]",
    "Euphorique": "bg-[#AF52DE]/10 text-[#AF52DE]",
    "Surmené": "bg-[#FF3B30]/10 text-[#FF3B30]",
    "Distant": "bg-[#86868B]/10 text-[#86868B]",
    "En conflit": "bg-[#FF3B30]/10 text-[#FF3B30]",
  };
  const cls = map[emotion] || "bg-[#E5E5EA] text-[#86868B]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-md font-medium ${small ? "text-[9px]" : "text-[11px]"} ${cls}`}>
      {emotion}
    </span>
  );
}

function AgentBar({ label, value, warn, invert }: { label: string; value: number; warn?: number; invert?: boolean }) {
  const bad = warn ? value > warn : false;
  const good = invert && value > 70;
  const color = bad ? "#FF3B30" : good ? "#34C759" : "#007AFF";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#86868B] w-14">{label}</span>
      <div className="flex-1 h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-[#86868B] w-5 text-right">{value}</span>
    </div>
  );
}

export function EquipeView() {
  const store = useGameStore();
  const [view, setView] = useState<"grid" | "org">("grid");
  const [filter, setFilter] = useState<"tous" | "en_ligne" | "en_alerte" | "stagiaires" | "managers">("tous");
  const [sort, setSort] = useState<"confiance" | "stress" | "nom">("confiance");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState("");

  useEffect(() => {
    if (store.agents.length > 0) store.recomputeTeamHealth();
  }, [store.agents.length]);

  function getAlerts(a: any) {
    const alerts: { icon: string; label: string }[] = [];
    if (a.stress > 85 || a.fatigue > 85) alerts.push({ icon: "🔥", label: "Burn-out imminent" });
    if (a.emotion === "En conflit" || a.emotion === "Frustré") alerts.push({ icon: "⚠️", label: "Tension" });
    const unreadFromAgent = store.messages.filter((m) => m.agent_id === a.id && !m.lu && !m.repondu).length;
    if (unreadFromAgent > 0) alerts.push({ icon: "📩", label: `${unreadFromAgent} message(s)` });
    if (a.arc_actuel === "Rupture") alerts.push({ icon: "💼", label: "Risque départ" });
    if (a.niveau && a.niveau.includes("Stagiaire") && a.arc_actuel === "Apprentissage") alerts.push({ icon: "🎯", label: "Stagiaire DEC" });
    if (store.game_hour >= 18 && a.statut === "En ligne") alerts.push({ icon: "🌙", label: "Heures sup" });
    return alerts;
  }

  function handleAction(agentId: string, action: "talk" | "reward" | "reprimand" | "train") {
    let result: { ok: boolean; reason?: string };
    if (action === "talk") result = store.talkAgent(agentId);
    else if (action === "reward") result = store.rewardAgent(agentId);
    else if (action === "reprimand") result = store.reprimandAgent(agentId);
    else result = store.trainAgent(agentId);

    if (!result.ok) setActionFeedback(result.reason || "Action indisponible");
    else {
      const labels: Record<string, string> = {
        talk: "Échange terminé",
        reward: "Récompense distribuée",
        reprimand: "Réprimande effectuée",
        train: "Formation lancée",
      };
      setActionFeedback(labels[action]);
    }
    setTimeout(() => setActionFeedback(""), 3000);
  }

  let filtered = store.agents.filter((a: any) => {
    if (filter === "tous") return true;
    if (filter === "en_ligne") return a.statut === "En ligne";
    if (filter === "en_alerte") return getAlerts(a).length > 0;
    if (filter === "stagiaires") return a.niveau && a.niveau.includes("Stagiaire");
    if (filter === "managers") return a.niveau === "Manager" || a.niveau === "Directeur";
    return true;
  });
  filtered = filtered.slice().sort((a, b) => {
    if (sort === "confiance") return b.confiance_joueur - a.confiance_joueur;
    if (sort === "stress") return b.stress - a.stress;
    return a.nom.localeCompare(b.nom);
  });

  const directeurs = filtered.filter((a: any) => a.niveau === "Directeur");
  const managers = filtered.filter((a: any) => a.niveau === "Manager");
  const collabs = filtered.filter((a: any) => a.niveau === "Collaborateur");
  const stagiaires = filtered.filter((a: any) => a.niveau && a.niveau.includes("Stagiaire"));

  const conflits = store.agents.filter((a) => a.emotion === "En conflit" || a.emotion === "Frustré").length;
  const burnoutRisques = store.agents.filter((a) => a.stress > 85 || a.fatigue > 85).length;
  const turnoverRisques = store.agents.filter((a: any) => a.confiance_joueur < 30 || a.arc_actuel === "Rupture").length;
  const satisfMoyenne = Math.round(store.agents.reduce((s, a) => s + a.confiance_joueur, 0) / Math.max(1, store.agents.length));

  const detailAgent = detailId ? store.agents.find((a) => a.id === detailId) : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Équipe</h2>
            <p className="text-[13px] text-[#86868B] mt-1">{store.agents.length} collaborateurs · Cabinet Morel &amp; Associés</p>
          </div>
          <div className="flex gap-1 bg-[#F5F5F7] p-1 rounded-[10px]">
            <button onClick={() => setView("grid")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-[7px] transition-all flex items-center gap-1 ${view === "grid" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              <Grid3x3 size={11} /> Grille
            </button>
            <button onClick={() => setView("org")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-[7px] transition-all flex items-center gap-1 ${view === "org" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              <GitBranch size={11} /> Organigramme
            </button>
          </div>
        </div>

        {/* Santé mentale équipe */}
        <div className={`rounded-[18px] p-4 mb-4 border-2 ${store.team_health >= 70 ? "border-[#34C759]/30 bg-gradient-to-br from-[#34C759]/8 to-[#007AFF]/5" : store.team_health >= 50 ? "border-[#FF9500]/30 bg-gradient-to-br from-[#FF9500]/8 to-[#FF3B30]/5" : "border-[#FF3B30]/40 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF9500]/5"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart size={16} className={store.team_health >= 70 ? "text-[#34C759]" : store.team_health >= 50 ? "text-[#FF9500]" : "text-[#FF3B30]"} />
              <span className="font-semibold text-[14px] text-[#1D1D1F]">Santé mentale équipe</span>
            </div>
            <div className="text-[28px] font-bold tabular-nums leading-none" style={{ color: store.team_health >= 70 ? "#34C759" : store.team_health >= 50 ? "#FF9500" : "#FF3B30" }}>
              {store.team_health}<span className="text-[14px] text-[#86868B] font-normal">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-white/70 rounded-[10px] p-2">
              <div className="text-[#86868B]">Satisfaction</div>
              <div className="text-[14px] font-semibold text-[#1D1D1F] tabular-nums">{satisfMoyenne}%</div>
            </div>
            <div className="bg-white/70 rounded-[10px] p-2">
              <div className="text-[#86868B]">Turnover risqué</div>
              <div className="text-[14px] font-semibold text-[#FF3B30] tabular-nums">{turnoverRisques}</div>
            </div>
            <div className="bg-white/70 rounded-[10px] p-2">
              <div className="text-[#86868B]">Conflits</div>
              <div className="text-[14px] font-semibold text-[#FF9500] tabular-nums">{conflits}</div>
            </div>
            <div className="bg-white/70 rounded-[10px] p-2">
              <div className="text-[#86868B]">Burn-out potentiel</div>
              <div className="text-[14px] font-semibold text-[#FF3B30] tabular-nums">{burnoutRisques}</div>
            </div>
          </div>
        </div>

        {/* Filtres + Tri */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter size={12} className="text-[#86868B]" />
          {(["tous", "en_ligne", "en_alerte", "stagiaires", "managers"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-[8px] transition-all ${filter === f ? "bg-[#007AFF] text-white" : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]/40"}`}>
              {f === "tous" ? "Tous" : f === "en_ligne" ? "En ligne" : f === "en_alerte" ? "En alerte" : f === "stagiaires" ? "Stagiaires" : "Managers"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <ArrowUpDown size={11} className="text-[#86868B]" />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}
              className="text-[11px] bg-white border border-[#E5E5EA]/40 rounded-[8px] px-2 py-1 outline-none">
              <option value="confiance">Confiance ↓</option>
              <option value="stress">Stress ↓</option>
              <option value="nom">Nom A-Z</option>
            </select>
          </div>
        </div>

        {actionFeedback && (
          <div className="mb-3 px-3 py-2 bg-[#007AFF]/10 border border-[#007AFF]/20 text-[#007AFF] text-[12px] rounded-[10px] flex items-center gap-2">
            <CheckCircle size={12} /> {actionFeedback}
          </div>
        )}

        {/* Vue Grille */}
        {view === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((a: any) => {
              const alerts = getAlerts(a);
              return (
                <div key={a.id} onClick={() => setDetailId(a.id)}
                  className="bg-white rounded-[18px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5EA]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 cursor-pointer transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-sm shrink-0" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-[#1D1D1F] truncate">{a.nom}</div>
                      <div className="text-[11px] text-[#86868B] truncate">{a.role}</div>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <EmotionChip emotion={a.emotion || "Stable"} small />
                        {alerts.map((alert, i) => <span key={i} title={alert.label} className="text-[12px]">{alert.icon}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <AgentBar label="Stress" value={a.stress} warn={70} />
                    <AgentBar label="Fatigue" value={a.fatigue} warn={70} />
                    <AgentBar label="Confiance" value={a.confiance_joueur} invert />
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F5F5F7] flex items-center justify-between">
                    <span className="text-[10px] text-[#86868B] bg-[#F5F5F7] px-2 py-0.5 rounded-full">{a.filiere}</span>
                    <span className={`text-[10px] font-medium ${a.statut === "En ligne" ? "text-[#34C759]" : a.statut === "Occupé" ? "text-[#FF9500]" : "text-[#86868B]"}`}>{a.statut}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleAction(a.id, "talk")} title="Parler · +3 Confiance" className="px-1 py-1.5 text-[10px] bg-[#007AFF]/8 text-[#007AFF] hover:bg-[#007AFF]/15 rounded-[6px] flex items-center justify-center"><MessageSquare size={10} /></button>
                    <button onClick={() => handleAction(a.id, "reward")} title="Récompenser" className="px-1 py-1.5 text-[10px] bg-[#34C759]/8 text-[#34C759] hover:bg-[#34C759]/15 rounded-[6px] flex items-center justify-center"><Award size={10} /></button>
                    <button onClick={() => handleAction(a.id, "train")} title="Former · 1 PA + 3k€" className="px-1 py-1.5 text-[10px] bg-[#AF52DE]/8 text-[#AF52DE] hover:bg-[#AF52DE]/15 rounded-[6px] flex items-center justify-center"><BookOpen size={10} /></button>
                    <button onClick={() => handleAction(a.id, "reprimand")} title="Réprimander" className="px-1 py-1.5 text-[10px] bg-[#FF3B30]/8 text-[#FF3B30] hover:bg-[#FF3B30]/15 rounded-[6px] flex items-center justify-center"><Megaphone size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vue Organigramme */}
        {view === "org" && (
          <div className="space-y-4">
            {[
              { label: "Direction", agents: directeurs, color: "#AF52DE" },
              { label: "Managers", agents: managers, color: "#007AFF" },
              { label: "Collaborateurs", agents: collabs, color: "#34C759" },
              { label: "Stagiaires", agents: stagiaires, color: "#FF9500" },
            ].map((row) => row.agents.length === 0 ? null : (
              <div key={row.label}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">{row.label}</span>
                  <span className="text-[10px] text-[#86868B]">({row.agents.length})</span>
                  <div className="flex-1 h-[1px] bg-[#E5E5EA]/40" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {row.agents.map((a: any) => {
                    const alerts = getAlerts(a);
                    return (
                      <button key={a.id} onClick={() => setDetailId(a.id)}
                        className="bg-white rounded-[14px] p-3 border border-[#E5E5EA]/40 hover:border-[#007AFF]/40 hover:shadow transition-all text-left">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ backgroundColor: a.avatar_color }}>
                            {a.initiales}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[#1D1D1F] truncate">{a.nom.split(" ")[0]}</div>
                            <div className="text-[10px] text-[#86868B] truncate">{a.filiere}</div>
                          </div>
                          {alerts.length > 0 && (
                            <div className="flex gap-0.5">
                              {alerts.slice(0, 2).map((al, i) => <span key={i} className="text-[10px]">{al.icon}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={a.stress > 70 ? "text-[#FF3B30]" : "text-[#86868B]"}>S {a.stress}</span>
                          <span className={a.confiance_joueur < 40 ? "text-[#FF3B30]" : "text-[#34C759]"}>C {a.confiance_joueur}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal détail agent */}
      {detailAgent && (
        <AgentDetailModal agent={detailAgent} onClose={() => setDetailId(null)} onAction={handleAction} actionFeedback={actionFeedback} />
      )}
    </div>
  );
}

function AgentDetailModal({ agent: a, onClose, onAction, actionFeedback }: { agent: any; onClose: () => void; onAction: (id: string, action: any) => void; actionFeedback: string }) {
  const store = useGameStore();
  const dossiers = store.dossiers.filter((d) => d.agent_id === a.id);
  const messages = store.messages.filter((m) => m.agent_id === a.id);
  const history = store.agent_player_history[a.id] || [];
  const cooldowns = store.agent_cooldowns[a.id] || {};
  const competences: string[] = a.competences_DEC || [];
  const secret: string | null = a.secret || null;
  const memoires: any[] = a.memoires || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 bg-gradient-to-r from-[#F5F5F7] to-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[15px] font-bold shadow-md" style={{ backgroundColor: a.avatar_color }}>
                {a.initiales}
              </div>
              <div>
                <h3 className="font-bold text-[17px] text-[#1D1D1F] tracking-tight">{a.nom}</h3>
                <p className="text-[12px] text-[#86868B]">{a.role} · {a.filiere}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <EmotionChip emotion={a.emotion || "Stable"} small />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${a.statut === "En ligne" ? "bg-[#34C759]/15 text-[#34C759]" : a.statut === "Occupé" ? "bg-[#FF9500]/15 text-[#FF9500]" : "bg-[#86868B]/15 text-[#86868B]"}`}>{a.statut}</span>
                  {a.trait_dominant && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#AF52DE]/10 text-[#AF52DE] font-medium">Trait : {a.trait_dominant}</span>}
                  {a.arc_actuel && <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${a.arc_actuel === "Rupture" ? "bg-[#FF3B30]/10 text-[#FF3B30]" : a.arc_actuel === "Trahison" ? "bg-[#FF9500]/10 text-[#FF9500]" : "bg-[#007AFF]/10 text-[#007AFF]"}`}>Arc : {a.arc_actuel}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
              <X size={14} className="text-[#86868B]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <AgentBar label="Stress" value={a.stress} warn={70} />
            <AgentBar label="Fatigue" value={a.fatigue} warn={70} />
            <AgentBar label="Confiance" value={a.confiance_joueur} invert />
            <AgentBar label="Respect" value={a.respect} invert />
            <AgentBar label="Peur" value={a.peur} warn={70} />
            <AgentBar label="Loyauté" value={a.loyaute} invert />
          </div>

          {competences.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Compétences DEC</div>
              <div className="flex flex-wrap gap-1">
                {competences.map((c, i) => (
                  <span key={i} className="text-[11px] bg-[#007AFF]/8 text-[#007AFF] px-2 py-0.5 rounded-md font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}

          {dossiers.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Dossiers portés ({dossiers.length})</div>
              <div className="space-y-1.5">
                {dossiers.map((d) => (
                  <div key={d.id} className="bg-[#F5F5F7] rounded-[10px] p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[#1D1D1F] truncate">{d.client}</div>
                      <div className="text-[10px] text-[#86868B]">{d.theme}</div>
                    </div>
                    <div className="text-[10px] tabular-nums font-semibold" style={{ color: d.etat === "perdu" ? "#FF3B30" : d.etat === "avance" ? "#34C759" : d.etat === "surveillance" ? "#FF9500" : "#007AFF" }}>
                      {d.progression}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Historique de tes actions</div>
            {history.length === 0 ? (
              <p className="text-[11px] text-[#86868B] italic">Aucune action enregistrée. Utilise les boutons en bas pour interagir.</p>
            ) : (
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {history.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] py-1 border-b border-[#F5F5F7] last:border-0">
                    <span className="text-[#86868B] font-mono tabular-nums shrink-0 w-12">J{h.day} {String(h.hour).padStart(2, "0")}h</span>
                    <span className="text-[#1D1D1F] flex-1">{h.event}</span>
                    {h.impact && <span className="text-[10px] text-[#86868B] italic">{h.impact}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {memoires.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Ses mémoires de toi</div>
              <div className="space-y-1">
                {memoires.slice(0, 5).map((m, i) => (
                  <div key={i} className={`text-[11px] p-2 rounded-[8px] flex items-start gap-2 ${m.type === "promesse" ? "bg-[#34C759]/8 text-[#34C759]" : m.type === "crise" ? "bg-[#FF3B30]/8 text-[#FF3B30]" : m.type === "promesse_brisee" ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#F5F5F7] text-[#86868B]"}`}>
                    <span className="shrink-0 font-semibold uppercase text-[9px]">{m.type}</span>
                    <span className="flex-1">{m.contenu}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {secret && (
            <div className="bg-[#1D1D1F]/95 text-white rounded-[10px] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">🔐 Secret (révélé)</div>
              <p className="text-[12px] italic">{secret}</p>
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Messages échangés ({messages.length})</div>
            <p className="text-[11px] text-[#86868B]">Va dans l'onglet Messages pour la conversation complète.</p>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "talk", label: "Parler", desc: "+3 Conf", icon: MessageSquare, color: "#007AFF", cd: cooldowns.talk },
              { id: "reward", label: "Récompenser", desc: "+7 +5 L", icon: Award, color: "#34C759", cd: cooldowns.reward },
              { id: "train", label: "Former", desc: "1PA 3k€", icon: BookOpen, color: "#AF52DE", cd: cooldowns.train },
              { id: "reprimand", label: "Réprimander", desc: "−6 +Peur", icon: Megaphone, color: "#FF3B30", cd: cooldowns.reprimand },
            ].map((act) => {
              const locked = !!(act.cd && store.game_day < act.cd);
              const Icon = act.icon;
              return (
                <button key={act.id} onClick={() => onAction(a.id, act.id)} disabled={locked}
                  title={locked ? `Re-dispo jour ${act.cd}` : act.desc}
                  className={`px-2 py-2 rounded-[10px] transition-all flex flex-col items-center gap-0.5 ${locked ? "bg-[#F5F5F7] text-[#c7c7cc] cursor-not-allowed" : "hover:bg-white border"}`}
                  style={!locked ? { backgroundColor: `${act.color}10`, color: act.color, borderColor: `${act.color}20` } : {}}>
                  <Icon size={14} />
                  <span className="text-[11px] font-semibold">{act.label}</span>
                  <span className="text-[9px] opacity-70">{locked ? `J${act.cd}` : act.desc}</span>
                </button>
              );
            })}
          </div>
          {actionFeedback && (
            <div className="mt-2 text-[11px] text-[#007AFF] text-center">{actionFeedback}</div>
          )}
        </div>
      </div>
    </div>
  );
}
