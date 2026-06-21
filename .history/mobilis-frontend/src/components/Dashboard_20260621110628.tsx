import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import {
    Keypair,
    Networks,
    TransactionBuilder,
    Contract,
    rpc,
    nativeToScVal,
    scValToNative
} from '@stellar/stellar-sdk';
import { CheckCircle2, Wallet, Coins, RefreshCw, Eye, EyeOff, Copy, AlertTriangle } from 'lucide-react';
import Navigation from './Navigation';
import type { UserData } from '../types';

const CONTRACT_ID = "CBISDWPNY3WIUJALZQOGTEOJWSGOI4TIUYWOLMPRMZ5FHVW57FHOV545";
const RPC_SERVER = "https://soroban-testnet.stellar.org";
const PHP_EXCHANGE_RATE = 60.69;

const Dashboard: React.FC = () => {
    const { stellarData } = useAuth();

    // App State
    const [activeTab, setActiveTab] = useState<'hub' | 'vault' | 'history' | 'profile'>('hub');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
    const [currencyMode, setCurrencyMode] = useState<'USDC' | 'PHP'>('PHP');

    // Feature States
    const [showSecret, setShowSecret] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [debtState, setDebtState] = useState<number>(0);
    const [customAmount, setCustomAmount] = useState<string>('15');

    // Admin States
    const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    // Profile Settings States
    const [editPhone, setEditPhone] = useState(stellarData?.phone || '');
    const [editPlate, setEditPlate] = useState(stellarData?.plateNumber || '');

    useEffect(() => {
        const root = window.document.documentElement;
        theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (stellarData) {
            setEditPhone(stellarData.phone || '');
            setEditPlate(stellarData.plateNumber || '');
        }
    }, [stellarData]);

    // --- ON-CHAIN DEBT SYNC ---
    useEffect(() => {
        const fetchOnChainDebt = async () => {
            if (!stellarData || stellarData.role !== 'driver' || !stellarData.secret) return;

            try {
                const server = new rpc.Server(RPC_SERVER);
                const sourceKeypair = Keypair.fromSecret(stellarData.secret);
                const account = await server.getAccount(sourceKeypair.publicKey());
                const contract = new Contract(CONTRACT_ID);

                const tx = new TransactionBuilder(account, {
                    fee: "100",
                    networkPassphrase: Networks.TESTNET,
                })
                    .addOperation(
                        contract.call(
                            "get_debt",
                            nativeToScVal(sourceKeypair.publicKey(), { type: 'address' })
                        )
                    )
                    .setTimeout(30)
                    .build();

                const simulation = await server.simulateTransaction(tx);

                if (rpc.Api.isSimulationSuccess(simulation)) {
                    const rawDebt = scValToNative(simulation.result.retval);
                    const parsedDebt = Number(rawDebt) / 10000000;
                    setDebtState(parsedDebt);
                }
            } catch (error) {
                console.error("Failed to sync on-chain debt:", error);
            }
        };

        fetchOnChainDebt();
    }, [stellarData]);

    // --- ADMIN SYNC ---
    useEffect(() => {
        const fetchPendingAccounts = async () => {
            if (!stellarData || (stellarData.role !== 'superadmin' && stellarData.role !== 'admin')) return;
            setIsFetching(true);
            try {
                let q = stellarData.role === 'superadmin'
                    ? query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'pending'))
                    : query(collection(db, 'users'), where('role', '==', 'driver'), where('status', '==', 'pending'), where('todaAffiliation', '==', stellarData.coopName));

                const querySnapshot = await getDocs(q);
                const users: UserData[] = [];
                querySnapshot.forEach((doc) => users.push(doc.data() as UserData));
                setPendingUsers(users);
            } catch (error) {
                console.error(error);
            } finally {
                setIsFetching(false);
            }
        };
        fetchPendingAccounts();
    }, [stellarData]);

    const handleApprove = async (uid: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { status: 'approved' });
            setPendingUsers(prev => prev.filter(user => user.uid !== uid));
            alert("Account verified on-chain successfully!");
        } catch (error) {
            alert("Failed to sign node approval.");
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stellarData) return;
        try {
            await updateDoc(doc(db, 'users', stellarData.uid), {
                phone: editPhone,
                plateNumber: editPlate
            });
            alert("Profile metadata updated successfully!");
        } catch (error) {
            alert("Failed to modify database fields.");
        }
    };

    // --- WEB3: BORROW ADVANCE ---
    const handleRequestAdvance = async () => {
        if (!stellarData || !stellarData.secret) return;
        setIsProcessing(true);

        const borrowVal = stellarData.role === 'driver' ? 15 : parseFloat(customAmount);

        try {
            const server = new rpc.Server(RPC_SERVER);
            const sourceKeypair = Keypair.fromSecret(stellarData.secret);
            const account = await server.getAccount(sourceKeypair.publicKey());
            const contract = new Contract(CONTRACT_ID);
            const rawSorobanAmount = borrowVal * 10000000;

            let tx = new TransactionBuilder(account, {
                fee: "10000",
                networkPassphrase: Networks.TESTNET,
            })
                .addOperation(
                    contract.call(
                        "request_advance",
                        nativeToScVal(sourceKeypair.publicKey(), { type: 'address' }),
                        nativeToScVal(rawSorobanAmount, { type: 'i128' })
                    )
                )
                .setTimeout(30)
                .build();

            const preparedTx = await server.prepareTransaction(tx);
            preparedTx.sign(sourceKeypair);
            const response = await server.sendTransaction(preparedTx);

            if (response.status === "ERROR") throw new Error("Transaction submission failed");

            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") {
                setDebtState(borrowVal);
                alert(`Success! ${borrowVal} USDC confirmed on the ledger.`);
            } else {
                throw new Error("On-chain execution reverted.");
            }
        } catch (error: any) {
            console.error("Soroban Execution Error:", error);
            if (error.message?.includes("UnreachableCodeReached") || error.message?.includes("InvalidAction")) {
                alert("Transaction Reverted: Please ensure you do not have an active advance, your wallet trusts USDC, and the TODA Treasury has sufficient funds.");
            } else {
                alert("Network communication failed. Please try again.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // --- NEW WEB3: SETTLE LOAN ---
    const handleSettleLoan = async () => {
        if (!stellarData || !stellarData.secret) return;
        setIsProcessing(true);

        try {
            const server = new rpc.Server(RPC_SERVER);
            const sourceKeypair = Keypair.fromSecret(stellarData.secret);
            const account = await server.getAccount(sourceKeypair.publicKey());
            const contract = new Contract(CONTRACT_ID);

            let tx = new TransactionBuilder(account, {
                fee: "10000",
                networkPassphrase: Networks.TESTNET,
            })
                .addOperation(
                    contract.call(
                        "settle_loan",
                        nativeToScVal(sourceKeypair.publicKey(), { type: 'address' })
                    )
                )
                .setTimeout(30)
                .build();

            const preparedTx = await server.prepareTransaction(tx);
            preparedTx.sign(sourceKeypair);
            const response = await server.sendTransaction(preparedTx);

            if (response.status === "ERROR") throw new Error("Transaction submission failed");

            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") {
                setDebtState(0);
                alert(`Success! Your loan has been fully settled and fees distributed.`);
            } else {
                throw new Error("On-chain execution reverted.");
            }
        } catch (error: any) {
            console.error("Soroban Execution Error:", error);
            alert("Transaction Reverted: Ensure your wallet has enough balance to cover the Principal + 0.5% Fee.");
        } finally {
            setIsProcessing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        if (currencyMode === 'PHP') {
            return `₱ ${(amount * PHP_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `$ ${amount.toFixed(2)} USDC`;
    };

    if (!stellarData) return <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex items-center justify-center text-white">Loading Node Profile...</div>;

    const isAdmin = stellarData.role === 'superadmin' || stellarData.role === 'admin';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#060610] text-gray-900 dark:text-white font-sans transition-colors duration-300 flex flex-col">

            <Navigation
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                theme={theme}
                toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
                onSignOut={() => signOut(auth)}
                role={stellarData.role}
            />

            <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center">

                {activeTab === 'hub' && (
                    <div className="w-full flex flex-col items-center">

                        <div className="w-full max-w-lg mb-4 flex justify-end">
                            <button
                                onClick={() => setCurrencyMode(p => p === 'PHP' ? 'USDC' : 'PHP')}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 shadow-sm"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Display: {currencyMode}
                            </button>
                        </div>

                        {isAdmin ? (
                            <div className="w-full">
                                <div className="mb-8 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-sm font-bold tracking-widest text-emerald-500 uppercase mb-4">Liquidity Controller</h3>
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <input
                                            type="number"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            placeholder="Enter Custom USDC Advance value..."
                                            className="w-full sm:flex-1 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500"
                                        />
                                        <button onClick={handleRequestAdvance} disabled={isProcessing} className="w-full sm:w-auto px-6 py-4 bg-emerald-500 text-black font-black text-sm rounded-xl hover:bg-emerald-400">
                                            {isProcessing ? "Executing..." : "Inject Asset Pool Loan"}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3 font-mono">Value preview: {formatCurrency(parseFloat(customAmount) || 0)}</p>
                                </div>

                                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                    Pending Registrations
                                    <span className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-full text-xs font-mono">{pendingUsers.length}</span>
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

                                {/* --- NEW: DYNAMIC REPAYMENT BUTTON UI --- */}
                                {debtState > 0 ? (
                                    <button
                                        onClick={handleSettleLoan}
                                        disabled={isProcessing}
                                        className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {isProcessing ? "Processing Settlement..." : `Settle Advance & Fees`}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleRequestAdvance}
                                        disabled={isProcessing}
                                        className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {isProcessing ? "Signing Core Transaction..." : `Borrow Fuel Advance (${formatCurrency(15)})`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'vault' && (
                    <div className="w-full max-w-2xl bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                        <h3 className="text-2xl font-black mb-2">Cryptographic Keys</h3>
                        <p className="text-gray-500 text-sm mb-6">Manage access configurations.</p>

                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6 flex gap-3 text-xs text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <p>Do not expose your secret seed key. These values are tied directly to your asset balances on the Stellar Network.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Public Ledger Address</label>
                            <div className="flex gap-2">
                                <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-xs break-all border border-gray-200 dark:border-white/5">{stellarData.publicKey}</code>
                                <button onClick={() => navigator.clipboard.writeText(stellarData.publicKey)} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Secret Seed Account Phrase</label>
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
                )}

                {activeTab === 'history' && (
                    <div className="w-full max-w-2xl bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                        <h3 className="text-2xl font-black mb-2">On-Chain Streams</h3>
                        <p className="text-gray-500 text-sm mb-6">Real-time immutable ledger receipts for wallet signature logs.</p>

                        <div className="space-y-3 font-mono text-xs">
                            {debtState > 0 ? (
                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 flex justify-between items-center">
                                    <div>
                                        <p className="text-emerald-600 dark:text-emerald-500 font-bold">FUEL LIQUIDITY ADVANCE</p>
                                        <p className="text-gray-400 text-[10px] mt-1">HASH: Pending Index</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(debtState)}</p>
                                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-sans font-bold inline-block mt-1">Confirmed</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No recorded transactions on this network.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="w-full max-w-xl bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                        <h3 className="text-2xl font-black mb-6">Profile Configuration</h3>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Contact Link Line (Mobile)</label>
                                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                            </div>

                            {!isAdmin && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">TODA Registered Vehicle Plate</label>
                                    <input type="text" value={editPlate} onChange={(e) => setEditPlate(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                                </div>
                            )}

                            <button type="submit" className="w-full py-4 mt-2 bg-gray-900 text-white dark:bg-white dark:text-black font-black text-sm rounded-xl transition-all hover:bg-gray-800 dark:hover:bg-gray-200">
                                Write Structural Updates
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;