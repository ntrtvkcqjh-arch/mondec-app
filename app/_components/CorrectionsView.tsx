"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import type { ChatCorrection } from "@/lib/supabase-store";
import { GraduationCap, BookOpen, TrendingUp, Filter, Trash2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";

type DateFilter = "tous" | "aujourd_hui" | "semaine" | "ancien";
type CatFilter = "tous" | string;

export function CorrectionsView() {
  const store = useGameStore();
  const corrections = store.chat_corrections;
  const [dateFilter, setDateFilter] = useState<DateFilter>("tous");
  const [catFilter, setCatFilter] = useState<CatFilter>("tous");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filtres
  const filtered = corrections.filter((c) => {
    if (dateFilter === "aujourd_hui" && c.game_day !== store.game_day) return false;
    if (dateFilter === "semaine" && store.game_day - c.game_day > 7) return false;
    if (dateFilter === "ancien" && store.game_day - c.game_day <= 7) return false;
    if (catFilter !== "tous" && c.categorie_dec !== catFilter) return false;
    return true;
  });

  // Stats globales
  const totalCorrections = corrections.length;
  const moyenneTotal = totalCorrections > 0
    ? (corrections.reduce((s, c) => s + c.note_sur_20, 0) / totalCorrections).toFixed(1)
    : "—";
  const moyenneJour = corrections.filter((c) => c.game_day === store.game_day).length > 0
    ? (corrections.filter((c) => c.game_day === store.game_day).reduce((s, c) => s + c.note_sur_20, 0) / corrections.filter((c) => c.game_day === store.game_day).length).toFixed(1)
    : "—";

  // Catégories présentes
  const categories = Array.from(new Set(corrections.map((c) => c.categorie_dec)));

  // Grouper par jour pour l'affichage
  const grouped: Record<number, ChatCorrection[]> = {};
  filtered.forEach((c) => {
    if (!grouped[c.game_day]) grouped[c.game_day] = [];
    grouped[c.game_day].push(c);
  });
  const sortedDays = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function noteColor(note: number): string {
    if (note >= 16) return "#34C759";
    if (note >= 12) return "#007AFF";
    if (note >= 8) return "#FF9500";
    return "#FF3B30";
  }

  function noteLabel(note: number): string {
    if (note >= 16) return "Très bien";
    if (note >= 12) return "Bien";
    if (note >= 8) return "Passable";
    if (note >= 5) return "Insuffisant";
    return "Très insuffisant";
  }

  // Dernière correction (la claque la plus récente)
  const lastCorrection = corrections[0]; // déjà triées par date desc dans addChatCorrection

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="CORRECTIONS"
        stats={[
          { value: totalCorrections, label: "évaluations" },
          { value: `${moyenneTotal}/20`, label: "moyenne générale", tone: typeof moyenneTotal === "string" && moyenneTotal !== "—" && parseFloat(moyenneTotal) < 8 ? "critical" : parseFloat(moyenneTotal as string) < 12 ? "warning" : "default" },
          { value: `${moyenneJour}/20`, label: `moyenne du jour` },
        ]}
      />

      <div className="max-w-[1200px] mx-auto px-10 pb-16">
        {corrections.length > 0 && (
          <button
            onClick={() => { if (confirm("Effacer tout l'historique des corrections ?")) store.clearChatCorrections(); }}
            className="text-[11px] px-3 py-1.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#6b7280] dark:text-[#98989D] hover:text-[#FF3B30] shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-medium flex items-center gap-1.5 mb-6"
          >
            <Trash2 size={11} /> Effacer l'historique
          </button>
        )}

        {/* HERO : DERNIÈRE CORRECTION (la fiche de feedback) */}
        {lastCorrection && (() => {
          const c = lastCorrection;
          const note = c.note_sur_20;
          const color = noteColor(note);
          const date = new Date(c.date_iso);
          return (
            <Card className="p-8 mb-8">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#98989D]">Dernière correction</span>
                <span className="text-[11px] text-[#9ca3af] dark:text-[#6b7280]">·</span>
                <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">
                  {date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <div className="flex items-end gap-6 mb-6">
                <div className="text-[88px] font-semibold tabular-nums leading-[0.85] tracking-[-0.04em]" style={{ color }}>
                  {note}
                </div>
                <div className="text-[18px] text-[#9ca3af] dark:text-[#6b7280] tabular-nums pb-3">/20</div>
                <div className="text-[16px] font-medium pb-3" style={{ color }}>{noteLabel(note)}</div>
              </div>
              {/* Tags catégorie + agent */}
              <div className="flex items-center gap-2 flex-wrap mb-5">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#d1d1d6]">
                  {c.categorie_dec}
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#6b7280] dark:text-[#98989D]">
                  Avec {c.agent_nom}
                </span>
              </div>
              {/* Verdict en gros */}
              {c.verdict && (
                <p className="text-[19px] font-medium text-[#111111] dark:text-white tracking-[-0.01em] leading-[1.35] mb-5 italic">
                  "{c.verdict}"
                </p>
              )}
              {/* Ta réponse */}
              <div className="mb-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] dark:text-[#98989D] mb-1.5">Ta réponse</div>
                <p className="text-[13px] text-[#3a3a3c] dark:text-[#d1d1d6] leading-relaxed italic">"{c.player_response}"</p>
              </div>
              {/* Réponse idéale */}
              {c.reponse_ideale && (
                <div className="bg-[#34C759]/5 dark:bg-[#30D158]/10 rounded-[16px] p-4 mt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#248A3D] dark:text-[#30D158] mb-1.5 flex items-center gap-1.5">
                    <BookOpen size={11} /> Ce qu'aurait fait un EC senior
                  </div>
                  <p className="text-[13px] text-[#111111] dark:text-[#d1d1d6] leading-relaxed">"{c.reponse_ideale}"</p>
                </div>
              )}
              {/* Sources */}
              {c.sources?.length > 0 && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] dark:text-[#98989D]">Sources</span>
                  {c.sources.map((s, i) => (
                    <span key={i} className="text-[10.5px] bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#d1d1d6] px-2 py-0.5 rounded-md font-mono">{s}</span>
                  ))}
                </div>
              )}
            </Card>
          );
        })()}

        {/* Filtres */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] dark:text-[#98989D] mr-1">Historique</span>
          <div className="flex gap-1 bg-white dark:bg-[#1c1c1e] p-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            {([
              { id: "tous", label: "Tout" },
              { id: "aujourd_hui", label: "Aujourd'hui" },
              { id: "semaine", label: "7 jours" },
              { id: "ancien", label: "Ancien" },
            ] as Array<{ id: DateFilter; label: string }>).map((f) => (
              <button key={f.id} onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1 text-[12px] font-medium rounded-full transition-all ${dateFilter === f.id ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]" : "text-[#6b7280] dark:text-[#98989D]"}`}>
                {f.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#3a3a3c] dark:text-[#d1d1d6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border-0 outline-none">
              <option value="tous">Toutes catégories</option>
              {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          )}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter size={14} className="text-[#86868B] dark:text-[#98989D]" />
          <div className="flex gap-1 bg-[#F5F5F7] dark:bg-[#2c2c2e] p-1 rounded-[10px]">
            {([
              { id: "tous", label: "Tout" },
              { id: "aujourd_hui", label: "Aujourd'hui" },
              { id: "semaine", label: "7 derniers jours" },
              { id: "ancien", label: "Plus ancien" },
            ] as Array<{ id: DateFilter; label: string }>).map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-[7px] transition-all ${
                  dateFilter === f.id ? "bg-white dark:bg-[#3a3a3c] text-[#1D1D1F] dark:text-white shadow-sm" : "text-[#86868B] dark:text-[#98989D]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="text-[11px] px-2.5 py-1.5 rounded-[8px] border border-[#E5E5EA] dark:border-[#38383a] bg-white dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white outline-none"
            >
              <option value="tous">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <GraduationCap size={32} className="mx-auto mb-2 text-[#86868B] dark:text-[#98989D] opacity-40" />
            <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">
              {corrections.length === 0
                ? "Aucune correction encore. Tes réponses dans le chat agents seront évaluées automatiquement par un examinateur DEC senior."
                : "Aucune correction dans ce filtre."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDays.map((day) => {
              const dayCorrs = grouped[day];
              const moyenneJ = (dayCorrs.reduce((s, c) => s + c.note_sur_20, 0) / dayCorrs.length).toFixed(1);
              const date = new Date(2026, 4, 14);
              date.setDate(date.getDate() + day - 1);
              const dateLabel = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">Jour {day}</span>
                    <span className="text-[11px] text-[#86868B] dark:text-[#98989D] capitalize">· {dateLabel}</span>
                    <div className="flex-1 h-[1px] bg-[#E5E5EA]/40 dark:bg-[#38383a]/60" />
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: noteColor(parseFloat(moyenneJ)) }}>{moyenneJ}/20</span>
                    <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">({dayCorrs.length} corr.)</span>
                  </div>
                  <div className="space-y-2">
                    {dayCorrs.map((c) => {
                      const isExpanded = expanded.has(c.id);
                      const color = noteColor(c.note_sur_20);
                      return (
                        <div key={c.id} className="bg-white dark:bg-[#1c1c1e] rounded-[14px] border border-[#E5E5EA]/40 dark:border-[#38383a] overflow-hidden">
                          {/* En-tête cliquable */}
                          <button
                            onClick={() => toggleExpand(c.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#F5F5F7]/40 dark:hover:bg-[#2c2c2e]/40 transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-[10px] shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>{c.note_sur_20}</div>
                              <div className="text-[8px] uppercase tracking-wider" style={{ color }}>/20</div>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{c.agent_nom}</span>
                                <span className="text-[9px] text-[#86868B] dark:text-[#98989D]">{c.agent_role}</span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#AF52DE]/10 text-[#AF52DE]">{c.categorie_dec}</span>
                                <span className="text-[9px] text-[#86868B] dark:text-[#98989D] ml-auto tabular-nums">{String(c.game_hour).padStart(2, "0")}h{String(c.game_minute).padStart(2, "0")}</span>
                              </div>
                              <div className="text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] italic mt-0.5 line-clamp-1">"{c.verdict}"</div>
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-[#86868B] shrink-0" /> : <ChevronDown size={14} className="text-[#86868B] shrink-0" />}
                          </button>

                          {/* Détails dépliés */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60">
                              {/* Le message original de l'agent */}
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mb-1">Message de l'agent</div>
                                <div className="bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] p-2.5 text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] italic">
                                  "{c.agent_message}"
                                </div>
                              </div>

                              {/* Ta réponse */}
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mb-1">Ta réponse</div>
                                <div className="bg-gradient-to-br from-[#007AFF]/8 to-[#5856D6]/8 dark:from-[#0A84FF]/15 dark:to-[#5E5CE6]/15 rounded-[8px] p-2.5 text-[11px] text-[#1D1D1F] dark:text-white">
                                  "{c.player_response}"
                                </div>
                              </div>

                              {/* Points forts / faibles */}
                              {(c.points_forts.length > 0 || c.points_faibles.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {c.points_forts.length > 0 && (
                                    <div className="bg-[#34C759]/5 dark:bg-[#30D158]/12 border border-[#34C759]/20 rounded-[8px] p-2.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D] dark:text-[#30D158] mb-1">✓ Points forts</div>
                                      <ul className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] space-y-0.5">
                                        {c.points_forts.map((p, i) => <li key={i}>• {p}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {c.points_faibles.length > 0 && (
                                    <div className="bg-[#FF3B30]/5 dark:bg-[#FF453A]/12 border border-[#FF3B30]/20 rounded-[8px] p-2.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF3B30] dark:text-[#FF453A] mb-1">✗ Points faibles</div>
                                      <ul className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] space-y-0.5">
                                        {c.points_faibles.map((p, i) => <li key={i}>• {p}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Correction détaillée */}
                              {c.correction_detaillee && (
                                <div className="bg-gradient-to-br from-[#AF52DE]/5 to-[#5856D6]/5 dark:from-[#BF5AF2]/12 dark:to-[#5E5CE6]/12 border border-[#AF52DE]/20 dark:border-[#BF5AF2]/30 rounded-[8px] p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#AF52DE] dark:text-[#BF5AF2] mb-1 flex items-center gap-1.5">
                                    <Sparkles size={11} /> Correction de l'examinateur
                                  </div>
                                  <p className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed">{c.correction_detaillee}</p>
                                </div>
                              )}

                              {/* Réponse idéale */}
                              {c.reponse_ideale && (
                                <div className="bg-[#34C759]/5 dark:bg-[#30D158]/12 border border-[#34C759]/20 rounded-[8px] p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D] dark:text-[#30D158] mb-1 flex items-center gap-1.5">
                                    <BookOpen size={11} /> Réponse idéale (modèle EC)
                                  </div>
                                  <p className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed italic">"{c.reponse_ideale}"</p>
                                </div>
                              )}

                              {/* Sources */}
                              {c.sources.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mr-1">📖 Sources :</span>
                                  {c.sources.map((s, i) => (
                                    <span key={i} className="text-[10px] bg-[#86868B]/10 dark:bg-white/10 text-[#3a3a3c] dark:text-[#d1d1d6] px-2 py-0.5 rounded-md font-mono">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
