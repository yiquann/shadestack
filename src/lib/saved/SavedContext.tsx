"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { AppliedLayer } from "@/lib/tryon/session";
import {
  emptySaved,
  isProductSaved as isProductSavedFn,
  toggleProduct as toggleProductFn,
  addLook as addLookFn,
  deleteLook as deleteLookFn,
  migrateSaved,
  type SavedLook,
  type SavedState,
} from "./savedCollection";

const STORAGE_KEY = "shadestack.saved.v1";

type SavedContextValue = {
  products: CatalogProduct[];
  looks: SavedLook[];
  isProductSaved: (id: string) => boolean;
  toggleProductSaved: (product: CatalogProduct) => void;
  saveLook: (name: string, layers: AppliedLayer[]) => void;
  deleteLook: (id: string) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SavedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavedState>(emptySaved);

  // Same hydration-safe pattern as the try-on session: the provider is
  // server-rendered, so the first client render must match the empty SSR
  // output. Load localStorage post-mount via an effect.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(migrateSaved(JSON.parse(raw)));
      }
    } catch {
      // localStorage unavailable or corrupt — start empty.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable — in-memory only for this load.
    }
  }, [state]);

  const value: SavedContextValue = useMemo(
    () => ({
      products: state.products,
      looks: state.looks,
      isProductSaved: (id) => isProductSavedFn(state, id),
      toggleProductSaved: (product) => setState((s) => toggleProductFn(s, product)),
      saveLook: (name, layers) =>
        setState((s) =>
          addLookFn(s, { id: newId(), name: name.trim(), layers, createdAt: new Date().toISOString() })
        ),
      deleteLook: (id) => setState((s) => deleteLookFn(s, id)),
    }),
    [state]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within a SavedProvider");
  return ctx;
}
