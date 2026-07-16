import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// =============================================================================
// AI Learning Companion (Phase 15) — tracks "what learning object is the
// student currently looking at" so the floating widget (mounted once in
// StudentPortalLayout) knows what to scope its conversation to. Pages opt in
// by calling setCurrentObject when they render a specific question; if
// nothing has set it, the companion honestly shows an idle state rather than
// guessing a topic.
// =============================================================================

export interface CurrentLearningObject {
  id: string;
  label: string;
}

interface LearningCompanionContextValue {
  currentObject: CurrentLearningObject | null;
  setCurrentObject: (obj: CurrentLearningObject | null) => void;
}

const LearningCompanionContext = createContext<LearningCompanionContextValue | null>(null);

export function LearningCompanionProvider({ children }: { children: ReactNode }) {
  const [currentObject, setCurrentObjectState] = useState<CurrentLearningObject | null>(null);
  const setCurrentObject = useCallback((obj: CurrentLearningObject | null) => setCurrentObjectState(obj), []);
  return (
    <LearningCompanionContext.Provider value={{ currentObject, setCurrentObject }}>
      {children}
    </LearningCompanionContext.Provider>
  );
}

export function useLearningCompanion(): LearningCompanionContextValue {
  const ctx = useContext(LearningCompanionContext);
  if (!ctx) throw new Error("useLearningCompanion must be used within LearningCompanionProvider");
  return ctx;
}
