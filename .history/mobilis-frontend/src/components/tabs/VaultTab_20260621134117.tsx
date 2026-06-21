import React, { useState } from 'react';
import { Eye, EyeOff, Copy, AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, RefreshCw, Link as LinkIcon, Unlink, Droplet } from 'lucide-react';

interface VaultTabProps {
    stellarData: any;
    externalWallet: string | null;
    activePubKey: string | null;
    xlmBalance: string;
    assetBalances: any[];
    currencyMode: 'XLM' | 'PHP';
    setCurrencyMode: React.Dispatch<React.SetStateAction<'XLM' | 'PHP'>>;
    formatCurrency: (amount: number | string) => string;
    setShowWalletModal: (val: boolean) => void;
    handleDisconnectWallet: () => void;
    setShowReceiveModal: (val: boolean) => void;
    setShowSendModal: (val: boolean) => void;
    appNetwork?: 'TESTNET' | 'PUBLIC';
    refreshData: () => Promise<void>; // Added to trigger fetch after funding
}

const PHP_EXCHANGE_RATE = 60.69;
const USDC_EXCHANGE_RATE = 58.00;

const VaultTab: React.FC<VaultTabProps> = ({ stellarData, externalWallet, activePubKey, xlmBalance, assetBalances, currencyMode, setCurrencyMode, formatCurrency, setShowWalletModal, handleDisconnectWallet, setShowReceiveModal, setShowSendModal, appNetwork, refreshData }) => {
    const [showSecret, setShowSecret] = useState(false);
    const [isFunding, setIsFunding] = useState(false);

    // --- FRIEND BOT FUNDING LOGIC ---
    const handleFundTestnet = async () => {
        if (!activePubKey) return;
        setIsFunding(true);
        try {
            const response = await fetch(`https://friendbot.stellar.org/?addr=${activePubKey}`);
            if (response.ok) {
                alert("Success! 10,000 Testnet XLM has been deposited to your account.");
                // Immediately pull new data after funding
                await refreshData();
            } else {
                const errorData = await response.json();
                console.error("[VaultTab -> handleFundTestnet] API Error Details:", errorData);
                alert(`Friendbot failed: ${errorData.detail || "Account may already be funded or network is busy."}`);
            }
        } catch (error) {
            console.error("[VaultTab -> handleFundTestnet] Network/Fetch Error:", error);
            alert("Network error: Could not reach Stellar Friendbot.");
        } finally {
            setIsFunding(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-4">
                <div>
                    <h3 className="text-2xl font-black">Digital Wallet</h3>
                    <p className="text-gray-500 text-sm">Stellar Network Assets</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {externalWallet ? (
                        <button onClick={handleDisconnectWallet} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-mono bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 shadow-sm transition-colors hover:bg-red-100 dark:hover:bg-red-500/20">
                            <Unlink className="w-4 h-4" /> Disconnect External
                        </button>
                    ) : (
                        <button onClick={() => setShowWalletModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-mono bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm transition-colors hover:bg-blue-100 dark:hover:bg-blue-500/20">
                            <LinkIcon className="w-4 h-4" /> Connect Wallet
                        </button>
                    )}
                    <button onClick={() => setCurrencyMode(p => p === 'PHP' ? 'XLM' : 'PHP')} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-mono bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 shadow-sm">
                        <RefreshCw className="w-4 h-4" /> {currencyMode}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Balance Card */}
                <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-[2rem] p-8 shadow-xl text-black flex flex-col justify-between min-h-[200px]">
                    <div>
                        <p className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Total Main Balance</p>
                        <h2 className="text-5xl md:text-6xl font-black">{formatCurrency(xlmBalance)}</h2>
                    </div>
                    <div className="flex items-center gap-2 mt-6 bg-black/10 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-xs font-bold tracking-wider">{externalWallet ? 'External Web3 Connected' : 'Internal Node Active'}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="col-span-1 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col gap-3 justify-center min-h-[200px]">
                    {/* NEW: Friendbot Funding Button (Only visible on Testnet) */}
                    {appNetwork === 'TESTNET' && (
                        <button
                            onClick={handleFundTestnet}
                            disabled={isFunding}
                            className="w-full py-3.5 px-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl font-bold text-sm flex items-center justify-between text-yellow-600 dark:text-yellow-400 transition-colors"
                        >
                            <span className="flex items-center gap-3"><Droplet className="w-4 h-4" /> {isFunding ? 'Funding...' : 'Drop Testnet XLM'}</span>
                        </button>
                    )}

                    <button onClick={() => setShowReceiveModal(true)} className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                        <span className="flex items-center gap-3"><ArrowDownLeft className