"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native glue for the Android app. Renders nothing on the web.
 * Android's back gesture/button goes back a page instead of closing the app, and only exits
 * from the first page in the history.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      }).then((handle) => {
        remove = () => handle.remove();
      }),
    );
    return () => remove?.();
  }, []);
  return null;
}
