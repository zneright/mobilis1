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
    appNetwork?: 'TESTNET';
    refreshData: () => Promise<void>;
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
                    {/* Always visible since app is strictly Testnet */}
                    <button
                        onClick={handleFundTestnet}
                        disabled={isFunding}
                        className="w-full py-3.5 px-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl font-bold text-sm flex items-center justify-between text-yellow-600 dark:text-yellow-400 transition-colors"
                    >
                        <span className="flex items-center gap-3"><Droplet className="w-4 h-4" /> {isFunding ? 'Funding...' : 'Drop Testnet XLM'}</span>
                    </button>

                    <button onClick={() => setShowReceiveModal(true)} className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                        <span className="flex items-center gap-3"><ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Receive</span>
                    </button>
                    <button onClick={() => setShowSendModal(true)} className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                        <span className="flex items-center gap-3"><ArrowUpRight className="w-4 h-4 text-blue-500" /> Send</span>
                    </button>
                    <button onClick={() => alert("Fiat Cashout architecture is currently disabled in testnet mode.")} className="w-full py-3.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl font-bold text-sm flex items-center justify-between text-emerald-600 dark:text-emerald-400 transition-colors">
                        <span className="flex items-center gap-3"><Banknote className="w-4 h-4" /> Cashout</span>
                    </button>
                </div>

                {/* Multi-Asset List */}
                {assetBalances && assetBalances.map((asset, idx) => {
                    const isNative = asset.asset_type === 'native';
                    const code = isNative ? 'XLM' : asset.asset_code;
                    const bal = parseFloat(asset.balance);
                    const rate = isNative ? PHP_EXCHANGE_RATE : (code === 'USDC' ? USDC_EXCHANGE_RATE : 1);
                    const phpValue = bal * rate;

                    return (
                        <div key={idx} className="col-span-1 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col justify-between">
                            <p className="text-sm font-bold text-gray-500 mb-1">{code} Vault</p>
                            <h4 className="text-2xl font-black">{bal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {code}</h4>
                            {currencyMode === 'PHP' && (
                                <p className="text-emerald-500 font-bold mt-2 text-sm">≈ ₱ {phpValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            )}
                        </div>
                    )
                })}

                {/* Keys */}
                <div className="col-span-1 md:col-span-3 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                    {externalWallet ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <LinkIcon className="w-12 h-12 text-blue-500 mb-4 opacity-50" />
                            <h4 className="text-lg font-bold mb-2">External Web3 Connected</h4>
                            <p className="text-gray-500 text-sm mb-4">You are currently managing your assets via a third-party Stellar application.</p>
                            <code className="bg-gray-50 dark:bg-black/40 p-3 rounded-xl text-xs break-all border border-gray-200 dark:border-white/5">{externalWallet}</code>
                        </div>
                    ) : (
                        <>
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6 flex gap-3 text-xs text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <p>Do not expose your secret seed key. These values control your internal assets on the Stellar Network.</p>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Public Address</label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-xs break-all border border-gray-200 dark:border-white/5">{activePubKey}</code>
                                        <button onClick={() => navigator.clipboard.writeText(activePubKey!)} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Secret Seed Phrase</label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-xs break-all border border-gray-200 dark:border-white/5 select-none">
                                            {showSecret ? stellarData.secret : 'S•••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                        </code>
                                        <button onClick={() => setShowSecret(!showSecret)} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10">
                                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => navigator.clipboard.writeText(stellarData.secret)} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VaultTab;