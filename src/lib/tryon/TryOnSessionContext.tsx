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
  emptyLooks,
  migrateStoredSession,
  type AppliedLayer,
  type Looks,
  type LookId,
  type ViewMode,
  type SourceMode,
  type StoredSession,
} from "./session";

const STORAGE_KEY = "shadestack.tryon.session.v2";

type TryOnSessionValue = {
  looks: Looks;
  mode: ViewMode;
  // The active face preview. Kept in-memory (not persisted) so a fresh reload
  // always defaults to Model — no surprise camera prompt — while it still
  // carries across in-app navigation (e.g. Saved → Try On opens on Camera).
  source: SourceMode;
  setSource: (source: SourceMode) => void;
  addProduct: (product: CatalogProduct, look: LookId) => void;
  removeLayer: (category: CatalogProduct["category"], look: LookId) => void;
  setOpacity: (category: CatalogProduct["category"], opacity: number, look: LookId) => void;
  toggleVisible: (category: CatalogProduct["category"], look: LookId) => void;
  moveLayer: (from: CatalogProduct["category"], to: CatalogProduct["category"], look: LookId) => void;
  clearLook: (look: LookId) => void;
  replaceLook: (look: LookId, layers: AppliedLayer[]) => void;
  setMode: (mode: ViewMode) => void;
};

const TryOnSessionContext = createContext<TryOnSessionValue | null>(null);

export function TryOnSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredSession>({ looks: emptyLooks(), mode: "single" });
  // Non-persisted (see `source` in the context value) — deliberately excluded
  // from the localStorage `state` above.
  const [source, setSource] = useState<SourceMode>("model");

  // The provider is server-rendered (no "use client" boundary above it in
  // (tabs)/layout.tsx), so the first client render must match the empty-looks
  // SSR output exactly. Reading localStorage happens here, post-mount, as an
  // ordinary effect-driven re-render rather than during the initial render —
  // this avoids a hydration mismatch for users with a persisted session.
  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem("shadestack.tryon.session.v1");
      if (raw) {
        // One-time hydration-safe load of an external store (localStorage)
        // that is only available post-mount. Not the derived-state
        // anti-pattern this rule targets.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(migrateStoredSession(JSON.parse(raw)));
      }
    } catch {
      // localStorage unavailable or corrupt — start with an empty session.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable (private browsing quota, etc.) — session
      // still works in-memory for the current page load.
    }
  }, [state]);

  // Callbacks close over `setState`, which React guarantees is referentially
  // stable across renders, so `state` is the only real dependency.
  const value: TryOnSessionValue = useMemo(() => {
    const mutate = (look: LookId, fn: (layers: AppliedLayer[]) => AppliedLayer[]) =>
      setState((s) => ({ ...s, looks: { ...s.looks, [look]: fn(s.looks[look]) } }));
    return {
      looks: state.looks,
      mode: state.mode,
      source,
      setSource,
      addProduct: (product, look) => mutate(look, (l) => applyProduct(l, product)),
      removeLayer: (category, look) => mutate(look, (l) => removeLayerFn(l, category)),
      setOpacity: (category, opacity, look) => mutate(look, (l) => setOpacityFn(l, category, opacity)),
      toggleVisible: (category, look) => mutate(look, (l) => toggleVisibleFn(l, category)),
      moveLayer: (from, to, look) => mutate(look, (l) => moveLayerFn(l, from, to)),
      clearLook: (look) => mutate(look, () => clearLookFn()),
      // Re-apply a saved look; deep-copy so the session never aliases the
      // stored look's layers.
      replaceLook: (look, layers) => mutate(look, () => layers.map((l) => ({ ...l }))),
      // Entering split leaves Look B as-is (bare until the user adds to it);
      // it is not seeded from Look A.
      setMode: (mode) => setState((s) => ({ ...s, mode })),
    };
  }, [state, source]);

  return <TryOnSessionContext.Provider value={value}>{children}</TryOnSessionContext.Provider>;
}

export function useTryOnSession(): TryOnSessionValue {
  const ctx = useContext(TryOnSessionContext);
  if (!ctx) throw new Error("useTryOnSession must be used within a TryOnSessionProvider");
  return ctx;
}
