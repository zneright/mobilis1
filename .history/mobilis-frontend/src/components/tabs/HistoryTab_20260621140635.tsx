import React from 'react';
import { ExternalLink } from 'lucide-react';

interface HistoryTabProps {
    txHistory: any[];
    appNetwork: 'TESTNET';
}

const HistoryTab: React.FC<HistoryTabProps> = ({ txHistory, appNetwork }) => {
    return (
        <div className="w-full max-w-4xl mx-auto bg-white dark:bg-[#0a0a14] border border-gray-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-xl">
            <h3 className="text-2xl font-black mb-2">Fleet Activity Ledger</h3>
            <p className="text-gray-500 text-sm mb-6">Combined metadata from Firestore secured by Stellar verification.</p>

            <div className="space-y-4">
                {txHistory && txHistory.length > 0 ? (
                    txHistory.map((tx: any, idx: number) => (
                        <div key={idx} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <p className="font-bold text-sm tracking-wide uppercase">Confirmed Entry</p>
                                    </div>
                                    <p className="font-black text-lg text-emerald-500">+{parseFloat(tx.amount || 0).toFixed(2)} {tx.asset}</p>
                                </div>
                                <p className="text-gray-400 text-xs font-mono mb-4">{new Date(tx.timestamp).toLocaleString()}</p>

                                {/* Rich Firebase Metadata */}
                                <div className="grid grid-cols-2 gap-2 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                                    <div className="col-span-2 sm:col-span-1">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Sender Identity</p>
                                        <p className="text-sm font-bold truncate">{tx.senderName || 'Unknown'}</p>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Registered Plate</p>
                                        <p className="text-sm font-mono truncate">{tx.plateNumber || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Fleet / Cooperative</p>
                                        <p className="text-xs font-bold text-blue-500">{tx.coopName || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 md:mt-0 mt-2 self-start md:self-center w-full md:w-auto">
                                <span className="text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                    {tx.network || appNetwork}
                                </span>
                                <a
                                    href={`https://stellar.expert/explorer/${(tx.network || appNetwork).toLowerCase()}/tx/${tx.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-xl text-xs font-bold transition-colors shadow-lg mt-2"
                                >
                                    Verify Receipt <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 text-center py-8">No recorded activity available for this node.</p>
                )}
            </div>
        </div>
    );
};

export default HistoryTab;