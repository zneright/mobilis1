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
        scValToNative,
        Operation,
        Asset
    } from '@stellar/stellar-sdk';
    import { Coins, RefreshCw, Eye, EyeOff, Copy, AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, ExternalLink, X, QrCode } from 'lucide-react';
    import Header from './Header';
    import BottomNav from './BottomNav';
    import Sidebar from './Sidebar';
    import type { UserData } from '../types';

    const CONTRACT_ID = "CBISDWPNY3WIUJALZQOGTEOJWSGOI4TIUYWOLMPRMZ5FHVW57FHOV545";
    const RPC_SERVER = "https://soroban-testnet.stellar.org";
    const HORIZON_SERVER = "https://horizon-testnet.stellar.org";
    const PHP_EXCHANGE_RATE = 60.69;

    const Dashboard: React.FC = () => {
        const { stellarData } = useAuth();

        // App State
        const [activeTab, setActiveTab] = useState<'hub' | 'vault' | 'history' | 'profile'>('hub');
        const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
        const [currencyMode, setCurrencyMode] = useState<'XLM' | 'PHP'>('XLM');

        // Wallet States
        const [showSecret, setShowSecret] = useState(false);
        const [isProcessing, setIsProcessing] = useState(false);
        const [debtState, setDebtState] = useState<number>(0);
        const [xlmBalance, setXlmBalance] = useState<string>('0.00');
        const [customAmount, setCustomAmount] = useState<string>('15');
        const [txHistory, setTxHistory] = useState<any[]>([]);

        // Modal States
        const [showSendModal, setShowSendModal] = useState(false);
        const [showReceiveModal, setShowReceiveModal] = useState(false);
        const [sendDest, setSendDest] = useState('');
        const [sendAmt, setSendAmt] = useState('');

        // Admin & Profile States
        const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
        const [isFetching, setIsFetching] = useState(false);
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

        // --- FETCH LEDGER DATA (Balances & History) ---
        useEffect(() => {
            const fetchLedgerData = async () => {
                if (!stellarData || !stellarData.secret) return;

                try {
                    // Fetch Balance
                    const res = await fetch(`${HORIZON_SERVER}/accounts/${stellarData.publicKey}`);
                    const data = await res.json();
                    if (data.balances) {
                        const native = data.balances.find((b: any) => b.asset_type === 'native');
                        if (native) setXlmBalance(parseFloat(native.balance).toFixed(2));
                    }

                    // Fetch Real Transaction History
                    const txRes = await fetch(`${HORIZON_SERVER}/accounts/${stellarData.publicKey}/transactions?limit=15&order=desc`);
                    const txData = await txRes.json();
                    if (txData._embedded && txData._embedded.records) {
                        setTxHistory(txData._embedded.records);
                    }

                } catch (err) {
                    console.error("Failed to fetch Horizon data", err);
                }

                // Fetch Mobilis Contract Debt
                if (stellarData.role === 'driver') {
                    try {
                        const server = new rpc.Server(RPC_SERVER);
                        const sourceKeypair = Keypair.fromSecret(stellarData.secret);
                        const account = await server.getAccount(sourceKeypair.publicKey());
                        const contract = new Contract(CONTRACT_ID);

                        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
                            .addOperation(contract.call("get_debt", nativeToScVal(sourceKeypair.publicKey(), { type: 'address' })))
                            .setTimeout(30).build();

                        const simulation = await server.simulateTransaction(tx);
                        if (rpc.Api.isSimulationSuccess(simulation)) {
                            const rawDebt = scValToNative(simulation.result.retval);
                            setDebtState(Number(rawDebt) / 10000000);
                        }
                    } catch (error) {
                        console.error("Failed to sync on-chain debt");
                    }
                }
            };

            fetchLedgerData();
        }, [stellarData, isProcessing]);

        // --- STANDARD XLM SEND ---
        const handleSendXLM = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!stellarData || !stellarData.secret) return;
            setIsProcessing(true);

            try {
                const server = new rpc.Server(RPC_SERVER);
                const sourceKeypair = Keypair.fromSecret(stellarData.secret);
                const account = await server.getAccount(sourceKeypair.publicKey());

                let tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
                    .addOperation(Operation.payment({
                        destination: sendDest,
                        asset: Asset.native(),
                        amount: sendAmt,
                    }))
                    .setTimeout(30).build();

                const preparedTx = await server.prepareTransaction(tx);
                preparedTx.sign(sourceKeypair);
                const response = await server.sendTransaction(preparedTx);

                if (response.status === "ERROR") throw new Error("Transaction submission failed");

                // Poll for success
                let txResult = await server.getTransaction(response.hash);
                while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    txResult = await server.getTransaction(response.hash);
                }

                if (txResult.status === "SUCCESS") {
                    alert(`Success! Sent ${sendAmt} XLM.`);
                    setShowSendModal(false);
                    setSendDest('');
                    setSendAmt('');
                } else {
                    throw new Error("Execution failed on ledger.");
                }
            } catch (err) {
                alert("Failed to send funds. Check destination address and balance.");
            } finally {
                setIsProcessing(false);
            }
        };

        // --- ADMIN SYNC & APPROVAL ---
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
                } catch (error) { console.error(error); } finally { setIsFetching(false); }
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

        const handleUpdateProfile = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!stellarData) return;
            try {
                await updateDoc(doc(db, 'users', stellarData.uid), { phone: editPhone, plateNumber: editPlate });
                alert("Profile metadata updated successfully!");
            } catch (error) { alert("Failed to modify database fields."); }
        };

        // --- CONTRACT: BORROW & SETTLE ---
        const executeContractCall = async (functionName: string, args: any[]) => {
            if (!stellarData || !stellarData.secret) return;
            setIsProcessing(true);
            try {
                const server = new rpc.Server(RPC_SERVER);
                const sourceKeypair = Keypair.fromSecret(stellarData.secret);
                const account = await server.getAccount(sourceKeypair.publicKey());
                const contract = new Contract(CONTRACT_ID);

                let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: Networks.TESTNET })
                    .addOperation(contract.call(functionName, ...args))
                    .setTimeout(30).build();

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
                    return true;
                } else {
                    throw new Error("On-chain execution reverted.");
                }
            } catch (error: any) {
                throw error;
            } finally {
                setIsProcessing(false);
            }
        };

        const handleRequestAdvance = async () => {
            if (!stellarData || !stellarData.publicKey) return;
            const borrowVal = stellarData.role === 'driver' ? 15 : parseFloat(customAmount);
            try {
                await executeContractCall("request_advance", [
                    nativeToScVal(stellarData.publicKey, { type: 'address' }),
                    nativeToScVal(borrowVal * 10000000, { type: 'i128' })
                ]);
                setDebtState(borrowVal);
                alert(`Success! ${borrowVal} XLM confirmed on the ledger.`);
            } catch (e) {
                alert("Transaction Reverted: Please ensure you do not have an active advance, your wallet is funded, and the TODA Treasury has sufficient funds.");
            }
        };

        const handleSettleLoan = async () => {
            if (!stellarData || !stellarData.publicKey) return;
            try {
                await executeContractCall("settle_loan", [nativeToScVal(stellarData.publicKey, { type: 'address' })]);
                setDebtState(0);
                alert(`Success! Your loan has been fully settled and fees distributed.`);
            } catch (e) {
                alert("Transaction Reverted: Ensure your wallet has enough XLM balance to cover the Principal + 0.5% Fee.");
            }
        };

        const formatCurrency = (amount: number | string) => {
            const num = typeof amount === 'string' ? parseFloat(amount) : amount;
            if (currencyMode === 'PHP') {
                return `₱ ${(num * PHP_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
        };

        if (!stellarData) return <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex items-center justify-center text-white">Loading Node Profile...</div>;

        const isAdmin = stellarData.role === 'superadmin' || stellarData.role === 'admin';

        return (
            <div className="flex h-screen bg-gray-50 dark:bg-[#060610] text-gray-900 dark:text-white font-sans overflow-hidden">

                {/* Desktop Sidebar Layout */}
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col h-full overflow-y-auto relative">

                    <Header theme={theme} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} onSignOut={() => signOut(auth)} />

                    <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center pb-32 md:pb-8">

                        {/* HUB TAB */}
                        {activeTab === 'hub' && (
                            <div className="w-full flex flex-col items-center">
                                <div className="w-full max-w-lg mb-4 flex justify-end">
                                    <button
                                        onClick={() => setCurrencyMode(p => p === 'PHP' ? 'XLM' : 'PHP')}
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
                                                    placeholder="Enter Custom XLM Advance value..."
                                                    className="w-full sm:flex-1 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500"
                                                />
                                                <button onClick={handleRequestAdvance} disabled={isProcessing} className="w-full sm:w-auto px-6 py-4 bg-emerald-500 text-black font-black text-sm rounded-xl hover:bg-emerald-400">
                                                    {isProcessing ? "Executing..." : "Inject Asset Pool Loan"}
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-3 font-mono">Value preview: {formatCurrency(customAmount || "0")}</p>
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

                        {/* VAULT TAB */}
                        {activeTab === 'vault' && (
                            <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <h3 className="text-2xl font-black">Digital Wallet</h3>
                                        <p className="text-gray-500 text-sm">Stellar Network Assets</p>
                                    </div>
                                    <button
                                        onClick={() => setCurrencyMode(p => p === 'PHP' ? 'XLM' : 'PHP')}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 shadow-sm"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> {currencyMode}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-[2rem] p-8 shadow-xl text-black flex flex-col justify-between min-h-[200px]">
                                        <div>
                                            <p className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Available Balance</p>
                                            <h2 className="text-5xl md:text-6xl font-black">{formatCurrency(xlmBalance)}</h2>
                                        </div>
                                        <div className="flex items-center gap-2 mt-6 bg-black/10 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                            <span className="text-xs font-bold tracking-wider">Testnet Active</span>
                                        </div>
                                    </div>

                                    <div className="col-span-1 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col gap-3 justify-center min-h-[200px]">
                                        <button onClick={() => setShowReceiveModal(true)} className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                                            <span className="flex items-center gap-3"><ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Receive</span>
                                        </button>
                                        <button onClick={() => setShowSendModal(true)} className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                                            <span className="flex items-center gap-3"><ArrowUpRight className="w-4 h-4 text-blue-500" /> Send</span>
                                        </button>
                                        <button
                                            onClick={() => alert("Fiat Cashout architecture is currently disabled in testnet mode.")}
                                            className="w-full py-3.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl font-bold text-sm flex items-center justify-between text-emerald-600 dark:text-emerald-400 transition-colors"
                                        >
                                            <span className="flex items-center gap-3"><Banknote className="w-4 h-4" /> Cashout</span>
                                        </button>
                                    </div>

                                    <div className="col-span-1 md:col-span-3 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6 flex gap-3 text-xs text-red-600 dark:text-red-400">
                                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                            <p>Do not expose your secret seed key. These values control your assets on the Stellar Network.</p>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-2">Public Address</label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-xs break-all border border-gray-200 dark:border-white/5">{stellarData.publicKey}</code>
                                                    <button onClick={() => navigator.clipboard.writeText(stellarData.publicKey)} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></button>
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
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* HISTORY TAB */}
                        {activeTab === 'history' && (
                            <div className="w-full max-w-4xl mx-auto bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                                <h3 className="text-2xl font-black mb-2">Network Ledger</h3>
                                <p className="text-gray-500 text-sm mb-6">Live unalterable transactions pulled directly from Stellar Horizon.</p>

                                <div className="space-y-4">
                                    {txHistory.length > 0 ? (
                                        txHistory.map((tx: any, idx: number) => (
                                            <div key={idx} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${tx.successful ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        <p className="font-bold text-sm tracking-wide uppercase">Transaction Executed</p>
                                                    </div>
                                                    <p className="text-gray-400 text-xs font-mono">{new Date(tx.created_at).toLocaleString()}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${tx.successful ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                                                        {tx.successful ? 'Success' : 'Failed'}
                                                    </span>
                                                    <a
                                                        href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl text-xs font-bold transition-colors"
                                                    >
                                                        View on Explorer <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-center py-8">No recorded transactions on this network.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
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

                {/* Mobile Bottom Nav */}
                <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />

                {/* SEND MODAL */}
                {showSendModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-md bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl relative">
                            <button onClick={() => setShowSendModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-black dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <h3 className="text-xl font-black mb-6">Send XLM</h3>
                            <form onSubmit={handleSendXLM} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Destination Public Key</label>
                                    <input required type="text" value={sendDest} onChange={(e) => setSendDest(e.target.value)} placeholder="G..." className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none font-mono focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Amount (XLM)</label>
                                    <input required type="number" step="0.0000001" value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} placeholder="0.00" className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-blue-500" />
                                </div>
                                <button type="submit" disabled={isProcessing} className="w-full py-4 mt-2 bg-blue-500 text-white font-black text-sm rounded-xl transition-all hover:bg-blue-600 disabled:opacity-50">
                                    {isProcessing ? "Signing Transaction..." : "Confirm & Send"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* RECEIVE MODAL */}
                {showReceiveModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl relative text-center">
                            <button onClick={() => setShowReceiveModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-black dark:hover:text-white"><X className="w-5 h-5" /></button>
                            <h3 className="text-xl font-black mb-2">Receive Assets</h3>
                            <p className="text-sm text-gray-500 mb-8">Scan to transfer funds to your wallet.</p>

                            <div className="bg-white p-4 rounded-2xl mx-auto w-fit mb-8 shadow-sm">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${stellarData.publicKey}`} alt="QR Code" className="w-48 h-48" />
                            </div>

                            <div className="text-left">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Your Address</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-[10px] break-all border border-gray-200 dark:border-white/5">{stellarData.publicKey}</code>
                                    <button onClick={() => navigator.clipboard.writeText(stellarData.publicKey)} className="p-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"><Copy className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    };

    export default Dashboard;