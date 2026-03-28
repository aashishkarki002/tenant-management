import React, { useState } from "react";
import FinancialKpiStrip from "./FinancialKpiStrip";
import { RefreshCw } from "lucide-react";

/**
 * Demo page for the Financial KPI Strip component
 * 
 * This showcases the premium micro-interactions and animations:
 * - Staggered card entry animations
 * - Smooth hover lift effect
 * - Animated number count-up
 * - Delta indicators with subtle pulse
 * - Mini sparkline animations
 */
export default function FinancialKpiStripDemo() {
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Mock data that matches your real data structure
  const mockStats = {
    accounting: {
      totalRevenue: 2450000,
      totalExpenses: 1680000,
    },
    kpi: {
      totalRemaining: 320000,
    },
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setRefreshKey(prev => prev + 1);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              Financial Dashboard KPI Strip
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
              A modern fintech-inspired KPI strip with premium micro-interactions. Built with React, 
              Tailwind CSS, and Framer Motion.
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 
                     dark:border-neutral-800 bg-white dark:bg-neutral-900 
                     text-neutral-950 dark:text-neutral-50 text-sm font-medium
                     hover:shadow-md transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Demo
          </button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 
                        bg-white dark:bg-neutral-900">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-1">
              Staggered Animation
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Cards fade in with 80ms stagger and subtle upward motion
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 
                        bg-white dark:bg-neutral-900">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-1">
              Hover Interaction
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Smooth lift effect with enhanced shadow (200ms transition)
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 
                        bg-white dark:bg-neutral-900">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-1">
              Number Animation
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Count-up effect with easeOut cubic timing (600ms)
            </p>
          </div>
        </div>
      </div>

      {/* KPI Strip Demo */}
      <div className="max-w-7xl mx-auto" key={refreshKey}>
        <FinancialKpiStrip stats={mockStats} loading={loading} />
      </div>

      {/* Technical Details */}
      <div className="max-w-7xl mx-auto mt-12">
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 
                      bg-white dark:bg-neutral-900">
          <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-4">
            Motion Design System
          </h2>
          
          <div className="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                  Entry Animation
                </h3>
                <ul className="space-y-1.5 text-xs">
                  <li>• Opacity: 0 → 1</li>
                  <li>• Y offset: 8px → 0</li>
                  <li>• Duration: 500ms</li>
                  <li>• Stagger: 80ms between cards</li>
                  <li>• Easing: cubic-bezier(0.22, 0.61, 0.36, 1)</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                  Hover State
                </h3>
                <ul className="space-y-1.5 text-xs">
                  <li>• Y offset: -2px lift</li>
                  <li>• Shadow: enhanced elevation</li>
                  <li>• Duration: 200ms</li>
                  <li>• Easing: easeOut</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                  Number Count-Up
                </h3>
                <ul className="space-y-1.5 text-xs">
                  <li>• Duration: 600ms</li>
                  <li>• Easing: cubic easeOut (1 - (1-t)³)</li>
                  <li>• RequestAnimationFrame for smooth 60fps</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                  Delta Indicators
                </h3>
                <ul className="space-y-1.5 text-xs">
                  <li>• Scale: 0.9 → 1</li>
                  <li>• Opacity: 0 → 1</li>
                  <li>• Duration: 300ms</li>
                  <li>• Delay: 500ms</li>
                  <li>• Color-coded: green (up) / red (down)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Example */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 
                      bg-white dark:bg-neutral-900">
          <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-4">
            Usage
          </h2>
          
          <pre className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 
                         text-xs text-neutral-950 dark:text-neutral-50 overflow-x-auto">
{`import FinancialKpiStrip from './component/FinancialKpiStrip';

function Dashboard() {
  const { stats, loading } = useStats();
  
  return (
    <div>
      <FinancialKpiStrip stats={stats} loading={loading} />
    </div>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
