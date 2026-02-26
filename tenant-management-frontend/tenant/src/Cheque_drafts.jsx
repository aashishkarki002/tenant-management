'use client';

import React, { useState, useRef, useCallback } from 'react';
import { PrinterIcon, DownloadIcon } from 'lucide-react';
// ─── Nepali number to words (NPR: Paisa) ─────────────────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n) {
    if (!n || isNaN(n) || n === '') return '';
    const raw = String(n).replace(/,/g, '');
    const num = Math.floor(parseFloat(raw));
    if (num === 0 && !raw.includes('.')) return 'Zero';

    function helper(n) {
        if (n === 0) return '';
        if (n < 20) return ones[n] + ' ';
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + helper(n % 100);
        if (n < 100000) return helper(Math.floor(n / 1000)) + 'Thousand ' + helper(n % 1000);
        if (n < 10000000) return helper(Math.floor(n / 100000)) + 'Lakh ' + helper(n % 100000);
        return helper(Math.floor(n / 10000000)) + 'Crore ' + helper(n % 10000000);
    }

    const [intPart, decPart] = raw.split('.');
    let result = helper(parseInt(intPart, 10)).trim();
    if (decPart && parseInt(decPart, 10) > 0) {
        const paisa = parseInt(decPart.slice(0, 2).padEnd(2, '0'), 10);
        result += ' and ' + helper(paisa).trim() + ' Paisa';
    }
    return result + ' Only';
}

