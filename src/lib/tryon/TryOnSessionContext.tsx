"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import {
  applyProduct,
  removeLayer as removeLayerFn,
  setOpacity as setOpacityFn,
  toggleVisible as toggleVisibleFn,
  moveLayer as moveLayerFn,
  clearLook as clearLookFn,
  type AppliedLayer,
} from "./session";

const STORAGE_KEY = "shadestack.tryon.session.v1";

type TryOnSessionValue = {
  layers: AppliedLayer[];
  addProduct: (product: CatalogProduct) => void;
  removeLayer: (category: CatalogProduct["category"]) => void;
  setOpacity: (category: CatalogProduct["category"], opacity: number) => void;
  toggleVisible: (category: CatalogProduct["category"]) => void;
  moveLayer: (from: CatalogProduct["category"], to: CatalogProduct["category"]) => void;
  clearLook: () => void;
};

const TryOnSessionContext = createContext<TryOnSessionValue | null>(null);

export function TryOnSessionProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<AppliedLayer[]>([]);

  // The provider is server-rendered (no "use client" boundary above it in
  // (tabs)/layout.tsx), so the first client render must match the empty-array
  // SSR output exactly. Reading localStorage happens here, post-mount, as an
  // ordinary effect-driven re-render rather than during the initial render —
  // this avoids a hydration mismatch for users with a persisted session.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // One-time hydration-safe load of an external store (localStorage)
        // that is only available post-mount. Not the derived-state
        // anti-pattern this rule targets.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLayers(JSON.parse(raw) as AppliedLayer[]);
      }
    } catch {
      // localStorage unavailable or corrupt — start with an empty session.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
    } catch {
      // localStorage unavailable (private browsing quota, etc.) — session
      // still works in-memory for the current page load.
    }
  }, [layers]);

  // Callbacks close over `setLayers`, which React guarantees is referentially
  // stable across renders, so `layers` is the only real dependency.
  const value: TryOnSessionValue = useMemo(
    () => ({
      layers,
      addProduct: (product) => setLayers((prev) => applyProduct(prev, product)),
      removeLayer: (category) => setLayers((prev) => removeLayerFn(prev, category)),
      setOpacity: (category, opacity) => setLayers((prev) => setOpacityFn(prev, category, opacity)),
      toggleVisible: (category) => setLayers((prev) => toggleVisibleFn(prev, category)),
      moveLayer: (from, to) => setLayers((prev) => moveLayerFn(prev, from, to)),
      clearLook: () => setLayers(clearLookFn()),
    }),
    [layers],
  );

  return <TryOnSessionContext.Provider value={value}>{children}</TryOnSessionContext.Provider>;
}

export function useTryOnSession(): TryOnSessionValue {
  const ctx = useContext(TryOnSessionContext);
  if (!ctx) throw new Error("useTryOnSession must be used within a TryOnSessionProvider");
  return ctx;
}
