import React, { useState, useEffect } from 'react';
import MicrosoftAuthQR, { generateBase32Secret, verifyTOTP } from './MicrosoftAuthQR';
import {
  ShieldCheck,
  Smartphone,
  Key,
  CheckCircle2,
  XCircle,
  Lock,
  RefreshCw,
  AlertCircle,
  Building,
  Plus,
  Search,
  User,
  Info,
  ExternalLink,
  X,
  QrCode,
  ChevronDown
} from 'lucide-react';

import { SystemUser } from '../types';
import { INITIAL_USERS, MASTER_ADMIN_USER, INITIAL_ORG_USERS } from '../data';
import { getAppStorageItem } from '../lib/storage';
import { verifyTOTPViaApi, verifyMasterPinViaApi, staffLoginViaApi, registerOrgViaApi } from '../lib/api';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  targetTenantId: string; // 'all' or specific tenant ID
  createdAt: string;
  severity: 'info' | 'warning' | 'urgent';
  createdBy?: string;
}

export interface TenantOrg {
  id: string;
  name: string;
  code: string;
  pin: string;
  ownerMobile: string;
  ownerName?: string;
  status: 'active' | 'deactivated';
  createdAt: string;
  secretKey?: string;
}

export const INITIAL_TENANTS: TenantOrg[] = [
  {
    id: 'org-admin',
    name: 'Master System Admin',
    code: 'ADMIN-00',
    pin: '••••••',
    ownerMobile: '+91 8149862034',
    ownerName: 'Master System Admin',
    status: 'active',
    createdAt: '2026-01-01',
    secretKey: 'MASTERADMIN2FA37'
  }
];

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

interface AuthModalProps {
  isOpen: boolean;
  tenants: TenantOrg[];
  activeTenantId?: string;
  users?: SystemUser[];
  onAuthenticated: (tenant: TenantOrg, userRole: string, loggedInUser?: SystemUser) => void;
  onRegisterOrg: (newTenant: TenantOrg) => void;
  onClose?: () => void;
}

