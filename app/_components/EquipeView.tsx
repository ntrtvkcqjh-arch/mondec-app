"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import {
  Users, Heart, Filter, ArrowUpDown, GitBranch, Grid3x3, Lock,
  X, MessageSquare, Award, BookOpen, Megaphone, CheckCircle, Flame
} from "lucide-react";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";
import { AgentAvatar } from "./ui/AgentAvatar";

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
  const [view, setView] = useState<"grid" | "org" | "crise">("grid");
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

  const enCrise = store.agents.filter((a: any) => a.stress > 70 || a.fatigue > 70 || a.emotion === "En conflit" || a.emotion === "Frustré" || a.arc_actuel === "Rupture" || a.arc_actuel === "Crise");

  // Statut résumé par agent (1 mot)
  function getStatusLabel(a: any): { label: string; tone: "ok" | "warning" | "critical" } {
    if (a.stress > 80 || a.fatigue > 80) return { label: "Burn-out", tone: "critical" };
    if (a.arc_actuel === "Rupture") return { label: "Risque départ", tone: "critical" };
    if (a.stress > 65 || a.confiance_joueur < 40) return { label: "Sous tension", tone: "warning" };
    if (a.stress > 45) return { label: "Chargé", tone: "warning" };
    return { label: "Serein", tone: "ok" };
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="ÉQUIPE"
        stats={[
          { value: store.agents.length, label: "collaborateurs" },
          { value: `${store.team_health}/100`, label: "climat social", tone: store.team_health < 50 ? "critical" : store.team_health < 70 ? "warning" : "default" },
          { value: burnoutRisques, label: "burn-out", tone: burnoutRisques > 0 ? "critical" : "default" },
        ]}
      />

      <div className="max-w-[1200px] mx-auto px-10 pb-16">
        {/* Toggle vue + Filtres */}
        <div className="flex items-center gap-2 mb-7 flex-wrap">
          <div className="flex gap-1 bg-white dark:bg-[#1c1c1e] p-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <button onClick={() => setView("grid")}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all flex items-center gap-1.5 ${view === "grid" ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]" : "text-[#6b7280] dark:text-[#98989D]"}`}>
              <Grid3x3 size={11} /> Grille
            </button>
            <button onClick={() => setView("org")}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all flex items-center gap-1.5 ${view === "org" ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]" : "text-[#6b7280] dark:text-[#98989D]"}`}>
              <GitBranch size={11} /> Organigramme
            </button>
            <button onClick={() => setView("crise")}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all flex items-center gap-1.5 ${view === "crise" ? "bg-[#FF3B30] text-white" : "text-[#FF3B30]"}`}>
              <Flame size={11} /> Crise
            </button>
          </div>
          <div className="flex gap-1 ml-auto">
            {(["tous", "en_alerte", "stagiaires", "managers"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-all ${filter === f ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]" : "bg-white dark:bg-[#1c1c1e] text-[#6b7280] dark:text-[#98989D] shadow-[0_1px_3px_rgba(0,0,0,0.03)]"}`}>
                {f === "tous" ? "Tous" : f === "en_alerte" ? "En alerte" : f === "stagiaires" ? "Stagiaires" : "Managers"}
              </button>
            ))}
          </div>
        </div>

        {actionFeedback && (
          <div className="mb-5 px-4 py-2.5 bg-[#007AFF]/8 text-[#007AFF] text-[12px] rounded-[14px] flex items-center gap-2">
            <CheckCircle size={13} /> {actionFeedback}
          </div>
        )}

        {/* Vue Grille — cartes simplifiées style Apple */}
        {view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a: any) => {
              const alerts = getAlerts(a);
              const status = getStatusLabel(a);
              const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
              const statusColor = status.tone === "critical" ? "#FF3B30" : status.tone === "warning" ? "#FF9500" : "#34C759";
              return (
                <Card key={a.id} onClick={() => setDetailId(a.id)} className="p-5">
                  {/* Header : avatar + nom + statut résumé */}
                  <div className="flex items-start gap-3 mb-4">
                    <AgentAvatar initials={a.initiales} color={a.avatar_color} agentId={a.id} agentName={a.nom} size="lg" online={a.statut === "En ligne"} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-[#111111] dark:text-white tracking-[-0.01em] truncate">{a.nom}</h3>
                      <p className="text-[11.5px] text-[#6b7280] dark:text-[#98989D] truncate">{a.role}</p>
                      <span className="inline-block mt-1 text-[11px] font-medium" style={{ color: statusColor }}>
                        {status.tone === "ok" ? "🟢" : status.tone === "warning" ? "🟠" : "🔴"} {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Stats inline minimalistes */}
                  <div className="flex items-baseline gap-x-5 gap-y-1 flex-wrap text-[12px] mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className={`font-semibold tabular-nums ${a.stress > 70 ? "text-[#FF3B30]" : "text-[#111111] dark:text-white"}`}>{a.stress}</span>
                      <span className="text-[#9ca3af] dark:text-[#6b7280] text-[11px]">stress</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-semibold tabular-nums ${a.confiance_joueur < 40 ? "text-[#FF3B30]" : "text-[#111111] dark:text-white"}`}>{a.confiance_joueur}</span>
                      <span className="text-[#9ca3af] dark:text-[#6b7280] text-[11px]">confiance</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-semibold tabular-nums ${charge >= 4 ? "text-[#FF3B30]" : charge === 3 ? "text-[#FF9500]" : "text-[#111111] dark:text-white"}`}>{charge}</span>
                      <span className="text-[#9ca3af] dark:text-[#6b7280] text-[11px]">dossier{charge > 1 ? "s" : ""}</span>
                    </div>
                    {alerts.length > 0 && (
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold tabular-nums text-[#FF9500]">{alerts.length}</span>
                        <span className="text-[#9ca3af] dark:text-[#6b7280] text-[11px]">alerte{alerts.length > 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer minimal : filière + actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#f1f1f3] dark:border-[#2c2c2e]">
                    <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">{a.filiere}</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleAction(a.id, "talk")} title="Parler 5 min · +3 Conf"
                        className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#007AFF]/15 hover:text-[#007AFF] text-[#6b7280] dark:text-[#98989D] flex items-center justify-center transition-colors">
                        <MessageSquare size={11} />
                      </button>
                      <button onClick={() => handleAction(a.id, "reward")} title="Récompenser 10 min · 500€"
                        className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#34C759]/15 hover:text-[#34C759] text-[#6b7280] dark:text-[#98989D] flex items-center justify-center transition-colors">
                        <Award size={11} />
                      </button>
                      <button onClick={() => handleAction(a.id, "train")} title="Former 3h · 3k€"
                        className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#AF52DE]/15 hover:text-[#AF52DE] text-[#6b7280] dark:text-[#98989D] flex items-center justify-center transition-colors">
                        <BookOpen size={11} />
                      </button>
                      <button onClick={() => handleAction(a.id, "reprimand")} title="Réprimander 10 min · risque"
                        className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#FF3B30]/15 hover:text-[#FF3B30] text-[#6b7280] dark:text-[#98989D] flex items-center justify-center transition-colors">
                        <Megaphone size={11} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {/* Hidden fallback for original layout when needed */}
            {false && filtered.map((a: any) => {
              const alerts = getAlerts(a);
              return (
                <div key={a.id} onClick={() => setDetailId(a.id)}
                  className="bg-white dark:bg-[#1c1c1e] rounded-[18px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5EA]/30 dark:border-[#38383a] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 cursor-pointer transition-all">
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
                  <div className="mt-2 pt-2 border-t border-[#F5F5F7] dark:border-[#38383a] flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] text-[#86868B] bg-[#F5F5F7] dark:bg-[#2c2c2e] dark:text-[#98989D] px-2 py-0.5 rounded-full">{a.filiere}</span>
                    {(() => {
                      const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
                      const overload = charge >= 4;
                      const medium = charge === 3;
                      return (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          overload ? "bg-[#FF3B30]/12 text-[#FF3B30]" : medium ? "bg-[#FF9500]/12 text-[#FF9500]" : "bg-[#34C759]/12 text-[#34C759]"
                        }`}>
                          📁 {charge} dossier{charge > 1 ? "s" : ""}
                        </span>
                      );
                    })()}
                    <span className={`text-[10px] font-medium ml-auto ${a.statut === "En ligne" ? "text-[#34C759]" : a.statut === "Occupé" ? "text-[#FF9500]" : "text-[#86868B]"}`}>{a.statut}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleAction(a.id, "talk")} title="Parler · 5 min · +3 Confiance" className="px-1 py-1.5 text-[10px] bg-[#007AFF]/8 text-[#007AFF] hover:bg-[#007AFF]/15 rounded-[6px] flex items-center justify-center"><MessageSquare size={10} /></button>
                    <button onClick={() => handleAction(a.id, "reward")} title="Récompenser · 10 min + 500€ chèque-cadeau" className="px-1 py-1.5 text-[10px] bg-[#34C759]/8 text-[#34C759] hover:bg-[#34C759]/15 rounded-[6px] flex items-center justify-center"><Award size={10} /></button>
                    <button onClick={() => handleAction(a.id, "train")} title="Former · 3h + 3k€" className="px-1 py-1.5 text-[10px] bg-[#AF52DE]/8 text-[#AF52DE] hover:bg-[#AF52DE]/15 rounded-[6px] flex items-center justify-center"><BookOpen size={10} /></button>
                    <button onClick={() => handleAction(a.id, "reprimand")} title="Réprimander · 10 min · risque conflit" className="px-1 py-1.5 text-[10px] bg-[#FF3B30]/8 text-[#FF3B30] hover:bg-[#FF3B30]/15 rounded-[6px] flex items-center justify-center"><Megaphone size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section Anciens collaborateurs — visible toutes vues sauf crise */}
        {view !== "crise" && store.former_agents.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#86868B] dark:text-[#98989D]">📜 Anciens collaborateurs</span>
              <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">({store.former_agents.length})</span>
              <div className="flex-1 h-[1px] bg-[#E5E5EA]/40 dark:bg-[#38383a]/60" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {store.former_agents.map((fa) => {
                const motifStyle = fa.motif_type === "licencie"
                  ? { bg: "bg-[#FF3B30]/8 dark:bg-[#FF453A]/15", border: "border-[#FF3B30]/30", label: "Licencié" }
                  : fa.motif_type === "demission"
                    ? { bg: "bg-[#FF9500]/8 dark:bg-[#FF9F0A]/15", border: "border-[#FF9500]/30", label: "Démission" }
                    : fa.motif_type === "burnout"
                      ? { bg: "bg-[#AF52DE]/8 dark:bg-[#BF5AF2]/15", border: "border-[#AF52DE]/30", label: "Burn-out" }
                      : { bg: "bg-[#86868B]/8 dark:bg-white/10", border: "border-[#86868B]/30", label: "Fin contrat" };
                return (
                  <div key={fa.id} className={`bg-white dark:bg-[#1c1c1e] rounded-[14px] p-3 border ${motifStyle.border} opacity-90`}>
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 grayscale" style={{ backgroundColor: fa.avatar_color }}>
                        {fa.initiales}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white line-through opacity-80">{fa.nom}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${motifStyle.bg} ${motifStyle.border.replace("border-", "text-")}`}>
                            {motifStyle.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                          {fa.role} · {fa.filiere} · {fa.duree_cabinet_jours}j dans le cabinet
                        </div>
                        <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-0.5 italic">
                          Parti J{fa.departure_game_day} · Motif : {fa.motif}
                        </div>
                      </div>
                    </div>
                    {fa.dossiers_transferes_a.length > 0 && (
                      <div className="text-[10px] text-[#3a3a3c] dark:text-[#d1d1d6] bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5">
                        <span className="font-semibold">📂 Dossiers transférés :</span>{" "}
                        {fa.dossiers_transferes_a.map((d) => `${d.dossier} → ${d.nouvel_agent.split(" ")[0]}`).join(", ")}
                      </div>
                    )}
                    <div className="mt-1.5 text-[9px] text-[#86868B] dark:text-[#98989D] flex items-center gap-2">
                      <span>Confiance finale : <span className="font-semibold">{fa.final_confiance}/100</span></span>
                      <span>·</span>
                      <span>Loyauté finale : <span className="font-semibold">{fa.final_loyaute}/100</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Crise */}
        {view === "crise" && (
          <>
            <div className="bg-gradient-to-r from-[#FF3B30] to-[#FF9500] text-white rounded-[16px] p-4 mb-4 flex items-center gap-3 shadow-md">
              <Flame size={28} className="animate-pulse" />
              <div>
                <div className="text-[15px] font-bold">Mode Crise activé</div>
                <div className="text-[12px] text-white/90">{enCrise.length} collaborateur{enCrise.length > 1 ? "s" : ""} en détresse · Intervention recommandée</div>
              </div>
              {enCrise.length > 0 && (
                <button onClick={() => enCrise.forEach((a) => store.talkAgent(a.id))}
                  className="ml-auto px-3 py-1.5 bg-white text-[#FF3B30] rounded-[8px] text-[12px] font-semibold hover:bg-white/90 transition-all">
                  Intervenir sur tous (+1 PA/personne)
                </button>
              )}
            </div>

            {enCrise.length === 0 ? (
              <div className="bg-white rounded-[16px] p-12 text-center border border-[#34C759]/20">
                <CheckCircle size={48} className="text-[#34C759] mx-auto mb-3" />
                <p className="text-[15px] font-semibold text-[#34C759]">Aucune crise détectée</p>
                <p className="text-[12px] text-[#86868B] mt-1">Toute l'équipe est dans le vert. Bon travail !</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {enCrise.map((a: any) => {
                  const alerts = getAlerts(a);
                  return (
                    <div key={a.id} onClick={() => setDetailId(a.id)}
                      className="bg-white rounded-[18px] p-4 border-l-[4px] border-l-[#FF3B30] border-y border-r border-[#FF3B30]/20 shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-md" style={{ backgroundColor: a.avatar_color }}>
                            {a.initiales}
                          </div>
                          <div className="absolute inset-0 rounded-full ring-2 ring-[#FF3B30] animate-pulse pointer-events-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-semibold text-[14px] text-[#1D1D1F] truncate">{a.nom}</span>
                            <span className="text-[10px] font-bold bg-[#FF3B30] text-white px-1.5 py-0.5 rounded-md">🔥 URGENT</span>
                          </div>
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
                      <div className="grid grid-cols-3 gap-1 mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleAction(a.id, "talk")} className="px-1 py-1.5 text-[10px] bg-[#007AFF]/8 text-[#007AFF] hover:bg-[#007AFF]/15 rounded-[6px] flex items-center justify-center gap-1 font-medium">
                          <MessageSquare size={10} /> Parler
                        </button>
                        <button onClick={() => handleAction(a.id, "train")} className="px-1 py-1.5 text-[10px] bg-[#AF52DE]/8 text-[#AF52DE] hover:bg-[#AF52DE]/15 rounded-[6px] flex items-center justify-center gap-1 font-medium">
                          <BookOpen size={10} /> Former
                        </button>
                        <button onClick={() => handleAction(a.id, "reward")} className="px-1 py-1.5 text-[10px] bg-[#34C759]/8 text-[#34C759] hover:bg-[#34C759]/15 rounded-[6px] flex items-center justify-center gap-1 font-medium">
                          <Award size={10} /> Récomp.
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Vue Organigramme — schéma hiérarchique avec lignes de liaison */}
        {view === "org" && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] border border-[#E5E5EA]/40 dark:border-[#38383a] p-6 overflow-x-auto">
            <div className="min-w-[680px] flex flex-col items-center gap-0">
              {[
                { label: "Direction", agents: directeurs, color: "#AF52DE", emoji: "👑" },
                { label: "Managers", agents: managers, color: "#007AFF", emoji: "🎩" },
                { label: "Collaborateurs", agents: collabs, color: "#34C759", emoji: "🧑‍💼" },
                { label: "Stagiaires", agents: stagiaires, color: "#FF9500", emoji: "🎓" },
              ].map((row, rowIdx, allRows) => {
                if (row.agents.length === 0) return null;
                const hasNext = allRows.slice(rowIdx + 1).some((r) => r.agents.length > 0);
                return (
                  <div key={row.label} className="w-full flex flex-col items-center">
                    {/* Label de niveau */}
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="text-[14px]">{row.emoji}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: row.color }}>{row.label}</span>
                      <span className="text-[9px] text-[#86868B] dark:text-[#98989D]">({row.agents.length})</span>
                    </div>
                    {/* Cartes */}
                    <div className="flex items-center justify-center gap-3 flex-wrap mb-1">
                      {row.agents.map((a: any) => {
                        const alerts = getAlerts(a);
                        const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
                        const chargeColor = charge >= 4 ? "#FF3B30" : charge >= 3 ? "#FF9500" : "#34C759";
                        return (
                          <button key={a.id} onClick={() => setDetailId(a.id)}
                            className="bg-white dark:bg-[#2c2c2e] rounded-[14px] p-2.5 border-2 hover:shadow-md transition-all text-left min-w-[150px]"
                            style={{ borderColor: `${row.color}40` }}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                                {a.initiales}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white truncate">{a.nom.split(" ")[0]} {a.nom.split(" ")[1]?.[0] || ""}.</div>
                                <div className="text-[9px] text-[#86868B] dark:text-[#98989D] truncate">{a.filiere}</div>
                              </div>
                              {alerts.length > 0 && (
                                <div className="flex gap-0.5">
                                  {alerts.slice(0, 2).map((al, i) => <span key={i} className="text-[10px]" title={al.label}>{al.icon}</span>)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[9px] gap-1">
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${a.stress > 70 ? "bg-[#FF3B30]/15 text-[#FF3B30]" : "bg-[#86868B]/15 text-[#86868B] dark:text-[#98989D]"}`}>S{a.stress}</span>
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${a.confiance_joueur < 40 ? "bg-[#FF3B30]/15 text-[#FF3B30]" : "bg-[#34C759]/15 text-[#34C759]"}`}>C{a.confiance_joueur}</span>
                              <span className="px-1.5 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: chargeColor }}>📁 {charge}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Ligne verticale de liaison vers le niveau suivant */}
                    {hasNext && (
                      <div className="h-8 w-[2px]" style={{ backgroundColor: `${row.color}40` }} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-4 text-center">
              Légende : <span className="text-[#34C759] font-medium">📁 ≤2</span> sain · <span className="text-[#FF9500] font-medium">📁 3</span> chargé · <span className="text-[#FF3B30] font-medium">📁 ≥4</span> surchargé
            </p>
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
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] bg-gradient-to-r from-[#F5F5F7] to-white">
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

        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 dark:border-[#38383a]">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "talk", label: "Parler", desc: "5min · +3", icon: MessageSquare, color: "#007AFF", cd: cooldowns.talk },
              { id: "reward", label: "Récompenser", desc: "10min · 500€", icon: Award, color: "#34C759", cd: cooldowns.reward },
              { id: "train", label: "Former", desc: "3h · 3k€", icon: BookOpen, color: "#AF52DE", cd: cooldowns.train },
              { id: "reprimand", label: "Réprimander", desc: "10min · risque", icon: Megaphone, color: "#FF3B30", cd: cooldowns.reprimand },
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
