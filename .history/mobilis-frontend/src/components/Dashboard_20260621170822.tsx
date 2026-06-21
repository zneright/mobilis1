import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
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

import HubTab from './tabs/HubTab';
import VaultTab from './tabs/VaultTab';
import HistoryTab from './tabs/HistoryTab';
import ProfileTab from './tabs/ProfileTab';

const CONTRACT_ID = "CBLCVIRSIQQ27DYJCHIMVAMBGBSWH6BPJ56WZ6FNSTN5AU7HARPH4KKC";
const PHP_EXCHANGE_RATE = 60.69;

declare global {
    interface Window { lobstr: any; }
}

const Dashboard: React.FC = () => {
    const { stellarData } = useAuth();

    const [activeTab, setActiveTab] = useState<'hub' | 'vault' | 'history' | 'profile'>('hub');
    const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
    const [currencyMode, setCurrencyMode] = useState<'XLM' | 'PHP'>('XLM');

    const appNetwork = 'TESTNET';
    const HORIZON_SERVER = "https://horizon-testnet.stellar.org";
    const RPC_SERVER = "https://soroban-testnet.stellar.org";
    const NETWORK_PASSPHRASE = Networks.TESTNET;

    const [externalWallet, setExternalWallet] = useState<string | null>(null);
    const activePubKey = externalWallet || stellarData?.publicKey;

    const [isProcessing, setIsProcessing] = useState(false);
    const [debtState, setDebtState] = useState<number>(0);
    const [xlmBalance, setXlmBalance] = useState<string>('0.00');
    const [assetBalances, setAssetBalances] = useState<any[]>([]);
    const [firebaseHistory, setFirebaseTxHistory] = useState<any[]>([]);
    const [treasuryBalance, setTreasuryBalance] = useState<string>('0.00');
    const [borrowLimit, setBorrowLimit] = useState<number>(15);

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
                console.error("[Dashboard] Auto-connect failed.", e);
            }
        };
        checkAutoConnect();
    }, []);

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
            }

            if (stellarData?.role === 'admin' || stellarData?.role === 'superadmin') {
                const contractRes = await fetch(`${HORIZON_SERVER}/accounts/${CONTRACT_ID}`);
                if (contractRes.ok) {
                    const contractData = await contractRes.json();
                    if (contractData.balances) {
                        const contractNative = contractData.balances.find((b: any) => b.asset_type === 'native');
                        if (contractNative) setTreasuryBalance(parseFloat(contractNative.balance).toFixed(2));
                    }
                }
            }
        } catch (err) {
            console.error("[Dashboard] Fetch balances failed:", err);
        }

        if (stellarData?.role === 'driver') {
            try {
                const server = new rpc.Server(RPC_SERVER);
                const contract = new Contract(CONTRACT_ID);

                const account = await server.getAccount(activePubKey);
                const tx = new TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
                    .addOperation(contract.call("get_debt", nativeToScVal(activePubKey, { type: 'address' })))
                    .setTimeout(30).build();

                const simulation = await server.simulateTransaction(tx);
                if (rpc.Api.isSimulationSuccess(simulation)) {
                    if (simulation.result && simulation.result.retval) {
                        const rawDebt = scValToNative(simulation.result.retval);
                        setDebtState(Number(rawDebt) / 10000000);
                    } else {
                        setDebtState(0);
                    }
                }
            } catch (error) {
                console.error("[Dashboard] Smart Contract Debt Simulation Error:", error);
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
            console.error("[Dashboard] Firebase fetch failed:", err);
        }
    };

    const fetchCoopSettings = async () => {
        if (!stellarData) return;
        try {
            const coopName = stellarData.role === 'driver' ? stellarData.todaAffiliation : stellarData.coopName;
            if (!coopName) return;
            const q = query(collection(db, 'coop_settings'), where('coopName', '==', coopName));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setBorrowLimit(snap.docs[0].data().borrowLimit || 15);
            }
        } catch (err) {
            console.error("Error fetching coop settings:", err);
        }
    };

    useEffect(() => {
        fetchLedgerData();
        fetchFirebaseHistory();
        fetchCoopSettings();
    }, [activePubKey, isProcessing, stellarData?.role]);

    const handleSetBorrowLimit = async (newLimit: number) => {
        if (!stellarData?.coopName) return;
        setIsProcessing(true);
        try {
            const q = query(collection(db, 'coop_settings'), where('coopName', '==', stellarData.coopName));
            const snap = await getDocs(q);
            if (snap.empty) {
                await addDoc(collection(db, 'coop_settings'), { coopName: stellarData.coopName, borrowLimit: newLimit });
            } else {
                await updateDoc(doc(db, 'coop_settings', snap.docs[0].id), { borrowLimit: newLimit });
            }
            setBorrowLimit(newLimit);
            alert(`Driver borrow limit successfully set to ${newLimit} XLM`);
        } catch (error) {
            console.error("Error setting limit:", error);
            alert("Failed to update borrow limit in database.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFullSignOut = async () => {
        try {
            setExternalWallet(null);
            localStorage.removeItem('externalWalletConnected');
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            alert("An error occurred while logging out.");
        }
    };

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
            throw error;
        }
    };

    const handleSendXLM = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activePubKey) return;
        if (parseFloat(sendAmt) > parseFloat(xlmBalance)) {
            alert(`Transaction Blocked: Insufficient XLM.`);
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
                alert(`Success! Sent ${sendAmt} XLM.`);
                setShowSendModal(false);
                setSendDest('');
                setSendAmt('');
                setTimeout(() => fetchLedgerData(), 3000);
            } else throw new Error("Execution failed on ledger.");
        } catch (err) {
            alert(`Failed to send funds. Ensure your wallet extension is set to ${appNetwork}.`);
        } finally { setIsProcessing(false); }
    };

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
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInjectLiquidity = async (amount: number) => {
        if (!activePubKey) return;
        setIsProcessing(true);
        try {
            const server = new rpc.Server(RPC_SERVER);
            const account = await server.getAccount(activePubKey);

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

                alert(`Success! Deposited ${amount} XLM into the Smart Contract Vault.`);
                setTimeout(() => fetchLedgerData(), 3000);
            } else throw new Error(`Execution failed on ledger: ${txResult.status}`);
        } catch (err: any) {
            alert(`Failed to deposit funds. Ensure your Admin wallet has enough balance to transfer.`);
        } finally { setIsProcessing(false); }
    };

    const handleRequestAdvance = async (amount: number) => {
        if (!activePubKey) return;

        if (debtState > 0 && stellarData?.role === 'driver') {
            alert(`Request Blocked: You currently have a pending debt of ${debtState} XLM. You must settle this before borrowing again.`);
            return;
        }

        if (amount > borrowLimit) {
            alert(`Request Blocked: The cooperative limit is ${borrowLimit} XLM.`);
            return;
        }

        setIsProcessing(true);

        try {
            await executeContractCall("request_advance", [
                nativeToScVal(activePubKey, { type: 'address' }),
                nativeToScVal(Math.floor(amount * 10000000).toString(), { type: 'i128' })
            ]);

            setDebtState(amount);

            await addDoc(collection(db, 'transactions'), {
                senderUid: CONTRACT_ID,
                senderName: 'Mobilis Treasury Contract',
                coopName: (stellarData as any)?.todaAffiliation || 'N/A',
                plateNumber: (stellarData as any)?.plateNumber || 'N/A',
                amount: amount.toString(),
                asset: 'XLM',
                type: 'SMART_CONTRACT_ADVANCE',
                destination: activePubKey,
                network: appNetwork,
                timestamp: new Date().toISOString()
            });

            alert(`Success! ${amount} XLM advance deposited into your wallet by the Smart Contract.`);
            setTimeout(() => fetchLedgerData(), 3000);

        } catch (e: any) {
            alert(`Advance Failed: Ensure the Cooperative Treasury has sufficient liquidity.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSettleLoan = async () => {
        if (!activePubKey || debtState <= 0) return;
        setIsProcessing(true);

        try {
            const totalFee = debtState * 0.005;

            await executeContractCall("settle_loan", [
                nativeToScVal(activePubKey, { type: 'address' })
            ]);

            setDebtState(0);

            await addDoc(collection(db, 'transactions'), {
                senderUid: stellarData?.uid,
                senderName: (stellarData as any)?.fullName || 'Node Operator',
                amountSettled: debtState.toString(),
                feePaid: totalFee.toString(),
                asset: 'XLM',
                type: 'SMART_CONTRACT_SETTLEMENT',
                network: appNetwork,
                timestamp: new Date().toISOString()
            });

            alert(`Settlement Complete! Principal and fees were successfully routed on-chain.`);
            setTimeout(() => fetchLedgerData(), 3000);

        } catch (e: any) {
            alert(`Transaction Failed: Ensure you have sufficient balance to cover the principal and the 0.5% routing fees.`);
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

                    {activeTab === 'hub' && <HubTab
                        stellarData={stellarData}
                        isAdmin={stellarData.role === 'superadmin' || stellarData.role === 'admin'}
                        currencyMode={currencyMode}
                        setCurrencyMode={setCurrencyMode}
                        formatCurrency={formatCurrency}
                        debtState={debtState}
                        isProcessing={isProcessing}
                        handleRequestAdvance={handleRequestAdvance}
                        handleInjectLiquidity={handleInjectLiquidity}
                        handleSettleLoan={handleSettleLoan}
                        appNetwork={appNetwork}
                        treasuryBalance={treasuryBalance}
                        borrowLimit={borrowLimit}
                        handleSetBorrowLimit={handleSetBorrowLimit}
                    />}
                    {activeTab === 'vault' && <VaultTab stellarData={stellarData} externalWallet={externalWallet} activePubKey={activePubKey} xlmBalance={xlmBalance} assetBalances={assetBalances} currencyMode={currencyMode} setCurrencyMode={setCurrencyMode} formatCurrency={formatCurrency} setShowWalletModal={setShowWalletModal} handleDisconnectWallet={handleDisconnectWallet} setShowReceiveModal={setShowReceiveModal} setShowSendModal={setShowSendModal} appNetwork={appNetwork} refreshData={fetchLedgerData} />}

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