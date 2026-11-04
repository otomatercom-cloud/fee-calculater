const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const money = (n: number) => inr.format(n || 0);
export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, "")}%`;
export const modeLabel = (m: string) => (m === "online" ? "Online" : "Offline");
