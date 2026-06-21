import React from 'react';
import { Fuel, LayoutDashboard, Key, History, UserCog, Sun, Moon, LogOut } from 'lucide-react';

interface NavigationProps {
    activeTab: 'hub' | 'vault' | 'history' | 'profile';
    setActiveTab: (tab: 'hub' | 'vault' | 'history' | 'profile') => void;
    theme: 'dark' | 'light';
    toggleTheme: () => void;
    onSignOut: () => void;
    role?: string; // --- NEW: Pass role to customize tabs ---
}

const Navigation: React.FC<NavigationProps> = ({
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    onSignOut,
    role
}) => {
    const isAdmin = role === 'superadmin' || role === 'admin';

    // --- NEW: Dynamic Tab Labels Based on Role ---
    const tabs = [
        { id: 'hub', label: isAdmin ? 'Command Center' : 'Control Hub', icon: LayoutDashboard },
        { id: 'vault', label: isAdmin ? 'Treasury Keys' : 'Wallet Vault', icon: Key },
        { id: 'history', label: isAdmin ? 'Audit Logs' : 'Ledger History', icon: History },
        { id: 'profile', label: isAdmin ? 'Coop Settings' : 'Profile Settings', icon: UserCog },
    ] as const;

    return (
        <nav className="sticky top-0 z-50 bg-white/80 dark:bg-[#060610]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

                {/* Brand */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center shadow-sm dark:shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                        <Fuel className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-black text-xl tracking-widest hidden md:block">MOBILIS</span>
                </div>

                {/* Main Tabs Navigation */}
                <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 overflow-x-auto custom-scrollbar">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white dark:bg-[#1a1a24] text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Theme & Log Out */}
                <div className="flex items-center gap-2">
                    <button onClick={toggleTheme} className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button onClick={onSignOut} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all text-sm font-bold">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;