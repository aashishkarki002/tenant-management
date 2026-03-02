import { X, User, Phone, Mail, DollarSign, Calendar, AlertTriangle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const statusLabels = {
    occupied: 'Occupied',
    vacant: 'Vacant',
    overdue: 'Overdue',
    reserved: 'Reserved',
    'owner-occupied': 'Owner Occupied',
};

const statusColors = {
    occupied: 'bg-green-100 text-green-800 border-green-300',
    vacant: 'bg-gray-100 text-gray-800 border-gray-300',
    overdue: 'bg-red-100 text-red-800 border-red-300',
    reserved: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'owner-occupied': 'bg-blue-100 text-blue-800 border-blue-300',
};

export function UnitDetailsDrawer({ unit, onClose }) {
    if (!unit) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto"
            >
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{unit.id}</h2>
                            <p className="text-sm text-gray-500">Floor {unit.floor} · Block {unit.block}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Status Badge */}
                    <div>
                        <Badge className={`${statusColors[unit.status]} border px-4 py-1.5 text-sm font-medium`}>
                            {statusLabels[unit.status]}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Tenant Information */}
                    {unit.tenant && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Tenant Information
                            </h3>
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{unit.tenant.name}</p>
                                        <p className="text-xs text-gray-500">Tenant</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone className="w-4 h-4" />
                                        <span>{unit.tenant.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Mail className="w-4 h-4" />
                                        <span>{unit.tenant.email}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Information */}
                    {unit.rentAmount && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Payment Details
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                    <p className="text-xs text-emerald-700 font-medium mb-1">Rent Amount</p>
                                    <p className="text-xl font-bold text-emerald-900">
                                        NPR {unit.rentAmount.toLocaleString()}
                                    </p>
                                </div>

                                {unit.paidAmount !== undefined && (
                                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                        <p className="text-xs text-blue-700 font-medium mb-1">Paid Amount</p>
                                        <p className="text-xl font-bold text-blue-900">
                                            NPR {unit.paidAmount.toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {unit.remainingAmount !== undefined && unit.remainingAmount > 0 && (
                                <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        <p className="text-sm font-semibold text-red-700">Outstanding Balance</p>
                                    </div>
                                    <p className="text-2xl font-bold text-red-900">
                                        NPR {unit.remainingAmount.toLocaleString()}
                                    </p>
                                    {unit.escalationInfo && (
                                        <p className="text-xs text-red-600 mt-1">{unit.escalationInfo}</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2 bg-gray-50 rounded-xl p-4">
                                {unit.dueDate && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Due Date
                                        </span>
                                        <span className="font-semibold text-gray-900">{unit.dueDate}</span>
                                    </div>
                                )}
                                {unit.lastPaymentDate && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Last Payment
                                        </span>
                                        <span className="font-semibold text-gray-900">{unit.lastPaymentDate}</span>
                                    </div>
                                )}
                            </div>

                            {unit.escalationInfo && unit.status === 'overdue' && (
                                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-4 h-4 text-yellow-700" />
                                        <p className="text-xs font-semibold text-yellow-700">Escalation Status</p>
                                    </div>
                                    <p className="text-sm text-yellow-900">{unit.escalationInfo}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4">
                        <Button className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700">
                            View Full Details
                        </Button>
                        {unit.status === 'overdue' && (
                            <Button className="w-full" variant="outline">
                                Mark as Paid
                            </Button>
                        )}
                        <Button className="w-full" variant="outline">
                            Add Maintenance Request
                        </Button>
                    </div>

                    {/* Vacant Unit Info */}
                    {unit.status === 'vacant' && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <p className="text-sm text-gray-700 font-medium mb-2">This unit is available</p>
                            <p className="text-xs text-gray-500 mb-4">
                                Perfect opportunity for new tenants. Contact management for viewing arrangements.
                            </p>
                            <Button className="w-full" variant="default">
                                List for Rent
                            </Button>
                        </div>
                    )}

                    {/* Reserved Unit Info */}
                    {unit.status === 'reserved' && (
                        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                            <p className="text-sm text-yellow-700 font-medium mb-2">Unit Reserved</p>
                            <p className="text-xs text-yellow-600">
                                This unit is currently reserved. Expected move-in date: {unit.dueDate}
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
