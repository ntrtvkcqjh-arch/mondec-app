"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "auto";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark"; // ce qui est vraiment appliqué
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Charge le thème depuis localStorage au montage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored && (stored === "light" || stored === "dark" || stored === "auto")) {
        setThemeState(stored);
      }
    } catch {}
  }, []);

  // Applique le thème au document à chaque changement
  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyTheme() {
      let actual: "light" | "dark" = "light";
      if (theme === "dark") actual = "dark";
      else if (theme === "auto") {
        actual = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      setResolvedTheme(actual);

      const root = document.documentElement;
      if (actual === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    }

    applyTheme();

    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
