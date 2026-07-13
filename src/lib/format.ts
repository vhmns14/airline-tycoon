/**
 * Display formatters for money and numbers in the UI.
 */

export function formatMoney(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
  return formatted
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
