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
            <DialogContent className="max-w-md border-0 p-0 overflow-hidden bg-white">
                <div className="p-6 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-slate-900">Remove Staff Member?</h2>
                        <p className="text-slate-600">
                            This action will permanently remove the following staff member from your organization:
                        </p>
                    </div>

                    {staff && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12 border-2 border-slate-200">
                                    <AvatarImage src={staff?.profilePicture} />
                                    <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 font-bold">
                                        {getInitials(staff?.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{staff?.name}</p>
                                    <p className="text-sm text-slate-600 truncate">{staff?.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm text-red-800 font-medium mb-2">Warning:</p>
                        <ul className="text-sm text-red-700 space-y-1">
                            <li>• All access permissions will be revoked immediately</li>
                            <li>• This action cannot be undone</li>
                            <li>• Staff member will be logged out from all devices</li>
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
                            className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                        >
                            Remove Staff
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
