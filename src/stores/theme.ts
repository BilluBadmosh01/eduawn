import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeState = {
  theme: "light" | "dark";
  toggle: () => void;
  setTheme: (t: "light" | "dark") => void;
};

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setTheme: (t) => set({ theme: t }),
    }),
    { name: "eduawn-theme" },
  ),
);

export function applyThemeClass(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

type SettingsState = {
  notifications: boolean;
  setNotifications: (v: boolean) => void;
};
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: true,
      setNotifications: (v) => set({ notifications: v }),
    }),
    { name: "eduawn-settings" },
  ),
);