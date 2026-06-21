import React from 'react';
import { Fuel, LayoutDashboard, Wallet, History, UserCog } from 'lucide-react';

interface SidebarProps {
    activeTab: 'hub' | 'vault' | 'history' | 'profile';
    setActiveTab: (tab: 'hub' | 'vault' | 'history' | 'profile') => void;
    role?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
    const isAdmin = role === 'superadmin' || role === 'admin';

    const tabs = [
        { id: 'hub', label: isAdmin ? 'Command Center' : 'Control Hub', icon: LayoutDashboard },
        { id: 'vault', label: isAdmin ? 'Treasury Keys' : 'Digital Wallet', icon: Wallet },
        { id: 'history', label: 'On-Chain Logs', icon: History },
        { id: 'profile', label: 'Profile Settings', icon: UserCog },
    ] as const;

    return (
        <aside className="hidden md:flex flex-col w-64 h-screen border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#060610] transition-colors duration-300">
            {/* Sidebar Header */}
            <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-200 dark:border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center shadow-sm dark:shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                    <Fuel className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-xl tracking-widest text-gray-900 dark:text-white">MOBILIS</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${isActive
                                    ? 'bg-emerald-50 dark:bg-[#1a1a24] text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;