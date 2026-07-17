"use client";

import { useEffect, useState } from "react";
import type { FacingMode } from "./cameraHelpers";

type CameraState = {
  stream: MediaStream | null;
  status: "idle" | "ready" | "denied" | "error";
  message?: string;
};

/**
 * Requests a camera stream for the given facing mode and stops all its tracks
 * on change/unmount so the camera indicator never lingers.
 */
export function useCameraStream(facingMode: FacingMode): CameraState {
  const [state, setState] = useState<CameraState>({ stream: null, status: "idle" });

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Hint a modest resolution: detectForVideo processes at the native
          // frame size, so requesting 720p rather than accepting 1080p+ trims
          // per-frame tracking cost. `ideal` degrades gracefully if unsupported.
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        setState({ stream, status: "ready" });
      } catch (e) {
        if (!active) return;
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setState({
          stream: null,
          status: denied ? "denied" : "error",
          message: e instanceof Error ? e.message : "Camera unavailable",
        });
      }
    }

    start();
    return () => {
      active = false;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return state;
}
