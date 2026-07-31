"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  restorableSource,
  type AppliedLayer,
  type Looks,
  type LookId,
  type ViewMode,
  type SourceMode,
  type StoredSession,
} from "./session";

const STORAGE_KEY = "shadestack.tryon.session.v2";
const SOURCE_KEY = "shadestack.tryon.source";

type TryOnSessionValue = {
  looks: Looks;
  mode: ViewMode;
  // The active face preview. Mirrored to sessionStorage so it survives a reload
  // the user did not ask for (see `restorableSource`) and carries across in-app
  // navigation (e.g. Saved → Try On opens on Camera), but never outlives the
  // tab and never restores Camera — a reload must not re-prompt for permission.
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
  // Kept out of the localStorage `state` above and mirrored to sessionStorage
  // instead: it should survive a same-tab reload (see `restorableSource`) but
  // not outlive the tab. Starts at "model" so the first client render matches
  // the server output; the stored value is applied post-mount below.
  const [source, setSourceState] = useState<SourceMode>("model");

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

  // Restore the source across a reload the user did not ask for (iOS tab
  // discard after the Photos picker). Post-mount, like the localStorage read
  // above, so it cannot cause a hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SOURCE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSourceState(restorableSource(stored));
      }
    } catch {
      // sessionStorage unavailable — stay on the default source.
    }
  }, []);

  // Written on change rather than in an effect on `source`, so that navigating
  // away and back does not rewrite a value the user never touched.
  const setSource = useCallback((next: SourceMode) => {
    setSourceState(next);
    try {
      window.sessionStorage.setItem(SOURCE_KEY, next);
    } catch {
      // sessionStorage unavailable — the choice still holds for this page load.
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
  }, [state, source, setSource]);

  return <TryOnSessionContext.Provider value={value}>{children}</TryOnSessionContext.Provider>;
}

export function useTryOnSession(): TryOnSessionValue {
  const ctx = useContext(TryOnSessionContext);
  if (!ctx) throw new Error("useTryOnSession must be used within a TryOnSessionProvider");
  return ctx;
}