// ─── BS (Bikram Sambat) converter ─────────────────────────────────────────────
const BS_DATA = {
    2080: [0, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 30],
    2081: [0, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2082: [0, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 30],
    2083: [0, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30, 30],
};
const BS_MONTHS = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

function adToBS(adDate) {
    try {
        const refAD = new Date(2023, 3, 14); // 14 Apr 2023 = 1 Baisakh 2080
        let remaining = Math.round((adDate - refAD) / 86400000);
        if (remaining < 0) return null;
        let bsYear = 2080, bsMonth = 1, bsDay = 1;
        outer: for (const [yr, months] of Object.entries(BS_DATA)) {
            for (let m = 1; m <= 12; m++) {
                const days = months[m];
                if (remaining < days) {
                    bsYear = parseInt(yr);
                    bsMonth = m;
                    bsDay = 1 + remaining;
                    break outer;
                }
                remaining -= days;
            }
        }
        return { year: bsYear, month: bsMonth, day: Math.round(bsDay) };
    } catch { return null; }
}

function formatBSDate(adDateStr) {
    if (!adDateStr) return '';
    const d = new Date(adDateStr + 'T00:00:00');
    const bs = adToBS(d);
    if (!bs) return '';
    return `${bs.day} ${BS_MONTHS[bs.month - 1]} ${bs.year} BS`;
}

// ─── NRB-licensed Commercial Banks ────────────────────────────────────────────
const NEPALI_BANKS = [
    'Nepal Bank Limited',
    'Rastriya Banijya Bank',
    'Nabil Bank Limited',
    'Nepal Investment Mega Bank',
    'Standard Chartered Bank Nepal',
    'Himalayan Bank Limited',
    'Nepal SBI Bank Limited',
    'Everest Bank Limited',
    'Kumari Bank Limited',
    'Laxmi Sunrise Bank',
    'Citizens Bank International',
    'Prime Commercial Bank',
    'Sanima Bank Limited',
    'Machhapuchchhre Bank Limited',
    'NMB Bank Limited',
    'Prabhu Bank Limited',
    'Siddhartha Bank Limited',
    'Global IME Bank Limited',
    'NIC Asia Bank Limited',
    'Mega Bank Nepal Limited',
    'Century Commercial Bank',
    'Civil Bank Limited',
    'Sunrise Bank Limited',
    'Gandaki Province Bank',
    'Nepal Credit and Commerce Bank',
    'Other',
];

// ─── MICR Line ────────────────────────────────────────────────────────────────
function MICRLine({ chequeNo, micrCode, accountNo }) {
    const pad = (s, n) => String(s || '').padStart(n, '0');
    const acc = (accountNo || '').replace(/\s/g, '');
    return (
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2px', color: '#222' }}>
            ⑆{pad(chequeNo, 6)}⑆{'  '}⑆{micrCode || '000000000'}⑆{'  '}⑆{pad(acc, 16)}⑆
        </div>
    );
}

// ─── Default cheque factory ────────────────────────────────────────────────────
const newCheque = (id) => ({
    id,
    accountHolderName: '',
    businessAddress: '',
    accountNo: '',
    bankName: '',
    bankBranch: '',
    swiftCode: '',
    micrCode: '',
    chequeNumber: String(100000 + id).slice(1),
    date: new Date().toISOString().split('T')[0],
    payeeName: '',
    amountNumbers: '',
    memo: '',
    currency: 'Rs.',
    currencyLabel: 'NPR',
    crossed: true,
    bearerOrOrder: 'order',
    signatureDataUrl: null,
});

// ─── Cheque Visual ─────────────────────────────────────────────────────────────
function ChequeVisual({ data, innerRef }) {
    const amountWords = numToWords(data.amountNumbers);
    const adDate = data.date
        ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';
    const bsDate = formatBSDate(data.date);
    const amt = data.amountNumbers
        ? Number(String(data.amountNumbers).replace(/,/g, '')).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

    return (
        <div
            ref={innerRef}
            style={{
                width: '100%',
                aspectRatio: '2.5/1',
                background: 'linear-gradient(160deg, #fefcf3 0%, #ffffff 50%, #f3f8fe 100%)',
                border: '1.5px solid #cfd8dc',
                borderRadius: '5px',
                padding: '16px 22px 8px 22px',
                fontFamily: 'Georgia, "Times New Roman", serif',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 6px 28px rgba(0,0,0,0.12)',
                boxSizing: 'border-box',
            }}
        >
            {/* Security pattern */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(180,60,60,0.025) 18px, rgba(180,60,60,0.025) 19px),
          repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(60,90,180,0.025) 18px, rgba(60,90,180,0.025) 19px)`,
            }} />

            {/* Crossed cheque band */}
            {data.crossed && (
                <div style={{ position: 'absolute', top: 0, left: 18, bottom: 0, width: 44, borderLeft: '1.5px solid #78909c', borderRight: '1.5px solid #78909c', opacity: 0.3 }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '7px', fontWeight: 800, color: '#455a64', letterSpacing: '1px', marginTop: '10px', marginLeft: '14px', fontFamily: 'Arial, sans-serif', opacity: 0.9 }}>
                        A/C PAYEE ONLY
                    </div>
                </div>
            )}

            {/* NRB stripe top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #c62828, #1565c0, #c62828)', opacity: 0.7 }} />

            {/* TOP: Bank name + cheque no */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ paddingLeft: data.crossed ? '52px' : '0' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#b71c1c', letterSpacing: '0.3px' }}>
                        {data.bankName || 'Bank Name'}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#546e7a', marginTop: '1px' }}>
                        {data.bankBranch || 'Branch Name'}{data.swiftCode ? ` · SWIFT: ${data.swiftCode}` : ''}
                    </div>
                    <div style={{ fontSize: '8px', color: '#90a4ae', marginTop: '1px' }}>Licensed by Nepal Rastra Bank (NRB)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '8px', color: '#90a4ae', letterSpacing: '1px', textTransform: 'uppercase' }}>Cheque No.</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#111', fontFamily: '"Courier New", monospace', letterSpacing: '3px', borderBottom: '1.5px solid #111', paddingBottom: '1px' }}>
                        {data.chequeNumber || '000000'}
                    </div>
                </div>
            </div>

            {/* Dual date */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '7px', gap: '16px' }}>
                <div style={{ fontSize: '9px', color: '#78909c' }}>
                    <span style={{ fontStyle: 'italic' }}>BS: </span>
                    <span style={{ fontWeight: 600, color: '#1a1a1a', borderBottom: '1px solid #999' }}>{bsDate || '__ ___ ____ BS'}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#78909c' }}>
                    <span style={{ fontStyle: 'italic' }}>AD: </span>
                    <span style={{ fontWeight: 600, color: '#1a1a1a', borderBottom: '1px solid #999' }}>{adDate || '__ ___ ____'}</span>
                </div>
            </div>

            {/* Pay to */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', color: '#546e7a', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                    Pay to {data.bearerOrOrder === 'bearer' ? 'Bearer' : 'the Order of'}
                </span>
                <div style={{ flex: 1, borderBottom: '1.5px solid #1a1a1a', paddingBottom: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>
                        {data.payeeName || '_______________________________________________'}
                    </span>
                </div>
            </div>

            {/* Amount words + box */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 1, borderBottom: '1.5px solid #1a1a1a', paddingBottom: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '10.5px', color: '#111', fontStyle: 'italic' }}>
                        {amountWords || '______________________________________ Only'}
                    </span>
                </div>
                <div style={{
                    border: '2px solid #b71c1c', borderRadius: '3px', padding: '3px 10px',
                    background: 'rgba(183,28,28,0.04)', minWidth: '120px', textAlign: 'center', flexShrink: 0,
                }}>
                    <div style={{ fontSize: '8px', color: '#b71c1c', fontFamily: 'Arial, sans-serif', fontWeight: 700, letterSpacing: '1px' }}>NPR / रू.</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#b71c1c', fontFamily: '"Courier New", monospace', letterSpacing: '1px' }}>
                        {data.currency} {amt}
                    </div>
                </div>
            </div>

            {/* Bottom: memo + signature */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e0e0e0', paddingTop: '5px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#90a4ae', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Memo / Narration</div>
                    <div style={{ fontSize: '10px', color: '#374151', borderBottom: '1px solid #ccc', minWidth: '150px', maxWidth: '240px', paddingBottom: '1px' }}>
                        {data.memo || ''}
                    </div>
                    <div style={{ fontSize: '8px', color: '#90a4ae', marginTop: '4px' }}>
                        A/C No: <span style={{ fontFamily: '"Courier New", monospace', color: '#546e7a' }}>{data.accountNo || '________________'}</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                    <div style={{ fontSize: '8.5px', color: '#546e7a', marginBottom: '2px' }}>{data.accountHolderName || 'Account Holder'}</div>
                    {data.signatureDataUrl ? (
                        <img src={data.signatureDataUrl} alt="Signature" style={{ height: '30px', maxWidth: '110px', objectFit: 'contain', borderBottom: '1.5px solid #111', display: 'block' }} />
                    ) : (
                        <div style={{ width: '120px', height: '28px', borderBottom: '1.5px solid #111' }} />
                    )}
                    <div style={{ fontSize: '8px', color: '#90a4ae', marginTop: '2px' }}>Authorised Signature</div>
                </div>
            </div>

            {/* MICR */}
            <div style={{ textAlign: 'center', marginTop: '5px', opacity: 0.65 }}>
                <MICRLine chequeNo={data.chequeNumber} micrCode={data.micrCode} accountNo={data.accountNo} />
            </div>

            {/* Issuer address */}
            <div style={{ position: 'absolute', bottom: '22px', left: '22px', fontSize: '7.5px', color: '#9e9e9e', maxWidth: '180px', lineHeight: '1.4' }}>
                {data.businessAddress}
            </div>

            {/* Bottom stripe */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #1565c0, #c62828, #1565c0)', opacity: 0.6 }} />
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ChequeDraft() {
    const [cheques, setCheques] = useState([newCheque(1)]);
    const [activeId, setActiveId] = useState(1);
    const [nextId, setNextId] = useState(2);
    const chequeRef = useRef(null);
    const sigRef = useRef(null);

    const active = cheques.find(c => c.id === activeId) || cheques[0];

    const update = useCallback((field, value) => {
        setCheques(prev => prev.map(c => c.id === activeId ? { ...c, [field]: value } : c));
    }, [activeId]);

    const handleInput = (e) => {
        const { name, value, type, checked } = e.target;
        update(name, type === 'checkbox' ? checked : value);
    };

    const handleSignatureUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => update('signatureDataUrl', ev.target.result);
        reader.readAsDataURL(file);
    };

    const addCheque = () => {
        const id = nextId;
        setNextId(id + 1);
        const base = {
            ...newCheque(id),
            accountHolderName: active.accountHolderName,
            businessAddress: active.businessAddress,
            accountNo: active.accountNo,
            bankName: active.bankName,
            bankBranch: active.bankBranch,
            swiftCode: active.swiftCode,
            micrCode: active.micrCode,
        };
        setCheques(prev => [...prev, base]);
        setActiveId(id);
    };

    const removeCheque = (id) => {
        if (cheques.length === 1) return;
        setCheques(prev => {
            const next = prev.filter(c => c.id !== id);
            if (activeId === id) setActiveId(next[next.length - 1].id);
            return next;
        });
    };

    const generatePDF = async () => {
        if (!chequeRef.current) return;
        const html2pdf = (await import('html2pdf.js')).default;
        html2pdf().set({
            margin: [8, 8],
            filename: `cheque-NPR-${active.chequeNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: [210, 99], orientation: 'landscape' },
        }).from(chequeRef.current).save();
    };

    const handlePrint = () => {
        const w = window.open('', '', 'width=1100,height=520');
        if (w && chequeRef.current) {
            w.document.write(`<html><head><title>Cheque #${active.chequeNumber}</title><style>
        body { margin: 20px; background: #fff; font-family: Georgia, serif; }
        @media print { body { margin: 0; } }
      </style></head><body>${chequeRef.current.outerHTML}</body></html>`);
            w.document.close();
            setTimeout(() => { w.print(); w.close(); }, 400);
        }
    };

    const inp = {
        width: '100%', padding: '7px 10px', borderRadius: '6px',
        border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff',
        color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>

            {/* Header */}
            <div style={{ background: 'rgb(255, 255, 255)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'justify-end' }}>

                <div style={{ display: 'flex flex-col sm:flex-row right-0', gap: '10px', marginRight: '30px' }}>
                    <button onClick={handlePrint} style={{ padding: '8px 18px', borderRadius: '6px', border: '1.5px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#000', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        <PrinterIcon className="w-4 h-4" /> Print
                    </button>
                    <button onClick={generatePDF} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#fff', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                        <DownloadIcon className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 20px', display: 'grid', gridTemplateColumns: '330px 1fr', gap: '22px' }}>

                {/* LEFT PANEL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Cheque list */}
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Cheques</span>
                            <button onClick={addCheque} style={{ fontSize: '12px', color: '#b71c1c', background: '#fce4e4', border: 'none', borderRadius: '5px', padding: '4px 12px', cursor: 'pointer', fontWeight: 700 }}>+ New</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {cheques.map(c => (
                                <div key={c.id} onClick={() => setActiveId(c.id)} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
                                    background: c.id === activeId ? '#fce4e4' : 'transparent',
                                    border: c.id === activeId ? '1.5px solid #e57373' : '1.5px solid transparent',
                                    transition: 'all 0.15s',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#b71c1c' }}>#{c.chequeNumber || '------'}</div>
                                        <div style={{ fontSize: '11px', color: '#78909c' }}>{c.payeeName || 'No payee'} · रू. {c.amountNumbers || '0'}</div>
                                    </div>
                                    {cheques.length > 1 && (
                                        <button onClick={e => { e.stopPropagation(); removeCheque(c.id); }} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '17px', lineHeight: 1 }}>×</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Form */}
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                        <Sec title="Account Holder">
                            <Fld label="Full Name / Business Name">
                                <input style={inp} name="accountHolderName" value={active.accountHolderName} onChange={handleInput} placeholder="Ram Bahadur Shrestha / Everest Pvt. Ltd." />
                            </Fld>
                            <Fld label="Address (Ward, Municipality, District)">
                                <textarea name="businessAddress" value={active.businessAddress} onChange={handleInput} rows={2} placeholder="Ward No. 5, Kathmandu Metropolitan City, Bagmati Province" style={{ ...inp, resize: 'vertical' }} />
                            </Fld>
                            <Fld label="Account Number">
                                <input style={inp} name="accountNo" value={active.accountNo} onChange={handleInput} placeholder="00100101000001" />
                            </Fld>
                        </Sec>

                        <Sec title="Bank Details">
                            <Fld label="Bank Name (NRB Licensed)">
                                <select style={inp} name="bankName" value={active.bankName} onChange={handleInput}>
                                    <option value="">— Select Bank —</option>
                                    {NEPALI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </Fld>
                            <Fld label="Branch">
                                <input style={inp} name="bankBranch" value={active.bankBranch} onChange={handleInput} placeholder="New Road Branch, Kathmandu" />
                            </Fld>
                            <TwoCol>
                                <Fld label="SWIFT Code">
                                    <input style={inp} name="swiftCode" value={active.swiftCode} onChange={handleInput} placeholder="NABILNPKA" />
                                </Fld>
                                <Fld label="MICR Code">
                                    <input style={inp} name="micrCode" value={active.micrCode} onChange={handleInput} placeholder="44400001" />
                                </Fld>
                            </TwoCol>
                        </Sec>

                        <Sec title="Cheque Details">
                            <TwoCol>
                                <Fld label="Cheque No.">
                                    <input style={inp} name="chequeNumber" value={active.chequeNumber} onChange={handleInput} placeholder="100001" />
                                </Fld>
                                <Fld label="Date (AD)">
                                    <input style={{ ...inp, fontFamily: 'inherit' }} type="date" name="date" value={active.date} onChange={handleInput} />
                                </Fld>
                            </TwoCol>

                            {active.date && (
                                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#795548' }}>
                                    BS Date: <strong>{formatBSDate(active.date)}</strong>
                                </div>
                            )}

                            <Fld label="Pay Mode">
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    {[['order', 'Order (Payee Only)'], ['bearer', 'Bearer (Anyone)']].map(([val, lbl]) => (
                                        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                                            <input type="radio" name="bearerOrOrder" value={val} checked={active.bearerOrOrder === val} onChange={handleInput} style={{ accentColor: '#b71c1c' }} />
                                            {lbl}
                                        </label>
                                    ))}
                                </div>
                            </Fld>

                            <Fld label="Payee Name (प्राप्तकर्ताको नाम)">
                                <input style={inp} name="payeeName" value={active.payeeName} onChange={handleInput} placeholder="Sita Kumari Tamang / Nepal Telecom" />
                            </Fld>

                            <Fld label="Amount — NPR (रकम)">
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#78909c', fontWeight: 600 }}>रू.</span>
                                    <input style={{ ...inp, paddingLeft: '34px' }} name="amountNumbers" value={active.amountNumbers} onChange={handleInput} placeholder="50000.00" type="number" min="0" step="0.01" />
                                </div>
                            </Fld>

                            <Fld label="Amount in Words (auto-generated)">
                                <div style={{ ...inp, background: '#f8fafc', color: '#374151', fontSize: '12px', minHeight: '34px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', wordBreak: 'break-word' }}>
                                    {numToWords(active.amountNumbers) || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Enter amount above…</span>}
                                </div>
                            </Fld>

                            <Fld label="Memo / Narration (विवरण)">
                                <input style={inp} name="memo" value={active.memo} onChange={handleInput} placeholder="Ghar bhadha Falgun 2081, Invoice #45..." />
                            </Fld>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151', userSelect: 'none' }}>
                                <input type="checkbox" name="crossed" checked={active.crossed} onChange={handleInput} style={{ accentColor: '#b71c1c', width: '15px', height: '15px' }} />
                                Crossed Cheque — A/C Payee Only
                            </label>
                        </Sec>

                        <Sec title="Signature / Thumb Impression">
                            <input ref={sigRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSignatureUpload} />
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button onClick={() => sigRef.current?.click()} style={{ padding: '7px 14px', borderRadius: '6px', border: '1.5px dashed #ef9a9a', background: '#fff5f5', color: '#c62828', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                                    Upload Signature / Thumb
                                </button>
                                {active.signatureDataUrl && (
                                    <button onClick={() => update('signatureDataUrl', null)} style={{ color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                                )}
                            </div>
                            {active.signatureDataUrl && (
                                <img src={active.signatureDataUrl} alt="sig" style={{ maxHeight: '48px', marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', background: '#fff' }} />
                            )}
                            <div style={{ fontSize: '10px', color: '#90a4ae', lineHeight: '1.5' }}>
                                ⚠ Signature must match bank records. Thumb impressions accepted for illiterate account holders per NRB guidelines.
                            </div>
                        </Sec>

                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div>
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Live Preview</div>
                            <div style={{ fontSize: '11px', color: '#90a4ae' }}>Standard Nepali cheque format · 8" × 3.5"</div>
                        </div>
                        <ChequeVisual data={active} innerRef={chequeRef} />
                        <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#bdbdbd', textAlign: 'center' }}>
                            Draft only · Do not use as a financial instrument · Verify all details before issuing actual cheque
                        </div>
                    </div>

                    {/* Summary table */}
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
                            All Cheques Summary
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                <thead>
                                    <tr style={{ background: '#fce4e4' }}>
                                        {['Cheque No.', 'BS Date', 'Payee', 'Amount (NPR)', 'Bank', 'Memo'].map(h => (
                                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#b71c1c', fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {cheques.map((c, i) => (
                                        <tr key={c.id} onClick={() => setActiveId(c.id)} style={{
                                            background: c.id === activeId ? '#fff8f8' : i % 2 === 0 ? '#fff' : '#fafafa',
                                            cursor: 'pointer', transition: 'background 0.1s',
                                            outline: c.id === activeId ? '1.5px solid #ef9a9a' : 'none',
                                        }}>
                                            <td style={{ padding: '8px 10px', fontFamily: '"Courier New", monospace', color: '#b71c1c', fontWeight: 700 }}>{c.chequeNumber || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{formatBSDate(c.date) || c.date || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: '#374151', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.payeeName || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: '#b71c1c', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {c.amountNumbers ? 'रू. ' + Number(c.amountNumbers).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#374151', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.bankName || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: '#6b7280', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {cheques.length > 1 && (
                                    <tfoot>
                                        <tr style={{ background: '#f8f8f8', borderTop: '2px solid #f5c6c6' }}>
                                            <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 700, fontSize: '12px', color: '#374151' }}>Total ({cheques.length} cheques)</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#b71c1c' }}>
                                                रू. {cheques.reduce((sum, c) => sum + (parseFloat(c.amountNumbers) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td colSpan={2} />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Sec({ title, children }) {
    return (
        <div>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#b71c1c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', borderBottom: '1.5px solid #fce4e4', paddingBottom: '4px' }}>
                {title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
        </div>
    );
}

function Fld({ label, children }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</label>
            {children}
        </div>
    );
}

function TwoCol({ children }) {
    return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>{children}</div>;
}