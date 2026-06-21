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
    handleSettleLoan: () => Promise<void>;
    appNetwork: 'TESTNET' | 'PUBLIC';
    handleNetworkChange: (network: 'TESTNET' | 'PUBLIC') => void;
}

const HubTab: React.FC<HubTabProps> = ({ stellarData, isAdmin, currencyMode, setCurrencyMode, formatCurrency, debtState, isProcessing, handleRequestAdvance, handleSettleLoan, appNetwork, handleNetworkChange }) => {
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
            } catch (error) { console.error(error); }
        };
        fetchPendingAccounts();
    }, [stellarData]);

    const handleApprove = async (uid: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { status: 'approved' });
            setPendingUsers(prev => prev.filter(user => user.uid !== uid));
            alert("Account verified on-chain successfully!");
        } catch (error) { alert("Failed to sign node approval."); }
    };

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-lg mb-4 flex justify-between items-center">
                {/* Admin Network Toggle */}
                {isAdmin ? (
                    <select
                        value={appNetwork}
                        onChange={(e) => handleNetworkChange(e.target.value as 'TESTNET' | 'PUBLIC')}
                        className="bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold font-mono p-2.5 outline-none shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                        <option value="TESTNET">Testnet (Dev)</option>
                        <option value="PUBLIC">Mainnet (Live)</option>
                    </select>
                ) : <div />}

                <button onClick={() => setCurrencyMode(p => p === 'PHP' ? 'XLM' : 'PHP')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5" /> Display: {currencyMode}
                </button>
            </div>

            {isAdmin ? (
                <div className="w-full">
                    <div className="mb-8 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold tracking-widest text-emerald-500 uppercase mb-4">Liquidity Controller</h3>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Enter Custom XLM Advance value..." className="w-full sm:flex-1 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                            <button onClick={() => handleRequestAdvance(parseFloat(customAmount))} disabled={isProcessing} className="w-full sm:w-auto px-6 py-4 bg-emerald-500 text-black font-black text-sm rounded-xl hover:bg-emerald-400">
                                {isProcessing ? "Executing..." : "Inject Asset Pool Loan"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-3 font-mono">Value preview: {formatCurrency(customAmount || "0")}</p>
                    </div>
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
                        <div className={`border rounded-2xl p-6 text-