import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
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
import { requestAccess, signTransaction, isConnected, isAllowed } from '@stellar/freighter-api';
import { Copy, ArrowUpRight, X, Wallet, Globe } from 'lucide-react';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

// Tab Imports
import HubTab from './tabs/HubTab';
import VaultTab from './tabs/VaultTab';
import HistoryTab from './tabs/HistoryTab';
import ProfileTab from './tabs/ProfileTab';

const CONTRACT_ID = "CBISDWPNY3WIUJALZQOGTEOJWSGOI4TIUYWOLMPRMZ5FHVW57FHOV545";
const PHP_EXCHANGE_RATE = 60.69;

declare global {
    interface Window { lobstr: any; }
}

const Dashboard: React.FC = () => {
    const { stellarData } = useAuth();

    // App & UI State
    const [activeTab, setActiveTab] = useState<'hub' | 'vault' | 'history' | 'profile'>('hub');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
    const [currencyMode, setCurrencyMode] = useState<'XLM' | 'PHP'>('XLM');

    // --- UNIVERSAL NETWORK STATE ---
    const [appNetwork, setAppNetwork] = useState<'TESTNET' | 'PUBLIC'>('TESTNET');
    const isTestnet = appNetwork === 'TESTNET';
    const HORIZON_SERVER = isTestnet ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";
    const RPC_SERVER = isTestnet ? "https://soroban-testnet.stellar.org" : "https://soroban-rpc.mainnet.stellar.org";
    const NETWORK_PASSPHRASE = isTestnet ? Networks.TESTNET : Networks.PUBLIC;

    // External Wallet State
    const [externalWallet, setExternalWallet] = useState<string | null>(null);
    const activePubKey = externalWallet || stellarData?.publicKey;

    // Data States
    const [isProcessing, setIsProcessing] = useState(false);
    const [debtState, setDebtState] = useState<number>(0);
    const [xlmBalance, setXlmBalance] = useState<string>('0.00');
    const [assetBalances, setAssetBalances] = useState<any[]>([]);
    const [firebaseHistory, setFirebaseTxHistory] = useState<any[]>([]);

    // Modal States
    const [showSendModal, setShowSendModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [sendDest, setSendDest] = useState('');
    const [sendAmt, setSendAmt] = useState('');

    useEffect(() => {
        const root = window.document.documentElement;
        theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    // --- REAL-TIME GLOBAL NETWORK SYNC ---
    useEffect(() => {
        try {
            const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
                if (docSnap.exists()) {
                    setAppNetwork(docSnap.data().activeNetwork || 'TESTNET');
                } else {
                    setDoc(doc(db, 'settings', 'global'), { activeNetwork: 'TESTNET' }).catch(console.error);
                }
            });
            return () => unsub();
        } catch (e) {
            console.error("Network sync error", e);
        }
    }, []);

    const handleNetworkChange = async (newNetwork: 'TESTNET' | 'PUBLIC') => {
        await setDoc(doc(db, 'settings', 'global'), { activeNetwork: newNetwork }, { merge: true });
    };

    // --- AUTO CONNECT WALLET ---
    useEffect(() => {
        const checkAutoConnect = async () => {
            const connectedWallet = localStorage.getItem('externalWalletConnected');
            try {
                if (connectedWallet === 'Freighter' && await isConnected() && await isAllowed()) {
                    const pubKey = await requestAccess();
                    setExternalWallet(typeof pubKey === 'string' ? pubKey : (pubKey as any).address);
                } else if (connectedWallet === 'LOBSTR' && window.lobstr) {
                    const pubKey = await window.lobstr.requestAccess();
                    setExternalWallet(pubKey);
                }
            } catch (e) { console.log("Auto-connect blocked or failed."); }
        };
        checkAutoConnect();
    }, []);

    // --- FETCH LEDGER & FIREBASE DATA ---
    useEffect(() => {
        const fetchLedgerData = async () => {
            if (!activePubKey) return;
            try {
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
            } catch (err) { console.error("Ledger fetch failed."); }

            if (stellarData?.role === 'driver') {
                try {
                    const server = new rpc.Server(RPC_SERVER);
                    const contract = new Contract(CONTRACT_ID);
                    const dummySource = Keypair.random();
                    const account = await server.getAccount(dummySource.publicKey()).catch(() => new rpc.Account(dummySource.publicKey(), "0"));
                    const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
                        .addOperation(contract.call("get_debt", nativeToScVal(activePubKey, { type: 'address' })))
                        .setTimeout(30).build();

                    const simulation = await server.simulateTransaction(tx);
                    if (rpc.Api.isSimulationSuccess(simulation)) {
                        const rawDebt = scValToNative(simulation.result.retval);
                        setDebtState(Number(rawDebt) / 10000000);
                    } else setDebtState(0);
                } catch (error) { setDebtState(0); }
            }
        };

        const fetchFirebaseHistory = async () => {
            if (!stellarData) return;
            try {
                let q;
                if (stellarData.role === 'superadmin') {
                    q = query(collection(db, 'transactions'));
                } else if (stellarData.role === 'admin') {
                    q = query(collection(db, 'transactions'), where('coopName', '==', stellarData.coopName));
                } else {
                    q = query(collection(db, 'transactions'), where('senderUid', '==', stellarData.uid));
                }
                const snapshot = await getDocs(q);
                const history: any[] = [];
                snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
                history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setFirebaseTxHistory(history);
            } catch (err) { console.error("Firebase history fetch failed.", err); }
        };

        fetchLedgerData();
        fetchFirebaseHistory();
    }, [activePubKey, isProcessing, stellarData?.role, appNetwork]);

    // --- WALLET CONNECT HANDLERS ---
    const executeWalletConnection = async (walletName: 'Freighter' | 'LOBSTR') => {
        setShowWalletModal(false);
        try {
            if (walletName === 'Freighter') {
                if (await isConnected()) {
                    const pubKey = await requestAccess();
                    setExternalWallet(typeof pubKey === 'string' ? pubKey : (pubKey as any).address);
                    localStorage.setItem('externalWalletConnected', 'Freighter');
                } else alert("Freighter extension is not installed or enabled.");
            } else if (walletName === 'LOBSTR') {
                if (window.lobstr) {
                    const pubKey = await window.lobstr.requestAccess();
                    setExternalWallet(pubKey);
                    localStorage.setItem('externalWalletConnected', 'LOBSTR');
                } else alert("LOBSTR extension is not installed.");
            }
        } catch (e) { alert(`Connection to ${walletName} rejected.`); }
    };

    const handleDisconnectWallet = () => {
        setExternalWallet(null);
        localStorage.removeItem('externalWalletConnected');
    };

    const signAndSubmitTx = async (server: rpc.Server, preparedTx: any) => {
        const walletType = localStorage.getItem('externalWalletConnected');

        if (externalWallet && walletType === 'Freighter') {
            const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), { network: appNetwork });
            if (error) throw new Error(`Transaction signing failed: ${error}`);
            const txToSubmit = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
            return await server.sendTransaction(txToSubmit as any);
        } else if (externalWallet && walletType === 'LOBSTR') {
            if (!window.lobstr) throw new Error("LOBSTR extension not found.");
            const signedXdr = await window.lobstr.signTransaction(preparedTx.toXDR(), appNetwork);
            const txToSubmit = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
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

        if (parseFloat(sendAmt) > parseFloat(xlmBalance)) {
            alert(`Transaction Blocked: You are trying to send ${sendAmt} XLM, but your available balance is only ${xlmBalance} XLM.`);
            return;
        }

        setIsProcessing(true);

        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);

            let tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: NETWORK_PASSPHRASE })
                .addOperation(Operation.payment({ destination: sendDest, asset: Asset.native(), amount: sendAmt }))
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
                await addDoc(collection(db, 'transactions'), {
                    txHash: response.hash,
                    senderUid: stellarData?.uid,
                    senderName: (stellarData as any)?.fullName || 'Node Operator',
                    plateNumber: (stellarData as any)?.plateNumber || 'N/A',
                    coopName: (stellarData as any)?.coopName || (stellarData as any)?.todaAffiliation || 'SuperAdmin HQ',
                    amount: sendAmt,
                    asset: 'XLM',
                    destination: sendDest,
                    network: appNetwork,
                    timestamp: new Date().toISOString()
                });

                alert(`Success! Sent ${sendAmt} XLM on ${appNetwork}.`);
                setShowSendModal(false);
                setSendDest('');
                setSendAmt('');
            } else throw new Error("Execution failed on ledger.");
        } catch (err) {
            alert(`Failed to send funds. Ensure your wallet extension is set to ${appNetwork}.`);
        } finally { setIsProcessing(false); }
    };

    // --- CONTRACT CALLS ---
    const executeContractCall = async (functionName: string, args: any[]) => {
        if (!activePubKey) return;
        setIsProcessing(true);
        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);
            const contract = new Contract(CONTRACT_ID);

            let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
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
        } catch (error: any) { throw error; } finally { setIsProcessing(false); }
    };

    // --- ADVANCE & SETTLEMENT LOGIC ---
    const handleRequestAdvance = async (amount: number) => {
        if (!activePubKey) return;

        // STRICT CHECK: Block new loans if there is a pending balance
        if (debtState > 0) {
            alert("Request Blocked: You must settle your pending balance before requesting a new advance.");
            return;
        }

        const borrowVal = stellarData?.role === 'driver' ? 15 : amount;
        try {
            await executeContractCall("request_advance", [
                nativeToScVal(activePubKey, { type: 'address' }),
                nativeToScVal(borrowVal * 10000000, { type: 'i128' })
            ]);
            setDebtState(borrowVal);
            alert(`Success! ${borrowVal} XLM confirmed on the ledger.`);
        } catch (e) {
            alert(`Transaction Reverted: Ensure your wallet extension is set to ${appNetwork} and you have funds.`);
        }
    };

    const handleSettleLoan = async () => {
        if (!activePubKey || debtState <= 0) return;
        setIsProcessing(true);

        try {
            // 1. Calculate Exact Fees
            const principal = debtState;
            const superAdminFee = (principal * 0.002).toFixed(7); // 0.2% HQ
            const coopFee = (principal * 0.003).toFixed(7);       // 0.3% Cooperative

            // 2. Fetch Destination Wallets from Firestore dynamically
            let superAdminAddress = '';
            let coopAddress = '';

            const saQuery = query(collection(db, 'users'), where('role', '==', 'superadmin'));
            const saSnap = await getDocs(saQuery);
            if (!saSnap.empty) superAdminAddress = saSnap.docs[0].data().publicKey;

            const coopQuery = query(collection(db, 'users'), where('role', '==', 'admin'), where('coopName', '==', (stellarData as any).todaAffiliation));
            const coopSnap = await getDocs(coopQuery);
            if (!coopSnap.empty) coopAddress = coopSnap.docs[0].data().publicKey;

            if (!superAdminAddress || !coopAddress) {
                throw new Error("Cannot route fees. Missing Superadmin or Cooperative wallet addresses.");
            }

            // 3. Build Multi-Operation Atomic Transaction
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);
            const contract = new Contract(CONTRACT_ID);

            let txBuilder = new TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
                // Op 1: Call the smart contract to clear the debt state
                .addOperation(contract.call("settle_loan", nativeToScVal(activePubKey, { type: 'address' })))
                // Op 2: 0.2% Fee Payment to Superadmin
                .addOperation(Operation.payment({
                    destination: superAdminAddress,
                    asset: Asset.native(),
                    amount: superAdminFee
                }))
                // Op 3: 0.3% Fee Payment to Cooperative Admin
                .addOperation(Operation.payment({
                    destination: coopAddress,
                    asset: Asset.native(),
                    amount: coopFee
                }));

            let tx = txBuilder.setTimeout(30).build();

            // 4. Sign and Submit
            const preparedTx = await server.prepareTransaction(tx);
            const response = await signAndSubmitTx(server, preparedTx);

            if (response.status === "ERROR") throw new Error("Transaction submission failed");

            // Wait for Ledger Confirmation
            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") {
                // Record the complex settlement to Firebase Logs
                await addDoc(collection(db, 'transactions'), {
                    txHash: response.hash,
                    senderUid: stellarData?.uid,
                    senderName: (stellarData as any)?.fullName || 'Node Operator',
                    plateNumber: (stellarData as any)?.plateNumber || 'N/A',
                    coopName: (stellarData as any)?.todaAffiliation || 'N/A',
                    amount: principal.toString(),
                    asset: 'XLM',
                    type: 'SETTLEMENT',
                    feesPaid: {
                        superAdmin: superAdminFee,
                        coop: coopFee
                    },
                    network: appNetwork,
                    timestamp: new Date().toISOString()
                });

                setDebtState(0);
                alert(`Settlement Complete! ${principal} XLM principal cleared. Paid ${superAdminFee} XLM to HQ and ${coopFee} XLM to Cooperative.`);
            } else {
                throw new Error("On-chain execution reverted.");
            }
        } catch (e: any) {
            alert(`Transaction Failed: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    const formatCurrency = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (currencyMode === 'PHP') return `₱ ${(num * PHP_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
    };

    if (!stellarData) return <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex items-center justify-center text-white">Loading Node Profile...</div>;
    // Intercept users who are not yet approved
    if (stellarData.status === 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-full max-w-md bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl">
                    <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        {/* Using an hourglass icon or emoji */}
                        <span className="text-3xl">⏳</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Node Pending Approval</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
                        Your cryptographic keys have been generated, but your network access requires verification.
                        Please wait for {stellarData.role === 'admin' ? 'a Super Admin' : 'your Cooperative Admin'} to approve your registration.
                    </p>
                    <button
                        onClick={() => signOut(auth)}
                        className="w-full py-4 bg-gray-900 text-white dark:bg-white dark:text-black font-black text-sm rounded-xl transition-all hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                        Sign Out Safely
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#060610] text-gray-900 dark:text-white font-sans overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />
            <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
                <Header theme={theme} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} onSignOut={() => signOut(auth)} />

                {/* NETWORK STATUS BANNER - Extremely clear indicator for users */}
                <div className={`w-full py-1.5 px-4 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${appNetwork === 'TESTNET' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-b border-yellow-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20'}`}>
                    <Globe className="w-3.5 h-3.5" />
                    Operating on Stellar {appNetwork}
                </div>

                {/* Mobile padding fixed (pb-28) to stop bottom nav overlap */}
                <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center pb-28 md:pb-8">

                    {activeTab === 'hub' && <HubTab stellarData={stellarData} isAdmin={stellarData.role === 'superadmin' || stellarData.role === 'admin'} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} debtState={debtState} isProcessing={isProcessing} handleRequestAdvance={handleRequestAdvance} handleSettleLoan={handleSettleLoan} appNetwork={appNetwork} handleNetworkChange={handleNetworkChange} />}

                    {activeTab === 'vault' && <VaultTab stellarData={stellarData} externalWallet={externalWallet} activePubKey={activePubKey} xlmBalance={xlmBalance} assetBalances={assetBalances} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} setShowWalletModal={setShowWalletModal} handleDisconnectWallet={handleDisconnectWallet} setShowReceiveModal={setShowReceiveModal} setShowSendModal={setShowSendModal} />}

                    {activeTab === 'history' && <HistoryTab txHistory={firebaseHistory} appNetwork={appNetwork} />}

                    {activeTab === 'profile' && <ProfileTab stellarData={stellarData} isSuperAdmin={stellarData.role === 'superadmin'} />}

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
                                {isProcessing ? "Signing Transaction..." : `Confirm & Send on ${appNetwork}`}
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