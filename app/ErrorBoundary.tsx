"use client";

import React from "react";

interface State { hasError: boolean; error: Error | null; errorInfo: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: error.stack || "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ errorInfo: (info.componentStack || "") + "\n\n" + (error.stack || "") });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F5F5F7]">
          <div className="max-w-2xl w-full bg-white rounded-[20px] shadow-xl p-8">
            <div className="w-12 h-12 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mb-4">
              <span className="text-[#FF3B30] text-2xl">!</span>
            </div>
            <h1 className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight mb-2">
              Erreur inattendue
            </h1>
            <p className="text-[14px] text-[#86868B] mb-4">
              L'application a rencontré un problème. Voici les détails techniques :
            </p>
            <div className="bg-[#F5F5F7] rounded-[12px] p-4 mb-4 font-mono text-[11px] text-[#FF3B30] max-h-[300px] overflow-auto">
              <div className="font-bold mb-2">{this.state.error?.name}: {this.state.error?.message}</div>
              <pre className="whitespace-pre-wrap break-words text-[#86868B]">{this.state.errorInfo.slice(0, 2000)}</pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch {}
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-[10px] bg-[#FF3B30] text-white text-[13px] font-medium hover:bg-[#dc2626]"
              >
                Vider le cache et recharger
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-[10px] bg-[#F5F5F7] text-[#1D1D1F] text-[13px] font-medium hover:bg-[#E5E5EA]"
              >
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
