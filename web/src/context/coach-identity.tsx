"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface CoachIdentity {
  name: string;
  email: string;
}

const CoachIdentityContext = createContext<CoachIdentity | null>(null);

export function CoachIdentityProvider({
  coach,
  children,
}: {
  coach: CoachIdentity | null;
  children: ReactNode;
}) {
  return (
    <CoachIdentityContext.Provider value={coach}>
      {children}
    </CoachIdentityContext.Provider>
  );
}

export function useCoachIdentity(): CoachIdentity | null {
  return useContext(CoachIdentityContext);
}
