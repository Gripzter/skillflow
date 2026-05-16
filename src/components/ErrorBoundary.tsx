"use client";

import React from "react";
import ErrorReportModal from "./ErrorReportModal";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({
      errorInfo: errorInfo.componentStack || "",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() =>
            this.setState({ hasError: false, error: null, errorInfo: "" })
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

function ErrorScreen({
  error,
  errorInfo,
  onReset,
}: {
  error: Error | null;
  errorInfo: string;
  onReset: () => void;
}) {
  const [showReport, setShowReport] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0E17",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          padding: "32px",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }} aria-hidden />
        <h1
          style={{
            color: "#F3F4F6",
            fontSize: "22px",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          Something Went Wrong
        </h1>
        <p
          style={{
            color: "#9CA3AF",
            fontSize: "14px",
            marginBottom: "24px",
            lineHeight: "1.5",
          }}
        >
          We hit an unexpected error. This has been logged automatically. You can
          help us fix it faster by reporting what happened.
        </p>

        <details
          style={{
            textAlign: "left",
            marginBottom: "24px",
            background: "rgba(239,68,68,0.06)",
            borderRadius: "8px",
            padding: "12px",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <summary
            style={{
              color: "#EF4444",
              fontSize: "12px",
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            Error Details
          </summary>
          <pre
            style={{
              color: "#F87171",
              fontSize: "11px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              maxHeight: "120px",
              overflow: "auto",
            }}
          >
            {error?.message || "Unknown error"}
          </pre>
        </details>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!reported ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.1)",
                color: "#F87171",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Report This Error
            </button>
          ) : (
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10B981",
                fontSize: "14px",
              }}
            >
              Report sent — thank you for helping us improve!
            </div>
          )}

          <button
            type="button"
            onClick={onReset}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #FFFF00, #E6E600)",
              color: "#0A0E17",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/play")}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#9CA3AF",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Back to Play
          </button>
        </div>

        {showReport && (
          <ErrorReportModal
            errorMessage={error?.message || "Unknown error"}
            errorStack={error?.stack || ""}
            pageUrl={typeof window !== "undefined" ? window.location.href : ""}
            onClose={() => setShowReport(false)}
            onSubmitted={() => {
              setReported(true);
              setShowReport(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
