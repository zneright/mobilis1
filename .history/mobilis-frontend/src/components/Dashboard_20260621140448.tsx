import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
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

    // --- STRICT TESTNET ENFORCEMENT ---
    const appNetwork = 'TESTNET';
    const HORIZON_SERVER = "https://horizon-testnet.stellar.org";
    const RPC_SERVER = "https://soroban-testnet.stellar.org";
    const NETWORK_PASSPHRASE = Networks.TESTNET;

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
            } catch (e) {
                console.error("[Dashboard -> checkAutoConnect Error]: Auto-connect blocked or failed.", e);
            }
        };
        checkAutoConnect();
    }, []);

    // --- CORE DATA FETCHING FUNCTION ---
    const fetchLedgerData = async () => {
        if (!activePubKey) return;

        // Purge stale state prior to making the fetch request
        setXlmBalance('0.00');
        setAssetBalances([]);
        setDebtState(0);

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
                console.warn(`[Dashboard -> fetchLedgerData] Horizon returned non-ok status: ${res.status}`);
            }
        } catch (err) {
            console.error("[Dashboard -> fetchLedgerData (Balances)] Fetch failed:", err);
        }

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
                }
            } catch (error) {
                console.error("[Dashboard -> fetchLedgerData (Debt)] Smart Contract Debt Simulation Error:", error);
            }
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
        } catch (err) {
            console.error("[Dashboard -> fetchFirebaseHistory] Firebase fetch failed:", err);
        }
    };

    useEffect(() => {
        fetchLedgerData();
        fetchFirebaseHistory();
    }, [activePubKey, isProcessing, stellarData?.role]);

    // --- FULL KILL SWITCH LOGOUT (Fixes ghost wallets) ---
    const handleFullSignOut = async () => {
        try {
            setExternalWallet(null);
            localStorage.removeItem('externalWalletConnected');
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            console.error("[Dashboard -> handleFullSignOut] Error during sign out:", error);
            alert("An error occurred while logging out. Please refresh the page manually.");
        }
    };

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
        } catch (e) {
            console.error(`[Dashboard -> executeWalletConnection] Connection to ${walletName} rejected:`, e);
            alert(`Connection to ${walletName} rejected or failed.`);
        }
    };

    const handleDisconnectWallet = () => {
        setExternalWallet(null);
        localStorage.removeItem('externalWalletConnected');
    };

    const signAndSubmitTx = async (server: rpc.Server, preparedTx: any) => {
        const walletType = localStorage.getItem('externalWalletConnected');

        try {
            if (externalWallet && walletType === 'Freighter') {
                const { signedTxXdr, error } = await signTransaction(preparedTx.toXDR(), { network: appNetwork });
                if (error) throw new Error(`Freighter Signing Error: ${error}`);
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
        } catch (error) {
            console.error("[Dashboard -> signAndSubmitTx] Signing/Submission Error:", error);
            throw error;
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

            if (response.status === "ERROR") throw new Error(`Submission failed: ${JSON.stringify(response.errorResult)}`);

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
                fetchLedgerData(); // Refresh immediately after sending
            } else throw new Error("Execution failed on ledger.");
        } catch (err) {
            console.error("[Dashboard -> handleSendXLM] Error:", err);
            alert(`Failed to send funds. Check console for exact failure details. Ensure your wallet extension is set to ${appNetwork}.`);
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

            if (response.status === "ERROR") throw new Error(`Transaction submission failed: ${JSON.stringify(response.errorResult)}`);

            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") return true;
            throw new Error(`On-chain execution reverted: ${txResult.status}`);
        } catch (error: any) {
            console.error(`[Dashboard -> executeContractCall (${functionName})] Error:`, error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    // --- ADMIN: INJECT LIQUIDITY (FUNDS THE CONTRACT) ---
    const handleInjectLiquidity = async (amount: number) => {
        if (!activePubKey) return;
        setIsProcessing(true);
        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);

            // Hardcoded strictly to Testnet XLM Contract
            const NATIVE_CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
            const nativeContract = new Contract(NATIVE_CONTRACT_ID);

            let tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
                .addOperation(nativeContract.call(
                    "transfer",
                    nativeToScVal(activePubKey, { type: 'address' }),
                    nativeToScVal(CONTRACT_ID, { type: 'address' }),
                    nativeToScVal(Math.floor(amount * 10000000).toString(), { type: 'i128' })
                ))
                .setTimeout(30).build();

            const preparedTx = await server.prepareTransaction(tx);
            const response = await signAndSubmitTx(server, preparedTx);

            if (response.status === "ERROR") throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);

            let txResult = await server.getTransaction(response.hash);
            while (txResult.status === "NOT_FOUND" || txResult.status === "PENDING") {
                await new Promise(resolve => setTimeout(resolve, 2000));
                txResult = await server.getTransaction(response.hash);
            }

            if (txResult.status === "SUCCESS") {
                await addDoc(collection(db, 'transactions'), {
                    txHash: response.hash,
                    senderUid: stellarData?.uid,
                    senderName: (stellarData as any)?.fullName || 'Coop Admin',
                    plateNumber: 'N/A',
                    coopName: (stellarData as any)?.coopName || (stellarData as any)?.todaAffiliation || 'SuperAdmin HQ',
                    amount: amount.toString(),
                    asset: 'XLM',
                    type: 'LIQUIDITY_INJECTION',
                    destination: CONTRACT_ID,
                    network: appNetwork,
                    timestamp: new Date().toISOString()
                });

                alert(`Success! Injected ${amount} XLM into the Cooperative Treasury.`);
                fetchLedgerData();
            } else throw new Error(`Execution failed on ledger: ${txResult.status}`);
        } catch (err: any) {
            console.error("Injection Error:", err);
            alert(`Failed to inject funds. Check console. Ensure your wallet extension is set to ${appNetwork}.`);
        } finally { setIsProcessing(false); }
    };

    // --- DRIVER: REQUEST ADVANCE ---
    const handleRequestAdvance = async (amount: number) => {
        if (!activePubKey) return;

        if (debtState > 0 && stellarData?.role === 'driver') {
            alert(`Request Blocked: You currently have a pending debt of ${debtState} XLM. You must settle this before borrowing again.`);
            return;
        }

        setIsProcessing(true);

        try {
            const borrowVal = stellarData?.role === 'driver' ? 15 : amount;

            await executeContractCall("request_advance", [
                nativeToScVal(activePubKey, { type: 'address' }),
                nativeToScVal(Math.floor(borrowVal * 10000000).toString(), { type: 'i128' })
            ]);

            setDebtState(borrowVal);

            await addDoc(collection(db, 'transactions'), {
                txHash: "SMART_CONTRACT_EXECUTION",
                senderUid: "CONTRACT_POOL",
                senderName: stellarData?.role === 'driver' ? (stellarData as any).todaAffiliation : 'SuperAdmin Pool',
                coopName: stellarData?.role === 'driver' ? (stellarData as any).todaAffiliation : 'N/A',
                plateNumber: (stellarData as any)?.plateNumber || 'N/A',
                amount: borrowVal.toString(),
                asset: 'XLM',
                type: 'LOAN_ADVANCE',
                destination: activePubKey,
                network: appNetwork,
                timestamp: new Date().toISOString()
            });

            alert(`Success! ${borrowVal} XLM advance has been successfully issued from the cooperative pool.`);
            fetchLedgerData();
        } catch (e: any) {
            console.error("[Dashboard -> handleRequestAdvance] Smart Contract Revert Data:", e);
            alert(`Transaction Reverted: The cooperative pool may have insufficient liquidity, or you lack the XLM required for transaction fees.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSettleLoan = async () => {
        if (!activePubKey || debtState <= 0) return;
        setIsProcessing(true);

        try {
            await executeContractCall("settle_loan", [
                nativeToScVal(activePubKey, { type: 'address' })
            ]);

            await addDoc(collection(db, 'transactions'), {
                txHash: "SMART_CONTRACT_EXECUTION_SETTLED",
                senderUid: stellarData?.uid,
                senderName: (stellarData as any)?.fullName || 'Node Operator',
                amount: debtState.toString(),
                asset: 'XLM',
                type: 'SETTLEMENT',
                network: appNetwork,
                timestamp: new Date().toISOString()
            });

            setDebtState(0);
            alert(`Settlement Complete! Fees have been routed by the Smart Contract.`);
            fetchLedgerData();
        } catch (e: any) {
            console.error("[Dashboard -> handleSettleLoan] Transaction Failed:", e);
            alert(`Transaction Failed: Ensure you have sufficient balance to cover the debt and gas fees.`);
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

    if (stellarData.status === 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-full max-w-md bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl">
                    <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">⏳</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Node Pending Approval</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
                        Your cryptographic keys have been generated, but your network access requires verification.
                        Please wait for {stellarData.role === 'admin' ? 'a Super Admin' : 'your Cooperative Admin'} to approve your registration.
                    </p>
                    <button
                        onClick={handleFullSignOut}
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
                <Header theme={theme} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} onSignOut={handleFullSignOut} />

                <div className="w-full py-1.5 px-4 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-b border-yellow-500/20">
                    <Globe className="w-3.5 h-3.5" />
                    Operating Strictly on Stellar {appNetwork}
                </div>

                <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center pb-28 md:pb-8">

                    {activeTab === 'hub' && <HubTab stellarData={stellarData} isAdmin={stellarData.role === 'superadmin' || stellarData.role === 'admin'} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} debtState={debtState} isProcessing={isProcessing} handleRequestAdvance={handleRequestAdvance} handleInjectLiquidity={handleInjectLiquidity} handleSettleLoan={handle