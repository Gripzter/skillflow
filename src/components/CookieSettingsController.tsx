"use client";

import { useEffect, useState } from "react";
import CookieSettingsModal from "@/components/CookieSettingsModal";

export default function CookieSettingsController() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("sf-open-cookie-settings-modal", handleOpen);
    return () => window.removeEventListener("sf-open-cookie-settings-modal", handleOpen);
  }, []);

  return <CookieSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
