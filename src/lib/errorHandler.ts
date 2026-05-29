export function getUserFriendlyError(error: any): string {
  const msg = error?.message?.toLowerCase() || "";

  if (msg.includes("legacy api keys") || msg.includes("api key")) {
    return "Connection error. Please refresh the page and try again.";
  }
  if (msg.includes("jwt") || msg.includes("token")) {
    return "Your session has expired. Please log in again.";
  }
  if (msg.includes("row-level security") || msg.includes("rls")) {
    return "You don't have permission to perform this action.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid password")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "An account with this email already exists.";
  }
  return "Something went wrong. Please try again.";
}
