import React from 'react';

const AccuracyChart = ({ accuracy = 0, isInitial = false, showComparisonMetrics = false }) => {
  const isActive = showComparisonMetrics && !isInitial;
  const displayAccuracy = isActive ? accuracy : 0;
  const discrepancy = isActive ? Math.max(0, 100 - displayAccuracy) : 0;

  // SVG Circle parameters
  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius; // ~439.82

  // Calculate dash offset for green (accuracy)
  const accuracyStrokeLength = (displayAccuracy / 100) * circumference;
  const accuracyStrokeOffset = circumference - accuracyStrokeLength;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 flex items-center justify-between h-36 relative overflow-hidden group hover:shadow-md transition-shadow duration-200">
      {/* Left Info Section */}
      <div className="flex flex-col justify-between h-full py-1">
        <div>
          <span className="text-slate-500 font-medium text-sm block">Dəqiqlik Bölgüsü</span>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150 inline-block mt-1">
            {isActive ? 'Canlı Status' : 'Gözləmədə'}
          </span>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-md ${isActive ? 'bg-emerald-500' : 'bg-slate-300'} shadow-sm`}></span>
            <span className="text-xs font-semibold text-slate-600">Dəqiqlik: {displayAccuracy}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-md ${isActive ? 'bg-rose-500' : 'bg-slate-200'} shadow-sm`}></span>
            <span className="text-xs font-semibold text-slate-650">Fərqlilik: {discrepancy}%</span>
          </div>
        </div>
      </div>

      {/* Right Chart Section */}
      <div className="relative flex items-center justify-center pr-2">
        <svg
          width="90"
          height="90"
          className="transform -rotate-90 transition-transform duration-500 ease-out hover:scale-105"
        >
          {/* Background circle (Red / Discrepancy or Gray / Initial) */}
          <circle
            cx="45"
            cy="45"
            r="32"
            fill="transparent"
            stroke={isActive ? "#f43f5e" : "#e2e8f0"} /* rose-500 or slate-200 */
            strokeWidth="10"
          />

          {/* Foreground circle (Green / Accuracy) */}
          {isActive && (
            <circle
              cx="45"
              cy="45"
              r="32"
              fill="transparent"
              stroke="#10b981" /* emerald-500 */
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 32}
              strokeDashoffset={(2 * Math.PI * 32) - ((displayAccuracy / 100) * (2 * Math.PI * 32))}
              strokeLinecap="butt"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>

        {/* Center Percentage Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pr-2 pointer-events-none">
          <span className="text-sm font-black text-slate-800">{displayAccuracy}%</span>
        </div>
      </div>
    </div>
  );
};

export default AccuracyChart;
