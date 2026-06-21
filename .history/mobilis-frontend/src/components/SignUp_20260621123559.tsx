// src/components/Signup.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Keypair } from '@stellar/stellar-sdk';
import { requestAccess, isConnected } from '@stellar/freighter-api';
import { AlertTriangle, Copy, CheckCircle2, Wallet } from 'lucide-react';
import type { UserData } from '../types';

declare global {
    interface Window { lobstr: any; }
}

const Signup: React.FC = () => {
    const [role, setRole] = useState<'driver' | 'admin'>('driver');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Driver Fields
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [plateNumber, setPlateNumber] = useState('');

    // Smart Autocomplete State for Drivers
    const [todaAffiliation, setTodaAffiliation] = useState('');
    const [approvedCoops, setApprovedCoops] = useState<string[]>([]);
    const [filteredCoops, setFilteredCoops] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Admin Fields & Wallet State
    const [coopName, setCoopName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [adminWalletMethod, setAdminWalletMethod] = useState<'generate' | 'freighter' | 'lobstr' | 'manual'>('generate');

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCoops = async () => {
            try {
                const q = query(
                    collection(db, 'users'),
                    where('role', '==', 'admin'),
                    where('status', '==', 'approved')
                );
                const snapshot = await getDocs(q);
                const coops = snapshot.docs.map(doc => doc.data().coopName as string);
                setApprovedCoops(coops);
                setFilteredCoops(coops);
            } catch (err) {
                console.error("Failed to fetch coops", err);
            }
        };
        fetchCoops();
    }, []);

    const handleTodaSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTodaAffiliation(value);
        const matches = approvedCoops.filter(coop =>
            coop.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredCoops(matches);
        setShowDropdown(true);
    };

    const handleSelectCoop = (coop: string) => {
        setTodaAffiliation(coop);
        setShowDropdown(false);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (role === 'driver') {
                const isValidCoop = approvedCoops.some(
                    coop => coop.toLowerCase() === todaAffiliation.toLowerCase().trim()
                );
                if (!isValidCoop) {
                    throw new Error("No such cooperative exists. Please select a valid organization from the list.");
                }
            }

            let publicKey = '';
            let secret = '';
            let generatedKeyToDisplay = null;

            // Handle strictly non-custodial logic for Admin
            if (role === 'admin') {
                if (adminWalletMethod === 'freighter') {
                    if (await isConnected()) {
                        const pk = await requestAccess();
                        publicKey = typeof pk === 'string' ? pk : (pk as any).address;
                    } else throw new Error("Freighter extension not found or access denied.");
                } else if (adminWalletMethod === 'lobstr') {
                    if (window.lobstr) {
                        publicKey = await window.lobstr.requestAccess();
                    } else throw new Error("LOBSTR extension not found.");
                } else if (adminWalletMethod === 'generate') {
                    const pair = Keypair.random();
                    publicKey = pair.publicKey();
                    secret = pair.secret(); // We capture it to show the user
                    generatedKeyToDisplay = secret;
                    // Strictly non-custodial: we will NOT save the secret to the database for admins!
                    secret = '';
                }
                // If 'manual', publicKey and secret stay empty strings, to be connected inside Dashboard.
            } else {
                // Drivers get auto-generated custodial wallets for ease of use
                const pair = Keypair.random();
                publicKey = pair.publicKey();
                secret = pair.secret();
                fetch(`https://friendbot.stellar.org?addr=${publicKey}`).catch(console.error);
            }

            // Create Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const baseData = {
                uid: user.uid,
                email: user.email || email,
                role: role,
                status: 'pending',
                publicKey,
                secret
            };

            let finalUserData: UserData;

            if (role === 'driver') {
                finalUserData = {
                    ...baseData,
                    fullName,
                    phone,
                    plateNumber,
                    todaAffiliation: todaAffiliation.trim()
                } as any;
            } else {
                finalUserData = {
                    ...baseData,
                    coopName: coopName.trim(),
                    contactPerson,
                    phone,
                    registrationNumber
                } as any;
            }

            await setDoc(doc(db, 'users', user.uid), finalUserData);

            if (generatedKeyToDisplay) {
                // Show modal with the key instead of navigating immediately
                setGeneratedSecret(generatedKeyToDisplay);
                setIsLoading(false);
                return;
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || "Failed to create account. Please verify your details and extensions.");
            console.error("Signup Catch Block Triggered:", err);
        } finally {
            if (!generatedSecret) setIsLoading(false);
        }
    };

    const inputClasses = "w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all";

    return (
        <div className="min-h-screen bg-[#060610] flex flex-col items-center justify-center p-4 sm:p-8 font-sans text-white relative">

            {/* NON CUSTODIAL SECRET KEY MODAL */}
            {generatedSecret && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0a0a14] border border-emerald-500/30 rounded-[2rem] p-8 shadow-2xl relative text-center">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-black mb-2">Save Your Recovery Key</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            This is a <strong className="text-white">Strictly Non-Custodial</strong> wallet. We do NOT store this key. If you lose it, your account and funds cannot be restored. Real as it gets!
                        </p>

                        <div className="bg-black/50 p-4 rounded-xl border border-white/10 mb-6">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Secret Seed Phrase</p>
                            <code className="text-sm text-emerald-400 break-all select-all">{generatedSecret}</code>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => navigator.clipboard.writeText(generatedSecret)} className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
                                <Copy className="w-4 h-4" /> Copy Key
                            </button>
                            <button onClick={() => navigate('/dashboard')} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                                <CheckCircle2 className="w-5 h-5" /> I Saved It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-lg bg-[#0a0a14]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-10 shadow-2xl">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 tracking-tight">Deploy Node</h2>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="flex flex-col gap-4">
                    {/* Segmented Control for Role */}
                    <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl mb-2">
                        <button type="button" onClick={() => setRole('driver')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === 'driver' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>
                            🚙 Driver
                        </button>
                        <button type="button" onClick={() => setRole('admin')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === 'admin' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>
                            🏢 TODA Admin
                        </button>
                    </div>

                    {role === 'driver' ? (
                        <>
                            <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClasses} />
                            <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputClasses} />
                            <input type="text" placeholder="Plate Number (e.g., ABC-1234)" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required className={inputClasses} />
                            <div className="relative">
                                <input type="text" placeholder="Search Cooperative Name..." value={todaAffiliation} onChange={handleTodaSearch} onFocus={() => setShowDropdown(true)} required className={inputClasses} />
                                {showDropdown && (
                                    <ul className="absolute top-[105%] left-0 w-full bg-[#161622] border border-white/10 rounded-xl max-h-40 overflow-y-auto z-50 shadow-2xl custom-scrollbar">
                                        {filteredCoops.length > 0 ? (
                                            filteredCoops.map((coop, idx) => (
                                                <li key={idx} onClick={() => handleSelectCoop(coop)} className="p-4 cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-none transition-colors">
                                                    {coop}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-4 text-gray-500 text-sm">No matching cooperatives</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <input type="text" placeholder="Registered Cooperative Name" value={coopName} onChange={(e) => setCoopName(e.target.value)} required className={inputClasses} />
                            <input type="text" placeholder="Contact Person Full Name" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required className={inputClasses} />
                            <input type="tel" placeholder="Official Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputClasses} />
                            <input type="text" placeholder="Gov Registration Number (e.g., CDA/SEC)" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required className={inputClasses} />

                            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Wallet className="w-4 h-4" /> Cooperative Wallet Setup
                                </p>
                                <select
                                    value={adminWalletMethod}
                                    onChange={(e) => setAdminWalletMethod(e.target.value as any)}
                                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-emerald-500"
                                >
                                    <option value="generate">Generate New Wallet (Non-Custodial)</option>
                                    <option value="freighter">Connect Freighter Extension</option>
                                    <option value="lobstr">Connect LOBSTR Extension</option>
                                    <option value="manual">Skip & Connect Later in Dashboard</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div className="h-px w-full bg-white/10 my-2" />

                    <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClasses} />
                    <input type="password" placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClasses} />

                    <button type="submit" disabled={isLoading} className="w-full mt-4 p-4 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                        {isLoading ? 'Broadcasting...' : 'Submit Application'}
                    </button>
                </form>

                <p className="text-center mt-8 text-sm text-gray-400">
                    Already registered? <Link to="/login" className="text-emerald-400 font-bold hover:text-emerald-300 hover:underline">Log In</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;