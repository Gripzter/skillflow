interface FormatCurrencyOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(
  value: number,
  options: FormatCurrencyOptions = {}
): string {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  if (process.env.NEXT_PUBLIC_LAUNCH_MODE === "SWEEPSTAKES") {
    return `${formatted} SP`;
  }

  return `$${formatted}`;
}
