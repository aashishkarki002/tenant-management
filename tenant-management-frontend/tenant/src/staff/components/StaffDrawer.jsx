import { useState, useEffect } from 'react'
import api from '../../../plugins/axios'
import {
    Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
    Phone, Mail, Edit, Trash2, MapPin, Calendar,
    Briefcase, TrendingUp, ShieldCheck, Clock, X,
    ChevronRight, Building2, CreditCard, History,
    CheckSquare, Wrench, AlertCircle
} from 'lucide-react'
import StaffAvatar from './StaffAvatar'
import DeptPill from './DeptPill'
import StaffStatusPill from './StaffStatusPill'

function formatPaisa(paisa) {
    if (!paisa && paisa !== 0) return '—'
    const rs = paisa / 100
    return `Rs. ${rs.toLocaleString('en-NP')}`
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
}

function SectionLabel({ children }) {
    return (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            {children}
        </p>
    )
}

function InfoRow({ icon: Icon, label, value, mono }) {
    if (!value) return null
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                <p className={`text-sm text-slate-800 font-semibold mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
            </div>
        </div>
    )
}

function SalaryHistoryEntry({ entry, index }) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${index === 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {/* connector line — not the last item */}
                <div className="w-px flex-1 bg-slate-100 mt-1" style={{ minHeight: '20px' }} />
            </div>
            <div className="pb-4">
                <p className="text-sm font-bold text-slate-800">{formatPaisa(entry.amountPaisa)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.effectiveFrom)}</p>
                {entry.reason && (
                    <p className="text-xs text-slate-500 mt-1 italic">"{entry.reason}"</p>
                )}
            </div>
        </div>
    )
}

// Placeholder sections for future data
function PlaceholderSection({ icon: Icon, label, description }) {
    return (
        <div className="border border-dashed border-slate-200 rounded-xl p-4 flex items-start gap-3 bg-slate-50/50">
            <Icon className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-xs font-semibold text-slate-400">{label}</p>
                <p className="text-xs text-slate-300 mt-0.5">{description}</p>
            </div>
        </div>
    )
}

export default function StaffDrawer({ member, open, onClose, onEdit, onDelete }) {
    const [fullData, setFullData] = useState(null)
    const [loadingFull, setLoadingFull] = useState(false)

    useEffect(() => {
        if (!open || !member) { setFullData(null); return }

        // Fetch the full record (with populated StaffProfile)
        const load = async () => {
            setLoadingFull(true)
            try {
                const res = await api.get(`/api/staff/get-staff/${member._id}`)
                if (res.data.success) setFullData(res.data.data)
            } catch {
                // Fallback: use what we already have from the list
                setFullData(member)
            } finally {
                setLoadingFull(false)
            }
        }
        load()
    }, [open, member])

    if (!member) return null

    const data = fullData || member
    const profile = data.profile

    const handleCall = () => {
        if (member.phone) window.location.href = `tel:${member.phone}`
        else alert('No phone number on record')
    }

    const handleEmail = () => {
        window.location.href = `mailto:${member.email}`
    }

    const salaryHistory = profile?.salaryHistory ?? []
    const sortedHistory = [...salaryHistory].sort(
        (a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)
    )

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md p-0 flex flex-col bg-card border-l border-border overflow-hidden"
                // suppress default close button — we have our own
                hideCloseButton
            >
                {/* ── Hero header ── */}
                <div className="relative px-6 pt-10 pb-6 bg-primary border border-border">
                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary/70 hover:text-primary transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-end gap-4">
                        {/* Avatar */}
                        <StaffAvatar src={data.profilePicture} name={data.name} size="xl" />

                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold text-foreground leading-tight truncate">{data.name}</h2>
                            {profile?.designation && (
                                <p className="text-lg font-semibold text-foreground mt-0.5 truncate">{profile.designation}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <DeptPill dept={profile?.department} />
                                <StaffStatusPill isActive={data.isActive} />
                            </div>
                        </div>
                    </div>

                    {/* Primary CTAs */}
                    <div className="grid grid-cols-2 gap-2 mt-5">
                        <button
                            onClick={handleCall}
                            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Call
                        </button>
                        <button
                            onClick={handleEmail}
                            className="flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-white/20 transition-colors border border-white/10"
                        >
                            <Mail className="w-4 h-4" />
                            Email
                        </button>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

                    {loadingFull && (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    )}

                    {!loadingFull && (
                        <>
                            {/* Contact info */}
                            <div>
                                <SectionLabel>Contact</SectionLabel>
                                <div className="bg-slate-50 rounded-2xl px-4 py-1 divide-y divide-slate-100">
                                    <InfoRow icon={Mail} label="Email" value={data.email} />
                                    <InfoRow icon={Phone} label="Phone" value={data.phone || 'Not provided'} />
                                </div>
                            </div>

                            {/* Employment */}
                            {profile && (
                                <div>
                                    <SectionLabel>Employment</SectionLabel>
                                    <div className="bg-slate-50 rounded-2xl px-4 py-1 divide-y divide-slate-100">
                                        <InfoRow icon={Briefcase} label="Designation" value={profile.designation} />
                                        <InfoRow icon={Building2} label="Department" value={profile.department?.charAt(0).toUpperCase() + profile.department?.slice(1)} />
                                        <InfoRow icon={ShieldCheck} label="Access level" value={profile.accessLevel ? `Level ${profile.accessLevel}` : null} />
                                        <InfoRow icon={Calendar} label="Joined" value={formatDate(profile.joiningDate)} />
                                        {profile.leavingDate && (
                                            <InfoRow icon={Calendar} label="Left" value={formatDate(profile.leavingDate)} />
                                        )}
                                        {profile.reportsTo && (
                                            <InfoRow icon={TrendingUp} label="Reports to" value={profile.reportsTo?.name || '—'} />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Salary — current */}
                            {profile && (
                                <div>
                                    <SectionLabel>Compensation</SectionLabel>
                                    <div className="bg-slate-50 rounded-2xl px-4 py-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-medium">Current salary</p>
                                                <p className="text-xl font-bold text-slate-900 mt-0.5">
                                                    {formatPaisa(profile.salaryAmountPaisa)}
                                                </p>
                                            </div>
                                            <span className="text-xs bg-slate-200 text-slate-600 font-semibold px-2 py-1 rounded-lg capitalize">
                                                {profile.salaryType || 'monthly'}
                                            </span>
                                        </div>

                                        {profile.bankDetails?.bankName && (
                                            <div className="mt-3 pt-3 border-t border-slate-200">
                                                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                                                    <CreditCard className="w-3 h-3" /> Bank
                                                </p>
                                                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                                                    {profile.bankDetails.bankName}
                                                    {profile.bankDetails.accountNumber && ` · ****${profile.bankDetails.accountNumber.slice(-4)}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Salary history */}
                            {sortedHistory.length > 0 && (
                                <div>
                                    <SectionLabel>Salary history</SectionLabel>
                                    <div className="pl-1">
                                        {sortedHistory.map((entry, i) => (
                                            <SalaryHistoryEntry key={i} entry={entry} index={i} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Future sections — placeholders so the owner knows what's coming */}
                            <div>
                                <SectionLabel>Activity</SectionLabel>
                                <div className="space-y-2">
                                    <PlaceholderSection
                                        icon={CheckSquare}
                                        label="Daily checklists"
                                        description="Completed tasks will appear here once the activity feed is connected."
                                    />
                                    <PlaceholderSection
                                        icon={Wrench}
                                        label="Maintenance tasks"
                                        description="Assigned and resolved maintenance jobs will show here."
                                    />
                                </div>
                            </div>

                            {/* Admin notes */}
                            {profile?.notes && (
                                <div>
                                    <SectionLabel>Internal notes</SectionLabel>
                                    <div className="bg-surface-alt border border-border rounded-2xl p-4 flex gap-3">
                                        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-destructive">{profile.notes}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Footer actions ── */}
                <div className="border-t border-border px-6 py-4 flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(member)}
                        className="flex-1 gap-2 border-border text-foreground hover:bg-accent/10 hover:text-accent-foreground"
                    >
                        <Edit className="w-4 h-4" />
                        Edit member
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(member)}
                        className="gap-2 border-destructive text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                    >
                        <Trash2 className="w-4 h-4" />
                        Remove
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}