import React, { useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'İdarə Paneli', icon: LayoutDashboard },
    { id: 'reports', label: 'Hesabatlar', icon: Activity },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className={`lg:hidden fixed z-[60] transition-all duration-300 ${isOpen ? 'top-6 left-[234px]' : 'top-4 left-4'}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-11 h-11 flex items-center justify-center bg-slate-900 text-white rounded-full shadow-2xl hover:bg-slate-800 transition-all duration-200 border border-slate-700/50 active:scale-90"
          aria-label="Toggle Menu"
        >
          {isOpen ? <ChevronRight size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-45
        w-64 bg-slate-900 text-slate-300 flex flex-col justify-between
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        transition-transform duration-300 ease-in-out h-screen border-r border-slate-800/50
      `}>
        {/* Top Branding Section */}
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400 shrink-0">
              <FileText size={22} className="animate-pulse" />
            </div>
            <span className="font-semibold text-lg text-white tracking-wide truncate">
              Smart Report AI
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-3 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    transition-all duration-200 group
                    ${isActive
                      ? 'bg-slate-800 text-white shadow-inner border-l-4 border-indigo-500'
                      : 'hover:bg-slate-800/50 hover:text-slate-100'
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className={`transition-transform duration-200 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>


      </aside>
    </>
  );
};

export default Sidebar;