export default function AuthModal({
  isOpen,
  tenants,
  activeTenantId,
  users,
  onAuthenticated,
  onRegisterOrg,
  onClose
}: AuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'mobile_2fa' | 'staff_login' | 'pin_passcode'>('mobile_2fa');
  
  // Mobile Login states
  const [mobileInput, setMobileInput] = useState<string>('+91 ');
  const [detectedTenant, setDetectedTenant] = useState<TenantOrg | null>(null);
  const [mobileSubmitted, setMobileSubmitted] = useState<boolean>(false);
  const [mobileError, setMobileError] = useState<string>('');
  const [rememberMeMobile, setRememberMeMobile] = useState<boolean>(true);

  // Microsoft Authenticator 6-digit TOTP states
  const [totpInputCode, setTotpInputCode] = useState<string>('');
  const [totpError, setTotpError] = useState<string>('');
  const [totpSuccess, setTotpSuccess] = useState<boolean>(false);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState<boolean>(false);

  // Staff / Technician Login states
  const [staffTenantId, setStaffTenantId] = useState<string>(activeTenantId || tenants[0]?.id || 'org-admin');
  const [staffOwnerMobile, setStaffOwnerMobile] = useState<string>('');
  const [staffDetectedOrg, setStaffDetectedOrg] = useState<TenantOrg | null>(null);
  const [staffUserInput, setStaffUserInput] = useState<string>('');
  const [staffPasswordInput, setStaffPasswordInput] = useState<string>('');
  const [staffError, setStaffError] = useState<string>('');
  const [staffSuccess, setStaffSuccess] = useState<boolean>(false);
  const [rememberMeStaff, setRememberMeStaff] = useState<boolean>(true);

  const handleStaffOwnerMobileChange = (val: string) => {
    setStaffOwnerMobile(val);
    setStaffError('');
    const cleanInput = normalizePhone(val);
    if (cleanInput.length >= 5) {
      const match = tenants.find(t => {
        const cleanOwner = normalizePhone(t.ownerMobile);
        return cleanOwner.length >= 5 && (cleanOwner.includes(cleanInput) || cleanInput.includes(cleanOwner));
      });
      setStaffDetectedOrg(match || null);
      if (match) {
        setStaffTenantId(match.id);
      }
    } else {
      setStaffDetectedOrg(null);
    }
  };

  // PIN Login states
  const [pinInput, setPinInput] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('Admin');
  const [pinError, setPinError] = useState<string>('');

  // Register New Organization Modal
  const [showRegisterOrg, setShowRegisterOrg] = useState<boolean>(false);
  const [regStep, setRegStep] = useState<number>(1);
  const [regOrgName, setRegOrgName] = useState<string>('');
  const [regOrgMobile, setRegOrgMobile] = useState<string>('');
  const [regOrgOwner, setRegOrgOwner] = useState<string>('');
  const [regOrgPin, setRegOrgPin] = useState<string>('1234');
  const [regSecretKey, setRegSecretKey] = useState<string>('');

  // Master Admin Directory Visibility state
  const [showAdminDirectory, setShowAdminDirectory] = useState<boolean>(false);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setMobileSubmitted(false);
      setMobileError('');
      setTotpInputCode('');
      setTotpError('');
      setTotpSuccess(false);
      setPinInput('');
      setPinError('');

      // Auto-restore remembered mobile number if stored on this machine
      try {
        const savedMobile = localStorage.getItem('remembered_login_mobile');
        if (savedMobile) {
          const parsed = JSON.parse(savedMobile);
          if (parsed && parsed.mobileInput) {
            setMobileInput(parsed.mobileInput);
            setRememberMeMobile(true);
            const cleanInput = normalizePhone(parsed.mobileInput);
            if (cleanInput.length >= 5) {
              const match = tenants.find(t => {
                const cleanOwner = normalizePhone(t.ownerMobile);
                return cleanOwner.length >= 5 && (cleanOwner.includes(cleanInput) || cleanInput.includes(cleanOwner));
              });
              setDetectedTenant(match || null);
            }
          }
        } else {
          setDetectedTenant(null);
          setMobileInput('+91 ');
        }
      } catch (e) {
        setDetectedTenant(null);
        setMobileInput('+91 ');
      }

      // Auto-restore remembered staff credentials if stored on this machine
      try {
        const savedStaff = localStorage.getItem('remembered_login_staff');
        if (savedStaff) {
          const parsed = JSON.parse(savedStaff);
          if (parsed) {
            if (parsed.ownerMobile) {
              setStaffOwnerMobile(parsed.ownerMobile);
              const cleanInput = normalizePhone(parsed.ownerMobile);
              if (cleanInput.length >= 5) {
                const match = tenants.find(t => {
                  const cleanOwner = normalizePhone(t.ownerMobile);
                  return cleanOwner.length >= 5 && (cleanOwner.includes(cleanInput) || cleanInput.includes(cleanOwner));
                });
                setStaffDetectedOrg(match || null);
                if (match) setStaffTenantId(match.id);
              }
            }
            if (parsed.username) {
              setStaffUserInput(parsed.username);
            }
            setRememberMeStaff(true);
          }
        }
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Dynamic search as user types mobile number
  const handleMobileInputChange = (value: string) => {
    setMobileInput(value);
    setMobileSubmitted(false);
    setMobileError('');
    setTotpError('');

    const cleanInput = normalizePhone(value);
    if (cleanInput.length >= 5) {
      const match = tenants.find(t => {
        const cleanOwner = normalizePhone(t.ownerMobile);
        return cleanOwner.length >= 5 && (cleanOwner.includes(cleanInput) || cleanInput.includes(cleanOwner));
      });
      setDetectedTenant(match || null);
    } else {
      setDetectedTenant(null);
    }
  };

  // Handle Mobile Number Verification
  const handleRequestApproval = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileError('');
    setTotpError('');
    setTotpSuccess(false);
    setTotpInputCode('');
    
    const cleanInput = normalizePhone(mobileInput);
    if (!cleanInput || cleanInput.length < 5) {
      setMobileError('Please enter a valid mobile number with at least 10 digits.');
      return;
    }

    // Find organization matching this mobile number
    const match = tenants.find(t => {
      const cleanOwner = normalizePhone(t.ownerMobile);
      return cleanOwner.length >= 5 && (cleanOwner.includes(cleanInput) || cleanInput.includes(cleanOwner));
    });

    if (match) {
      if (match.status === 'deactivated') {
        setDetectedTenant(match);
        setMobileSubmitted(false);
        setMobileError(`🔒 ACCOUNT DEACTIVATED: Organization "${match.name}" has been deactivated by Platform Master Admin. Login access is blocked.`);
        return;
      }
      if (rememberMeMobile) {
        localStorage.setItem('remembered_login_mobile', JSON.stringify({ mobileInput }));
      } else {
        localStorage.removeItem('remembered_login_mobile');
      }
      setDetectedTenant(match);
      setMobileSubmitted(true);
    } else {
      setDetectedTenant(null);
      setMobileSubmitted(false);
      setMobileError(`Mobile number "${mobileInput}" is not registered with any organization. Please verify mobile or contact administrator.`);
    }
  };

  // Handle Microsoft Authenticator 6-Digit Code Verification
  const handleTotpVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    setTotpSuccess(false);

    const cleanCode = totpInputCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setTotpError('Please enter a valid 6-digit passcode from Microsoft Authenticator app.');
      return;
    }

    if (!detectedTenant) {
      setTotpError('No active organization detected for this mobile number.');
      return;
    }

    setIsVerifyingTotp(true);
    let isValid = await verifyTOTPViaApi(detectedTenant.secretKey || 'INOMSSECRET2FAKEY', cleanCode);
    if (!isValid) {
      isValid = await verifyTOTP(detectedTenant.secretKey || 'INOMSSECRET2FAKEY', cleanCode);
    }

    if (isValid) {
      if (rememberMeMobile) {
        localStorage.setItem('remembered_login_mobile', JSON.stringify({ mobileInput }));
      } else {
        localStorage.removeItem('remembered_login_mobile');
      }
      setTotpSuccess(true);
      setIsVerifyingTotp(false);
      setTimeout(() => {
        onAuthenticated(detectedTenant, detectedTenant.id === 'org-admin' ? 'Admin' : 'Org Admin');
      }, 600);
    } else {
      setIsVerifyingTotp(false);
      setTotpError('Invalid 6-digit code. Please check Microsoft Authenticator app on your mobile device.');
    }
  };

  // Handle Staff & Technician Login Submit via Backend API
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    setStaffSuccess(false);

    const cleanOwnerPhone = normalizePhone(staffOwnerMobile);
    if (!cleanOwnerPhone || cleanOwnerPhone.length < 5) {
      setStaffError("Please enter a valid Organization Owner's Mobile Number (at least 10 digits).");
      return;
    }

    const selectedOrg = staffDetectedOrg || tenants.find(t => {
      const cleanOwner = normalizePhone(t.ownerMobile);
      return cleanOwner.length >= 5 && (cleanOwner.includes(cleanOwnerPhone) || cleanOwnerPhone.includes(cleanOwner));
    }) || tenants.find(t => t.id === staffTenantId) || tenants[0] || INITIAL_TENANTS[0];

    if (!selectedOrg) {
      setStaffError(`No organization found for Owner Mobile "${staffOwnerMobile}". Please check the phone number.`);
      return;
    }

    const cleanInput = staffUserInput.trim().toLowerCase();
    const cleanPass = staffPasswordInput.trim();

    if (!cleanInput) {
      setStaffError('Please enter your Mobile Number or Username.');
      return;
    }

    const saveStaffMemory = () => {
      if (rememberMeStaff) {
        localStorage.setItem('remembered_login_staff', JSON.stringify({
          ownerMobile: staffOwnerMobile,
          username: staffUserInput
        }));
      } else {
        localStorage.removeItem('remembered_login_staff');
      }
    };

    const isAdminOrgSelected = selectedOrg && (selectedOrg.id === 'org-admin' || selectedOrg.code?.toUpperCase() === 'ADMIN-00' || selectedOrg.ownerMobile?.includes('8149862034'));

    if (selectedOrg && selectedOrg.status === 'deactivated' && !isAdminOrgSelected) {
      setStaffError(`🔒 ACCOUNT DEACTIVATED: Organization "${selectedOrg.name}" has been deactivated.`);
      return;
    }

    let systemUsersList: SystemUser[] = [];
    if (selectedOrg) {
      const savedOrgUsers = getAppStorageItem(`users_${selectedOrg.id}`);
      if (savedOrgUsers) {
        try {
          const parsed = JSON.parse(savedOrgUsers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            systemUsersList = parsed;
          }
        } catch (e) {}
      }
    }
    if (systemUsersList.length === 0) {
      if (selectedOrg?.id === 'org-admin') {
        systemUsersList = [MASTER_ADMIN_USER];
      } else {
        systemUsersList = INITIAL_ORG_USERS;
      }
    }

    if (selectedOrg?.id === 'org-admin') {
      const hasMasterAdmin = systemUsersList.some(u => u.mobile?.includes('8149862034') || u.username === 'scrova');
      if (!hasMasterAdmin && MASTER_ADMIN_USER) {
        systemUsersList = [MASTER_ADMIN_USER, ...systemUsersList];
      }
    } else {
      systemUsersList = systemUsersList.filter(u => !u.mobile?.includes('8149862034') && u.username !== 'scrova' && u.email !== 'admin@mastersystem.com' && u.name !== 'Master System Admin');
    }

    // Attempt Secure Backend API Login first
    const apiResult = await staffLoginViaApi(cleanInput, cleanPass, systemUsersList);
    if (apiResult.success && apiResult.user) {
      saveStaffMemory();
      setStaffSuccess(true);
      setTimeout(() => {
        onAuthenticated(selectedOrg, apiResult.role || apiResult.user.role || 'Staff', apiResult.user);
      }, 500);
      return;
    } else if (apiResult.message && apiResult.message.includes('DEACTIVATED')) {
      setStaffError(apiResult.message);
      return;
    }

    // Fallback match check
    const cleanPhone = normalizePhone(staffUserInput);
    const match = systemUsersList.find(u => {
      const uUsername = u.username.trim().toLowerCase();
      const uMobile = normalizePhone(u.mobile);
      return uUsername === cleanInput || (cleanPhone.length >= 5 && uMobile.includes(cleanPhone));
    });

    if (match) {
      if (match.isDeactivated || match.status === 'Deactivated') {
        setStaffError(`🔒 ACCOUNT DEACTIVATED: User "${match.name}" (${match.role}) has been deactivated.`);
        return;
      }
      const userPassword = (match.password || match.pin || '1234').trim();
      const isCorrectPassword = (cleanPass === userPassword) || (!match.password && !match.pin && (cleanPass === '1234' || !cleanPass));
      if (isCorrectPassword) {
        saveStaffMemory();
        setStaffSuccess(true);
        setTimeout(() => {
          onAuthenticated(selectedOrg, match.role, match);
        }, 500);
      } else {
        setStaffError('Incorrect Password or PIN. Please check with your Organization Administrator.');
      }
    } else {
      if (cleanInput === 'jackie' || cleanInput.includes('9188160629') || cleanInput.includes('tech')) {
        const defaultTech: SystemUser = {
          id: 'u2',
          name: 'Jackie A',
          mobile: '9188160629',
          email: 'test@gmail.com',
          username: 'jackie',
          password: '1234',
          pin: '1234',
          role: 'Technician',
          permissions: { dashboard: true, operations: true, accounts: false, setup: false, reports: false }
        };
        saveStaffMemory();
        setStaffSuccess(true);
        setTimeout(() => {
          onAuthenticated(selectedOrg, 'Technician', defaultTech);
        }, 500);
      } else {
        setStaffError(apiResult.message || `Staff user "${staffUserInput}" not found in ${selectedOrg.name}.`);
      }
    }
  };

  // Handle Master Admin Microsoft Authenticator 2FA Login via Backend API
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    const cleanCode = pinInput.replace(/\D/g, '');

    if (cleanCode.length !== 6) {
      setPinError('Please enter a valid 6-digit passcode from Microsoft Authenticator app.');
      return;
    }

    const adminOrg = tenants.find(t => t.ownerMobile.includes('8149862034') || t.id === 'org-admin' || t.code === 'ADMIN-00') || INITIAL_TENANTS[0];

    let isValid = await verifyMasterPinViaApi(cleanCode);
    if (!isValid) {
      isValid = await verifyTOTP(adminOrg.secretKey || 'MASTERADMIN2FA37', cleanCode);
    }

    if (isValid) {
      onAuthenticated(adminOrg, 'Admin');
    } else {
      setPinError('Invalid 6-digit passcode. Please open Microsoft Authenticator app on your smartphone.');
    }
  };

  // Handle Register New Organization via Backend API
  const handleProceedTo2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOrgName || !regOrgMobile) return;
    setRegSecretKey(generateBase32Secret(regOrgName + regOrgMobile));
    setRegStep(2);
  };

  const handleFinalizeRegistration = async () => {
    if (!regOrgName || !regOrgMobile) return;

    const apiRes = await registerOrgViaApi(regOrgName, regOrgMobile, regOrgOwner, regOrgPin);
    const newOrg: TenantOrg = (apiRes.success && apiRes.org) ? apiRes.org : {
      id: `org-${Date.now()}`,
      name: regOrgName.trim(),
      code: `${regOrgName.substring(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      pin: regOrgPin.trim() || '1234',
      ownerMobile: regOrgMobile.trim(),
      ownerName: regOrgOwner.trim() || 'Owner',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      secretKey: regSecretKey
    };

    onRegisterOrg(newOrg);
    setDetectedTenant(newOrg);
    setMobileInput(newOrg.ownerMobile);
    setShowRegisterOrg(false);
    setRegStep(1);
    
    // Auto-authenticate into new org
    onAuthenticated(newOrg, 'Admin');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/20 border border-teal-400/30 rounded-2xl text-teal-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Welcome to INOMS</h2>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30">
                  Management made easy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">Mobile Approval & Organization Isolation System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                title="Close Window"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">

          {/* Registration Drawer inside Modal */}
          {showRegisterOrg && (
            <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
              
              <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold">Step {regStep}/2</span>
                  <h4 className="text-xs font-bold text-teal-900 uppercase flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-teal-700" />
                    {regStep === 1 ? 'Register New Organization Workspace' : 'Microsoft Authenticator 2FA Setup'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterOrg(false);
                    setRegStep(1);
                  }}
                  className="text-xs text-slate-500 font-bold hover:text-slate-800 cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {regStep === 1 ? (
                <form onSubmit={handleProceedTo2FA} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Company / Organization Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Yash Technologies"
                        value={regOrgName}
                        onChange={e => setRegOrgName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Registered Owner Mobile Number</label>
                      <input
                        type="text"
                        required
                        placeholder="+91 9123456789"
                        value={regOrgMobile}
                        onChange={e => setRegOrgMobile(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Owner / Admin Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Yash Sharma"
                        value={regOrgOwner}
                        onChange={e => setRegOrgOwner(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRegisterOrg(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 font-bold hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Next: Setup Microsoft Authenticator 2FA →
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="bg-white p-4 rounded-2xl border border-teal-200">
                    <MicrosoftAuthQR
                      orgName={regOrgName || 'New Organization'}
                      ownerMobile={regOrgMobile || '+91 9999999999'}
                      secretKey={regSecretKey}
                      title="Scan QR Code with Microsoft Authenticator"
                      subtitle="Open Microsoft Authenticator app on your smartphone and scan this QR code to finish linking your organization."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="px-3 py-1.5 text-xs text-slate-700 font-bold bg-slate-200 hover:bg-slate-300 rounded-xl cursor-pointer"
                    >
                      ← Back to Details
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalizeRegistration}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Complete Registration & Launch Workspace
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Private Workspace Privacy Notice Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Workspace Access</p>
                <p className="text-[11px] text-slate-500">Enter your registered mobile number below to authenticate into your organization.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAdminDirectory(!showAdminDirectory);
                setAdminPinError('');
              }}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white border border-teal-200 px-2.5 py-1 rounded-xl shadow-xs cursor-pointer hover:bg-teal-50 transition"
            >
              {showAdminDirectory ? 'Hide Admin List' : '🔑 Admin Directory'}
            </button>
          </div>

          {/* Master Admin Directory (Protected by Master PIN) */}
          {showAdminDirectory && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 border border-slate-800 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-teal-400" /> Registered Organizations Directory (Admin Master View)
                </h4>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  Total Workspaces: {tenants.length}
                </span>
              </div>

              {!adminUnlocked ? (
                <div className="space-y-2 py-1">
                  <p className="text-xs text-slate-300">
                    Enter 6-digit Microsoft Authenticator Code to unlock Master Admin Directory:
                  </p>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={adminPinInput}
                      onChange={e => {
                        setAdminPinInput(e.target.value.replace(/\D/g, ''));
                        setAdminPinError('');
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold tracking-widest outline-none focus:ring-1 focus:ring-teal-400 flex-1 text-center"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const isValid = await verifyMasterPinViaApi(adminPinInput);
                        if (isValid) {
                          setAdminUnlocked(true);
                          setAdminPinError('');
                        } else {
                          setAdminPinError('Invalid 6-digit Microsoft Authenticator passcode.');
                        }
                      }}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-3 py-1.5 text-xs rounded-xl cursor-pointer transition"
                    >
                      Unlock Directory
                    </button>
                  </div>
                  {adminPinError && (
                    <p className="text-[11px] text-rose-400 font-medium">{adminPinError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-300">
                    Select an organization workspace below to switch directly as Master System Admin:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {tenants.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setMobileInput(t.ownerMobile);
                          setDetectedTenant(t);
                          setMobileSubmitted(false);
                          setMobileError('');
                          setShowAdminDirectory(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                          detectedTenant?.id === t.id
                            ? 'bg-teal-950 border-teal-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-teal-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded font-mono">
                            {t.code}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Owner Mobile: <strong className="text-slate-300">{t.ownerMobile}</strong>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auth Method Navigation Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setAuthMethod('mobile_2fa')}
              className={`flex-1 py-2.5 px-2 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMethod === 'mobile_2fa'
                  ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Organisation Owner Login</span>
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod('staff_login')}
              className={`flex-1 py-2.5 px-2 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMethod === 'staff_login'
                  ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Staff & Technician Login</span>
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod('pin_passcode')}
              className={`flex-1 py-2.5 px-2 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMethod === 'pin_passcode'
                  ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Key className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Admin</span>
            </button>
          </div>

          {/* Method 1: Mobile Number Login & Microsoft Authenticator 2FA */}
          {authMethod === 'mobile_2fa' && (
            <div className="space-y-4">
              
              {/* Mobile Input Form */}
              <form onSubmit={handleRequestApproval} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Enter Registered Mobile Number</span>
                    {detectedTenant ? (
                      <span className="text-[11px] text-teal-800 font-bold bg-teal-100/90 px-2.5 py-0.5 rounded-full border border-teal-300 flex items-center gap-1 shadow-xs animate-in fade-in duration-150">
                        🏢 Workspace: {detectedTenant.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        (Workspace detected automatically upon typing)
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        placeholder="+91 9861606292 or 9123456789"
                        value={mobileInput}
                        onChange={e => handleMobileInputChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      <Smartphone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                    </div>
                    <button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <Search className="w-3.5 h-3.5" /> Verify Mobile
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMeMobile}
                        onChange={(e) => setRememberMeMobile(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                      />
                      <span>Remember my mobile number on this machine</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Saved in browser cache</span>
                  </div>
                </div>

                {mobileError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <p className="text-xs text-rose-700 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" /> {mobileError}
                    </p>
                  </div>
                )}
              </form>

              {/* Microsoft Authenticator Code Verification */}
              {mobileSubmitted && detectedTenant && (
                <div className="space-y-4 animate-in fade-in duration-200 border-t border-slate-100 pt-3">
                  
                  {/* Authenticator Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-400 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          Microsoft Authenticator 2FA
                          <span className="bg-teal-500/20 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                            {detectedTenant.name}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Account Phone: <strong className="text-white">{detectedTenant.ownerMobile}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 6-Digit Code Input Box */}
                  <form onSubmit={handleTotpVerificationSubmit} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Enter 6-Digit Code from Microsoft Authenticator:</span>
                        <span className="text-[10px] text-teal-700 font-mono font-bold bg-teal-100/60 px-2 py-0.5 rounded">
                          Mobile 2FA
                        </span>
                      </label>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            maxLength={6}
                            required
                            autoFocus
                            placeholder="000000"
                            value={totpInputCode}
                            onChange={e => {
                              setTotpInputCode(e.target.value.replace(/\D/g, ''));
                              setTotpError('');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-lg font-mono tracking-[0.25em] font-bold text-slate-900 text-center focus:ring-2 focus:ring-teal-500 outline-none"
                          />
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                        </div>

                        <button
                          type="submit"
                          disabled={isVerifyingTotp}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-md shrink-0"
                        >
                          {isVerifyingTotp ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>Verify & Login</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {totpError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> {totpError}
                      </div>
                    )}

                    {totpSuccess && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                        <span>✓ Passcode Verified! Opening {detectedTenant.name}...</span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Open <strong>Microsoft Authenticator</strong> app on your smartphone ({detectedTenant.ownerMobile}) and type the current 6-digit passcode for <strong>{detectedTenant.name}</strong>.
                    </p>
                  </form>

                </div>
              )}

            </div>
          )}

          {/* Method 2: Staff & Technician Login */}
          {authMethod === 'staff_login' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Technician & Staff Workspace Portal</h4>
                    <p className="text-[11px] text-slate-300">Login for Technicians, Engineers, Front Desk, & Staff</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStaffSubmit} className="space-y-3.5 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Organization Owner Mobile Number</span>
                    {staffDetectedOrg && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ {staffDetectedOrg.name} ({staffDetectedOrg.code})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={staffOwnerMobile}
                      onChange={(e) => handleStaffOwnerMobileChange(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 font-mono outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {!staffDetectedOrg && staffOwnerMobile.length >= 3 && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      ⚠️ Enter 10-digit Organization Owner phone number to display organization name.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Username or Mobile Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. staff_user or 9876543210"
                      value={staffUserInput}
                      onChange={(e) => {
                        setStaffUserInput(e.target.value);
                        setStaffError('');
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Password / Security PIN</label>
                    <input
                      type="password"
                      placeholder="Enter password or PIN"
                      value={staffPasswordInput}
                      onChange={(e) => {
                        setStaffPasswordInput(e.target.value);
                        setStaffError('');
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMeStaff}
                      onChange={(e) => setRememberMeStaff(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Remember me on this machine</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-fill on this PC</span>
                </div>

                {staffError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> {staffError}
                  </div>
                )}

                {staffSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-1.5 animate-pulse">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                    <span>✓ Staff Login Verified! Opening Workspace...</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-500">
                    <strong>Demo Tech Creds:</strong> <code>jackie</code> / <code>1234</code>
                  </p>
                  <button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <User className="w-4 h-4" />
                    <span>Login as Technician / Staff</span>
                  </button>
                </div>
              </form>

              <div className="bg-teal-50/80 border border-teal-200/80 p-3 rounded-2xl text-[11px] text-teal-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Where do Organization Admins manage Technicians?</p>
                  <p className="text-teal-800 mt-0.5 leading-relaxed">
                    Log in as Organization Owner first, then navigate to <strong>Settings → Admin Control → Diagnostics Staff list</strong> to create or update Technicians with custom Username, Mobile, Password, and menu access privileges.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Method 3: Master Admin Microsoft Authenticator 2FA */}
          {authMethod === 'pin_passcode' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Admin Authenticator</h4>
                    <p className="text-[11px] text-slate-300">Security Access: <strong className="text-teal-300">Master Admin 2FA (+91 ********34)</strong></p>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Enter 6-Digit Code from Microsoft Authenticator:</span>
                  <span className="text-[10px] text-teal-800 font-mono font-bold bg-teal-100 px-2 py-0.5 rounded">
                    Master 2FA
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={pinInput}
                    onChange={e => {
                      setPinInput(e.target.value.replace(/\D/g, ''));
                      setPinError('');
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-lg font-mono tracking-[0.25em] font-bold text-slate-900 text-center focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <Lock className="w-5 h-5 text-slate-400 absolute right-4 top-3.5" />
                </div>

                {pinError && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {pinError}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Open <strong>Microsoft Authenticator</strong> app on your device and enter the active 6-digit passcode to log in as Master System Admin.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Verify & Login as Master Admin
              </button>
            </form>
          </div>
        )}

        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 p-3.5 text-center text-xs text-slate-500 flex items-center justify-between px-6">
          <span>🔐 Multi-Tenant Data Isolation Active</span>
          <span className="text-[11px] font-semibold text-slate-400">SaaS Workspace Security</span>
        </div>

      </div>
    </div>
  );
}
