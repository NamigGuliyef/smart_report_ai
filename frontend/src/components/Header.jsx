import React, { useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';

const Header = ({ user, onLogout }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-slate-100/50">
      {/* Search Bar / Left title context on mobile */}
      <div className="flex-1 lg:max-w-xs">
        {/* Optional Search bar or blank spacer to align items */}

      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-full lg:rounded-xl transition-all duration-200"
          >
            {/* Avatar image / initials */}
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-semibold overflow-hidden">
              <User size={18} />
            </div>
            <span className="hidden sm:block text-sm font-medium text-slate-700">{user?.name || 'İstifadəçi'}</span>
            <ChevronDown size={16} className="text-slate-400 hidden sm:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-32 bg-white border border-slate-150 rounded-xl shadow-xl z-50 py-1.5 animate-fade-in">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50/50 transition-colors"
              >
                <LogOut size={16} />
                <span>Çıxış</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
