import React from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';

const DashboardCards = ({ totalItems = 0, accuracy = 0, discrepancies = 0, isLoading = false, showComparisonMetrics = false }) => {
  // Skeleton Loading Component
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Skeleton for Accuracy Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 h-36 animate-pulse">
          <div className="flex justify-between items-start">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
          </div>
          <div className="mt-6">
            <div className="h-10 w-20 bg-slate-200 rounded"></div>
          </div>
        </div>

        {/* Skeleton for Discrepancies Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 h-36 animate-pulse">
          <div className="flex justify-between items-start">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
          </div>
          <div className="mt-6">
            <div className="h-10 w-16 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const displayAccuracy = showComparisonMetrics ? accuracy : 0;
  const displayDiscrepancies = showComparisonMetrics ? discrepancies : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Inventory Accuracy % Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-36 relative overflow-hidden group">
        <div className="flex justify-between items-start">
          <span className="text-slate-500 font-medium text-sm">Dəqiqlik %</span>
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
            <BarChart3 size={18} />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-3xl md:text-4xl font-black text-emerald-650 tracking-tight">
            {displayAccuracy}%
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
      </div>

      {/* Discrepancies Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-36 relative overflow-hidden group">
        <div className="flex justify-between items-start">
          <span className="text-slate-500 font-medium text-sm">Fərqliliklər</span>
          <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl md:text-4xl font-black text-rose-600 tracking-tight animate-soft-pulse">
            {displayDiscrepancies}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
      </div>
    </div>
  );
};

export default DashboardCards;
