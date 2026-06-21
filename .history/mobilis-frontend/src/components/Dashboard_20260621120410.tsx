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
import {
    requestAccess,
    signTransaction,
    isConnected,
    isAllowed
} from '@stellar/freighter-api';
import { Coins, RefreshCw, Eye, EyeOff, Copy, AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, ExternalLink, X, Link as LinkIcon, Unlink, Wallet } from 'lucide-react';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import type { UserData } from '../types';

const CONTRACT_ID = "CBISDWPNY3WIUJALZQOGTEOJWSGOI4TIUYWOLMPRMZ5FHVW57FHOV545";
const RPC_SERVER = "https://soroban-testnet.stellar.org";
const HORIZON_SERVER = "https://horizon-testnet.stellar.org";
const PHP_EXCHANGE_RATE = 60.69;
const USDC_EXCHANGE_RATE = 58.00; // Mock rate for USDC

const Dashboard: React.FC = () => {
    const { stellarData } = useAuth();

    // App & UI State
    const [activeTab, setActiveTab] = useState<'hub' | 'vault' | 'history' | 'profile'>('hub');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
    const [currencyMode, setCurrencyMode] = useState<'XLM' | 'PHP'>('XLM');

    // --- EXTERNAL WALLET STATE ---
    const [externalWallet, setExternalWallet] = useState<string | null>(null);
    const activePubKey = externalWallet || stellarData?.publicKey;

    // Wallet & Contract States
    const [showSecret, setShowSecret] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [debtState, setDebtState] = useState<number>(0);
    const [xlmBalance, setXlmBalance] = useState<string>('0.00');
    const [assetBalances, setAssetBalances] = useState<any[]>([]); // New state for multiple assets
    const [customAmount, setCustomAmount] = useState<string>('15');
    const [txHistory, setTxHistory] = useState<any[]>([]);

    // Modal States
    const [showSendModal, setShowSendModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [sendDest, setSendDest] = useState('');
    const [sendAmt, setSendAmt] = useState('');

    // Admin & Profile States
    const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [editPhone, setEditPhone] = useState(stellarData?.phone || '');
    const [editPlate, setEditPlate] = useState(stellarData?.plateNumber || '');
    const [editContact, setEditContact] = useState(stellarData?.contactPerson || '');
    const [editRegNum, setEditRegNum] = useState(stellarData?.registrationNumber || '');

    useEffect(() => {
        const root = window.document.documentElement;
        theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (stellarData) {
            setEditPhone(stellarData.phone || '');
            setEditPlate(stellarData.plateNumber || '');
            setEditContact(stellarData.contactPerson || '');
            setEditRegNum(stellarData.registrationNumber || '');
        }
    }, [stellarData]);

    // --- AUTO CONNECT WALLET ---
    useEffect(() => {
        const checkAutoConnect = async () => {
            // ONLY auto-connect if the user explicitly connected in the past
            if (localStorage.getItem('externalWalletConnected') === 'true') {
                if (await isConnected()) {
                    if (await isAllowed()) {
                        try {
                            const pubKey = await requestAccess();
                            if (typeof pubKey === 'string') {
                                setExternalWallet(pubKey);
                            } else if (pubKey && (pubKey as any).address) {
                                setExternalWallet((pubKey as any).address);
                            }
                        } catch (e) {
                            console.log("Auto-connect failed or locked.");
                        }
                    }
                }
            }
        };
        checkAutoConnect();
    }, []);

    // --- FETCH LEDGER DATA ---
    useEffect(() => {
        const fetchLedgerData = async () => {
            if (!activePubKey) return;

            try {
                // Fetch Balances for ALL assets
                const res = await fetch(`${HORIZON_SERVER}/accounts/${activePubKey}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.balances) {
                        setAssetBalances(data.balances);
                        const native = data.balances.find((b: any) => b.asset_type === 'native');
                        if (native) setXlmBalance(parseFloat(native.balance).toFixed(2));
                    }
                } else {
                    setXlmBalance('0.00');
                    setAssetBalances([]);
                }

                // Fetch History (Gracefully handle 404s)
                const txRes = await fetch(`${HORIZON_SERVER}/accounts/${activePubKey}/transactions?limit=15&order=desc`);
                if (txRes.ok) {
                    const txData = await txRes.json();
                    if (txData._embedded && txData._embedded.records) {
                        setTxHistory(txData._embedded.records);
                    }
                } else {
                    setTxHistory([]);
                }
            } catch (err) {
                console.error("Ledger fetch skipped or failed.");
            }

            // Fetch Contract Debt
            if (stellarData?.role === 'driver') {
                try {
                    const server = new rpc.Server(RPC_SERVER);
                    const contract = new Contract(CONTRACT_ID);
                    const dummySource = Keypair.random();
                    const account = await server.getAccount(dummySource.publicKey()).catch(() => new rpc.Account(dummySource.publicKey(), "0"));

                    const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
                        .addOperation(contract.call("get_debt", nativeToScVal(activePubKey, { type: 'address' })))
                        .setTimeout(30).build();

                    const simulation = await server.simulateTransaction(tx);
                    if (rpc.Api.isSimulationSuccess(simulation)) {
                        const rawDebt = scValToNative(simulation.result.retval);
                        setDebtState(Number(rawDebt) / 10000000);
                    } else {
                        setDebtState(0);
                    }
                } catch (error) {
                    setDebtState(0);
                }
            }
        };

        fetchLedgerData();
    }, [activePubKey, isProcessing, stellarData?.role]);

    // --- WALLET CONNECT HANDLERS ---
    const executeWalletConnection = async (walletName: string) => {
        setShowWalletModal(false);
        if (await isConnected()) {
            try {
                const pubKey = await requestAccess();
                if (typeof pubKey === 'string') {
                    setExternalWallet(pubKey);
                    localStorage.setItem('externalWalletConnected', 'true');
                } else if (pubKey && (pubKey as any).address) {
                    setExternalWallet((pubKey as any).address);
                    localStorage.setItem('externalWalletConnected', 'true');
                }
            } catch (e) {
                alert(`Connection request to ${walletName} was rejected or the app is locked.`);
            }
        } else {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                alert(`To connect on mobile, please open this website directly inside the ${walletName} app's 'Discover' or Web3 browser.`);
            } else {
                alert(`${walletName} extension is not detected. Please ensure the extension is installed and enabled.`);
            }
        }
    };

    const handleDisconnectWallet = () => {
        setExternalWallet(null);
        localStorage.removeItem('externalWalletConnected'); // Completely sever data connection
    };

    const signAndSubmitTx = async (server: rpc.Server, preparedTx: any) => {
        if (externalWallet) {
            const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), { network: 'TESTNET' });
            if (error) throw new Error(`Transaction signing failed: ${error}`);

            const txToSubmit = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);
            return await server.sendTransaction(txToSubmit as any);
        } else {
            const sourceKeypair = Keypair.fromSecret(stellarData!.secret);
            preparedTx.sign(sourceKeypair);
            return await server.sendTransaction(preparedTx);
        }
    };

    // --- STANDARD XLM SEND ---
    const handleSendXLM = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activePubKey) return;
        setIsProcessing(true);

        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);

            let tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
                .addOperation(Operation.payment({
                    destination: sendDest,
                    asset: Asset.native(),
                    amount: sendAmt,
                }))
                .setTimeout(30).build();

            const preparedTx = await server.prepareTransaction(tx);
            const response = await signAndSubmitTx(server, preparedTx);

            if (response.status === "ERROR") throw new Error("Transaction submission failed");

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
            alert("Failed to send funds. Check destination address and ensure you have enough XLM.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- CONTRACT: BORROW & SETTLE ---
    const executeContractCall = async (functionName: string, args: any[]) => {
        if (!activePubKey) return;
        setIsProcessing(true);
        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);
            const contract = new Contract(CONTRACT_ID);

            let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: Networks.TESTNET })
                .addOperation(contract.call(functionName, ...args))
                .setTimeout(30).build();

            const preparedTx = await server.prepareTransaction(tx);
            const response = await signAndSubmitTx(server, preparedTx);

            if (response.status === "ERROR") throw new Error("Transaction submission failed");

            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") return true;
            throw new Error("On-chain execution reverted.");
        } catch (error: any) {
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRequestAdvance = async () => {
        if (!activePubKey) return;
        const borrowVal = stellarData?.role === 'driver' ? 15 : parseFloat(customAmount);
        try {
            await executeContractCall("request_advance", [
                nativeToScVal(activePubKey, { type: 'address' }),
                nativeToScVal(borrowVal * 10000000, { type: 'i128' })
            ]);
            setDebtState(borrowVal);
            alert(`Success! ${borrowVal} XLM confirmed on the ledger.`);
        } catch (e) {
            alert("Transaction Reverted: Please ensure you do not have an active advance, your wallet is funded, and the TODA Treasury has sufficient funds.");
        }
    };

    const handleSettleLoan = async () => {
        if (!activePubKey) return;
        try {
            await executeContractCall("settle_loan", [nativeToScVal(activePubKey, { type: 'address' })]);
            setDebtState(0);
            alert(`Success! Your loan has been fully settled and fees distributed.`);
        } catch (e) {
            alert("Transaction Reverted: Ensure your wallet has enough XLM balance to cover the Principal + 0.5% Fee.");
        }
    };

    // --- ADMIN SYNC & PROFILE ---
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
            await updateDoc(doc(db, 'users', stellarData.uid), {
                phone: editPhone,
                ...(stellarData.role === 'driver' && { plateNumber: editPlate }),
                ...(stellarData.role === 'admin' && { contactPerson: editContact, registrationNumber: editRegNum })
            });
            alert("Profile metadata updated successfully!");
        } catch (error) { alert("Failed to modify database fields."); }
    };

    const formatCurrency = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (currencyMode === 'PHP') return `₱ ${(num * PHP_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
    };

    if (!stellarData) return <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex items-center justify-center text-white">Loading Node Profile...</div>;
    const isSuperAdmin = stellarData.role === 'superadmin';
    const isAdmin = isSuperAdmin || stellarData.role === 'admin';

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#060610] text-gray-900 dark:text-white font-sans overflow-hidden">

            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />

            <div className="flex-1 flex flex-col h-full overflow-y-auto relative">

                <Header theme={theme} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} onSignOut={() => signOut(auth)} />

                <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center pb-32 md:pb-8">

                    {/* HUB TAB */}
                    {activeTab === 'hub' && (
                        <div className="w-full flex flex-col items-center">
                            <div className="w-full max-w-lg mb-4 flex justify-end">
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
                                            <button onClick={handleRequestAdvance} disabled={isProcessing} className="w-full sm:w-auto px-6 py-4 bg-emerald-500 text-black font-black text-sm rounded-xl hover:bg-emerald-400">
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
                                        <div className={`border rounded-2xl p-6 text-center ${debtState === 0 ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'}`}>
                                            <div className="text-4xl font-black">{formatCurrency(debtState)}</div>
                                        </div>
                                    </div>
                                    {debtState > 0 ? (
                                        <button onClick={handleSettleLoan} disabled={isProcessing} className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98]">
                                            {isProcessing ? "Processing Settlement..." : `Settle Advance & Fees`}
                                        </button>
                                    ) : (
                                        <button onClick={handleRequestAdvance} disabled={isProcessing} className="w-full py-5 rounded-2xl font-black text-lg tracking-wide shadow-xl transition-all bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:scale-[1.02] active:scale-[0.98]">
                                            {isProcessing ? "Signing Transaction..." : `Borrow Fuel Advance (${formatCurrency(15)})`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VAULT TAB (BENTO LAYOUT) */}
                    {activeTab === 'vault' && (
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
                                {/* Card 1: Balance */}
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

                                {/* Card 2: Actions */}
                                <div className="col-span-1 bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col gap-3 justify-center min-h-[200px]">
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

                                {/* Asset Map List (XLM, USDC, etc) */}
                                {assetBalances.map((asset, idx) => {
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

                                {/* Card 3: Cryptographic Keys */}
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
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="w-full max-w-4xl mx-auto bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
                            <h3 className="text-2xl font-black mb-2">Network Ledger</h3>
                            <p className="text-gray-500 text-sm mb-6">Live unalterable transactions pulled directly from Stellar Horizon.</p>

                            <div className="space-y-4">
                                {txHistory.length > 0 ? (
                                    txHistory.map((tx: any, idx: number) => (
                                        <div key={idx} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-2 h-2 rounded-full ${tx.successful ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    <p className="font-bold text-sm tracking-wide uppercase">{tx.successful ? 'Transaction Confirmed' : 'Execution Reverted'}</p>
                                                </div>
                                                <p className="text-gray-400 text-xs font-mono mb-3">{new Date(tx.created_at).toLocaleString()}</p>

                                                <div className="space-y-1 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Sender Account</span>
                                                        <span className="text-xs font-mono truncate max-w-xs">{tx.source_account}</span>
                                                    </div>
                                                    {tx.memo && (
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-gray-200 dark:border-white/10 mt-2">
                                                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Public Memo</span>
                                                            <span className="text-xs font-mono truncate">{tx.memo}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 md:mt-0 mt-2 self-start md:self-center">
                                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${tx.successful ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                                                    {tx.successful ? 'Success' : 'Failed'}
                                                </span>
                                                <a href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">User / Full Name</p>
                                    <p className="font-bold text-sm">{(stellarData as any).fullName || (stellarData as any).displayName || 'Data Unavailable'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Cooperative / Affiliation</p>
                                    <p className="font-bold text-sm">{(stellarData as any).coopName || (stellarData as any).todaAffiliation || 'Data Unavailable'}</p>
                                </div>
                            </div>

                            {isSuperAdmin ? (
                                <p className="text-gray-500 text-sm">Super Admin infrastructure nodes do not require mutable profile fields.</p>
                            ) : (
                                <form onSubmit={handleUpdateProfile} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Phone Number</label>
                                        <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                                    </div>

                                    {stellarData.role === 'admin' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Contact Person</label>
                                                <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Gov Registration (CDA/SEC)</label>
                                                <input type="text" value={editRegNum} onChange={(e) => setEditRegNum(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                                            </div>
                                        </>
                                    )}

                                    {stellarData.role === 'driver' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">TODA Registered Vehicle Plate</label>
                                            <input type="text" value={editPlate} onChange={(e) => setEditPlate(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500" />
                                        </div>
                                    )}
                                    <button type="submit" className="w-full py-4 mt-2 bg-gray-900 text-white dark:bg-white dark:text-black font-black text-sm rounded-xl transition-all hover:bg-gray-800 dark:hover:bg-gray-200">
                                        Write Structural Updates
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                </main>
            </div>

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
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${activePubKey}`} alt="QR Code" className="w-48 h-48" />
                        </div>

                        <div className="text-left">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Your Address</label>
                            <div className="flex gap-2">
                                <code className="flex-1 bg-gray-50 dark:bg-black/40 p-4 rounded-xl text-[10px] break-all border border-gray-200 dark:border-white/5">{activePubKey}</code>
                                <button onClick={() => navigator.clipboard.writeText(activePubKey!)} className="p-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"><Copy className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WALLET SELECTION MODAL */}
            {showWalletModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl relative text-center">
                        <button onClick={() => setShowWalletModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-black dark:hover:text-white"><X className="w-5 h-5" /></button>
                        <Wallet className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                        <h3 className="text-xl font-black mb-2">Connect Wallet</h3>
                        <p className="text-sm text-gray-500 mb-6">Select your preferred Stellar Network provider to continue.</p>

                        <div className="flex flex-col gap-3">
                            <button onClick={() => executeWalletConnection('LOBSTR')} className="w-full py-4 px-6 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                                LOBSTR Extension <ArrowUpRight className="w-4 h-4 opacity-50" />
                            </button>
                            <button onClick={() => executeWalletConnection('Freighter')} className="w-full py-4 px-6 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm flex items-center justify-between transition-colors">
                                Freighter <ArrowUpRight className="w-4 h-4 opacity-50" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;