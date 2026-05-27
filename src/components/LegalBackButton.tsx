"use client";

function hasSession() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.localStorage.getItem("skillflow_dev_user")) {
    return true;
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) {
      continue;
    }
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      const value = window.localStorage.getItem(key);
      if (value && value !== "null") {
        return true;
      }
    }
  }

  return false;
}

export default function LegalBackButton() {
  const handleClick = () => {
    window.location.href = hasSession() ? "/dashboard" : "/";
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-200 transition hover:bg-white/10 hover:text-white"
      aria-label="Go back"
    >
      <span aria-hidden>←</span>
      Back
    </button>
  );
}
