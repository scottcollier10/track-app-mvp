"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type CoachViewContextType = {
  coachView: boolean;
  toggleCoachView: () => void;
};

const CoachViewContext = createContext<CoachViewContextType | undefined>(
  undefined
);

export function CoachViewProvider({ children }: { children: ReactNode }) {
  const [coachView, setCoachView] = useState(false);

  // Load persisted value on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("coachView");
    if (stored === "on") setCoachView(true);
  }, []);

  const toggleCoachView = () => {
    setCoachView((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("coachView", next ? "on" : "off");
      }
      return next;
    });
  };

  return (
    <CoachViewContext.Provider value={{ coachView, toggleCoachView }}>
      {children}
    </CoachViewContext.Provider>
  );
}

export function useCoachView() {
  const ctx = useContext(CoachViewContext);
  if (!ctx) {
    throw new Error("useCoachView must be used within a CoachViewProvider");
  }
  return ctx;
}
