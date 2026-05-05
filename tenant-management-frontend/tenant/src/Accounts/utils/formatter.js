// Basic rupee formatter (from paisa) - Latin numerals
export const fmtRs = (paisa = 0) => 
    (paisa / 100).toLocaleString("en-NP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

// Devanagari numerals option
export const fmtRsNe = (paisa = 0) => 
    (paisa / 100).toLocaleString("ne-NP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

// Compact formatter with Nepali units (lakh/crore)
export const fmtK = (v) => {
    const a = Math.abs(v ?? 0), s = (v ?? 0) < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(2)} करोड`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(2)} लाख`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(1)} हजार`;
    return `${s}${a.toFixed(2)}`;
};

// Latin version of compact formatter
export const fmtKLatin = (v) => {
    const a = Math.abs(v ?? 0), s = (v ?? 0) < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(2)} Cr`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(2)} L`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(1)}K`;
    return `${s}${a.toFixed(2)}`;
};

// With currency symbol
export const fmtCurrency = (paisa = 0, { compact = false, nepali = false } = {}) => {
    const rs = paisa / 100;
    const symbol = nepali ? "रू " : "Rs. ";
    
    if (compact && Math.abs(rs) >= 1000) {
        const formatted = nepali ? fmtK(rs) : fmtKLatin(rs);
        return symbol + formatted;
    }
    
    const formatted = nepali ? fmtRsNe(paisa) : fmtRs(paisa);
    return symbol + formatted;
};

// Accounting style (parentheses for negatives)
export const fmtAccounting = (paisa = 0, { compact = false, nepali = false } = {}) => {
    const rs = Math.abs(paisa / 100);
    const formatted = compact 
        ? (nepali ? fmtK(rs) : fmtKLatin(rs))
        : rs.toLocaleString(nepali ? "ne-NP" : "en-NP", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
    
    return paisa < 0 ? `(${formatted})` : formatted;
};

// Non-currency numbers (counts, IDs, etc.)
export const fmtN = (n = 0, nepali = false) => 
    Math.abs(n).toLocaleString(nepali ? "ne-NP" : "en-NP");