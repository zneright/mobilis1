// Drop this into wherever your BottomNav component lives
import React from 'react';
import { LayoutDashboard, Wallet, History, UserCog } from 'lucide-react';

interface BottomNavProps {
    activeTab: 'hub' | 'vault' | 'history' | 'profile';
    setActiveTab: (tab: 'hub' | 'vault' | 'history' | 'profile') => void;
    role?: string;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, role }) => {
    const isAdmin = role === 'superadmin' || role === 'admin';

    const tabs = [
        { id: 'hub', label: isAdmin ? 'Command' : 'Hub', icon: LayoutDashboard },
        { id: 'vault', label: isAdmin ? 'Treasury' : 'Wallet', icon: Wallet },
        { id: 'history', label: 'History', icon: History },
        { id: 'profile', label: 'Profile', icon: UserCog },
    ] as const;

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0a0a14]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 pt-2 pb-6 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-colors duration-300">
            <div className="max-w-md mx-auto flex items-center justify-around h-16">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${isActive
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : 'text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 scale-110' : 'bg-transparent scale-100'}`}>
                                <Icon className="w-[22px] h-[22px]" />
                            </div>
                            <span className="text-[10px] font-bold tracking-wide">{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;