"use client";

import { useEffect } from "react";
import { startConnectionTester, stopConnectionTester } from "@/lib/connection-tester";

/**
 * Bootstraps the connection tester in the background. Renders nothing.
 * The actual UI is ConnectionBadge in the navbar.
 */
export default function ConnectionMonitor() {
  useEffect(() => {
    startConnectionTester();
    return () => stopConnectionTester();
  }, []);
  return null;
}
