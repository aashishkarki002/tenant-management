import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, User, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP = {
  payment: CheckCircle,
  rent: CheckCircle,
  maintenance: Clock,
  tenant: User,
  default: Circle,
};

const COLOR_MAP = {
  payment: 'bg-green-500',
  rent: 'bg-green-500',
  maintenance: 'bg-blue-500',
  tenant: 'bg-orange-500',
  default: 'bg-gray-400',
};

const LABEL_MAP = {
  payment: 'Payment',
  rent: 'Rent',
  maintenance: 'Maintenance',
  tenant: 'Tenant',
  default: 'Activity',
};

function normalizeActivities(stats) {
  const raw = stats?.recentActivities ?? stats?.activities ?? stats?.recentActivity;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => ({
    id: item.id ?? i,
    type: item.type ?? item.icon ?? 'default',
    mainText: item.mainText ?? item.title ?? item.message ?? item.text ?? '—',
    details: item.details ?? item.subtitle ?? item.time ?? '',
  }));
}

function ActivitySkeleton() {
  return (
    <div className="space-y-5 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full animate-pulse bg-muted shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-3/4 rounded animate-pulse bg-muted" />
            <div className="h-3 w-1/2 rounded animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecentActivities({ stats, loading, error }) {
  const activities = normalizeActivities(stats);

  return (
    <Card className="rounded-xl shadow-md w-full bg-white border border-gray-100">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">
          Recent Activity
        </CardTitle>
        <Link
          to="/activity"
          className="text-xs font-semibold text-orange-700 hover:text-orange-800 hover:underline uppercase tracking-wide"
        >
          View Log
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}

        {loading ? (
          <ActivitySkeleton />
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Circle className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No recent activity</p>
            <p className="text-xs text-gray-400">Activity from payments and maintenance will appear here</p>
          </div>
        ) : (
          /* Timeline with a vertical connector line */
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-100" aria-hidden />

            <div className="space-y-5">
              {activities.map((activity, idx) => {
                const IconComponent = ICON_MAP[activity.type] ?? ICON_MAP.default;
                const iconColor = COLOR_MAP[activity.type] ?? COLOR_MAP.default;
                const label = LABEL_MAP[activity.type] ?? LABEL_MAP.default;
                return (
                  <div key={activity.id} className="relative flex items-start gap-3 group">
                    {/* Icon dot */}
                    <div className={`relative z-10 ${iconColor} rounded-full p-1.5 shrink-0 shadow-sm ring-2 ring-white mt-0.5`}>
                      <IconComponent className="w-3.5 h-3.5 text-white" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900 truncate leading-snug">
                          {activity.mainText}
                        </p>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${activity.type === 'payment' || activity.type === 'rent' ? 'bg-green-100 text-green-700' :
                            activity.type === 'maintenance' ? 'bg-blue-100 text-blue-700' :
                              activity.type === 'tenant' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                          }`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {activity.details}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}