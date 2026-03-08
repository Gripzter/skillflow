"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface ErrorReportModalProps {
  errorMessage: string;
  errorStack: string;
  pageUrl: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ErrorReportModal({
  errorMessage,
  errorStack,
  pageUrl,
  onClose,
  onSubmitted,
}: ErrorReportModalProps) {
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    try {
      const supabase = createClient();
      const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
      const username = user?.user_metadata?.username ?? user?.email ?? "anonymous";

      const deviceInfo =
        typeof navigator !== "undefined"
          ? JSON.stringify({
              userAgent: navigator.userAgent,
              screen: `${typeof screen !== "undefined" ? screen.width : 0}x${typeof screen !== "undefined" ? screen.height : 0}`,
              viewport: `${typeof window !== "undefined" ? window.innerWidth : 0}x${typeof window !== "undefined" ? window.innerHeight : 0}`,
              platform: navigator.platform,
              language: navigator.language,
            })
          : "{}";

      await fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? null,
          username,
          errorMessage,
          errorStack,
          pageUrl,
          userDescription: description,
          deviceInfo,
        }),
      });
      onSubmitted();
    } catch {
      onSubmitted();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-report-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: "440px",
          width: "100%",
          background: "#111827",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="error-report-title"
          style={{
            color: "#F3F4F6",
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "4px",
          }}
        >
          🐛 Report Error
        </h2>
        <p
          style={{
            color: "#6B7280",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Tell us what you were doing when this happened. This helps us fix it
          faster.
        </p>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="I was trying to join a Connect 4 match and..."
          maxLength={500}
          rows={4}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#E5E7EB",
            fontSize: "14px",
            resize: "vertical",
            outline: "none",
            marginBottom: "4px",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <p
          style={{
            color: "#4B5563",
            fontSize: "11px",
            marginBottom: "16px",
            textAlign: "right",
          }}
        >
          {description.length}/500
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: "8px",
            padding: "10px",
            marginBottom: "16px",
            fontSize: "11px",
            color: "#6B7280",
          }}
        >
          <strong style={{ color: "#9CA3AF" }}>Auto-captured:</strong>
          <br />
          Error: {errorMessage.substring(0, 80)}
          {errorMessage.length > 80 ? "..." : ""}
          <br />
          Page: {pageUrl}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#9CA3AF",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: sending ? "#374151" : "#EF4444",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
