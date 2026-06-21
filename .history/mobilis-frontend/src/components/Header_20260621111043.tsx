import React from 'react';
import { Fuel, Sun, Moon, LogOut } from 'lucide-react';

interface HeaderProps {
    theme: 'dark' | 'light';
    toggleTheme: () => void;
    onSignOut: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, onSignOut }) => {
    return (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#060610]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

                {/* Brand */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center shadow-sm dark:shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                        <Fuel className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-black text-xl tracking-widest text-gray-900 dark:text-white">MOBILIS</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={onSignOut}
                        className="flex items-center gap-2 p-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all font-bold"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;