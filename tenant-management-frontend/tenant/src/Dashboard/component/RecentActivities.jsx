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
  default: 'bg-gray-500',
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
    <div className="space-y-6 mt-4 px-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative flex items-start gap-3">
          <div className="w-7 h-7 rounded-full animate-pulse bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded animate-pulse bg-muted" />
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
    <Card className="rounded-lg shadow-lg w-full bg-white border border-gray-100 mt-6 mx-4">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Recent Activity
        </CardTitle>
        <Link
          to="/activity"
          className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
        >
          View Log
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        <div className="relative pl-8 flex">
          <div className="space-y-6 mt-4 px-4 w-full">
            {loading ? (
              <ActivitySkeleton />
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No recent activity</p>
            ) : (
              activities.map((activity) => {
                const iconType = ICON_MAP[activity.type] ?? ICON_MAP.default;
                const iconColor = COLOR_MAP[activity.type] ?? COLOR_MAP.default;
                const IconComponent = iconType;
                return (
                  <div key={activity.id} className="relative flex items-start">
                    <div className={`absolute left-0 ${iconColor} rounded-full p-1.5 z-10`}>
                      <IconComponent className="w-4 h-4 text-white " />
                    </div>
                    <div className="ml-10 w-full">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {activity.mainText}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.details}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}