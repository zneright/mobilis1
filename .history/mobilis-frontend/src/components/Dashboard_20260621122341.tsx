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
import { Copy, ArrowUpRight, X, Wallet } from 'lucide-react';
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
        const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
            if (docSnap.exists()) {
                setAppNetwork(docSnap.data().activeNetwork || 'TESTNET');
            } else {
                // Initialize if setting doesn't exist yet
                setDoc(doc(db, 'settings', 'global'), { activeNetwork: 'TESTNET' });
            }
        });
        return () => unsub();
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

    const handleRequestAdvance = async (amount: number) => {
        if (!activePubKey) return;
        const borrowVal = stellarData?.role === 'driver' ? 15 : amount;
        try {
            await executeContractCall("request_advance", [
                nativeToScVal(activePubKey, { type: 'address' }),
                nativeToScVal(borrowVal * 10000000, { type: 'i128' })
            ]);
            setDebtState(borrowVal);
            alert(`Success! ${borrowVal} XLM confirmed on the ledger.`);
        } catch (e) { alert(`Transaction Reverted: Ensure your wallet extension is set to ${appNetwork} and you have funds.`); }
    };

    const handleSettleLoan = async () => {
        if (!activePubKey) return;
        try {
            await executeContractCall("settle_loan", [nativeToScVal(activePubKey, { type: 'address' })]);
            setDebtState(0);
            alert(`Success! Your loan has been fully settled and fees distributed.`);
        } catch (e) { alert(`Transaction Reverted: Ensure your wallet extension is set to ${appNetwork}.`); }
    };

    const formatCurrency = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (currencyMode === 'PHP') return `₱ ${(num * PHP_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
    };

    if (!stellarData) return <div className="min-h-screen bg-gray-50 dark:bg-[#060610] flex items-center justify-center text-white">Loading Node Profile...</div>;

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#060610] text-gray-900 dark:text-white font-sans overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />
            <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
                <Header theme={theme} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} onSignOut={() => signOut(auth)} />
                <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col items-center pb-32 md:pb-8">

                    {activeTab === 'hub' && <HubTab stellarData={stellarData} isAdmin={stellarData.role === 'superadmin' || stellarData.role === 'admin'} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} debtState={debtState} isProcessing={isProcessing} handleRequestAdvance={handleRequestAdvance} handleSettleLoan={handleSettleLoan} appNetwork={appNetwork} handleNetworkChange={handleNetworkChange} />}
                    
                    {activeTab === 'vault' && <VaultTab stellarData={stellarData} externalWallet={externalWallet} activePubKey={activePubKey} xlmBalance={xlmBalance} assetBalances={assetBalances} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} setShowWalletModal={setShowWalletModal} handleDisconnectWallet={handleDisconnectWallet} setShowReceiveModal={setShowReceiveModal} setShowSendModal={setShowSendModal} appNetwork={appNetwork} />}
                    
                    {activeTab === 'history' && <HistoryTab txHistory={firebaseHistory} appNetwork={appNetwork} />}
                    
                    {activeTab === 'profile' && <ProfileTab stellarData={stellarData} isSuperAdmin={stellarData.role === 'superadmin'} />}

                </main>
            </div>
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} role={stellarData.role} />