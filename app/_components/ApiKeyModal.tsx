"use client";

import { useState } from "react";
import { Key, AlertTriangle, RefreshCw, ExternalLink, Sparkles, X } from "lucide-react";
import { apiFetch, getUserApiKey, setUserApiKey, clearUserApiKey, hasUserApiKey } from "@/lib/api-client";

interface Props {
  open: boolean;
  onClose: () => void;
  onStatusChange: (status: "ok" | "error", reason: string, details?: any) => void;
  apiStatus: "checking" | "ok" | "error";
  apiStatusReason: string;
  apiStatusDetails: { status?: number; attempts?: Array<{ model: string; status: number; message: string }>; diagnostic?: string; needs_credit?: boolean } | null;
}

export function ApiKeyModal({ open, onClose, onStatusChange, apiStatus, apiStatusReason, apiStatusDetails }: Props) {
  const [keyInput, setKeyInput] = useState(getUserApiKey() || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setUserApiKey(keyInput.trim());
    try {
      const r = await apiFetch("/api/health");
      const d = await r.json();
      if (d.ok) {
        onStatusChange("ok", "", null);
        onClose();
      } else {
        onStatusChange("error", d.reason || "Clé invalide", d);
      }
    } catch (err: any) {
      onStatusChange("error", "Erreur réseau", null);
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    clearUserApiKey();
    setKeyInput("");
    onStatusChange("error", "Clé supprimée", null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl dark:shadow-black/60 w-full max-w-md overflow-hidden border border-transparent dark:border-[#38383a]/60">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5 dark:from-[#007AFF]/10 dark:to-[#5856D6]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
              <Key size={15} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-[#1D1D1F] dark:text-white">Connecter Claude</h3>
              <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">Active les agents IA pour ce navigateur</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-[12px] text-[#3a3a3c] dark:text-[#d1d1d6] leading-relaxed">
            Si la clé serveur n'est pas configurée (Vercel), tu peux mettre ta propre clé Anthropic ici.
            Elle est stockée uniquement dans <strong className="dark:text-white">ton navigateur</strong> (localStorage) et ne quitte ton appareil que pour appeler l'API Anthropic via ce site.
          </p>

          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-[#007AFF] dark:text-[#0A84FF] hover:underline">
            Obtenir une clé sur console.anthropic.com <ExternalLink size={11} />
          </a>

          <div>
            <input
              type="password"
              autoFocus
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="sk-ant-api03-..."
              className="w-full text-[12px] p-3 border border-[#E5E5EA] dark:border-[#38383a] rounded-[12px] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 font-mono bg-white dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white placeholder:text-[#86868B] dark:placeholder:text-[#636366]"
            />
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-1.5">
              Format attendu : <code className="bg-[#F5F5F7] dark:bg-[#2c2c2e] dark:text-[#d1d1d6] px-1 rounded">sk-ant-...</code>
            </p>
          </div>

          {apiStatusDetails?.needs_credit && (
            <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
              className="block bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white rounded-[14px] p-3.5 shadow-md hover:shadow-lg transition-all">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} />
                <span className="font-semibold text-[13px]">Charger ton compte Anthropic</span>
                <ExternalLink size={11} className="ml-auto" />
              </div>
              <p className="text-[11px] text-white/85 leading-relaxed">
                Ton compte fonctionne mais n'a pas encore de crédit. Ajoute <strong>5$ minimum</strong> sur console.anthropic.com → Settings → Billing.
              </p>
            </a>
          )}

          {apiStatus === "error" && apiStatusReason && (
            <div className="text-[11px] text-[#FF3B30] bg-[#FF3B30]/5 dark:bg-[#FF3B30]/10 border border-[#FF3B30]/15 dark:border-[#FF3B30]/25 rounded-[10px] p-2.5 max-h-[200px] overflow-y-auto">
              <div className="flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  {apiStatusDetails?.status ? (
                    <div className="font-semibold mb-1">Erreur HTTP {apiStatusDetails.status}</div>
                  ) : null}
                  <div className="break-words whitespace-pre-wrap leading-relaxed">{apiStatusReason}</div>
                  {apiStatusDetails?.diagnostic && (
                    <div className="mt-1.5 text-[#1D1D1F] dark:text-white font-medium bg-white/70 dark:bg-[#2c2c2e] rounded px-2 py-1">
                      💡 {apiStatusDetails.diagnostic}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#fafafa] dark:bg-[#161618] border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60 flex items-center gap-2 flex-wrap">
          {hasUserApiKey() && (
            <button onClick={handleClear}
              className="px-3 py-2 text-[12px] rounded-[10px] bg-[#FF3B30]/10 dark:bg-[#FF3B30]/15 text-[#FF3B30] hover:bg-[#FF3B30]/15 dark:hover:bg-[#FF3B30]/25 font-medium transition-all">
              Supprimer
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            title="Re-tester la clé actuelle"
            className="px-3 py-2 text-[12px] rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#38383a] transition-all flex items-center gap-1.5">
            <RefreshCw size={11} className={saving ? "animate-spin" : ""} /> Re-tester
          </button>
          <button onClick={onClose}
            className="ml-auto px-3 py-2 text-[12px] rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#38383a] transition-all">
            Fermer
          </button>
          <button onClick={handleSave} disabled={!keyInput.trim() || saving}
            className={`px-4 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center gap-1.5 ${
              keyInput.trim() && !saving
                ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md hover:shadow-lg"
                : "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] dark:text-[#636366] cursor-not-allowed"
            }`}>
            {saving ? <><RefreshCw size={11} className="animate-spin" /> Test…</> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
