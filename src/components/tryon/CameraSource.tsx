"use client";

import type { AppliedLayer } from "@/lib/tryon/session";

export function CameraSource(_props: { layers: AppliedLayer[] }) {
  return (
    <p className="mx-auto max-w-xs text-center text-xs text-textMuted">
      Camera mode coming up.
    </p>
  );
}
