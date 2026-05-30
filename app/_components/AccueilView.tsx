"use client";

import { useGameStore } from "@/lib/supabase-store";
import { TrendingUp, Users, FolderOpen, Mail, GraduationCap, AlertTriangle, Sparkles, Sunrise } from "lucide-react";
import { Card } from "./ui/Card";
import { AgentAvatar, ClientLogo } from "./ui/AgentAvatar";

interface Props {
  onNavigate?: (tab: string) => void;
}

/**
 * Vue ACCUEIL — Hero PHDDEC style + stats cabinet + quick links
 * Première page du jeu, donne la vision complète en un coup d'œil
 */
export function AccueilView({ onNavigate }: Props) {
  const store = useGameStore();

  const dossiersActifs = store.dossiers.filter((d) => d.etat === "en_cours" || d.etat === "surveillance").length;
  const dossiersSurveillance = store.dossiers.filter((d) => d.etat === "surveillance").length;
  const caAnnuel = store.dossiers.reduce((sum, d) => sum + (d.honoraires_annuels || 0), 0);
  const messagesNonLus = store.messages.filter((m) => !m.lu).length;
  const mailsNonLus = store.mails.filter((m) => m.direction === "in" && !m.read).length;
  const agentsAlerte = store.agents.filter((a) => a.stress > 70 || (a as any).arc_actuel === "Rupture").length;
  const prospectsPending = store.prospects_pending.length;
  const lastCorrection = store.chat_corrections[0];
  const moyenneCorrections = store.chat_corrections.length > 0
    ? (store.chat_corrections.reduce((s, c) => s + c.note_sur_20, 0) / store.chat_corrections.length).toFixed(1)
    : null;

  // Période de la journée
  const periode = store.game_hour < 7 ? "Bonne nuit" :
                  store.game_hour < 12 ? "Bonjour" :
                  store.game_hour < 18 ? "Bon après-midi" :
                  store.game_hour < 22 ? "Bonsoir" : "Bonne nuit";

  const today = new Date(2026, 4, 14);
  today.setDate(today.getDate() + store.game_day - 1);
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // Top 3 dossiers VIP
  const dossiersVip = store.dossiers.filter((d) => d.is_vip && d.etat !== "perdu" && d.etat !== "cloture").slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* HERO */}
      <header className="pt-14 pb-10 px-10 max-w-[1200px] mx-auto fade-up">
        <p className="text-[13px] uppercase tracking-[0.12em] font-medium mb-3" style={{ color: "var(--mdec-text-3)" }}>
          {periode} · <span className="capitalize">{dateLabel}</span>
        </p>
        <h1 className="display-num text-[88px] font-semibold leading-[0.85]" style={{ color: "var(--mdec-text)" }}>
          Cabinet<span style={{ color: "var(--mdec-accent)" }}>.</span>
        </h1>
        <div className="mt-6 flex items-baseline gap-x-7 gap-y-2 flex-wrap text-[16px]">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tabular-nums display-num text-[28px]" style={{ color: "var(--mdec-text)" }}>{(caAnnuel / 1000).toFixed(0)}k€</span>
            <span style={{ color: "var(--mdec-text-3)" }}>CA récurrent</span>
          </div>
          <span style={{ color: "var(--mdec-text-4)" }}>·</span>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tabular-nums display-num text-[28px]" style={{ color: "var(--mdec-text)" }}>{store.agents.length}</span>
            <span style={{ color: "var(--mdec-text-3)" }}>collaborateurs</span>
          </div>
          <span style={{ color: "var(--mdec-text-4)" }}>·</span>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tabular-nums display-num text-[28px]" style={{ color: "var(--mdec-text)" }}>{dossiersActifs}</span>
            <span style={{ color: "var(--mdec-text-3)" }}>dossiers actifs</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-10 pb-16 space-y-6">

        {/* KPI tiles principales (style Apple Health) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-up">
          <Kpi label="Trésorerie" value={`${(store.tresorerie / 1000).toFixed(0)}k€`} sub="disponible" tone={store.tresorerie < 30000 ? "critical" : "default"} icon={TrendingUp} onClick={() => onNavigate?.("rh")} />
          <Kpi label="Climat social" value={`${store.team_health}/100`} sub={store.team_health >= 70 ? "Excellent" : store.team_health >= 50 ? "Correct" : "Tendu"} tone={store.team_health < 50 ? "critical" : store.team_health < 70 ? "warning" : "default"} icon={Users} onClick={() => onNavigate?.("equipe")} />
          <Kpi label="Légitimité" value={`${store.legitimite}/100`} sub={store.legitimite >= 70 ? "Solide" : store.legitimite >= 50 ? "Stable" : "Fragile"} tone={store.legitimite < 50 ? "warning" : "default"} icon={Sparkles} />
          <Kpi label="Streak DEC" value={`${store.dec_streak}j`} sub="consécutifs" tone={store.dec_streak === 0 ? "warning" : "default"} icon={GraduationCap} onClick={() => onNavigate?.("dec")} />
        </div>

        {/* Section : à traiter aujourd'hui */}
        <section className="fade-up">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3 px-1" style={{ color: "var(--mdec-text-3)" }}>
            À traiter aujourd'hui
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionTile
              icon={Mail}
              label="Messages"
              count={messagesNonLus + mailsNonLus}
              sub={`${messagesNonLus} chat · ${mailsNonLus} mail`}
              tone={messagesNonLus + mailsNonLus > 0 ? "info" : "default"}
              onClick={() => onNavigate?.(mailsNonLus > messagesNonLus ? "mail" : "messages")}
            />
            <ActionTile
              icon={AlertTriangle}
              label="Équipe en alerte"
              count={agentsAlerte}
              sub={agentsAlerte > 0 ? "à voir en entretien" : "tout va bien"}
              tone={agentsAlerte > 0 ? "warning" : "success"}
              onClick={() => onNavigate?.("entretiens")}
            />
            <ActionTile
              icon={Sparkles}
              label="Nouveaux prospects"
              count={prospectsPending}
              sub={prospectsPending > 0 ? "à examiner" : "rien en cours"}
              tone={prospectsPending > 0 ? "info" : "default"}
              onClick={() => onNavigate?.("dossiers")}
            />
          </div>
        </section>

        {/* Section : Top dossiers VIP */}
        {dossiersVip.length > 0 && (
          <section className="fade-up">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3 px-1" style={{ color: "var(--mdec-text-3)" }}>
              ⭐ Dossiers VIP en cours
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dossiersVip.map((d) => {
                const a = store.agents.find((x) => x.id === d.agent_id);
                const phaseCol = d.phase === "P5" ? "var(--mdec-rose)" : d.phase === "P4" ? "var(--mdec-amber)" : d.phase === "P3" ? "var(--mdec-accent)" : "var(--mdec-mint)";
                return (
                  <Card key={d.id} onClick={() => onNavigate?.("dossiers")} className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <ClientLogo client={d.client} secteur_categorie={d.secteur_categorie} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--mdec-text)" }}>{d.client}</div>
                        <div className="text-[11px] line-clamp-1" style={{ color: "var(--mdec-text-3)" }}>{d.theme}</div>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="display-num text-[24px] font-semibold" style={{ color: "var(--mdec-text)" }}>{d.progression}<span className="text-[12px] opacity-50">%</span></span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: phaseCol }}>{d.phase}</span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden mb-3" style={{ background: "var(--mdec-active)" }}>
                      <div className="h-full rounded-full" style={{ width: `${d.progression}%`, backgroundColor: phaseCol }} />
                    </div>
                    {a && (
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--mdec-text-3)" }}>
                        <AgentAvatar initials={a.initiales} color={a.avatar_color} agentId={a.id} agentName={a.nom} size="xs" online={a.statut === "En ligne"} />
                        <span>{a.nom.split(" ")[0]}</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Section : Dernière correction examinateur (la claque) */}
        {lastCorrection && (
          <section className="fade-up">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3 px-1" style={{ color: "var(--mdec-text-3)" }}>
              📖 Dernière correction examinateur
            </h2>
            <Card onClick={() => onNavigate?.("corrections")} className="p-6">
              <div className="flex items-baseline gap-4 mb-3">
                <span className="display-num text-[56px] font-semibold leading-none" style={{ color: lastCorrection.note_sur_20 >= 14 ? "var(--mdec-mint)" : lastCorrection.note_sur_20 >= 10 ? "var(--mdec-accent)" : lastCorrection.note_sur_20 >= 6 ? "var(--mdec-amber)" : "var(--mdec-rose)" }}>
                  {lastCorrection.note_sur_20}
                </span>
                <span className="text-[16px] opacity-50" style={{ color: "var(--mdec-text-3)" }}>/20</span>
                <span className="text-[12px] uppercase tracking-wider ml-auto" style={{ color: "var(--mdec-text-3)" }}>
                  {moyenneCorrections && `Moyenne ${moyenneCorrections}/20`}
                </span>
              </div>
              <p className="text-[15px] font-medium leading-snug italic mb-2" style={{ color: "var(--mdec-text)" }}>
                "{lastCorrection.verdict}"
              </p>
              <div className="flex items-center gap-2 mt-3 text-[11px]">
                <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--mdec-accent-soft)", color: "var(--mdec-accent)" }}>{lastCorrection.categorie_dec}</span>
                <span style={{ color: "var(--mdec-text-3)" }}>Avec {lastCorrection.agent_nom}</span>
              </div>
            </Card>
          </section>
        )}

      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "default", onClick }: { icon: any; label: string; value: string; sub: string; tone?: "default" | "info" | "success" | "warning" | "critical"; onClick?: () => void }) {
  const tones: Record<string, string> = {
    default: "var(--mdec-text)",
    info: "var(--mdec-accent)",
    success: "var(--mdec-mint)",
    warning: "var(--mdec-amber)",
    critical: "var(--mdec-rose)",
  };
  return (
    <Card onClick={onClick} className="p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--mdec-text-3)" }}>{label}</span>
        <Icon size={16} style={{ color: "var(--mdec-text-4)" }} />
      </div>
      <div className="display-num text-[36px] font-semibold leading-none" style={{ color: tones[tone] }}>
        {value}
      </div>
      <div className="mt-2 text-[11px]" style={{ color: "var(--mdec-text-3)" }}>{sub}</div>
    </Card>
  );
}

function ActionTile({ icon: Icon, label, count, sub, tone = "default", onClick }: { icon: any; label: string; count: number; sub: string; tone?: "default" | "info" | "success" | "warning" | "critical"; onClick?: () => void }) {
  const tones: Record<string, { bg: string; text: string }> = {
    default: { bg: "var(--mdec-active)", text: "var(--mdec-text-3)" },
    info: { bg: "var(--mdec-accent-soft)", text: "var(--mdec-accent)" },
    success: { bg: "var(--mdec-mint-soft)", text: "var(--mdec-mint)" },
    warning: { bg: "var(--mdec-amber-soft)", text: "var(--mdec-amber)" },
    critical: { bg: "var(--mdec-rose-soft)", text: "var(--mdec-rose)" },
  };
  const t = tones[tone];
  return (
    <Card onClick={onClick} className="p-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: t.bg }}>
          <Icon size={20} style={{ color: t.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--mdec-text-3)" }}>{label}</div>
          <div className="display-num text-[28px] font-semibold leading-none mt-1" style={{ color: count > 0 ? t.text : "var(--mdec-text-4)" }}>
            {count}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--mdec-text-3)" }}>{sub}</div>
        </div>
      </div>
    </Card>
  );
}
