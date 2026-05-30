"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import type { Email, MailContact } from "@/lib/supabase-store";
import { Inbox, Send, Pencil, X, Reply, Search, Paperclip, AlertTriangle, Clock, ChevronLeft } from "lucide-react";

type MailFolder = "inbox" | "sent" | "compose";

export function MailView() {
  const store = useGameStore();
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [openMail, setOpenMail] = useState<Email | null>(null);
  const [search, setSearch] = useState("");
  const [composeTo, setComposeTo] = useState<MailContact[]>([]);
  const [composeCc, setComposeCc] = useState<MailContact[]>([]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyExpectedCc, setReplyExpectedCc] = useState<string[]>([]);

  // Génère les mails initiaux si vide + check relances toutes les 30s
  useEffect(() => {
    if (store.mails.length === 0) {
      store.generateInitialMails();
    }
    const interval = setInterval(() => store.checkAndGenerateRelances(), 30000);
    return () => clearInterval(interval);
  }, [store.mails.length]);

  const inbox = store.mails.filter((m) => m.direction === "in");
  const sent = store.mails.filter((m) => m.direction === "out");
  const unreadCount = inbox.filter((m) => !m.read).length;

  const visibleMails = folder === "inbox" ? inbox : sent;
  const filteredMails = search
    ? visibleMails.filter((m) =>
        m.subject.toLowerCase().includes(search.toLowerCase()) ||
        m.from.name.toLowerCase().includes(search.toLowerCase()) ||
        m.body.toLowerCase().includes(search.toLowerCase())
      )
    : visibleMails;

  function openMailDetail(m: Email) {
    setOpenMail(m);
    if (!m.read) store.markMailRead(m.id);
  }

  function startReply(m: Email) {
    setComposeTo([m.from]);
    setComposeCc(m.cc.filter((c) => c.type !== "self"));
    setComposeSubject(m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`);
    setComposeBody(`\n\n---\nLe ${new Date(m.date_iso).toLocaleString("fr-FR")}, ${m.from.name} a écrit :\n> ${m.body.split("\n").join("\n> ")}`);
    setReplyParentId(m.id);
    setReplyExpectedCc(m.expected_cc_ids || []);
    setFolder("compose");
    setOpenMail(null);
  }

  function startCompose() {
    setComposeTo([]);
    setComposeCc([]);
    setComposeSubject("");
    setComposeBody("");
    setReplyParentId(null);
    setReplyExpectedCc([]);
    setFolder("compose");
    setOpenMail(null);
  }

  function handleSend() {
    if (composeTo.length === 0 || !composeSubject.trim()) {
      alert("Indique au moins un destinataire et un objet.");
      return;
    }
    store.sendMail({
      to: composeTo,
      cc: composeCc,
      subject: composeSubject.trim(),
      body: composeBody.trim(),
      parent_id: replyParentId || undefined,
      expected_cc_ids: replyExpectedCc,
    });
    setFolder("sent");
    setComposeTo([]);
    setComposeCc([]);
    setComposeSubject("");
    setComposeBody("");
    setReplyParentId(null);
    setReplyExpectedCc([]);
  }

  // Suggestions de contacts pour To/CC (clients depuis dossiers + agents)
  const contactSuggestions: MailContact[] = [
    ...store.agents.map((a) => ({
      type: "agent" as const,
      id: a.id,
      name: a.nom,
      email: `${a.nom.toLowerCase().replace(/\s+/g, ".")}@cabinet-morel.fr`,
    })),
    ...store.dossiers.map((d) => {
      const slug = d.client.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      return {
        type: "client" as const,
        id: d.id,
        name: `Direction ${d.client}`,
        email: `direction@${slug}.fr`,
      };
    }),
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#fafafa] dark:bg-black">
      {/* Sidebar Mail */}
      <div className="w-64 bg-white/60 dark:bg-[#1c1c1e] backdrop-blur border-r border-[#E5E5EA]/40 dark:border-[#38383a] flex flex-col">
        <div className="px-4 py-4">
          <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#1D1D1F] dark:text-white leading-none">Mail.</h2>
        </div>
        <button
          onClick={startCompose}
          className="mx-3 mb-3 px-3 py-2.5 rounded-[12px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white text-[12px] font-semibold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
        >
          <Pencil size={12} /> Composer
        </button>
        <nav className="flex-1 px-2 space-y-0.5">
          <button
            onClick={() => setFolder("inbox")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] transition-all ${
              folder === "inbox"
                ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] font-semibold"
                : "text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e]"
            }`}
          >
            <Inbox size={13} />
            <span className="flex-1 text-left">Boîte de réception</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF3B30] text-white">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setFolder("sent")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] transition-all ${
              folder === "sent"
                ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] font-semibold"
                : "text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e]"
            }`}
          >
            <Send size={13} />
            <span className="flex-1 text-left">Envoyés</span>
            <span className="text-[10px] text-[#86868B]">{sent.length}</span>
          </button>
        </nav>
        <div className="px-3 pb-4 pt-2 border-t border-[#E5E5EA]/30 dark:border-[#38383a]">
          <p className="text-[10px] text-[#86868B] dark:text-[#98989D] leading-snug">
            <strong>Relances auto</strong> : un mail non répondu après 2 jours déclenche une relance automatique du contact. Max 2 relances par mail.
          </p>
        </div>
      </div>

      {/* Liste des mails OU composer */}
      {folder !== "compose" && (
        <div className="w-[380px] bg-white/40 dark:bg-[#0F0F10] border-r border-[#E5E5EA]/40 dark:border-[#38383a] flex flex-col">
          <div className="px-4 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans les mails…"
                className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-[8px] bg-[#F5F5F7] dark:bg-[#2c2c2e] border-0 outline-none text-[#1D1D1F] dark:text-white placeholder-[#86868B]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredMails.length === 0 && (
              <div className="text-center py-12 px-4 text-[11px] text-[#86868B] dark:text-[#98989D]">
                {search ? "Aucun mail trouvé pour cette recherche." : folder === "inbox" ? "Boîte de réception vide." : "Aucun mail envoyé."}
              </div>
            )}
            {filteredMails.map((m) => {
              const isSelected = openMail?.id === m.id;
              const isRelance = m.subject.includes("[Relance");
              return (
                <button
                  key={m.id}
                  onClick={() => openMailDetail(m)}
                  className={`w-full text-left px-4 py-3 border-b border-[#E5E5EA]/30 dark:border-[#38383a]/60 transition-colors ${
                    isSelected
                      ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/15"
                      : !m.read && m.direction === "in"
                        ? "bg-white dark:bg-[#1c1c1e] hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e]"
                        : "hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {!m.read && m.direction === "in" && (
                      <div className="w-2 h-2 rounded-full bg-[#007AFF] shrink-0" />
                    )}
                    <span className={`text-[12px] flex-1 truncate ${
                      !m.read && m.direction === "in" ? "font-semibold text-[#1D1D1F] dark:text-white" : "text-[#3a3a3c] dark:text-[#d1d1d6]"
                    }`}>
                      {m.direction === "in" ? m.from.name : `→ ${m.to.map((t) => t.name).join(", ")}`}
                    </span>
                    <span className="text-[10px] text-[#86868B] dark:text-[#98989D] shrink-0">
                      {new Date(m.date_iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className={`text-[11px] truncate mb-0.5 flex items-center gap-1.5 ${
                    !m.read && m.direction === "in" ? "font-semibold text-[#1D1D1F] dark:text-white" : "text-[#3a3a3c] dark:text-[#d1d1d6]"
                  }`}>
                    {isRelance && <AlertTriangle size={10} className="text-[#FF9500] shrink-0" />}
                    <span className="truncate">{m.subject}</span>
                  </div>
                  <div className="text-[10px] text-[#86868B] dark:text-[#98989D] truncate">{m.body.replace(/\n/g, " ").slice(0, 80)}…</div>
                  {m.cc.length > 0 && (
                    <div className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 italic">CC : {m.cc.map((c) => c.name).join(", ")}</div>
                  )}
                  {m.direction === "in" && !m.replied && m.relance_count > 0 && (
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#FF9500]/15 text-[#FF9500] mt-1">
                      ⏰ {m.relance_count} relance{m.relance_count > 1 ? "s" : ""}
                    </span>
                  )}
                  {m.direction === "in" && m.replied && (
                    <span className="inline-block text-[9px] text-[#34C759] mt-1">✓ Répondu</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Détail mail OU composer */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-[#1c1c1e]">
        {folder === "compose" ? (
          <Compose
            to={composeTo} setTo={setComposeTo}
            cc={composeCc} setCc={setComposeCc}
            subject={composeSubject} setSubject={setComposeSubject}
            body={composeBody} setBody={setComposeBody}
            contactSuggestions={contactSuggestions}
            expectedCc={replyExpectedCc}
            onSend={handleSend}
            onCancel={() => { setFolder("inbox"); setReplyParentId(null); }}
          />
        ) : openMail ? (
          <MailDetail mail={openMail} onClose={() => setOpenMail(null)} onReply={() => startReply(openMail)} onDelete={() => { store.deleteMail(openMail.id); setOpenMail(null); }} />
        ) : (
          <div className="flex items-center justify-center h-full text-[#86868B] dark:text-[#98989D] text-[13px]">
            Sélectionne un mail à gauche pour le lire.
          </div>
        )}
      </main>
    </div>
  );
}

function MailDetail({ mail, onClose, onReply, onDelete }: { mail: Email; onClose: () => void; onReply: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center gap-2">
        <button onClick={onClose} className="lg:hidden w-7 h-7 rounded-full hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e] flex items-center justify-center">
          <ChevronLeft size={14} className="text-[#86868B]" />
        </button>
        <h3 className="flex-1 text-[16px] font-semibold text-[#1D1D1F] dark:text-white truncate">{mail.subject}</h3>
        <button onClick={onReply}
          className="px-3 py-1.5 rounded-[10px] bg-[#007AFF] hover:bg-[#0066d4] text-white text-[12px] font-semibold flex items-center gap-1.5">
          <Reply size={11} /> Répondre
        </button>
        <button onClick={onDelete}
          className="px-2.5 py-1.5 rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF3B30]/15 text-[#86868B] hover:text-[#FF3B30] text-[12px] flex items-center gap-1.5">
          <X size={11} /> Supprimer
        </button>
      </div>
      <div className="px-6 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a] space-y-1 text-[12px]">
        <div className="flex items-start gap-2">
          <span className="text-[#86868B] dark:text-[#98989D] w-12 shrink-0">De :</span>
          <span className="text-[#1D1D1F] dark:text-white">
            <strong>{mail.from.name}</strong> &lt;{mail.from.email}&gt;
            {mail.from.type === "client" && <span className="ml-1.5 text-[9px] bg-[#34C759]/15 text-[#34C759] px-1.5 py-0.5 rounded">CLIENT</span>}
            {mail.from.type === "agent" && <span className="ml-1.5 text-[9px] bg-[#007AFF]/15 text-[#007AFF] px-1.5 py-0.5 rounded">ÉQUIPE</span>}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#86868B] dark:text-[#98989D] w-12 shrink-0">À :</span>
          <span className="text-[#3a3a3c] dark:text-[#d1d1d6]">{mail.to.map((t) => `${t.name} <${t.email}>`).join(", ")}</span>
        </div>
        {mail.cc.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[#86868B] dark:text-[#98989D] w-12 shrink-0">CC :</span>
            <span className="text-[#3a3a3c] dark:text-[#d1d1d6]">{mail.cc.map((c) => `${c.name} <${c.email}>`).join(", ")}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <span className="text-[#86868B] dark:text-[#98989D] w-12 shrink-0">Date :</span>
          <span className="text-[#86868B] dark:text-[#98989D]">{new Date(mail.date_iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}</span>
        </div>
        {mail.relance_count > 0 && mail.direction === "in" && (
          <div className="flex items-start gap-2 pt-1">
            <Clock size={11} className="text-[#FF9500] mt-0.5" />
            <span className="text-[11px] text-[#FF9500] italic">
              {mail.relance_count} relance{mail.relance_count > 1 ? "s" : ""} envoyée{mail.relance_count > 1 ? "s" : ""} par l'expéditeur · Réponse attendue
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <pre className="text-[13px] text-[#1D1D1F] dark:text-[#d1d1d6] whitespace-pre-wrap font-sans leading-relaxed">{mail.body}</pre>
      </div>
    </div>
  );
}

function Compose({
  to, setTo, cc, setCc, subject, setSubject, body, setBody, contactSuggestions, expectedCc, onSend, onCancel,
}: {
  to: MailContact[]; setTo: (v: MailContact[]) => void;
  cc: MailContact[]; setCc: (v: MailContact[]) => void;
  subject: string; setSubject: (v: string) => void;
  body: string; setBody: (v: string) => void;
  contactSuggestions: MailContact[];
  expectedCc: string[];
  onSend: () => void;
  onCancel: () => void;
}) {
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [showCcField, setShowCcField] = useState(cc.length > 0);

  function addContactByEmail(input: string, target: "to" | "cc") {
    const lower = input.trim().toLowerCase();
    if (!lower) return;
    const match = contactSuggestions.find((c) => c.email.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower));
    const contact: MailContact = match || { type: "external", name: input.trim(), email: input.trim().includes("@") ? input.trim() : `${input.trim().toLowerCase().replace(/\s+/g, ".")}@externe.fr` };
    if (target === "to") {
      setTo([...to, contact]);
      setToInput("");
    } else {
      setCc([...cc, contact]);
      setCcInput("");
    }
  }

  function removeContact(target: "to" | "cc", idx: number) {
    if (target === "to") setTo(to.filter((_, i) => i !== idx));
    else setCc(cc.filter((_, i) => i !== idx));
  }

  // Suggère les CC manqués en cas de réponse
  const missingExpectedCc = expectedCc.filter((id) => !cc.some((c) => c.id === id));
  const missingContacts = missingExpectedCc
    .map((id) => contactSuggestions.find((c) => c.id === id))
    .filter(Boolean) as MailContact[];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white">Nouveau message</h3>
        <button onClick={onCancel} className="w-7 h-7 rounded-full hover:bg-[#F5F5F7] dark:hover:bg-[#2c2c2e] flex items-center justify-center">
          <X size={14} className="text-[#86868B]" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-2 border-b border-[#E5E5EA]/40 dark:border-[#38383a]">
        {/* À */}
        <div className="flex items-start gap-2">
          <span className="text-[12px] text-[#86868B] dark:text-[#98989D] w-12 shrink-0 mt-1.5">À :</span>
          <div className="flex-1 flex items-center flex-wrap gap-1 bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5 min-h-[32px]">
            {to.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#007AFF]/15 text-[#007AFF] dark:text-[#0A84FF] text-[11px]">
                {c.name}
                <button onClick={() => removeContact("to", i)} className="hover:bg-[#007AFF]/20 rounded-full"><X size={9} /></button>
              </span>
            ))}
            <input
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === ",") && toInput.trim()) { e.preventDefault(); addContactByEmail(toInput, "to"); } }}
              onBlur={() => { if (toInput.trim()) addContactByEmail(toInput, "to"); }}
              placeholder={to.length === 0 ? "Nom ou email du destinataire" : ""}
              className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-[12px] text-[#1D1D1F] dark:text-white placeholder-[#86868B]"
              list="contact-suggestions"
            />
          </div>
          {!showCcField && (
            <button onClick={() => setShowCcField(true)} className="text-[11px] text-[#007AFF] dark:text-[#0A84FF] mt-1.5">Ajouter CC</button>
          )}
        </div>

        {/* CC */}
        {showCcField && (
          <div className="flex items-start gap-2">
            <span className="text-[12px] text-[#86868B] dark:text-[#98989D] w-12 shrink-0 mt-1.5">CC :</span>
            <div className="flex-1 flex items-center flex-wrap gap-1 bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5 min-h-[32px]">
              {cc.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#86868B]/20 text-[#3a3a3c] dark:text-[#d1d1d6] text-[11px]">
                  {c.name}
                  <button onClick={() => removeContact("cc", i)} className="hover:bg-[#86868B]/30 rounded-full"><X size={9} /></button>
                </span>
              ))}
              <input
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === ",") && ccInput.trim()) { e.preventDefault(); addContactByEmail(ccInput, "cc"); } }}
                onBlur={() => { if (ccInput.trim()) addContactByEmail(ccInput, "cc"); }}
                placeholder={cc.length === 0 ? "Personnes en copie" : ""}
                className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-[12px] text-[#1D1D1F] dark:text-white placeholder-[#86868B]"
              />
            </div>
          </div>
        )}

        {/* Sujet */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#86868B] dark:text-[#98989D] w-12 shrink-0">Objet :</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet du message"
            className="flex-1 bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[8px] px-2.5 py-1.5 text-[12px] text-[#1D1D1F] dark:text-white outline-none placeholder-[#86868B]"
          />
        </div>

        {missingContacts.length > 0 && (
          <div className="bg-[#FF9500]/8 border border-[#FF9500]/20 rounded-[8px] px-3 py-2 text-[11px] text-[#C76A00] dark:text-[#FF9F0A]">
            ⚠ Tu réponds à un mail qui attendait <strong>{missingContacts.map((c) => c.name).join(", ")}</strong> en copie. Oublier ces personnes risque d'impacter ta relation (-3 confiance).
            <button onClick={() => setCc([...cc, ...missingContacts])} className="ml-2 underline">Les ajouter en CC</button>
          </div>
        )}

        <datalist id="contact-suggestions">
          {contactSuggestions.map((c, i) => (
            <option key={i} value={c.email}>{c.name}</option>
          ))}
        </datalist>
      </div>

      {/* Corps */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Écris ton message ici…"
        className="flex-1 px-6 py-5 text-[13px] leading-relaxed bg-transparent text-[#1D1D1F] dark:text-white outline-none resize-none font-sans"
      />

      <div className="px-6 py-3 border-t border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between bg-[#fafafa] dark:bg-[#161618]">
        <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
          {to.length} destinataire{to.length > 1 ? "s" : ""}{cc.length > 0 ? ` · ${cc.length} en CC` : ""} · {body.length} car.
        </span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-[12px] rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white">
            Annuler
          </button>
          <button onClick={onSend} disabled={to.length === 0 || !subject.trim()}
            className={`px-4 py-1.5 text-[12px] font-semibold rounded-[10px] flex items-center gap-1.5 ${
              to.length === 0 || !subject.trim()
                ? "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] cursor-not-allowed"
                : "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md hover:shadow-lg"
            }`}>
            <Send size={11} /> Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
