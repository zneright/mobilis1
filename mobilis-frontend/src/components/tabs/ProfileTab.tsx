import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface ProfileTabProps {
    stellarData: any;
    isSuperAdmin: boolean;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ stellarData, isSuperAdmin }) => {
    const [editPhone, setEditPhone] = useState(stellarData?.phone || '');
    const [editPlate, setEditPlate] = useState(stellarData?.plateNumber || '');
    const [editContact, setEditContact] = useState(stellarData?.contactPerson || '');
    const [editRegNum, setEditRegNum] = useState(stellarData?.registrationNumber || '');

    useEffect(() => {
        if (stellarData) {
            setEditPhone(stellarData.phone || '');
            setEditPlate(stellarData.plateNumber || '');
            setEditContact(stellarData.contactPerson || '');
            setEditRegNum(stellarData.registrationNumber || '');
        }
    }, [stellarData]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'users', stellarData.uid), {
                phone: editPhone,
                ...(stellarData.role === 'driver' && { plateNumber: editPlate }),
                ...(stellarData.role === 'admin' && { contactPerson: editContact, registrationNumber: editRegNum })
            });
            alert("Profile metadata updated successfully!");
        } catch (error) { alert("Failed to modify database fields."); }
    };

    return (
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
    );
};

export default ProfileTab;