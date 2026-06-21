import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Coins, RefreshCw } from 'lucide-react';
import type { UserData } from '../../types';

interface HubTabProps {
    stellarData: any;
    isAdmin: boolean;
    currencyMode: 'XLM' | 'PHP';
    setCurrencyMode: React.Dispatch<React.SetStateAction<'XLM' | 'PHP'>>;
    formatCurrency: (amount: number | string) => string;
    debtState: number;
    isProcessing: boolean;
    handleRequestAdvance: (amount: number) => Promise<void>;
    handleInjectLiquidity: (amount: number) => Promise<void>;
    handleSettleLoan: () => Promise<void>;
    appNetwork: 'TESTNET';
    
const HubTab: React.FC<HubTabProps> = ({ stellarData, isAdmin, currencyMode, setCurrencyMode, formatCurrency, debtState, isProcessing, handleRequestAdvance, handleInjectLiquidity, handleSettleLoan, treasuryBalance }) => {
    const [customAmount, setCustomAmount] = useState<string>('15');
    const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);

    useEffect(() => {
        const fetchPendingAccounts = async () => {
            if (!isAdmin) return;
            try {
                let q = stellarData.role === 'superadmin'
                    ? query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'pending'))
                    : query(collection(db, 'users'), where('role', '==', 'driver'), where('status', '==', 'pending'), where('todaAffiliation', '==', stellarData.coopName));

                const querySnapshot = await getDocs(q);
                const users: UserData[] = [];
                querySnapshot.forEach((doc) => users.push(doc.data() as UserData));
                setPendingUsers(users);
            } catch (error) {
                console.error("Error fetching pending accounts:", error);
            }
        };
        fetchPendingAccounts();
    }, [stellarData, isAdmin]);

    const handleApprove = async (uid: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { status: 'approved' });
            setPendingUsers(prev => prev.filter(user => user.uid !== uid));
            alert("Account verified on-chain successfully!");
        } catch (error) {
            alert("Failed to sign node approval. Check console for details.");
        }
    };

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-lg mb-4 flex justify-end items-center">
                <button onClick={() => setCurrencyMode(p => p === 'PHP' ? 'XLM' : 'PHP')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5" /> Display: {currencyMode}
                </button>
            </div>

            {isAdmin ? (
                <div className="w-full">
                    <div className="mb-8 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
    <h3 className="text-sm font-bold tracking-widest text-emerald-500 uppercase mb-4">Liquidity Controller</h3>
    
    {/* NEW: Treasury Balance Display */}
    <div className="mb-6 p-6 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Live Cooperative Treasury</p>
        <h2 className="text-4xl font-black text-gray-900 dark:text-white">
            {formatCurrency(treasuryBalance || "0")}
        </h2>
        <p className="text-[10px] text-gray-500 mt-2 font-mono break-all">Vault: {CONTRACT_ID}</p>
    </div>

    {/* Your existing inject liquidity input goes here... */}
    <div className="flex flex-col sm:flex-row items-center gap-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                        Pending Registrations <span className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-full text-xs font-mono">{pendingUsers.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingUsers.map(user => (
                            <div key={user.uid} className="bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                                <div className="mb-4">
                                    <h4 className="text-lg font-bold">{stellarData.role === 'admin' ? user.fullName : user.coopName}</h4>
                                    <p className="text-sm text-gray-500 font-mono mt-2">PLATE: {user.plateNumber || 'N/A'}</p>
                                </div>
                                <button onClick={() => handleApprove(user.uid)} className="w-full py-3 bg-gray-900 text-white dark:bg-white dark:text-black font-bold rounded-xl text-sm">Approve Node Signature</button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-lg flex flex-col gap-4">
                    <div className="bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Coins className="w-5 h-5 text-emerald-500" />
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">On-Chain Debt Balance</p>
                        </div>
                        <div className={`border rounded-2xl p-6 text-center ${debtState === 0 ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'}`}>
                            <div className="text-4xl font-black">{formatCurrency(debtState)}</div>
                        </div>
                    </div>
                    {debtState > 0 ? (
                        <button onClick={handleSettleLoan} disabled={isProcessing} className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]">
                            {isProcessing ? "Processing Settlement..." : `Settle Loan + 0.5% Fee`}
                        </button>
                    ) : (
                        <button onClick={() => handleRequestAdvance(15)} disabled={isProcessing} className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:scale-[1.02] active:scale-[0.98]">
                            {isProcessing ? "Signing Transaction..." : `Borrow Fuel Advance (${formatCurrency(15)})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default HubTab;  