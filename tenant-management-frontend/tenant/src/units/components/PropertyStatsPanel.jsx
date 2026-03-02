import { ArrowLeft, Building2, Users, Home, AlertCircle, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getNepaliDate } from '../utils/nepaliDate';

export function PropertyStatsPanel({ propertyName, stats }) {
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const nepaliDate = getNepaliDate();

    return (
        <div className="w-80 p-6 space-y-6">
            <Card className="p-6 shadow-lg border-gray-200 bg-white">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="space-y-4">
                        <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{propertyName}</h1>
                                <p className="text-sm text-gray-500">Multi-Unit Complex</p>
                            </div>
                        </div>
                    </div>

                    {/* Date Info */}
                    <div className="space-y-2 p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{currentDate}</span>
                        </div>
                        <p className="text-xs text-gray-500 pl-6">{nepaliDate}</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="space-y-3">
                        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                            Quick Stats
                        </h2>

                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                icon={<Building2 className="w-5 h-5" />}
                                label="Total Units"
                                value={stats.totalUnits}
                                color="bg-gray-100 text-gray-700"
                            />
                            <StatCard
                                icon={<Users className="w-5 h-5" />}
                                label="Occupied"
                                value={stats.occupied}
                                color="bg-green-100 text-green-700"
                            />
                            <StatCard
                                icon={<Home className="w-5 h-5" />}
                                label="Vacant"
                                value={stats.vacant}
                                color="bg-gray-100 text-gray-600"
                            />
                            <StatCard
                                icon={<AlertCircle className="w-5 h-5" />}
                                label="Overdue"
                                value={stats.overdue}
                                color="bg-red-100 text-red-700"
                            />
                        </div>

                        {/* Occupancy Rate */}
                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Occupancy Rate</span>
                                <span className="text-2xl font-bold text-emerald-700">
                                    {stats.occupancyRate}%
                                </span>
                            </div>
                            <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${stats.occupancyRate}%` }}
                                />
                            </div>
                        </div>

                        {/* Additional Stats */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <div className="text-xs text-yellow-700 font-medium">Reserved</div>
                                <div className="text-xl font-bold text-yellow-800">{stats.reserved}</div>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-xs text-blue-700 font-medium">Owner Occ.</div>
                                <div className="text-xl font-bold text-blue-800">{stats.ownerOccupied}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <div className={`p-3 rounded-xl ${color}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}
