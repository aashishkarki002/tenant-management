import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertTriangle, X } from 'lucide-react'

function getInitials(name) {
    if (!name || typeof name !== 'string') return '?'
    return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DeleteStaffDialog({ open, staff, onOpenChange, onConfirm }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md border border-border p-0 overflow-hidden bg-card">
                <div className="p-6 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-8 h-8 hover:bg-muted rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Remove {staff?.name ?? 'this member'}?
                        </h2>
                    </div>

                    {staff && (
                        <div className="bg-muted/40 border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12 border-2 border-border">
                                    <AvatarImage src={staff?.profilePicture} />
                                    <AvatarFallback className="bg-muted text-foreground font-bold">
                                        {getInitials(staff?.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">{staff?.name}</p>
                                    <p className="text-sm text-muted-foreground truncate">{staff?.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                        <ul className="text-sm text-destructive/80 space-y-1">
                            <li>• Their access will be revoked immediately</li>
                            <li>• This can't be undone</li>
                        </ul>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-11"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className="flex-1 h-11 bg-destructive hover:bg-destructive/90 text-white"
                        >
                            Remove member
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
