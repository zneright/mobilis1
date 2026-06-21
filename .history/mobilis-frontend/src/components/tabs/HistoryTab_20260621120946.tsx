import React from 'react';
import { ExternalLink } from 'lucide-react';

interface HistoryTabProps {
    txHistory: any[];
}

const HistoryTab: React.FC<HistoryTabProps> = ({ txHistory }) => {
    return (
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
    );
};

export default HistoryTab;