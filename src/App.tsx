/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Wallet,
  Receipt,
  Package,
  PiggyBank,
  Settings,
  TrendingUp,
  Building,
  ShieldCheck,
  ChevronDown,
  Bell,
  RefreshCw,
  LogOut,
  UserCheck,
  BookOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Kanban,
  Menu,
  X,
  WifiOff,
  Wifi
} from 'lucide-react';

import { getDirectoryHandle, getLatestBackupFromDirectoryHandle, writeBackupToDirectoryHandle } from './lib/directoryHandleStorage';
import { getBackupOrgPrefix } from './lib/backupUtils';
import { getOrgPrefix } from './lib/orgUtils';
import {
  getAppStorageItem,
  setAppStorageItem,
  getAppSessionItem,
  setAppSessionItem,
  removeAppSessionItem
} from './lib/storage';

import {
  getHomeServerDbKey,
  saveHomeServerDbKey,
  restoreHomeServerDb,
  registerHomeServerSession,
  checkHomeServerSession
} from './lib/api';

import {
  bootstrapTenantFromHomeServer,
  pullDeltaFromHomeServer,
  pushPendingOperations,
  getPendingOperationsCount,
  getAuthToken
} from './lib/localDb';

// Modular Components
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Inwards from './components/Inwards';
import LiveRepairQueue from './components/LiveRepairQueue';
import Outwards from './components/Outwards';
import Billing from './components/Billing';
import Payments from './components/Payments';
import Inventory from './components/Inventory';
import Expenses from './components/Expenses';
import SettingsComponent from './components/Settings';
import Reports from './components/Reports';
import AuthModal, { TenantOrg, SystemAnnouncement, INITIAL_TENANTS } from './components/AuthModal';
import MasterAdminDashboard from './components/MasterAdminDashboard';
import {
  subscribeTenants,
  saveTenantToFirestore,
  deleteTenantFromFirestore,
  saveCompanyConfigToFirestore,
  subscribeCompanyConfig,
  subscribeTenantCollection,
  saveTenantCollectionToFirestore,
  subscribeAnnouncements,
  saveAnnouncementToFirestore,
  deleteAnnouncementFromFirestore,
  saveUserSessionToFirestore,
  subscribeUserSession,
  isQuotaExhausted,
  getPendingQueueCount,
  clearPendingQueue,
  retryPendingCloudSync
} from './lib/firebase';

// Data Mock repos
import {
  INITIAL_CLIENTS,
  INITIAL_LEDGER,
  INITIAL_JOBS,
  INITIAL_PAYMENTS,
  INITIAL_INVOICES,
  INITIAL_PRODUCTS,
  INITIAL_EXPENSES,
  MASTER_ADMIN_USER,
  INITIAL_ORG_USERS,
  INITIAL_USERS,
  INITIAL_LOGS,
  EQUIPMENT_TYPES,
  COMMON_PROBLEMS,
  INITIAL_CATEGORIES,
  INITIAL_RACKS
} from './data';

import {
  Client,
  ClientLedgerEntry,
  RepairJob,
  Payment,
  Invoice,
  Product,
  Expense,
  SystemUser,
  ActivityLog,
  Equipment,
  Problem,
  Category,
  LocationRack,
  CompanyConfig,
  DEFAULT_THEME_PALETTE,
  TenantThemePalette,
  getEffectiveBillAmount,
  sortJobsByLatest,
  AddonPricingConfig,
  MasterAdminInvoice,
  DEFAULT_ADDON_PRICING
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  
  // Helper to construct tenant-isolated default company config
  const getDefaultCompanyConfig = (tenant: TenantOrg): CompanyConfig => {
    if (tenant.id === 'org-admin' || tenant.code === 'ADMIN-00' || tenant.ownerMobile?.includes('8149862034')) {
      return {
        name: 'Master System Admin',
        address: 'Badambadi, Cuttack, Odisha',
        phone: '+91 8149862034',
        email: 'admin@mastersystem.com',
        website: 'www.mastersystem.com',
        gstin: '21AJDSBSDWERDS',
        syncMode: 'offline',
        lanHostIp: '192.168.25.10',
        driveConnected: false,
        autoBackupTimes: ['10:00', '18:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\INOMS_Backups\\',
        localBackupScheduleTime: '18:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: '2026-07-26 08:00:00'
      };
    } else if (tenant.id === 'org-nibban' || tenant.code === 'NIBBAN-01' || tenant.name === 'Nibban Technologies' || tenant.id === 'org-inoms') {
      return {
        name: 'INOMS Enterprises',
        address: 'Link Road, Cuttack, Odisha',
        phone: '+91 9876543210',
        email: 'support@inoms.com',
        website: 'www.inoms.com',
        gstin: '21INOMS1234F1Z',
        syncMode: 'offline',
        lanHostIp: '192.168.1.15',
        driveConnected: false,
        autoBackupTimes: ['12:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\INOMS_Backups\\',
        localBackupScheduleTime: '20:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: '2026-07-26 12:00:00'
      };
    } else {
      return {
        name: tenant.name,
        address: 'Main Office',
        phone: tenant.ownerMobile || '',
        email: `contact@${tenant.code?.toLowerCase() || 'org'}.com`,
        website: `www.${tenant.code?.toLowerCase() || 'org'}.com`,
        gstin: '',
        syncMode: 'offline',
        lanHostIp: '192.168.1.100',
        driveConnected: false,
        autoBackupTimes: ['18:00'],
        localBackupEnabled: true,
        localBackupPath: 'C:\\Backups\\',
        localBackupScheduleTime: '18:00',
        localBackupFrequency: 'on_sync',
        lastLocalBackupTime: ''
      };
    }
  };

  // Helper to ensure Master System Admin org exists and strip unrequested demo tenants & duplicates
  const ensureAdminActive = (list: TenantOrg[]) => {
    let result = list.filter(t => t && t.code !== 'SCROVA-01' && t.code !== 'NIBBAN-01' && t.id !== 'org-nibban' && t.id !== 'org-yash');
    const hasAdminOrg = result.some(t => t.id === 'org-admin' || t.ownerMobile?.includes('8149862034'));
    if (!hasAdminOrg) {
      result = [INITIAL_TENANTS[0], ...result];
    }
    
    // Deduplicate by ID and (name + cleanMobile)
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const deduped: TenantOrg[] = [];

    for (const t of result) {
      if (!t || !t.id || seenIds.has(t.id)) continue;
      seenIds.add(t.id);

      const cleanMobile = (t.ownerMobile || '').replace(/\D/g, '');
      const cleanName = (t.name || '').trim().toLowerCase();
      const isMasterAdmin = t.id === 'org-admin' || cleanMobile === '8149862034' || t.code?.toUpperCase() === 'ADMIN-00';
      const dedupeKey = isMasterAdmin ? 'org-admin' : `${cleanName}_${cleanMobile}`;

      if (!isMasterAdmin && cleanMobile && seenKeys.has(dedupeKey)) {
        continue;
      }
      if (dedupeKey) seenKeys.add(dedupeKey);

      if (isMasterAdmin) {
        deduped.push({
          ...t,
          id: 'org-admin',
          name: 'Master System Admin',
          ownerName: 'Master System Admin',
          ownerMobile: '+91 8149862034',
          status: 'active' as const
        });
      } else {
        deduped.push(t);
      }
    }

    return deduped;
  };

  // Multi-Tenant Organizations State
  const [tenants, setTenants] = useState<TenantOrg[]>(() => {
    try {
      const saved = getAppStorageItem('tenants_v3');
      const parsed = saved ? JSON.parse(saved) : INITIAL_TENANTS;
      return ensureAdminActive(Array.isArray(parsed) ? parsed : INITIAL_TENANTS);
    } catch {
      return ensureAdminActive(INITIAL_TENANTS);
    }
  });

  const [activeTenant, setActiveTenant] = useState<TenantOrg>(() => {
    const saved = getAppStorageItem('active_tenant_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id === 'org-admin' || parsed.id === 'org-nibban' || parsed.code?.toUpperCase() === 'NIBBAN' || parsed.code?.toUpperCase() === 'ADMIN') {
          return { ...parsed, status: 'active' };
        }
        return parsed;
      } catch (e) {}
    }
    return INITIAL_TENANTS[0];
  });

  // Lifted Company Config state strictly isolated by active tenant
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(() => {
    const saved = getAppStorageItem(`company_config_${activeTenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (activeTenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
            return getDefaultCompanyConfig(activeTenant);
          }
          return {
            ...getDefaultCompanyConfig(activeTenant),
            ...parsed,
            name: parsed.name || activeTenant.name,
            phone: parsed.phone || activeTenant.ownerMobile
          };
        }
      } catch (e) {}
    }
    return getDefaultCompanyConfig(activeTenant);
  });

  // Track which tenant ID the currently loaded companyConfig belongs to
  const configTenantIdRef = React.useRef<string>(activeTenant.id);

  const [activeCompany, setActiveCompany] = useState<string>(companyConfig.name);
  
  // Font size setting state with localStorage persistence
  const [fontSize, setFontSize] = useState<string>(() => {
    return getAppStorageItem('app_font_size') || '16';
  });

  React.useEffect(() => {
    setAppStorageItem('tenants_v3', JSON.stringify(tenants));
  }, [tenants]);

  React.useEffect(() => {
    setAppStorageItem('active_tenant_v3', JSON.stringify(activeTenant));
  }, [activeTenant]);

  // Load tenant-specific company config when active tenant switches
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    configTenantIdRef.current = activeTenant.id;
    const savedForTenant = getAppStorageItem(`company_config_${activeTenant.id}`);
    const globalBrandingStr = getAppStorageItem('global_system_branding');
    let globalBranding: any = null;
    if (globalBrandingStr) {
      try { globalBranding = JSON.parse(globalBrandingStr); } catch (e) {}
    }

    if (savedForTenant) {
      try {
        const parsed = JSON.parse(savedForTenant);
        if (parsed && typeof parsed === 'object') {
          // If this is not the admin org but contains admin details, sanitize and clean it up
          if (activeTenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
            const clean = getDefaultCompanyConfig(activeTenant);
            if (globalBranding?.appLogoUrl) clean.appLogoUrl = globalBranding.appLogoUrl;
            if (globalBranding?.appName) clean.appName = globalBranding.appName;
            if (globalBranding?.appTagline) clean.appTagline = globalBranding.appTagline;
            setCompanyConfig(clean);
            setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(clean));
            return;
          }
          setCompanyConfig({
            ...getDefaultCompanyConfig(activeTenant),
            ...parsed,
            name: parsed.name || activeTenant.name,
            phone: parsed.phone || activeTenant.ownerMobile,
            appLogoUrl: parsed.appLogoUrl || globalBranding?.appLogoUrl || '/inoms_logo.jpg',
            appName: parsed.appName || globalBranding?.appName || 'INOMS',
            appTagline: parsed.appTagline || globalBranding?.appTagline || 'Integrated Inward & Outward Management System',
            localBackupFrequency: 'on_sync'
          });
          return;
        }
      } catch (e) {}
    }
    const defaultConfig = getDefaultCompanyConfig(activeTenant);
    if (globalBranding?.appLogoUrl) defaultConfig.appLogoUrl = globalBranding.appLogoUrl;
    if (globalBranding?.appName) defaultConfig.appName = globalBranding.appName;
    if (globalBranding?.appTagline) defaultConfig.appTagline = globalBranding.appTagline;
    setCompanyConfig(defaultConfig);
    setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(defaultConfig));
  }, [activeTenant?.id]);

  // Persist tenant company config when companyConfig changes
  const savedGlobalBranding = React.useMemo(() => {
    const saved = getAppStorageItem('global_system_branding');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  }, [companyConfig?.appName, companyConfig?.appTagline, companyConfig?.appLogoUrl]);

  const systemAppName = companyConfig.appName || savedGlobalBranding?.appName || 'INOMS';
  const systemAppTagline = companyConfig.appTagline || savedGlobalBranding?.appTagline || 'Integrated Inward & Outward Management System';
  const systemAppLogo = companyConfig.appLogoUrl || savedGlobalBranding?.appLogoUrl || companyConfig.logoUrl || '/inoms_logo.jpg';

  React.useEffect(() => {
    document.title = `${systemAppName} - ${systemAppTagline}`;
  }, [systemAppName, systemAppTagline]);

  React.useEffect(() => {
    if (!activeTenant?.id) return;
    if (configTenantIdRef.current !== activeTenant.id) return;

    setAppStorageItem(`company_config_${activeTenant.id}`, JSON.stringify(companyConfig));
    setActiveCompany(companyConfig.name || activeTenant.name);

    // Persist active tenant companyConfig to Cloud Firestore
    saveCompanyConfigToFirestore(activeTenant.id, companyConfig);

    // Synchronize global application branding ONLY if updated by Master Admin or if appLogoUrl is explicitly set
    const isMasterAdminOrg = activeTenant.id === 'org-admin' || activeTenant.code === 'ADMIN-00' || activeTenant.ownerMobile?.includes('8149862034');

    if (isMasterAdminOrg || companyConfig.appLogoUrl) {
      const globalBrandingPayload = {
        appName: systemAppName,
        appTagline: systemAppTagline,
        appLogoUrl: systemAppLogo
      };
      setAppStorageItem('global_system_branding', JSON.stringify(globalBrandingPayload));

      // Persist global_system_branding to Cloud Firestore so incognito / other devices receive logos & titles
      saveCompanyConfigToFirestore('global_system_branding', {
        ...companyConfig,
        ...globalBrandingPayload
      });
    }
  }, [companyConfig, activeTenant?.id, systemAppName, systemAppTagline, systemAppLogo]);

  React.useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    setAppStorageItem('app_font_size', fontSize);
  }, [fontSize]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return getAppSessionItem('authenticated') === 'true';
  });

  const [userRole, setUserRole] = useState<string>(() => {
    return getAppSessionItem('user_role') || 'Admin';
  });

  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = getAppSessionItem('current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(!isAuthenticated);

  const handleAuthenticated = (tenant: TenantOrg, role: string, loggedInUser?: SystemUser) => {
    setActiveTenant(tenant);
    setUserRole(role);
    setCurrentUser(loggedInUser || null);
    setIsAuthenticated(true);
    setShowAuthModal(false);
    setAppSessionItem('authenticated', 'true');
    setAppSessionItem('user_role', role);
    if (loggedInUser) {
      setAppSessionItem('current_user', JSON.stringify(loggedInUser));
    } else {
      removeAppSessionItem('current_user');
    }

    if (role === 'Admin') {
      setActiveTab('master_admin');
    } else {
      setActiveTab('dashboard');
    }

    // Sync company config with authenticated tenant details safely without inheriting previous tenant's assets
    const tenantConfig = (() => {
      const saved = getAppStorageItem(`company_config_${tenant.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            if (tenant.id !== 'org-admin' && (parsed.name === 'Master System Admin' || parsed.phone === '+91 8149862034')) {
              return getDefaultCompanyConfig(tenant);
            }
            return {
              ...getDefaultCompanyConfig(tenant),
              ...parsed,
              name: parsed.name || tenant.name,
              phone: parsed.phone || tenant.ownerMobile
            };
          }
        } catch (e) {}
      }
      return getDefaultCompanyConfig(tenant);
    })();
    setCompanyConfig(tenantConfig);
    setAppStorageItem(`company_config_${tenant.id}`, JSON.stringify(tenantConfig));

    // Load state corresponding to this tenant with fallback and legacy data support
    const tId = tenant.id;
    setClients(getTenantData('clients', tId, INITIAL_CLIENTS));
    setJobs(getTenantData('jobs', tId, INITIAL_JOBS));
    setInvoices(getTenantData('invoices', tId, INITIAL_INVOICES));
    setProducts(getTenantData('products', tId, INITIAL_PRODUCTS));
    setLedger(getTenantData('ledger', tId, INITIAL_LEDGER));
    setPayments(getTenantData('payments', tId, INITIAL_PAYMENTS));
    setExpenses(getTenantData('expenses', tId, INITIAL_EXPENSES));
    setUsers(getTenantData('users', tId, INITIAL_USERS));
    setLogs(getTenantData('logs', tId, INITIAL_LOGS));
    setCategories(getTenantData('categories', tId, INITIAL_CATEGORIES));
    setRacks(getTenantData('racks', tId, INITIAL_RACKS));
    setEquipments(getTenantData('equipments', tId, EQUIPMENT_TYPES));
    setProblems(getTenantData('problems', tId, COMMON_PROBLEMS));
  };

  // System Announcements & Broadcast State
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(() => {
    try {
      const saved = getAppStorageItem('announcements_v2');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [
      {
        id: 'ann-1',
        title: 'Platform System Announcement',
        message: 'All registered organizations have active Microsoft Authenticator 2FA security enabled.',
        targetTenantId: 'all',
        createdAt: '2026-07-24 10:00',
        severity: 'info',
        createdBy: 'Master Admin'
      },
      {
        id: 'ann-2',
        title: 'Scheduled Cloud Backup',
        message: 'Automated nightly sync scheduled at 11:30 PM. Active sessions will remain uninterrupted.',
        targetTenantId: 'all',
        createdAt: '2026-07-23 18:00',
        severity: 'warning',
        createdBy: 'Master Admin'
      }
    ];
  });

  React.useEffect(() => {
    setAppStorageItem('announcements_v2', JSON.stringify(announcements));
  }, [announcements]);

  // Subscribe to real-time Cloud Firestore updates for System Announcements
  React.useEffect(() => {
    const unsubscribe = subscribeAnnouncements((cloudAnnouncements) => {
      if (Array.isArray(cloudAnnouncements) && cloudAnnouncements.length > 0) {
        setAnnouncements(cloudAnnouncements);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time Cloud Firestore updates for Multi-Tenant Organizations
  React.useEffect(() => {
    const unsubscribe = subscribeTenants((cloudTenants) => {
      if (Array.isArray(cloudTenants) && cloudTenants.length > 0) {
        setTenants((prev) => {
          const mergedMap = new Map<string, TenantOrg>();
          prev.forEach(t => mergedMap.set(t.id, t));
          cloudTenants.forEach(ct => mergedMap.set(ct.id, ct));
          const updated = ensureAdminActive(Array.from(mergedMap.values()));
          setAppStorageItem('tenants_v3', JSON.stringify(updated));
          return updated;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRegisterOrg = async (newTenant: TenantOrg) => {
    // Immediately seed and store isolated company config for the new tenant
    const newOrgConfig = getDefaultCompanyConfig(newTenant);
    setAppStorageItem(`company_config_${newTenant.id}`, JSON.stringify(newOrgConfig));
    saveCompanyConfigToFirestore(newTenant.id, newOrgConfig);

    setTenants(prev => {
      const exists = prev.some(t => t.id === newTenant.id);
      if (exists) return prev;
      const next = [...prev, newTenant];
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      return next;
    });

    // Save to Firestore so it syncs instantly across all devices
    await saveTenantToFirestore(newTenant);
  };

  const handleUpdateTenant = async (updatedTenant: TenantOrg) => {
    setTenants(prev => {
      const next = prev.map(t => t.id === updatedTenant.id ? updatedTenant : t);
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      return next;
    });

    if (activeTenant.id === updatedTenant.id) {
      setActiveTenant(updatedTenant);
      setCompanyConfig(prev => ({
        ...prev,
        name: updatedTenant.name,
        phone: updatedTenant.ownerMobile
      }));
    }

    // Save to Firestore
    await saveTenantToFirestore(updatedTenant);
    triggerSaveNotification(`✓ Organization details for "${updatedTenant.name}" updated successfully!`);
  };

  const handleToggleTenantStatus = async (tenantId: string) => {
    const targetOrg = tenants.find(t => t.id === tenantId);
    if (targetOrg && (targetOrg.id === 'org-admin' || targetOrg.code?.toUpperCase() === 'ADMIN-00' || targetOrg.ownerMobile?.includes('8149862034'))) {
      triggerSaveNotification('🛡️ Security Guard: Master System Admin Organization (+91 8149862034) can NEVER be deactivated.', true);
      return;
    }

    let updatedTenant: TenantOrg | null = null;
    setTenants(prev => {
      const next = prev.map(t => {
        if (t.id === tenantId) {
          updatedTenant = {
            ...t,
            status: t.status === 'active' ? 'deactivated' : 'active'
          };
          return updatedTenant;
        }
        return t;
      });
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      return next;
    });

    if (updatedTenant) {
      await saveTenantToFirestore(updatedTenant);
      const nextState = (updatedTenant as TenantOrg).status === 'active' ? 'ACTIVATED' : 'DEACTIVATED';
      triggerSaveNotification(`✓ Account "${(updatedTenant as TenantOrg).name}" (${(updatedTenant as TenantOrg).code}) access ${nextState}!`);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    const targetOrg = tenants.find(t => t.id === tenantId);
    if (targetOrg && (targetOrg.id === 'org-admin' || targetOrg.code?.toUpperCase() === 'ADMIN-00' || targetOrg.ownerMobile?.includes('8149862034'))) {
      triggerSaveNotification('🛡️ Security Guard: Master System Admin Organization (+91 8149862034) can NEVER be deleted.', true);
      return;
    }

    setTenants(prev => {
      const next = prev.filter(t => t.id !== tenantId);
      setAppStorageItem('tenants_v3', JSON.stringify(next));
      return next;
    });

    await deleteTenantFromFirestore(tenantId);
    triggerSaveNotification(`✓ Account "${targetOrg?.name || tenantId}" permanently deleted!`);
  };

  // ACTIVE SESSION SECURITY GUARD: Log out active user if non-admin organization is deactivated or deleted
  React.useEffect(() => {
    if (isAuthenticated && activeTenant) {
      const isAdminOrg = activeTenant.id === 'org-admin' || activeTenant.id === 'org-nibban' || activeTenant.code?.toUpperCase() === 'NIBBAN' || activeTenant.code?.toUpperCase() === 'ADMIN' || userRole === 'Admin' || userRole === 'Master Admin';
      if (isAdminOrg) {
        // Master Admin & Admin accounts are fully protected and never logged out or blocked
        return;
      }

      const currentOrg = tenants.find(t => t.id === activeTenant.id);
      if (!currentOrg) {
        alert(`🔒 ACCESS TERMINATED: Organization "${activeTenant.name}" has been deleted by the System Administrator.`);
        setIsAuthenticated(false);
        removeAppSessionItem('authenticated');
        setShowAuthModal(true);
      } else if (currentOrg.status === 'deactivated') {
        alert(`🔒 ACCOUNT DEACTIVATED: Organization "${activeTenant.name}" access has been deactivated by the System Administrator.`);
        setIsAuthenticated(false);
        removeAppSessionItem('authenticated');
        setShowAuthModal(true);
      }
    }
  }, [tenants, activeTenant, isAuthenticated, userRole]);

  // Master Admin SaaS Invoices & Add-on Pricing Configuration States
  const [initialSaasBillingTenantId, setInitialSaasBillingTenantId] = useState<string | null>(null);

  const [pricingConfig, setPricingConfig] = useState<AddonPricingConfig>(() => {
    try {
      const saved = getAppStorageItem('master_admin_addon_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ADDON_PRICING;
  });

  const handleSavePricing = (newConfig: AddonPricingConfig) => {
    setPricingConfig(newConfig);
    try {
      setAppStorageItem('master_admin_addon_pricing_v1', JSON.stringify(newConfig));
    } catch {}
    triggerSaveNotification('✓ Add-on Pricing Matrix updated successfully!');
  };

  const [saasInvoices, setSaasInvoices] = useState<MasterAdminInvoice[]>(() => {
    try {
      const saved = getAppStorageItem('master_admin_saas_invoices_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'SAAS-1001',
        tenantId: 'org-1',
        tenantName: 'Dev Infotech',
        tenantCode: 'DEV-10',
        ownerMobile: '+91 9876543210',
        ownerName: 'Devendra Patel',
        date: '2026-07-01',
        dueDate: '2026-07-08',
        billingPeriod: 'Monthly',
        items: [
          { id: 'it-1', description: 'Core Enterprise ERP Platform License (Monthly)', addonKey: 'basePlatform', qty: 1, rate: 999, amount: 999 },
          { id: 'it-2', description: 'WhatsApp Automated Cloud Messaging Integration (1 Mo)', addonKey: 'whatsAppMessaging', qty: 1, rate: 499, amount: 499 },
          { id: 'it-3', description: 'Thermal Barcode & QR Code Tag Generation (1 Mo)', addonKey: 'barcodeQrTags', qty: 1, rate: 299, amount: 299 }
        ],
        subtotal: 1797,
        discount: 0,
        gstPercent: 18,
        gstAmount: 323,
        grandTotal: 2120,
        paymentStatus: 'Paid',
        paymentMode: 'UPI',
        notes: 'Monthly SaaS subscription active.',
        createdAt: '2026-07-01T10:00:00.000Z'
      }
    ];
  });

  const handleAddSaasInvoice = (inv: MasterAdminInvoice) => {
    const next = [inv, ...saasInvoices];
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${inv.id} generated for ${inv.tenantName}!`);
  };

  const handleUpdateSaasInvoice = (inv: MasterAdminInvoice) => {
    const next = saasInvoices.map(i => i.id === inv.id ? inv : i);
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${inv.id} updated successfully!`);
  };

  const handleDeleteSaasInvoice = (id: string) => {
    const next = saasInvoices.filter(i => i.id !== id);
    setSaasInvoices(next);
    try {
      setAppStorageItem('master_admin_saas_invoices_v1', JSON.stringify(next));
    } catch {}
    triggerSaveNotification(`✓ SaaS Bill #${id} deleted.`);
  };

  const handleSendAnnouncement = async (newAnn: Omit<SystemAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => {
    const announcement: SystemAnnouncement = {
      id: `ann-${Date.now()}`,
      ...newAnn,
      createdAt: new Date().toLocaleString('en-GB', { hour12: false }),
      createdBy: 'Master Admin'
    };
    setAnnouncements(prev => {
      const next = [announcement, ...prev];
      setAppStorageItem('announcements_v3', JSON.stringify(next));
      return next;
    });
    await saveAnnouncementToFirestore(announcement);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setAnnouncements(prev => {
      const next = prev.filter(a => a.id !== id);
      setAppStorageItem('announcements_v3', JSON.stringify(next));
      return next;
    });
    await deleteAnnouncementFromFirestore(id);
  };

  const handleLockSession = () => {
    setIsAuthenticated(false);
    removeAppSessionItem('authenticated');
    setShowAuthModal(true);
  };

  // Global Interactive React States with localStorage Persistence & Tenant Data Isolation
  const isDefaultActiveOrg = activeTenant.id === 'org-nibban';

  const getTenantData = <T,>(keySuffix: string, tenantId: string, fallback: T[]): T[] => {
    const saved = getAppStorageItem(`${keySuffix}_${tenantId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let items = parsed.map((item: any) => ({ ...item, tenantId: item.tenantId || tenantId }));
          if (keySuffix === 'users') {
            if (tenantId === 'org-admin') {
              const hasMasterAdmin = items.some((u: any) => u.mobile?.includes('8149862034') || u.username === 'scrova');
              if (!hasMasterAdmin && MASTER_ADMIN_USER) {
                items.unshift({ ...MASTER_ADMIN_USER, tenantId: 'org-admin' });
              }
            } else {
              items = items.filter((u: any) => !u.mobile?.includes('8149862034') && u.username !== 'scrova' && u.email !== 'admin@mastersystem.com' && u.name !== 'Master System Admin');
            }
          }
          return items;
        }
      } catch (e) {}
    }

    if (keySuffix === 'users') {
      if (tenantId === 'org-admin') {
        return [{ ...MASTER_ADMIN_USER, tenantId: 'org-admin' }] as unknown as T[];
      } else {
        const orgUsers = INITIAL_ORG_USERS.map((item: any) => ({ ...item, tenantId }));
        return orgUsers as unknown as T[];
      }
    }

    if (tenantId === 'org-nibban' || tenantId === 'org-admin') {
      return fallback.map((item: any) => ({ ...item, tenantId }));
    }
    return fallback.map((item: any) => ({ ...item, tenantId }));
  };

  const [clients, setClients] = useState<Client[]>(() => getTenantData('clients', activeTenant.id, INITIAL_CLIENTS));
  const [ledger, setLedger] = useState(() => getTenantData('ledger', activeTenant.id, INITIAL_LEDGER));
  const [jobs, setJobs] = useState<RepairJob[]>(() => getTenantData('jobs', activeTenant.id, INITIAL_JOBS));
  const [payments, setPayments] = useState<Payment[]>(() => getTenantData('payments', activeTenant.id, INITIAL_PAYMENTS));
  const [invoices, setInvoices] = useState<Invoice[]>(() => getTenantData('invoices', activeTenant.id, INITIAL_INVOICES));
  const [products, setProducts] = useState<Product[]>(() => getTenantData('products', activeTenant.id, INITIAL_PRODUCTS));
  const [expenses, setExpenses] = useState<Expense[]>(() => getTenantData('expenses', activeTenant.id, INITIAL_EXPENSES));
  const [users, setUsers] = useState<SystemUser[]>(() => getTenantData('users', activeTenant.id, INITIAL_USERS));
  const [logs, setLogs] = useState<ActivityLog[]>(() => getTenantData('logs', activeTenant.id, INITIAL_LOGS));
  const [categories, setCategories] = useState<Category[]>(() => getTenantData('categories', activeTenant.id, INITIAL_CATEGORIES));
  const [racks, setRacks] = useState<LocationRack[]>(() => getTenantData('racks', activeTenant.id, INITIAL_RACKS));
  const [equipments, setEquipments] = useState<Equipment[]>(() => getTenantData('equipments', activeTenant.id, EQUIPMENT_TYPES));
  const [problems, setProblems] = useState<Problem[]>(() => getTenantData('problems', activeTenant.id, COMMON_PROBLEMS));
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState<RepairJob | null>(null);

  // Synchronize state refs for safe access inside subscription callbacks
  const clientsRef = React.useRef(clients);
  const ledgerRef = React.useRef(ledger);
  const jobsRef = React.useRef(jobs);
  const paymentsRef = React.useRef(payments);
  const invoicesRef = React.useRef(invoices);
  const productsRef = React.useRef(products);
  const expensesRef = React.useRef(expenses);
  const usersRef = React.useRef(users);
  const logsRef = React.useRef(logs);
  const categoriesRef = React.useRef(categories);
  const racksRef = React.useRef(racks);
  const equipmentsRef = React.useRef(equipments);
  const problemsRef = React.useRef(problems);

  React.useEffect(() => { clientsRef.current = clients; }, [clients]);
  React.useEffect(() => { ledgerRef.current = ledger; }, [ledger]);
  React.useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  React.useEffect(() => { paymentsRef.current = payments; }, [payments]);
  React.useEffect(() => { invoicesRef.current = invoices; }, [invoices]);
  React.useEffect(() => { productsRef.current = products; }, [products]);
  React.useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  React.useEffect(() => { usersRef.current = users; }, [users]);
  React.useEffect(() => { logsRef.current = logs; }, [logs]);
  React.useEffect(() => { categoriesRef.current = categories; }, [categories]);
  React.useEffect(() => { racksRef.current = racks; }, [racks]);
  React.useEffect(() => { equipmentsRef.current = equipments; }, [equipments]);
  React.useEffect(() => { problemsRef.current = problems; }, [problems]);

  // Track collections that have finished initial Cloud Firestore sync to ensure Cloud as Absolute Master
  const hasLoadedCloudRef = React.useRef<Set<string>>(new Set());

  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => getPendingQueueCount());
  const [isQuotaExhaustedState, setIsQuotaExhaustedState] = useState<boolean>(() => isQuotaExhausted());
  const [isSyncRetrying, setIsSyncRetrying] = useState<boolean>(false);
  const [isOfflineBannerDismissed, setIsOfflineBannerDismissed] = useState<boolean>(false);

  React.useEffect(() => {
    const handleQueueChange = () => {
      setPendingQueueCount(getPendingQueueCount());
      setIsQuotaExhaustedState(isQuotaExhausted());
    };
    window.addEventListener('inoms_sync_queue_changed', handleQueueChange);
    const interval = setInterval(handleQueueChange, 3000);
    return () => {
      window.removeEventListener('inoms_sync_queue_changed', handleQueueChange);
      clearInterval(interval);
    };
  }, []);

  // Unique active session ID for single active device restriction per user account
  const [currentSessionId] = useState<string>(() => {
    let id = getAppSessionItem('active_device_session_id');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setAppSessionItem('active_device_session_id', id);
    }
    return id;
  });

  const handleCloudCollectionUpdate = <T,>(colName: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    return (items: T[]) => {
      hasLoadedCloudRef.current.add(colName);
      setter(prev => {
        if (!items || prev === items) return prev;
        if (prev && prev.length === items.length) {
          let isSame = true;
          for (let i = 0; i < prev.length; i++) {
            const p = prev[i] as any;
            const it = items[i] as any;
            if (p?.id !== it?.id || p?.version !== it?.version || p?.updatedAt !== it?.updatedAt) {
              isSame = false;
              break;
            }
          }
          if (isSame) return prev;
        }
        return items;
      });
    };
  };

  // Re-sync states whenever active tenant changes to strictly isolate organization data
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    const tId = activeTenant.id;
    setClients(getTenantData('clients', tId, INITIAL_CLIENTS));
    setJobs(getTenantData('jobs', tId, INITIAL_JOBS));
    setInvoices(getTenantData('invoices', tId, INITIAL_INVOICES));
    setProducts(getTenantData('products', tId, INITIAL_PRODUCTS));
    setLedger(getTenantData('ledger', tId, INITIAL_LEDGER));
    setPayments(getTenantData('payments', tId, INITIAL_PAYMENTS));
    setExpenses(getTenantData('expenses', tId, INITIAL_EXPENSES));
    setUsers(getTenantData('users', tId, INITIAL_USERS));
    setLogs(getTenantData('logs', tId, INITIAL_LOGS));
    setCategories(getTenantData('categories', tId, INITIAL_CATEGORIES));
    setRacks(getTenantData('racks', tId, INITIAL_RACKS));
    setEquipments(getTenantData('equipments', tId, EQUIPMENT_TYPES));
    setProblems(getTenantData('problems', tId, COMMON_PROBLEMS));
  }, [activeTenant?.id]);

  // Single Active Device / Session Enforcement per User Account via Home Server
  React.useEffect(() => {
    if (!isAuthenticated || !activeTenant?.id) return;

    const sessionUserId = currentUser?.id 
      ? `user_${currentUser.id}`
      : currentUser?.username 
        ? `user_${currentUser.username.toLowerCase()}`
        : 'org_owner';

    const sessionStorageKey = `active_session_${activeTenant.id}_${sessionUserId}`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser';

    // Claim active session locally in localStorage
    setAppStorageItem(sessionStorageKey, currentSessionId);

    // Register active device session on Home Server & Firestore
    registerHomeServerSession(activeTenant.id, sessionUserId, currentSessionId, userAgent);
    saveUserSessionToFirestore(activeTenant.id, sessionUserId, currentSessionId);

    const handleDisplacement = (newDeviceName?: string) => {
      triggerSaveNotification(`⚠️ Account was signed in on another device/window${newDeviceName ? ` (${newDeviceName})` : ''}. Signed out.`, true);
      setTimeout(() => {
        setIsAuthenticated(false);
        setShowAuthModal(true);
        removeAppSessionItem('authenticated');
        removeAppSessionItem('current_user');
      }, 1500);
    };

    // 1. Setup Local BroadcastChannel for instant same-browser multi-tab displacement
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('inoms_session_channel');
        
        // Claim session on channel
        bc.postMessage({
          type: 'CLAIM_SESSION',
          tenantId: activeTenant.id,
          sessionUserId,
          sessionId: currentSessionId
        });

        bc.onmessage = (event) => {
          const data = event.data;
          if (
            data &&
            data.tenantId === activeTenant.id &&
            data.sessionUserId === sessionUserId &&
            data.sessionId !== currentSessionId
          ) {
            if (data.type === 'CLAIM_SESSION') {
              handleDisplacement('New Tab/Window Login');
            }
          }
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel session setup notice:', err);
    }

    // 2. Setup Storage Event Listener for multi-window / tab takeover
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `app_storage_${sessionStorageKey}` || e.key === sessionStorageKey) {
        if (e.newValue && e.newValue !== currentSessionId) {
          handleDisplacement('Another Window/Tab');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Periodic Home Server check to log out older remote sessions if a newer session claimed ownership
    const sessionPollTimer = setInterval(async () => {
      const status = await checkHomeServerSession(activeTenant.id, sessionUserId);
      if (status && status.activeSessionId && status.activeSessionId !== currentSessionId) {
        handleDisplacement(status.deviceInfo || 'Remote Device');
      }
    }, 12000);

    return () => {
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(sessionPollTimer);
    };
  }, [isAuthenticated, activeTenant?.id, currentUser?.id, currentUser?.username, currentSessionId]);

  // Subscribe to real-time Cloud Firestore updates for active Tenant Organization
  React.useEffect(() => {
    if (!activeTenant?.id) return;
    const tId = activeTenant.id;

    // Reset cloud loaded tracker when active tenant changes
    hasLoadedCloudRef.current = new Set();

    // Trigger spinning rotation animation during initial Cloud Firestore sync
    setIsSyncing(true);
    const syncTimer = setTimeout(() => {
      setIsSyncing(false);
    }, 1500);

    // Real-time Cloud Company Config sync across all devices
    const unSubConfig = subscribeCompanyConfig(tId, (cloudConfig) => {
      if (cloudConfig) {
        setCompanyConfig(prev => ({ ...prev, ...cloudConfig }));
      }
    });

    // Real-time Cloud Global Branding sync across all devices for logo & titles
    const unSubGlobalBranding = subscribeCompanyConfig('global_system_branding', (globalConfig) => {
      if (globalConfig) {
        setCompanyConfig(prev => ({
          ...prev,
          appName: globalConfig.appName || prev.appName,
          appTagline: globalConfig.appTagline || prev.appTagline,
          appLogoUrl: globalConfig.appLogoUrl || prev.appLogoUrl
        }));
      }
    });

    // Real-time Cloud Collections sync across all devices (Cloud as Absolute Master)
    const unSubClients = subscribeTenantCollection<Client>(tId, 'clients', handleCloudCollectionUpdate('clients', setClients), () => clientsRef.current);
    const unSubLedger = subscribeTenantCollection<ClientLedgerEntry>(tId, 'ledger', handleCloudCollectionUpdate('ledger', setLedger), () => ledgerRef.current);
    const unSubJobs = subscribeTenantCollection<RepairJob>(tId, 'jobs', handleCloudCollectionUpdate('jobs', setJobs), () => jobsRef.current);
    const unSubPayments = subscribeTenantCollection<Payment>(tId, 'payments', handleCloudCollectionUpdate('payments', setPayments), () => paymentsRef.current);
    const unSubInvoices = subscribeTenantCollection<Invoice>(tId, 'invoices', handleCloudCollectionUpdate('invoices', setInvoices), () => invoicesRef.current);
    const unSubProducts = subscribeTenantCollection<Product>(tId, 'products', handleCloudCollectionUpdate('products', setProducts), () => productsRef.current);
    const unSubExpenses = subscribeTenantCollection<Expense>(tId, 'expenses', handleCloudCollectionUpdate('expenses', setExpenses), () => expensesRef.current);
    const unSubUsers = subscribeTenantCollection<SystemUser>(tId, 'users', handleCloudCollectionUpdate('users', setUsers), () => usersRef.current);
    const unSubLogs = subscribeTenantCollection<ActivityLog>(tId, 'logs', handleCloudCollectionUpdate('logs', setLogs), () => logsRef.current);
    const unSubCategories = subscribeTenantCollection<Category>(tId, 'categories', handleCloudCollectionUpdate('categories', setCategories), () => categoriesRef.current);
    const unSubRacks = subscribeTenantCollection<LocationRack>(tId, 'racks', handleCloudCollectionUpdate('racks', setRacks), () => racksRef.current);
    const unSubEquipments = subscribeTenantCollection<Equipment>(tId, 'equipments', handleCloudCollectionUpdate('equipments', setEquipments), () => equipmentsRef.current);
    const unSubProblems = subscribeTenantCollection<Problem>(tId, 'problems', handleCloudCollectionUpdate('problems', setProblems), () => problemsRef.current);

    // 1. Initial Authoritative Bootstrap from Home Server SQLite Database
    bootstrapTenantFromHomeServer(tId)
      .then(bData => {
        if (bData && bData.collections) {
          if (bData.collections.clients) setClients(bData.collections.clients);
          if (bData.collections.jobs) setJobs(bData.collections.jobs);
          if (bData.collections.invoices) setInvoices(bData.collections.invoices);
          if (bData.collections.payments) setPayments(bData.collections.payments);
          if (bData.collections.products) setProducts(bData.collections.products);
          if (bData.collections.expenses) setExpenses(bData.collections.expenses);
          if (bData.collections.ledger) setLedger(bData.collections.ledger);
          if (bData.collections.users && bData.collections.users.length > 0) setUsers(bData.collections.users);
          if (bData.collections.categories) setCategories(bData.collections.categories);
          if (bData.collections.racks) setRacks(bData.collections.racks);
          if (bData.collections.equipments) setEquipments(bData.collections.equipments);
          if (bData.collections.problems) setProblems(bData.collections.problems);
          if (bData.companyConfig) setCompanyConfig(prev => ({ ...prev, ...bData.companyConfig }));
        }
      })
      .catch(err => {
        console.info('Home Server bootstrap info:', err?.message || err);
      });

    // 2. Periodic Home Server Delta Synchronization (Every 10 seconds)
    const deltaSyncInterval = setInterval(() => {
      if (navigator.onLine && getAuthToken()) {
        pullDeltaFromHomeServer(tId).catch(() => {});
        pushPendingOperations(tId).catch(() => {});
      }
    }, 10000);

    // 3. Online event listener to immediately flush pending offline queue
    const handleOnline = () => {
      if (getAuthToken()) {
        pushPendingOperations(tId).catch(() => {});
        pullDeltaFromHomeServer(tId).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(syncTimer);
      clearInterval(deltaSyncInterval);
      window.removeEventListener('online', handleOnline);
      unSubConfig();
      unSubGlobalBranding();
      unSubClients();
      unSubLedger();
      unSubJobs();
      unSubPayments();
      unSubInvoices();
      unSubProducts();
      unSubExpenses();
      unSubUsers();
      unSubLogs();
      unSubCategories();
      unSubRacks();
      unSubEquipments();
      unSubProblems();
    };
  }, [activeTenant?.id]);

  // Global Save Notification Status Banner (Green for 3 sec)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cross navigation states for clickable Job ID and Invoice links
  const [initialJobIdToView, setInitialJobIdToView] = useState<string | null>(null);
  const [initialInvoiceIdToView, setInitialInvoiceIdToView] = useState<string | null>(null);

  const handleNavigateToJob = (jobId: string) => {
    const match = jobs.find(j => j.id === jobId || j.id.includes(jobId));
    if (match && (match.status === 'Product Out' || match.status === 'Outwarded')) {
      setActiveTab('outwards');
    } else {
      setActiveTab('inwards');
    }
    setInitialJobIdToView(jobId);
  };

  const handleNavigateToInvoice = (invoiceId: string) => {
    setActiveTab('billing');
    setInitialInvoiceIdToView(invoiceId);
  };

  const triggerSaveNotification = (message: string, isError = false) => {
    setSaveStatus({ type: isError ? 'error' : 'success', message });
  };

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Auto-sync states to tenant-isolated localStorage & Cloud Firestore (Guarded by local-first persistence)
  React.useEffect(() => {
    setAppStorageItem(`clients_${activeTenant.id}`, JSON.stringify(clients));
    saveTenantCollectionToFirestore(activeTenant.id, 'clients', clients);
  }, [clients, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`ledger_${activeTenant.id}`, JSON.stringify(ledger));
    saveTenantCollectionToFirestore(activeTenant.id, 'ledger', ledger);
  }, [ledger, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`jobs_${activeTenant.id}`, JSON.stringify(jobs));
    saveTenantCollectionToFirestore(activeTenant.id, 'jobs', jobs);
  }, [jobs, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`payments_${activeTenant.id}`, JSON.stringify(payments));
    saveTenantCollectionToFirestore(activeTenant.id, 'payments', payments);
  }, [payments, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`invoices_${activeTenant.id}`, JSON.stringify(invoices));
    saveTenantCollectionToFirestore(activeTenant.id, 'invoices', invoices);
  }, [invoices, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(products));
    saveTenantCollectionToFirestore(activeTenant.id, 'products', products);
  }, [products, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`expenses_${activeTenant.id}`, JSON.stringify(expenses));
    saveTenantCollectionToFirestore(activeTenant.id, 'expenses', expenses);
  }, [expenses, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(users));
    saveTenantCollectionToFirestore(activeTenant.id, 'users', users);
  }, [users, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`logs_${activeTenant.id}`, JSON.stringify(logs));
    saveTenantCollectionToFirestore(activeTenant.id, 'logs', logs);
  }, [logs, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`categories_${activeTenant.id}`, JSON.stringify(categories));
    saveTenantCollectionToFirestore(activeTenant.id, 'categories', categories);
  }, [categories, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`racks_${activeTenant.id}`, JSON.stringify(racks));
    saveTenantCollectionToFirestore(activeTenant.id, 'racks', racks);
  }, [racks, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`equipments_${activeTenant.id}`, JSON.stringify(equipments));
    saveTenantCollectionToFirestore(activeTenant.id, 'equipments', equipments);
  }, [equipments, activeTenant.id]);

  React.useEffect(() => {
    setAppStorageItem(`problems_${activeTenant.id}`, JSON.stringify(problems));
    saveTenantCollectionToFirestore(activeTenant.id, 'problems', problems);
  }, [problems, activeTenant.id]);

  // Silent Background Local PC Auto-Backup Service across all tabs
  const lastBackedUpSnapshotRef = React.useRef<string | null>(null);
  const backupTimerRef = React.useRef<any>(null);
  const mountTimeRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    mountTimeRef.current = Date.now();
    lastBackedUpSnapshotRef.current = null;
    if (backupTimerRef.current) {
      clearTimeout(backupTimerRef.current);
      backupTimerRef.current = null;
    }
  }, [activeTenant.id, isAuthenticated]);

  React.useEffect(() => {
    // CRITICAL: Prevent any background backup from triggering before user completes authentication
    if (!isAuthenticated) return;
    // SECURITY GUARD: Only Organization Owners (Admin) and Master Admin can execute or download local backups
    const isAllowedRoleForBackup = userRole === 'Admin' || userRole === 'Master Admin' || activeTenant?.id === 'org-admin';
    if (!isAllowedRoleForBackup) return;

    const isEnabled = companyConfig.localBackupEnabled ?? true;
    if (!isEnabled) return;
    const freq = companyConfig.localBackupFrequency || 'daily';
    if (freq === 'manual') return;

    // Calculate snapshot fingerprint of current data collections
    const currentSnapshot = JSON.stringify([
      clients,
      jobs,
      invoices,
      products,
      ledger,
      payments,
      expenses,
      users,
      categories,
      racks,
      equipments,
      problems
    ]);

    // GUARD: Ignore initial mount & initial 2.5-second Firestore hydration window on page refresh/login
    const isInitialHydration = (Date.now() - mountTimeRef.current) < 2500;
    if (isInitialHydration || lastBackedUpSnapshotRef.current === null) {
      lastBackedUpSnapshotRef.current = currentSnapshot;
      return;
    }

    // If data hasn't changed since last backed up snapshot, skip!
    if (lastBackedUpSnapshotRef.current === currentSnapshot) {
      return;
    }

    const performBackgroundLocalBackup = async () => {
      setIsSyncing(true);
      try {
        lastBackedUpSnapshotRef.current = currentSnapshot;

        const dataToExport = {
          tenantId: activeTenant.id,
          orgName: companyConfig.name || activeTenant.name,
          clients,
          jobs,
          invoices,
          products,
          ledger,
          payments,
          expenses,
          users,
          categories,
          racks,
          equipments,
          problems,
          companyConfig
        };

        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        const formattedTimestamp = `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
        const orgPrefix = getBackupOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.id);
        const filename = `${orgPrefix}_Local_Backup_${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}.json`;
        const jsonStr = JSON.stringify(dataToExport, null, 2);

        let dirHandle = (window as any)[`__repairTrackLocalDirectoryHandle_${activeTenant.id}`] || (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`];
        if (!dirHandle) {
          dirHandle = await getDirectoryHandle(activeTenant.id);
          if (dirHandle) {
            (window as any)[`__repairTrackLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
            (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
          }
        }

        if (dirHandle) {
          const success = await writeBackupToDirectoryHandle(dirHandle, filename, jsonStr);
          if (success) {
            setCompanyConfig(prev => ({ ...prev, lastLocalBackupTime: formattedTimestamp }));
            return; // Written silently directly into user's PC target folder with zero popups!
          }
        }

        // Automatic browser background download fallback
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setCompanyConfig(prev => ({ ...prev, lastLocalBackupTime: formattedTimestamp }));
      } catch (err) {
        console.warn('Background backup error:', err);
      } finally {
        setTimeout(() => {
          setIsSyncing(false);
        }, 1000);
      }
    };

    // 1. On Every Change / Sync Mode
    if (freq === 'on_sync') {
      if (backupTimerRef.current) {
        clearTimeout(backupTimerRef.current);
      }
      backupTimerRef.current = setTimeout(() => {
        performBackgroundLocalBackup();
      }, 1200);
      return () => {
        if (backupTimerRef.current) {
          clearTimeout(backupTimerRef.current);
        }
      };
    }

    // 2. Fixed Daily Time Mode
    if (freq === 'daily') {
      const schedTime = companyConfig.localBackupScheduleTime || '18:00';
      const interval = setInterval(() => {
        const now = new Date();
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (currentHHMM === schedTime && now.getSeconds() === 0) {
          performBackgroundLocalBackup();
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    // 3. Periodic Duration Intervals (30 mins, 1 hour to 12 hours)
    const intervalMap: { [key: string]: number } = {
      mins_30: 30 * 60 * 1000,
      hourly_1: 1 * 60 * 60 * 1000,
      hourly_2: 2 * 60 * 60 * 1000,
      hourly_3: 3 * 60 * 60 * 1000,
      hourly_4: 4 * 60 * 60 * 1000,
      hourly_5: 5 * 60 * 60 * 1000,
      hourly_6: 6 * 60 * 60 * 1000,
      hourly_12: 12 * 60 * 60 * 1000,
    };

    const intervalMs = intervalMap[freq];
    if (intervalMs) {
      const interval = setInterval(() => {
        performBackgroundLocalBackup();
      }, intervalMs);
      return () => clearInterval(interval);
    }
  }, [
    isAuthenticated,
    activeTenant.id,
    companyConfig.localBackupEnabled,
    companyConfig.localBackupFrequency,
    companyConfig.localBackupScheduleTime,
    clients,
    jobs,
    invoices,
    products,
    ledger,
    payments,
    expenses,
    users,
    categories,
    racks,
    equipments,
    problems
  ]);

  // Sync animation & bidirectional data merger handler
  const handleSyncData = async () => {
    setIsSyncing(true);
    const syncStartTime = Date.now();
    try {
      // 0. Flush any queued offline writes to Home Server SQLite
      await pushPendingOperations(activeTenant.id);
      await pullDeltaFromHomeServer(activeTenant.id);
      setPendingQueueCount(getPendingQueueCount());
      setIsQuotaExhaustedState(isQuotaExhausted());
      // 1. Sync Company Config & Global System Branding to Home Server
      await saveCompanyConfigToFirestore(activeTenant.id, companyConfig);
      const isMasterAdminOrg = activeTenant.id === 'org-admin' || activeTenant.code === 'ADMIN-00' || activeTenant.ownerMobile?.includes('8149862034');
      if (isMasterAdminOrg || companyConfig.appLogoUrl) {
        await saveCompanyConfigToFirestore('global_system_branding', {
          ...companyConfig,
          appName: systemAppName,
          appTagline: systemAppTagline,
          appLogoUrl: systemAppLogo
        });
      }

      // 2. Mark collections loaded and sync all collections to Cloud Firestore
      ['clients', 'ledger', 'jobs', 'payments', 'invoices', 'products', 'expenses', 'users', 'logs', 'categories', 'racks', 'equipments', 'problems'].forEach(c => hasLoadedCloudRef.current.add(c));
      await Promise.all([
        saveTenantCollectionToFirestore(activeTenant.id, 'clients', clients),
        saveTenantCollectionToFirestore(activeTenant.id, 'ledger', ledger),
        saveTenantCollectionToFirestore(activeTenant.id, 'jobs', jobs),
        saveTenantCollectionToFirestore(activeTenant.id, 'payments', payments),
        saveTenantCollectionToFirestore(activeTenant.id, 'invoices', invoices),
        saveTenantCollectionToFirestore(activeTenant.id, 'products', products),
        saveTenantCollectionToFirestore(activeTenant.id, 'expenses', expenses),
        saveTenantCollectionToFirestore(activeTenant.id, 'users', users),
        saveTenantCollectionToFirestore(activeTenant.id, 'logs', logs),
        saveTenantCollectionToFirestore(activeTenant.id, 'categories', categories),
        saveTenantCollectionToFirestore(activeTenant.id, 'racks', racks),
        saveTenantCollectionToFirestore(activeTenant.id, 'equipments', equipments),
        saveTenantCollectionToFirestore(activeTenant.id, 'problems', problems)
      ]);

      let pcFolderSynced = false;
      let latestBackupName = '';

      // 3. Check if a local directory handle is connected
      const dirHandle = (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] || (await getDirectoryHandle(activeTenant.id));
      if (dirHandle) {
        (window as any)[`__nibbanLocalDirectoryHandle_${activeTenant.id}`] = dirHandle;
        const backupResult = await getLatestBackupFromDirectoryHandle(dirHandle, activeTenant.id, companyConfig.name || activeTenant.name);
        if (backupResult && backupResult.data) {
          latestBackupName = backupResult.filename;
          const bData = backupResult.data;

          // Merge backup datasets if valid
          if (Array.isArray(bData.clients) && bData.clients.length > 0) {
            setClients(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.clients.forEach((c: any) => { if (c && c.id) map.set(c.id, { ...c, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.jobs) && bData.jobs.length > 0) {
            setJobs(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.jobs.forEach((j: any) => { if (j && j.id) map.set(j.id, { ...j, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.invoices) && bData.invoices.length > 0) {
            setInvoices(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.invoices.forEach((inv: any) => { if (inv && inv.id) map.set(inv.id, { ...inv, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.payments) && bData.payments.length > 0) {
            setPayments(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.payments.forEach((p: any) => { if (p && p.id) map.set(p.id, { ...p, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.products) && bData.products.length > 0) {
            setProducts(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.products.forEach((prod: any) => { if (prod && prod.id) map.set(prod.id, { ...prod, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.users) && bData.users.length > 0) {
            setUsers(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.users.forEach((u: any) => { if (u && u.id) map.set(u.id, { ...u, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.categories) && bData.categories.length > 0) {
            setCategories(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.categories.forEach((cat: any) => { if (cat && cat.id) map.set(cat.id, { ...cat, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.racks) && bData.racks.length > 0) {
            setRacks(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.racks.forEach((r: any) => { if (r && r.id) map.set(r.id, { ...r, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.equipments) && bData.equipments.length > 0) {
            setEquipments(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.equipments.forEach((eq: any) => { if (eq && eq.id) map.set(eq.id, { ...eq, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(bData.problems) && bData.problems.length > 0) {
            setProblems(prev => {
              const map = new Map(prev.map(item => [item.id, item]));
              bData.problems.forEach((pr: any) => { if (pr && pr.id) map.set(pr.id, { ...pr, tenantId: activeTenant.id }); });
              return Array.from(map.values());
            });
          }
          pcFolderSynced = true;
        }

        // Write current snapshot backup into folder silently
        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const orgPrefix = getBackupOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.id);
        const syncFilename = `${orgPrefix}_Sync_Backup_${YYYY}-${MM}-${DD}_${hh}-${mm}.json`;
        const syncPayload = JSON.stringify({
          tenantId: activeTenant.id,
          orgName: companyConfig.name || activeTenant.name,
          clients,
          jobs,
          invoices,
          products,
          ledger,
          payments,
          expenses,
          users,
          categories,
          racks,
          equipments,
          problems,
          companyConfig
        }, null, 2);
        await writeBackupToDirectoryHandle(dirHandle, syncFilename, syncPayload);
      }

      // Log audit
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'SYNC',
        details: pcFolderSynced
          ? `Synced station data & config with Cloud Firestore & PC backup file "${latestBackupName}".`
          : 'Synced station data & config with Cloud Firestore & Local Storage successfully.'
      };
      setLogs(prev => [newLog, ...prev]);

      // Ensure minimum 1500ms sync rotation animation duration
      const elapsedTime = Date.now() - syncStartTime;
      if (elapsedTime < 1500) {
        await new Promise(res => setTimeout(res, 1500 - elapsedTime));
      }

      const statusMsg = pcFolderSynced
        ? `✓ Synced with Cloud Firestore & PC backup file "${latestBackupName}"!`
        : `✓ Synced with Cloud Firestore & Local Storage!`;
      triggerSaveNotification(statusMsg);
    } catch (err: any) {
      triggerSaveNotification(`✓ Data synced to Local Storage! (${err.message || 'PC folder access restricted'})`);
    } finally {
      setIsSyncing(false);
    }
  };

  // State Action Callbacks
  const addClient = (newClient: Omit<Client, 'id'>): Client => {
    try {
      const id = `c-${Date.now()}`;
      const balance = Number(newClient.outstandingBalance) || 0;
      const client: Client = {
        id,
        tenantId: activeTenant.id,
        ...newClient,
        outstandingBalance: balance
      };
      setClients(prev => [...prev, client]);

      if (balance !== 0) {
        const openingLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: id,
          date: new Date().toLocaleDateString('en-IN'),
          type: 'Opening Balance',
          refNo: 'OPENING',
          debit: balance > 0 ? balance : 0,
          credit: balance < 0 ? Math.abs(balance) : 0,
          balance: balance
        };
        setLedger(prev => [openingLedgerLog, ...prev]);
      }

      triggerSaveNotification(`✓ Client "${newClient.name}" added & saved!`);
      return client;
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save client: ${err.message}`, true);
      return null;
    }
  };

  const editClient = (updatedClient: Client) => {
    try {
      setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
      triggerSaveNotification(`✓ Client profile "${updatedClient.name}" updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save client: ${err.message}`, true);
    }
  };

  const deleteClient = (id: string) => {
    try {
      const client = clients.find(c => c.id === id);
      setClients(clients.filter(c => c.id !== id));
      triggerSaveNotification(`✓ Client "${client?.name || id}" removed!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete client: ${err.message}`, true);
    }
  };

  const addJob = (newJob: Omit<RepairJob, 'id'>) => {
    try {
      const orgPrefix = getOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.code);
      const jobId = `${orgPrefix}/2026/${jobs.length + 101}`;
      const nowIso = new Date().toISOString();
      const formattedNow = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const immutableInDate = newJob.inDate || newJob.inwardDate || newJob.createdAt || formattedNow;

      const job: RepairJob = {
        id: jobId,
        tenantId: activeTenant.id,
        ...newJob,
        createdAt: newJob.createdAt || nowIso,
        updatedAt: nowIso,
        inDate: immutableInDate,
        inwardDate: immutableInDate
      };
      setJobs(prev => sortJobsByLatest([job, ...prev]));

      // If inward advance payment was accepted during creation
      if (newJob.advanceAmount && newJob.advanceAmount > 0) {
        const advAmount = Number(newJob.advanceAmount) || 0;
        const advancePayment: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: newJob.date || new Date().toISOString().split('T')[0],
          clientId: newJob.clientId,
          clientName: newJob.clientName,
          amount: advAmount,
          mode: newJob.advancePaymentMode || 'UPI',
          refNo: `Inward Advance ${jobId}`,
          remarks: `Advance payment accepted during inward job card ${jobId}`,
          linkedJobId: jobId
        };
        setPayments(prev => [advancePayment, ...prev]);

        // Credit client ledger for advance received
        const advLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: newJob.clientId,
          date: newJob.date || new Date().toLocaleDateString('en-IN'),
          type: 'Inward Advance Payment',
          refNo: `ADV-${jobId}`,
          debit: 0,
          credit: advAmount,
          balance: (clients.find(c => c.id === newJob.clientId)?.outstandingBalance || 0) - advAmount
        };
        setLedger(prev => [advLedgerLog, ...prev]);

        // Update client balance (minus advance received)
        setClients(prev => prev.map(c => {
          if (c.id === newJob.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + (newJob.estimateAmount || 0) - advAmount
            };
          }
          return c;
        }));
      } else {
        // Update client outstandings with estimate
        setClients(prev => prev.map(c => {
          if (c.id === newJob.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + (newJob.estimateAmount || 0)
            };
          }
          return c;
        }));
      }

      // Update log
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'INWARD_JOB',
        details: `Inwarded ${newJob.equipment} (${newJob.productName}) for ${newJob.clientName}.${newJob.advanceAmount ? ` Advance received: ₹${newJob.advanceAmount}` : ''}`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Inward Job card ${jobId} logged & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to log repair job: ${err.message}`, true);
    }
  };

  const updateJob = (updatedJob: RepairJob) => {
    try {
      const oldJob = jobs.find(j => j.id === updatedJob.id);

      const oldBill = oldJob ? getEffectiveBillAmount(oldJob) : 0;
      const oldAdvance = oldJob ? (oldJob.advanceAmount || 0) : 0;
      const oldIsPaid = oldJob ? oldJob.paymentStatus === 'Paid' : false;

      const newBill = getEffectiveBillAmount(updatedJob);
      const newAdvance = updatedJob.advanceAmount || 0;
      const newIsPaid = updatedJob.paymentStatus === 'Paid';

      // Calculate bill difference
      const billDiff = newBill - oldBill;

      const nowIso = new Date().toISOString();
      const immutableInDate = oldJob?.inDate || oldJob?.inwardDate || oldJob?.createdAt || updatedJob.inDate || updatedJob.inwardDate || updatedJob.createdAt || new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      let finalOutDate = updatedJob.outDate || updatedJob.outwardedDate;
      if (!finalOutDate && (updatedJob.status === 'Product Out' || updatedJob.status === 'Outwarded' || updatedJob.deliveryStatus === 'Delivered')) {
        finalOutDate = oldJob?.outDate || oldJob?.outwardedDate || new Date().toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        });
      }

      const jobToSave: RepairJob = {
        ...updatedJob,
        createdAt: oldJob?.createdAt || updatedJob.createdAt || nowIso,
        updatedAt: nowIso,
        inDate: immutableInDate,
        inwardDate: immutableInDate,
        outDate: finalOutDate,
        outwardedDate: finalOutDate || updatedJob.outwardedDate
      };

      // Update jobs array sorted by latest
      setJobs(prevJobs => sortJobsByLatest(prevJobs.map(j => j.id === jobToSave.id ? jobToSave : j)));

      // Handle Client Balance updates
      if (oldJob && oldJob.clientId !== updatedJob.clientId) {
        // Client changed on job
        const oldPending = oldIsPaid ? 0 : Math.max(0, oldBill - oldAdvance);
        const newPending = newIsPaid ? 0 : Math.max(0, newBill - newAdvance);

        setClients(prevClients => prevClients.map(c => {
          if (c.id === oldJob.clientId) {
            return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - oldPending) };
          }
          if (c.id === updatedJob.clientId) {
            return { ...c, outstandingBalance: c.outstandingBalance + newPending };
          }
          return c;
        }));
      } else {
        // Same client
        if (billDiff !== 0) {
          setClients(prevClients => prevClients.map(c => {
            if (c.id === updatedJob.clientId) {
              return { ...c, outstandingBalance: c.outstandingBalance + billDiff };
            }
            return c;
          }));
        }

        // If status changed from Paid -> Unpaid, restore unpaid amount to client balance
        if (oldIsPaid && !newIsPaid && updatedJob.repairOutcome !== 'Not Repaired') {
          const amountToRestore = Math.max(0, newBill - newAdvance);
          if (amountToRestore > 0) {
            setClients(prevClients => prevClients.map(c => {
              if (c.id === updatedJob.clientId) {
                return { ...c, outstandingBalance: c.outstandingBalance + amountToRestore };
              }
              return c;
            }));
          }
        }
      }

      // Sync Advance Payment with Payments list if advance amount changed or payment mode changed
      if (oldAdvance !== newAdvance || (oldJob && oldJob.advancePaymentMode !== updatedJob.advancePaymentMode)) {
        setPayments(prevPayments => {
          const existingIndex = prevPayments.findIndex(p => 
            p.linkedJobId === updatedJob.id || 
            (p.refNo && (p.refNo.includes(`Inward Advance ${updatedJob.id}`) || p.refNo.includes(`ADV-${updatedJob.id}`)))
          );

          if (newAdvance > 0) {
            if (existingIndex >= 0) {
              const updated = [...prevPayments];
              updated[existingIndex] = {
                ...updated[existingIndex],
                amount: newAdvance,
                mode: updatedJob.advancePaymentMode || updated[existingIndex].mode || 'UPI',
                clientId: updatedJob.clientId,
                clientName: updatedJob.clientName,
                date: updatedJob.date || updated[existingIndex].date,
                remarks: `Advance payment updated for inward job card ${updatedJob.id}`
              };
              return updated;
            } else {
              const newAdvPay: Payment = {
                id: `pay-${Date.now()}`,
                tenantId: activeTenant.id,
                date: updatedJob.date || new Date().toISOString().split('T')[0],
                clientId: updatedJob.clientId,
                clientName: updatedJob.clientName,
                amount: newAdvance,
                mode: updatedJob.advancePaymentMode || 'UPI',
                refNo: `Inward Advance ${updatedJob.id}`,
                remarks: `Advance payment added for job card ${updatedJob.id}`,
                linkedJobId: updatedJob.id
              };
              return [newAdvPay, ...prevPayments];
            }
          } else {
            if (existingIndex >= 0) {
              return prevPayments.filter((_, idx) => idx !== existingIndex);
            }
            return prevPayments;
          }
        });
      }

      // Handle Advance Refund if checked and advance was taken
      if (updatedJob.advanceRefunded && newAdvance > 0 && (!oldJob || !oldJob.advanceRefunded)) {
        const refundAmount = newAdvance;
        const payDate = new Date().toISOString().split('T')[0];
        const payMode = updatedJob.advanceRefundMode || 'Cash';

        const refundPayment: Payment = {
          id: `pay-refund-${Date.now()}`,
          tenantId: activeTenant.id,
          date: payDate,
          clientId: updatedJob.clientId,
          clientName: updatedJob.clientName,
          amount: -refundAmount,
          mode: payMode,
          refNo: `REFUND-${updatedJob.id}`,
          remarks: `Advance refunded for Not Repaired job card #${updatedJob.id} (${updatedJob.equipment || 'Device'})`
        };

        setPayments(prev => [refundPayment, ...prev]);

        const clientObj = clients.find(c => c.id === updatedJob.clientId);
        const currentBal = clientObj ? clientObj.outstandingBalance : 0;

        const refundLedgerLog: ClientLedgerEntry = {
          id: `l-refund-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedJob.clientId,
          date: new Date().toLocaleDateString('en-IN'),
          type: 'Advance Refunded',
          refNo: `REFUND-${updatedJob.id}`,
          debit: refundAmount,
          credit: 0,
          balance: currentBal + refundAmount
        };
        setLedger(prev => [refundLedgerLog, ...prev]);

        // Refunding advance increases client balance by refundAmount (offsets negative credit)
        setClients(prevClients => prevClients.map(c => {
          if (c.id === updatedJob.clientId) {
            return { ...c, outstandingBalance: c.outstandingBalance + refundAmount };
          }
          return c;
        }));
      }

      // If status changed from Unpaid -> Paid and NOT Not Repaired, generate payment record and credit client
      if (newIsPaid && !oldIsPaid && updatedJob.repairOutcome !== 'Not Repaired') {
        const remainingPaid = Math.max(0, newBill - newAdvance);
        if (remainingPaid > 0) {
          const payDate = new Date().toISOString().split('T')[0];
          const payMode = updatedJob.advancePaymentMode || 'UPI';

          const outwardPayment: Payment = {
            id: `pay-${Date.now()}`,
            tenantId: activeTenant.id,
            date: payDate,
            clientId: updatedJob.clientId,
            clientName: updatedJob.clientName,
            amount: remainingPaid,
            mode: payMode,
            refNo: `Outward Bill ${updatedJob.id}`,
            remarks: `Full payment cleared for job card #${updatedJob.id} (${updatedJob.equipment || 'Device'})`
          };

          setPayments(prev => [outwardPayment, ...prev]);

          const clientObj = clients.find(c => c.id === updatedJob.clientId);
          const currentBal = clientObj ? clientObj.outstandingBalance : 0;

          const outwardLedgerLog: ClientLedgerEntry = {
            id: `l-${Date.now()}`,
            tenantId: activeTenant.id,
            clientId: updatedJob.clientId,
            date: new Date().toLocaleDateString('en-IN'),
            type: 'Outward Payment Received',
            refNo: `OUT-${updatedJob.id}`,
            debit: 0,
            credit: remainingPaid,
            balance: Math.max(0, currentBal - remainingPaid)
          };
          setLedger(prev => [outwardLedgerLog, ...prev]);

          // Deduct from client balance
          setClients(prevClients => prevClients.map(c => {
            if (c.id === updatedJob.clientId) {
              return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - remainingPaid) };
            }
            return c;
          }));
        }
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'UPDATE_JOB',
        details: `Updated repair job card ${updatedJob.id} status to ${updatedJob.status}.`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Repair job ${updatedJob.id} updated & synced with Client & Payments!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update job: ${err.message}`, true);
    }
  };

  const deleteJob = (id: string) => {
    try {
      const targetJob = jobs.find(j => j.id === id);
      if (targetJob && targetJob.paymentStatus !== 'Paid') {
        const bill = getEffectiveBillAmount(targetJob);
        const pending = Math.max(0, bill - (targetJob.advanceAmount || 0));
        if (pending > 0) {
          setClients(prev => prev.map(c => {
            if (c.id === targetJob.clientId) {
              return { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - pending) };
            }
            return c;
          }));
        }
      }
      const nextJobs = jobs.filter(j => j.id !== id);
      setJobs(nextJobs);
      setAppStorageItem(`jobs_${activeTenant.id}`, JSON.stringify(nextJobs));

      // Remove any linked advance / outward payments associated with deleted job
      setPayments(prevPayments => prevPayments.filter(p => 
        p.linkedJobId !== id && 
        !(p.refNo && (p.refNo.includes(`Inward Advance ${id}`) || p.refNo.includes(`ADV-${id}`) || p.refNo.includes(`Outward Bill ${id}`)))
      ));

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Staff',
        action: 'DELETE_JOB',
        details: `Deleted job ticket #${targetJob?.id || id}`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Job card ${targetJob?.id ? '#' + targetJob.id : ''} permanently deleted.`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete job card: ${err.message}`, true);
    }
  };

  const addPayment = (newPayment: Omit<Payment, 'id'>) => {
    try {
      const paymentId = `pay-${Date.now()}`;
      const payment: Payment = {
        id: paymentId,
        tenantId: activeTenant.id,
        ...newPayment
      };
      setPayments([payment, ...payments]);

      // Deduct client ledger balance
      setClients(clients.map(c => {
        if (c.id === newPayment.clientId) {
          return {
            ...c,
            outstandingBalance: c.outstandingBalance - newPayment.amount
          };
        }
        return c;
      }));

      // Add ledger log
      const ledgerLog = {
        id: `l-${Date.now()}`,
        tenantId: activeTenant.id,
        clientId: newPayment.clientId,
        date: newPayment.date,
        type: 'Payment Received',
        refNo: `${newPayment.mode} (${newPayment.refNo || 'Direct Credit'})`,
        debit: 0,
        credit: newPayment.amount,
        balance: (clients.find(c => c.id === newPayment.clientId)?.outstandingBalance || 0) - newPayment.amount
      };
      setLedger([ledgerLog, ...ledger]);

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_CREDIT',
        details: `Credited ₹${newPayment.amount} payment from client ${newPayment.clientName}.`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Payment ₹${newPayment.amount} credited & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save payment: ${err.message}`, true);
    }
  };

  const updatePayment = (updatedPayment: Payment) => {
    try {
      const oldPayment = payments.find(p => p.id === updatedPayment.id);
      const oldAmount = oldPayment ? oldPayment.amount : 0;
      const diff = updatedPayment.amount - oldAmount;

      setPayments(payments.map(p => p.id === updatedPayment.id ? updatedPayment : p));

      if (diff !== 0) {
        setClients(clients.map(c => {
          if (c.id === updatedPayment.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance - diff
            };
          }
          return c;
        }));
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_EDIT',
        details: `Edited payment record ${updatedPayment.id} amount to ₹${updatedPayment.amount}.`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Payment record ${updatedPayment.id} updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update payment: ${err.message}`, true);
    }
  };

  const deletePayment = (paymentId: string) => {
    try {
      const targetPayment = payments.find(p => p.id === paymentId);
      if (!targetPayment) return;

      // Remove from payments list
      setPayments(prev => prev.filter(p => p.id !== paymentId));

      // Restore client outstanding balance
      setClients(prev => prev.map(c => {
        if (c.id === targetPayment.clientId) {
          return {
            ...c,
            outstandingBalance: c.outstandingBalance + targetPayment.amount
          };
        }
        return c;
      }));

      // Log audit
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'PAYMENT_DELETE',
        details: `Deleted payment receipt ${targetPayment.id} of ₹${targetPayment.amount} for client ${targetPayment.clientName}.`
      };
      setLogs(prev => [audit, ...prev]);

      triggerSaveNotification(`✓ Payment receipt of ₹${targetPayment.amount} deleted & client balance restored!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete payment: ${err.message}`, true);
    }
  };

  // Helper to match an invoice line item against an inventory product reliably
  const isInvoiceItemProductMatch = (item: { productName: string; serialNo?: string }, prod: Product): boolean => {
    const itemPN = (item.productName || '').trim().toLowerCase();
    const prodN = (prod.name || '').trim().toLowerCase();
    const itemSKU = (item.serialNo || '').trim().toLowerCase();
    const prodID = (prod.id || '').trim().toLowerCase();
    const prodHSN = (prod.hsnCode || '').trim().toLowerCase();

    if (!itemPN && !itemSKU) return false;

    // 1. Direct match on ID / HSN
    if (itemSKU && (
      itemSKU === prodID ||
      itemSKU === prodHSN ||
      itemSKU === `hsn:${prodHSN}`
    )) {
      return true;
    }

    // 2. Exact match on Product Name
    if (itemPN === prodN) return true;

    // 3. Substring match if name is reasonably long (>= 3 chars)
    if (prodN.length >= 3 && itemPN.includes(prodN)) return true;
    if (itemPN.length >= 3 && prodN.includes(itemPN)) return true;

    return false;
  };

  const addInvoice = (newInvoice: Omit<Invoice, 'id'>) => {
    try {
      const orgPrefix = getOrgPrefix(companyConfig.name || activeTenant.name, activeTenant.code);
      const invoiceNo = `${orgPrefix}/2026/BILL/${invoices.length + 459}`;
      const paid = newInvoice.isPaid !== false ? newInvoice.paidAmount : 0;
      const bal = newInvoice.grandTotal - paid;
      const invoice: Invoice = {
        id: invoiceNo,
        tenantId: activeTenant.id,
        ...newInvoice,
        paidAmount: paid,
        balanceAmount: bal > 0 ? bal : 0,
        isPaid: newInvoice.isPaid !== false && bal <= 0
      };
      setInvoices([invoice, ...invoices]);

      // If invoice is paid (or paidAmount > 0), auto record in payments list & client ledger
      if (paid > 0) {
        const paymentRecord: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: newInvoice.date || new Date().toISOString().split('T')[0],
          clientId: newInvoice.clientId,
          clientName: newInvoice.clientName,
          amount: paid,
          mode: newInvoice.paymentMode || 'UPI',
          refNo: `Invoice ${invoiceNo}`,
          remarks: `Auto-recorded payment for Tax Invoice ${invoiceNo}`,
          invoiceId: invoiceNo,
          linkedJobId: newInvoice.linkedJobId
        };
        setPayments(prev => [paymentRecord, ...prev]);

        // Add ledger log for invoice payment
        const invPaymentLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: newInvoice.clientId,
          date: newInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Received',
          refNo: invoiceNo,
          debit: 0,
          credit: paid,
          balance: (clients.find(c => c.id === newInvoice.clientId)?.outstandingBalance || 0) - paid
        };
        setLedger(prev => [invPaymentLedgerLog, ...prev]);

        setClients(prev => prev.map(c => {
          if (c.id === newInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance - paid
            };
          }
          return c;
        }));
      }

      // Sync linked repair job final bill amount and payment status
      if (newInvoice.linkedJobId) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === newInvoice.linkedJobId) {
            return {
              ...job,
              finalBillAmount: newInvoice.grandTotal,
              paymentStatus: (invoice.isPaid || invoice.balanceAmount <= 0) ? 'Paid' : 'Unpaid'
            };
          }
          return job;
        }));
      }

      // Automatically deduct product stock count for items in inventory
      if (newInvoice.items && newInvoice.items.length > 0) {
        setProducts(prevProducts => {
          const updated = prevProducts.map(prod => {
            const matchedItems = newInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));
            if (matchedItems.length > 0) {
              const totalBilledQty = matchedItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
              const newStock = Math.max(0, prod.stock - totalBilledQty);
              return {
                ...prod,
                stock: newStock
              };
            }
            return prod;
          });
          setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updated));
          saveTenantCollectionToFirestore(activeTenant.id, 'products', updated);
          return updated;
        });
      }

      // Increment log
      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_GEN',
        details: `Generated tax invoice ${invoiceNo} for ${newInvoice.clientName} (₹${newInvoice.grandTotal}). Status: ${invoice.isPaid ? 'PAID' : 'UNPAID'}.`
      };
      setLogs([audit, ...logs]);
      triggerSaveNotification(`✓ Tax Invoice ${invoiceNo} generated & inventory stock updated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to generate invoice: ${err.message}`, true);
    }
  };

  const updateInvoice = (updatedInvoice: Invoice) => {
    try {
      const oldInvoice = invoices.find(inv => inv.id === updatedInvoice.id);
      setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));

      // Calculate newly paid amount difference
      const oldPaid = oldInvoice ? oldInvoice.paidAmount : 0;
      const newlyPaid = updatedInvoice.paidAmount - oldPaid;

      if (newlyPaid > 0) {
        // Record payment in Payments tab automatically
        const paymentRecord: Payment = {
          id: `pay-${Date.now()}`,
          tenantId: activeTenant.id,
          date: updatedInvoice.date || new Date().toISOString().split('T')[0],
          clientId: updatedInvoice.clientId,
          clientName: updatedInvoice.clientName,
          amount: newlyPaid,
          mode: updatedInvoice.paymentMode || 'UPI',
          refNo: `Invoice ${updatedInvoice.id}`,
          remarks: `Payment received for Tax Invoice ${updatedInvoice.id} (${updatedInvoice.isPaid ? 'Marked as Paid' : 'Partial Settlement'})`,
          invoiceId: updatedInvoice.id,
          linkedJobId: updatedInvoice.linkedJobId
        };
        setPayments(prev => [paymentRecord, ...prev]);

        // Add ledger log
        const invPaymentLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedInvoice.clientId,
          date: updatedInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Received',
          refNo: updatedInvoice.id,
          debit: 0,
          credit: newlyPaid,
          balance: Math.max(0, (clients.find(c => c.id === updatedInvoice.clientId)?.outstandingBalance || 0) - newlyPaid)
        };
        setLedger(prev => [invPaymentLedgerLog, ...prev]);

        // Reduce client outstanding balance
        setClients(prev => prev.map(c => {
          if (c.id === updatedInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: Math.max(0, c.outstandingBalance - newlyPaid)
            };
          }
          return c;
        }));
      } else if (newlyPaid < 0) {
        const reversedAmount = Math.abs(newlyPaid);
        // Payment was marked UNPAID or reduced -> remove payment log for this invoice
        setPayments(prev => prev.filter(p => !(p.refNo && p.refNo.includes(updatedInvoice.id)) && p.invoiceId !== updatedInvoice.id));

        // Add reversal log in client ledger
        const invPaymentReversalLedgerLog: ClientLedgerEntry = {
          id: `l-${Date.now()}`,
          tenantId: activeTenant.id,
          clientId: updatedInvoice.clientId,
          date: updatedInvoice.date || new Date().toLocaleDateString('en-IN'),
          type: 'Invoice Payment Reversed / Marked Unpaid',
          refNo: updatedInvoice.id,
          debit: reversedAmount,
          credit: 0,
          balance: (clients.find(c => c.id === updatedInvoice.clientId)?.outstandingBalance || 0) + reversedAmount
        };
        setLedger(prev => [invPaymentReversalLedgerLog, ...prev]);

        // Increase client outstanding balance back
        setClients(prev => prev.map(c => {
          if (c.id === updatedInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + reversedAmount
            };
          }
          return c;
        }));
      }

      // Sync linked repair job final bill amount and payment status
      if (updatedInvoice.linkedJobId) {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.id === updatedInvoice.linkedJobId) {
            return {
              ...job,
              finalBillAmount: updatedInvoice.grandTotal,
              paymentStatus: (updatedInvoice.isPaid || updatedInvoice.balanceAmount <= 0) ? 'Paid' : 'Unpaid'
            };
          }
          return job;
        }));
      }

      // Adjust product stock counts based on item changes between oldInvoice and updatedInvoice
      setProducts(prevProducts => {
        const updated = prevProducts.map(prod => {
          const oldMatched = oldInvoice ? oldInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod)) : [];
          const newMatched = updatedInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));

          const oldQty = oldMatched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
          const newQty = newMatched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

          const diffQty = newQty - oldQty;
          if (diffQty !== 0) {
            const newStock = Math.max(0, prod.stock - diffQty);
            return {
              ...prod,
              stock: newStock
            };
          }
          return prod;
        });
        setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updated));
        saveTenantCollectionToFirestore(activeTenant.id, 'products', updated);
        return updated;
      });

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_EDIT',
        details: `Updated tax invoice ${updatedInvoice.id} for ${updatedInvoice.clientName} (₹${updatedInvoice.grandTotal}). Status: ${updatedInvoice.isPaid ? 'PAID' : 'UNPAID'}.`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Tax Invoice ${updatedInvoice.id} updated & stock synced!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update invoice: ${err.message}`, true);
    }
  };

  const deleteInvoice = (id: string) => {
    try {
      const targetInvoice = invoices.find(inv => inv.id === id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));

      if (targetInvoice) {
        if (targetInvoice.paidAmount > 0) {
          // Remove payments recorded for this invoice
          setPayments(prev => prev.filter(p => !(p.refNo && p.refNo.includes(targetInvoice.id)) && p.invoiceId !== targetInvoice.id));

          // Restore client outstanding balance
          setClients(prev => prev.map(c => {
            if (c.id === targetInvoice.clientId) {
              return {
                ...c,
                outstandingBalance: c.outstandingBalance + targetInvoice.paidAmount
              };
            }
            return c;
          }));

          // Ledger reversal
          const reversalLog: ClientLedgerEntry = {
            id: `l-${Date.now()}`,
            tenantId: activeTenant.id,
            clientId: targetInvoice.clientId,
            date: new Date().toLocaleDateString('en-IN'),
            type: 'Invoice Deleted / Payment Voided',
            refNo: targetInvoice.id,
            debit: targetInvoice.paidAmount,
            credit: 0,
            balance: (clients.find(c => c.id === targetInvoice.clientId)?.outstandingBalance || 0) + targetInvoice.paidAmount
          };
          setLedger(prev => [reversalLog, ...prev]);
        }

        if (targetInvoice.linkedJobId) {
          setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === targetInvoice.linkedJobId) {
              return {
                ...job,
                paymentStatus: 'Unpaid'
              };
            }
            return job;
          }));
        }

        // Restore inventory product stock counts for items in deleted invoice
        if (targetInvoice.items && targetInvoice.items.length > 0) {
          setProducts(prevProducts => {
            const updated = prevProducts.map(prod => {
              const matched = targetInvoice.items.filter(item => isInvoiceItemProductMatch(item, prod));
              if (matched.length > 0) {
                const totalQtyToRestore = matched.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                return {
                  ...prod,
                  stock: prod.stock + totalQtyToRestore
                };
              }
              return prod;
            });
            setAppStorageItem(`products_${activeTenant.id}`, JSON.stringify(updated));
            saveTenantCollectionToFirestore(activeTenant.id, 'products', updated);
            return updated;
          });
        }
      }

      const audit: ActivityLog = {
        id: `log-${Date.now()}`,
        tenantId: activeTenant.id,
        timestamp: new Date().toLocaleString('en-GB', { hour12: false }),
        user: currentUser?.name || 'Admin',
        action: 'BILL_DELETE',
        details: `Deleted tax invoice ${id} for ${targetInvoice?.clientName || 'Client'}.`
      };
      setLogs(prev => [audit, ...prev]);
      triggerSaveNotification(`✓ Tax Invoice ${id} deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete invoice: ${err.message}`, true);
    }
  };

  const addProduct = (newProd: Omit<Product, 'id'>) => {
    try {
      const prod: Product = {
        id: `prod-${Date.now()}`,
        tenantId: activeTenant.id,
        ...newProd
      };
      setProducts([...products, prod]);
      triggerSaveNotification(`✓ Product "${newProd.name}" added to inventory & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to add product: ${err.message}`, true);
    }
  };

  const editProduct = (updatedProd: Product) => {
    try {
      setProducts(products.map(p => p.id === updatedProd.id ? updatedProd : p));
      triggerSaveNotification(`✓ Product "${updatedProd.name}" updated & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to edit product: ${err.message}`, true);
    }
  };

  const deleteProduct = (id: string) => {
    try {
      const p = products.find(prod => prod.id === id);
      setProducts(products.filter(p => p.id !== id));
      triggerSaveNotification(`✓ Product "${p?.name || id}" removed!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete product: ${err.message}`, true);
    }
  };

  const updateLedgerEntry = (updatedEntry: ClientLedgerEntry) => {
    try {
      const updatedLedger = ledger.map(l => l.id === updatedEntry.id ? updatedEntry : l);
      setLedger(updatedLedger);

      if (updatedEntry.clientId) {
        const clientLogs = updatedLedger.filter(l => l.clientId === updatedEntry.clientId);
        const totalDebit = clientLogs.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = clientLogs.reduce((sum, l) => sum + (l.credit || 0), 0);
        const newBalance = totalDebit - totalCredit;

        setClients(clients.map(c => c.id === updatedEntry.clientId ? { ...c, outstandingBalance: newBalance } : c));
      }
      triggerSaveNotification(`✓ Client ledger transaction updated & balance recalculation completed!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update ledger transaction: ${err.message}`, true);
    }
  };

  const addExpense = (newExp: Omit<Expense, 'id'>) => {
    try {
      const exp: Expense = {
        id: `exp-${Date.now()}`,
        ...newExp
      };
      setExpenses([exp, ...expenses]);
      triggerSaveNotification(`✓ Expense ₹${newExp.amount} recorded & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save expense: ${err.message}`, true);
    }
  };

  const deleteExpense = (id: string) => {
    try {
      setExpenses(expenses.filter(e => e.id !== id));
      triggerSaveNotification(`✓ Expense entry deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete expense: ${err.message}`, true);
    }
  };

  const addUser = (newUser: Omit<SystemUser, 'id'>) => {
    try {
      const u: SystemUser = {
        id: `user-${Date.now()}`,
        tenantId: activeTenant.id,
        status: 'Active',
        isDeactivated: false,
        ...newUser
      };
      const updatedUsers = [...users, u];
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      triggerSaveNotification(`✓ User account "${newUser.name}" (${newUser.role}) created & activated!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to save user account: ${err.message}`, true);
    }
  };

  const updateUser = (updatedUser: SystemUser) => {
    try {
      const updatedUsers = users.map(usr => usr.id === updatedUser.id ? { ...usr, ...updatedUser, tenantId: activeTenant.id } : usr);
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));

      // Update currentUser in state and session if editing current user
      if (currentUser && (currentUser.id === updatedUser.id || (currentUser.username && updatedUser.username && currentUser.username.toLowerCase() === updatedUser.username.toLowerCase()))) {
        const mergedUser = { ...currentUser, ...updatedUser };
        setCurrentUser(mergedUser);
        setAppSessionItem('current_user', JSON.stringify(mergedUser));
        if (updatedUser.role) {
          setUserRole(updatedUser.role);
          setAppSessionItem('user_role', updatedUser.role);
        }
      }

      triggerSaveNotification(`✓ Account "${updatedUser.name}" (${updatedUser.role}) updated successfully!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to update user account: ${err.message}`, true);
    }
  };

  const toggleUserStatus = (id: string) => {
    try {
      const u = users.find(usr => usr.id === id);
      if (!u) return;

      const isCurrentlyDeactivated = u.isDeactivated || u.status === 'Deactivated';

      // Protect against deactivating Master System Admin (+91 8149862034)
      if (u.mobile?.includes('8149862034') && !isCurrentlyDeactivated) {
        const remainingMasterAdmins = users.filter(usr => usr.mobile?.includes('8149862034') && usr.id !== id && !usr.isDeactivated && usr.status !== 'Deactivated');
        if (remainingMasterAdmins.length === 0) {
          triggerSaveNotification('🛡️ Security Protection: Master System Admin account (+91 8149862034) cannot be deactivated!', true);
          return;
        }
      }

      // If deactivating an Admin, ensure at least 1 active Admin remains
      if (!isCurrentlyDeactivated && u.role === 'Admin') {
        const remainingActiveAdmins = users.filter(usr => usr.role === 'Admin' && usr.id !== id && !usr.isDeactivated && usr.status !== 'Deactivated');
        if (remainingActiveAdmins.length === 0) {
          triggerSaveNotification('🛡️ Protection: You cannot deactivate the only active Admin account! Keep at least one active Admin.', true);
          return;
        }
      }

      const updatedUsers = users.map(usr => {
        if (usr.id === id) {
          const nextDeactivated = !isCurrentlyDeactivated;
          return {
            ...usr,
            isDeactivated: nextDeactivated,
            status: (nextDeactivated ? 'Deactivated' : 'Active') as 'Active' | 'Deactivated'
          };
        }
        return usr;
      });

      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      const actionLabel = isCurrentlyDeactivated ? 'Activated' : 'Deactivated';
      triggerSaveNotification(`✓ Account "${u.name}" (${u.role}) ${actionLabel}!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to change account status: ${err.message}`, true);
    }
  };

  const deleteUser = (id: string) => {
    try {
      const u = users.find(usr => usr.id === id);
      if (u) {
        if (u.mobile?.includes('8149862034')) {
          const remainingMasterAdmins = users.filter(usr => usr.mobile?.includes('8149862034') && usr.id !== id);
          if (remainingMasterAdmins.length === 0) {
            triggerSaveNotification('🛡️ Security Protection: Master System Admin account (+91 8149862034) cannot be deleted!', true);
            return;
          }
        }
        if (u.role === 'Admin') {
          const remainingAdmins = users.filter(usr => usr.role === 'Admin' && usr.id !== id);
          if (remainingAdmins.length === 0) {
            triggerSaveNotification('🛡️ Protection: You must keep at least 1 Admin account!', true);
            return;
          }
        }
      }

      const updatedUsers = users.filter(usr => usr.id !== id);
      setUsers(updatedUsers);
      setAppStorageItem(`users_${activeTenant.id}`, JSON.stringify(updatedUsers));
      triggerSaveNotification(`✓ Account "${u?.name || id}" (${u?.role || 'User'}) permanently deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Failed to delete user: ${err.message}`, true);
    }
  };

  const addCategory = (name: string) => {
    try {
      const next = [...categories, { id: `cat-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setCategories(next);
      setAppStorageItem(`categories_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Category "${name}" added & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding category: ${err.message}`, true);
    }
  };

  const addRack = (name: string) => {
    try {
      const next = [...racks, { id: `rack-${Date.now()}`, tenantId: activeTenant.id, name }];
      setRacks(next);
      setAppStorageItem(`racks_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Location rack "${name}" added & saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding rack: ${err.message}`, true);
    }
  };

  const addEquipment = (name: string) => {
    try {
      const next = [...equipments, { id: `eq-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setEquipments(next);
      setAppStorageItem(`equipments_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Equipment type "${name}" saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding equipment: ${err.message}`, true);
    }
  };

  const deleteEquipment = (id: string) => {
    try {
      const next = equipments.filter(e => e.id !== id);
      setEquipments(next);
      setAppStorageItem(`equipments_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Equipment type deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting equipment: ${err.message}`, true);
    }
  };

  const addProblem = (name: string) => {
    try {
      const next = [...problems, { id: `pb-${Date.now()}`, tenantId: activeTenant.id, name: name.toUpperCase() }];
      setProblems(next);
      setAppStorageItem(`problems_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Problem fault "${name}" saved!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error adding problem: ${err.message}`, true);
    }
  };

  const deleteProblem = (id: string) => {
    try {
      const next = problems.filter(p => p.id !== id);
      setProblems(next);
      setAppStorageItem(`problems_${activeTenant.id}`, JSON.stringify(next));
      triggerSaveNotification(`✓ Problem fault deleted!`);
    } catch (err: any) {
      triggerSaveNotification(`⚠️ Error deleting problem: ${err.message}`, true);
    }
  };

  const isStaffUser = userRole === 'Technician' || userRole === 'Front Desk' || userRole === 'HR' || userRole === 'Staff';

  // Compute navigation menu items dynamically based on tenant & staff permissions
  const getNavItems = () => {
    // 1. Master System Admin Platform Organization
    if (activeTenant?.id === 'org-admin') {
      return [
        { id: 'master_admin', label: 'Organizations Admin', icon: ShieldCheck },
        { id: 'clients', label: 'Client Organizations', icon: Building },
        { id: 'billing', label: 'Billing & Invoices', icon: Receipt },
        { id: 'reports', label: 'Platform Reports', icon: TrendingUp },
        { id: 'settings', label: 'System Settings', icon: Settings }
      ];
    }

    // 2. Organization Admin / Owner (Full Access across ERP)
    const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin' || (!isStaffUser && userRole !== 'Technician');
    let items: { id: string; label: string; icon: any }[] = [];

    if (isAdmin) {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'live_queue', label: 'Live Queue & Bench', icon: Kanban },
        { id: 'inwards', label: 'Repair Inwards', icon: Briefcase },
        { id: 'outwards', label: 'Outward Jobs', icon: Truck },
        { id: 'billing', label: 'Billing / Invoice', icon: Receipt },
        { id: 'clients', label: 'Clients Ledger', icon: Users },
        { id: 'payments', label: 'Payment History', icon: Wallet },
        { id: 'inventory', label: 'Inventory / Stock', icon: Package },
        { id: 'expenses', label: 'Expenses Outflow', icon: PiggyBank },
        { id: 'reports', label: 'Reports Hub', icon: TrendingUp },
        { id: 'settings', label: 'Setup Settings', icon: Settings }
      ];
    } else {
      // 3. Staff / Technician User (Dynamic Access strictly based on permissions saved by Admin)
      const perms = currentUser?.permissions || {};
      const hasExplicitPerms = !!(currentUser?.permissions && Object.keys(currentUser.permissions).length > 0);

      // Dashboard
      if (hasExplicitPerms ? !!perms.dashboard : true) {
        items.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
      }
      // Live Queue & Workbench
      if (hasExplicitPerms ? !!perms.operations : true) {
        items.push({ id: 'live_queue', label: 'Live Queue & Bench', icon: Kanban });
      }
      // Repair Inwards & Outward Jobs
      if (hasExplicitPerms ? !!perms.operations : true) {
        items.push({ id: 'inwards', label: 'Repair Inwards', icon: Briefcase });
        items.push({ id: 'outwards', label: 'Outward Jobs', icon: Truck });
      }
      // Billing / Invoice
      if (!!perms.billingInvoice || !!perms.billing) {
        items.push({ id: 'billing', label: 'Billing / Invoice', icon: Receipt });
      }
      // Clients Ledger
      if (!!perms.clientLedger) {
        items.push({ id: 'clients', label: 'Clients Ledger', icon: Users });
      }
      // Payment History
      if (!!perms.payments) {
        items.push({ id: 'payments', label: 'Payment History', icon: Wallet });
      }
      // Inventory / Stock
      if (!!perms.inventoryEdit || !!perms.inventory) {
        items.push({ id: 'inventory', label: 'Inventory / Stock', icon: Package });
      }
      // Expenses
      if (!!perms.accounts) {
        items.push({ id: 'expenses', label: 'Expenses Outflow', icon: PiggyBank });
      }
      // Reports Hub
      if (!!perms.reports) {
        items.push({ id: 'reports', label: 'Reports Hub', icon: TrendingUp });
      }
      // Setup Settings
      if (!!perms.setup) {
        items.push({ id: 'settings', label: 'Setup Settings', icon: Settings });
      }
    }

    // Filter by Organization Allowed Navigation Modules if restricted by Master Admin
    const allowedModules = activeTenant?.features?.allowedModules;
    if (allowedModules && allowedModules.length > 0 && activeTenant?.id !== 'org-admin') {
      items = items.filter(m => allowedModules.includes(m.id));
    }

    // Fallback if no items configured
    if (items.length === 0) {
      items.push({ id: 'inwards', label: 'Repair Inwards', icon: Briefcase });
    }

    return items;
  };

  // Ensure Admin and Staff are routed safely to allowed tabs
  React.useEffect(() => {
    const navItems = getNavItems();
    const isTabAllowed = navItems.some(item => item.id === activeTab);
    if (!isTabAllowed && navItems.length > 0) {
      setActiveTab(navItems[0].id);
    }
  }, [userRole, activeTab, activeTenant?.id, currentUser]);

  const activeThemePalette: TenantThemePalette = companyConfig.themePalette || DEFAULT_THEME_PALETTE;

  // STRICT AUTHENTICATION GUARD: Prevent any rendering or access to app features unless properly authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 select-none">
        <AuthModal
          isOpen={true}
          tenants={tenants}
          activeTenantId={activeTenant?.id}
          users={users}
          onAuthenticated={handleAuthenticated}
          onRegisterOrg={handleRegisterOrg}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen font-sans select-none overflow-hidden transition-colors duration-200" style={{ backgroundColor: activeThemePalette.appBg }} id="app-root-shell">
      {/* Save Notification Toast Banner */}
      {saveStatus && (
        <div className={`fixed top-4 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs border transition-all animate-bounce ${
          saveStatus.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/30'
            : 'bg-rose-600 text-white border-rose-500 shadow-rose-950/30'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}
      {/* Dynamic Theme Button & Font Accent Styles */}
      <style>{`
        .btn-theme-primary {
          background-color: ${activeThemePalette.buttonBg} !important;
          color: ${activeThemePalette.buttonText} !important;
        }
        .text-theme-accent {
          color: ${activeThemePalette.fontAccent} !important;
        }
      `}</style>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside 
            className="relative w-72 max-w-[85vw] flex flex-col justify-between h-full shadow-2xl z-10 transition-all duration-300"
            style={{ backgroundColor: activeThemePalette.sidebarBg, color: activeThemePalette.sidebarText }}
          >
            <div className="flex flex-col overflow-y-auto">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md shrink-0 overflow-hidden bg-white border border-white/20 p-0.5"
                  >
                    <img src={systemAppLogo} alt={`${systemAppName} Logo`} className="w-full h-full object-contain rounded-lg" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-sm font-black text-white tracking-wide block uppercase leading-tight truncate">
                      {systemAppName}
                    </span>
                    <span className="text-[9px] font-bold tracking-wider uppercase block truncate" style={{ color: activeThemePalette.fontAccent || '#5eead4' }} title={systemAppTagline}>
                      Inward &amp; Outward OS
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="p-4 space-y-1.5">
                {getNavItems().map((menu) => {
                  const Icon = menu.icon;
                  const isActive = activeTab === menu.id;
                  return (
                    <button
                      key={menu.id}
                      onClick={() => {
                        setActiveTab(menu.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer group`}
                      style={isActive ? {
                        backgroundColor: activeThemePalette.buttonBg,
                        color: activeThemePalette.buttonText,
                        boxShadow: `0 8px 16px -4px ${activeThemePalette.buttonBg}40`
                      } : {
                        color: activeThemePalette.sidebarText,
                        opacity: 0.85
                      }}
                    >
                      <Icon className="w-4.5 h-4.5 transition group-hover:scale-110" style={{ color: isActive ? activeThemePalette.buttonText : activeThemePalette.sidebarText }} />
                      <span>{menu.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] opacity-75 font-semibold text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-white tracking-wide">{systemAppName} Enterprise</span>
              </div>
              <p className="text-[9px] opacity-70 font-mono text-emerald-300">v1.0.0</p>
            </div>
          </aside>
        </div>
      )}

      {/* 1. Left Navigation Sidebar (Desktop) */}
      <aside 
        className="hidden lg:flex w-64 flex-col justify-between shrink-0 h-full border-r border-white/10 transition-colors duration-200"
        style={{ backgroundColor: activeThemePalette.sidebarBg, color: activeThemePalette.sidebarText }}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Brand header - Fixed Application Logo, Name, and Tagline */}
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md shrink-0 overflow-hidden bg-white border border-white/20 p-0.5"
            >
              <img src={systemAppLogo} alt={`${systemAppName} Logo`} className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="overflow-hidden">
              <span className="text-base font-black text-white tracking-wide block uppercase leading-tight truncate">
                {systemAppName}
              </span>
              <span className="text-[9px] font-bold tracking-wider uppercase block truncate" style={{ color: activeThemePalette.fontAccent || '#5eead4' }} title={systemAppTagline}>
                Inward &amp; Outward OS
              </span>
            </div>
          </div>

          {/* Menu items */}
          <nav className="p-4 space-y-1.5" id="sidebar-nav">
            {getNavItems().map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.id;
              return (
                <button
                  key={menu.id}
                  onClick={() => setActiveTab(menu.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer group`}
                  style={isActive ? {
                    backgroundColor: activeThemePalette.buttonBg,
                    color: activeThemePalette.buttonText,
                    boxShadow: `0 8px 16px -4px ${activeThemePalette.buttonBg}40`
                  } : {
                    color: activeThemePalette.sidebarText,
                    opacity: 0.85
                  }}
                >
                  <Icon className="w-4.5 h-4.5 transition group-hover:scale-110" style={{ color: isActive ? activeThemePalette.buttonText : activeThemePalette.sidebarText }} />
                  <span>{menu.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Brand credit info footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] opacity-75 font-semibold text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-white tracking-wide">{systemAppName} Enterprise</span>
          </div>
          <p className="text-[9px] opacity-70 font-mono text-emerald-300">v1.0.0</p>
        </div>
      </aside>

      {/* 2. Main Workstage Section */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Top Header Bar */}
        <header 
          className="h-16 border-b border-slate-100 flex items-center justify-between px-3 sm:px-6 shrink-0 z-30 transition-colors duration-200 gap-2"
          style={{ backgroundColor: activeThemePalette.topHeaderBg }}
        >
          
          {/* Company Title & Org Selector */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-teal-700" />
            </button>

            {/* Single Consolidated Organisation Info Badge */}
            <div className="flex items-center gap-2 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-200/80 min-w-0 max-w-[175px] xs:max-w-[220px] sm:max-w-none">
              {/* Organisation Logo / Badge */}
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs overflow-hidden">
                {companyConfig.logoUrl ? (
                  <img src={companyConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  (activeTenant?.name || activeCompany || 'O').charAt(0).toUpperCase()
                )}
              </div>

              {/* Organisation Details: Name, Number, and Role */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-left min-w-0">
                <span className="text-xs font-bold text-slate-800 leading-none truncate max-w-[110px] sm:max-w-[180px] md:max-w-none">
                  {activeTenant?.name || activeCompany}
                </span>
                
                {activeTenant?.ownerMobile && (
                  <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200/80 hidden sm:inline-block">
                    {activeTenant.ownerMobile}
                  </span>
                )}

                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-full border border-slate-200 hidden md:inline-block">
                  Role: {currentUser?.role || (activeTenant?.id === 'org-admin' || activeTenant?.code === 'ADMIN-00' ? 'System Admin' : 'Organization Owner')}
                </span>
              </div>
            </div>
          </div>

          {/* Sync icons / Notifications / Lock App button */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-semibold text-slate-600 shrink-0">
            {/* Real-time sync notifier */}
            <button
              onClick={handleSyncData}
              disabled={isSyncing}
              title={
                !isOnline
                  ? 'Device is offline. All data is saved locally in browser storage & PC backups until internet returns.'
                  : isSyncing
                  ? 'Synchronizing changes with Cloud Firestore & backing up local JSON files...'
                  : 'Data synchronized in real-time with Cloud Firestore & Local Storage. Click to trigger manual sync.'
              }
              className={`px-2 sm:px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 font-bold text-xs ${
                !isOnline
                  ? 'bg-amber-50/90 border-amber-200/90 text-amber-800 hover:bg-amber-100 shadow-2xs'
                  : isSyncing
                  ? 'bg-teal-50 border-teal-300 text-teal-800 animate-pulse shadow-2xs'
                  : 'bg-emerald-50/90 border-emerald-200/90 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wide hidden sm:inline text-amber-800">
                    Offline (Saved Locally)
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wide sm:hidden text-amber-800">
                    Offline
                  </span>
                </>
              ) : isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wide hidden sm:inline text-teal-800">
                    Syncing...
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wide sm:hidden text-teal-800">
                    Sync
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wide hidden sm:inline text-emerald-800">
                    Synced
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wide sm:hidden text-emerald-800">
                    OK
                  </span>
                </>
              )}
            </button>

            {/* Notification system */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 sm:p-2 hover:bg-slate-50 rounded-xl border border-slate-100 text-slate-500 cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-11 bg-white border border-slate-200/90 rounded-2xl shadow-2xl w-[calc(100vw-32px)] sm:w-80 max-w-sm p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-teal-600" /> Notifications & Broadcasts
                    </h4>
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                      {activeTenant?.name || 'Workspace'}
                    </span>
                  </div>

                  {/* Master Admin Broadcasts */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {announcements
                      .filter(a => a.targetTenantId === 'all' || a.targetTenantId === activeTenant?.id)
                      .map((ann, annIdx) => (
                        <div
                          key={ann.id ? `${ann.id}-${annIdx}` : `ann-${annIdx}`}
                          className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                            ann.severity === 'urgent'
                              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                              : ann.severity === 'warning'
                              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                              : 'bg-teal-50/80 border-teal-200 text-teal-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs block">{ann.title}</span>
                            <span className="text-[9px] font-mono opacity-70">{ann.createdAt.split(' ')[0]}</span>
                          </div>
                          <p className="text-[10px] leading-relaxed opacity-90 font-medium">{ann.message}</p>
                          <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 pt-0.5">
                            <span>👑 Platform Announcement</span>
                          </div>
                        </div>
                      ))}

                    {/* Standard System Logs */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                      <p className="pb-1 border-b border-slate-50 flex items-center justify-between">
                        <span>🔔 Backup success: Cloud schema synced</span>
                        <span className="font-mono text-[9px]">Just now</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>⚠️ Low Stock Alert: Keyboard inventory under 10</span>
                        <span className="font-mono text-[9px]">Today</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lock Session / Switch Org */}
            <button
              onClick={handleLockSession}
              title="Lock Session / Switch Organization"
              className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl cursor-pointer transition flex items-center gap-1 font-bold text-xs shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Lock</span>
            </button>
          </div>

        </header>

        {/* Offline / Network Disconnection Banner */}
        {!isOfflineBannerDismissed && !navigator.onLine && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold border-b border-amber-600 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-950/20 rounded-lg text-slate-950 font-bold shrink-0">
                <WifiOff className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <p className="font-bold text-slate-950 flex items-center gap-2">
                  <span>🌐 Offline Mode Active — Disconnected from Network</span>
                  <span className="bg-amber-950/20 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Saved Locally
                  </span>
                </p>
                <p className="text-[11px] text-slate-900 opacity-90 mt-0.5">
                  Your device is currently offline. All changes are being recorded in local storage and will sync to your Home Server once reconnected.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setIsSyncRetrying(true);
                  try {
                    await handleSyncData();
                    triggerSaveNotification('✓ Connection checked & synced');
                  } catch (err) {
                    console.error('Manual sync retry failed:', err);
                  } finally {
                    setIsSyncRetrying(false);
                  }
                }}
                disabled={isSyncRetrying}
                className="px-3 py-1.5 bg-slate-950 text-amber-300 hover:bg-slate-900 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncRetrying ? 'animate-spin' : ''}`} />
                <span>{isSyncRetrying ? 'Checking...' : 'Check Connection'}</span>
              </button>

              {(userRole === 'Admin' || userRole === 'Master Admin' || activeTenant?.id === 'org-admin') && (
                <button
                  type="button"
                  onClick={() => {
                    const dataToExport = {
                      tenantId: activeTenant.id,
                      orgName: companyConfig.name || activeTenant.name,
                      timestamp: new Date().toISOString(),
                      clients, jobs, invoices, products, ledger, payments, expenses, users, categories, racks, equipments, problems, companyConfig
                    };
                    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `INOMS_Local_Backup_${activeTenant.id}_${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-white/95 text-slate-900 hover:bg-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                  <span>Download JSON</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOfflineBannerDismissed(true)}
                className="p-1.5 text-slate-950/70 hover:text-slate-950 hover:bg-amber-600/40 rounded-lg transition cursor-pointer"
                title="Dismiss Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Screen stage area */}
        <div 
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 sm:pb-24 lg:pb-6 transition-colors duration-200" 
          id="applet-workstage"
          style={{ backgroundColor: activeThemePalette.appBg }}
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              clients={clients}
              jobs={jobs}
              payments={payments}
              onNavigate={(tab) => setActiveTab(tab)}
              onSync={handleSyncData}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'master_admin' && (
            <MasterAdminDashboard
              tenants={tenants}
              announcements={announcements}
              onRegisterOrg={handleRegisterOrg}
              onUpdateTenant={handleUpdateTenant}
              onToggleTenantStatus={handleToggleTenantStatus}
              onDeleteTenant={handleDeleteTenant}
              onSendAnnouncement={handleSendAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              pricingConfig={pricingConfig}
              onSavePricing={handleSavePricing}
              saasInvoices={saasInvoices}
              onAddSaasInvoice={handleAddSaasInvoice}
              onUpdateSaasInvoice={handleUpdateSaasInvoice}
              onDeleteSaasInvoice={handleDeleteSaasInvoice}
              onNavigateToSaasBilling={(tenantId) => {
                setInitialSaasBillingTenantId(tenantId || null);
                setActiveTab('billing');
              }}
              onNavigateToPricing={() => {
                setInitialSaasBillingTenantId(null);
                setActiveTab('billing');
              }}
            />
          )}

          {activeTab === 'clients' && (
            <Clients
              clients={clients}
              ledger={ledger}
              jobs={jobs}
              invoices={invoices}
              tenants={tenants}
              isAdmin={userRole === 'Admin'}
              isStaff={isStaffUser}
              currentUser={currentUser}
              onAddClient={addClient}
              onEditClient={editClient}
              onDeleteClient={deleteClient}
              onUpdateLedgerEntry={updateLedgerEntry}
              onToggleTenantStatus={handleToggleTenantStatus}
              onRegisterOrg={handleRegisterOrg}
              onNavigateToBillingForOrg={() => setActiveTab('billing')}
              onNavigateToJob={handleNavigateToJob}
              onNavigateToInvoice={handleNavigateToInvoice}
            />
          )}

          {activeTab === 'live_queue' && activeTenant.id !== 'org-admin' && (
            <LiveRepairQueue
              jobs={jobs}
              companyConfig={companyConfig}
              users={users}
              currentUser={currentUser}
              onSelectJob={(job) => {
                setInitialJobIdToView(job.id);
                setActiveTab('inwards');
              }}
              onUpdateJob={updateJob}
              onNewJobClick={() => {
                setActiveTab('inwards');
              }}
            />
          )}

          {activeTab === 'inwards' && activeTenant.id !== 'org-admin' && (
            <Inwards
              jobs={jobs}
              clients={clients}
              equipments={equipments}
              problems={problems}
              products={products}
              companyConfig={companyConfig}
              users={users}
              currentUser={currentUser}
              userRole={userRole}
              initialJobIdToView={initialJobIdToView}
              onClearInitialJobIdToView={() => setInitialJobIdToView(null)}
              onAddJob={addJob}
              onUpdateJob={updateJob}
              onDeleteJob={deleteJob}
              onAddClient={addClient}
              onOpenOutwardJob={(jobId) => {
                setActiveTab('outwards');
                setInitialJobIdToView(jobId);
              }}
              onRecordPayment={(payData) => {
                const clientObj = clients.find(c => c.id === payData.clientId);
                addPayment({
                  clientId: payData.clientId,
                  clientName: clientObj?.name || 'Unknown',
                  date: new Date().toISOString().split('T')[0],
                  amount: payData.amount,
                  mode: payData.mode,
                  remarks: payData.remarks
                });
              }}
            />
          )}

          {activeTab === 'outwards' && activeTenant.id !== 'org-admin' && (
            <Outwards
              jobs={jobs}
              clients={clients}
              invoices={invoices}
              companyConfig={companyConfig}
              userRole={userRole}
              currentUser={currentUser}
              tenantFeatures={activeTenant?.features}
              initialJobIdToView={initialJobIdToView}
              onClearInitialJobIdToView={() => setInitialJobIdToView(null)}
              onUpdateJob={updateJob}
              onDeleteJob={deleteJob}
              onGenerateInvoiceForJob={(job) => {
                setSelectedJobForInvoice(job);
                setActiveTab('billing');
              }}
            />
          )}

          {activeTab === 'billing' && (
            <Billing
              invoices={invoices}
              clients={clients}
              jobs={jobs}
              products={products}
              companyConfig={companyConfig}
              tenants={tenants}
              tenantFeatures={activeTenant?.features}
              isAdmin={userRole === 'Admin'}
              currentUser={currentUser}
              activeTenantId={activeTenant.id}
              initialJobForInvoice={selectedJobForInvoice}
              onClearInitialJobForInvoice={() => setSelectedJobForInvoice(null)}
              initialInvoiceIdToView={initialInvoiceIdToView}
              onClearInitialInvoiceIdToView={() => setInitialInvoiceIdToView(null)}
              onAddInvoice={addInvoice}
              onUpdateInvoice={updateInvoice}
              onDeleteInvoice={deleteInvoice}
              onAddClient={addClient}
              pricingConfig={pricingConfig}
              onSavePricing={handleSavePricing}
              saasInvoices={saasInvoices}
              onAddSaasInvoice={handleAddSaasInvoice}
              onUpdateSaasInvoice={handleUpdateSaasInvoice}
              onDeleteSaasInvoice={handleDeleteSaasInvoice}
              initialSaasBillingTenantId={initialSaasBillingTenantId}
              onClearInitialSaasBillingTenantId={() => setInitialSaasBillingTenantId(null)}
            />
          )}

          {activeTab === 'payments' && (
            <Payments
              payments={payments}
              clients={clients}
              invoices={invoices}
              jobs={jobs}
              companyConfig={companyConfig}
              userRole={userRole}
              currentUser={currentUser}
              onAddPayment={addPayment}
              onUpdatePayment={updatePayment}
              onDeletePayment={deletePayment}
              onNavigateToJob={handleNavigateToJob}
              onNavigateToInvoice={handleNavigateToInvoice}
            />
          )}

          {activeTab === 'inventory' && activeTenant.id !== 'org-admin' && (
            <Inventory
              products={products}
              categories={categories}
              racks={racks}
              isStaff={isStaffUser}
              currentUser={currentUser}
              userRole={userRole}
              onAddProduct={addProduct}
              onEditProduct={editProduct}
              onDeleteProduct={deleteProduct}
              onAddCategory={addCategory}
              onAddRack={addRack}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses
              expenses={expenses}
              onAddExpense={addExpense}
              onDeleteExpense={deleteExpense}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              jobs={jobs}
              payments={payments}
              invoices={invoices}
              expenses={expenses}
              clients={clients}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsComponent
              activeTenantId={activeTenant.id}
              userRole={userRole}
              currentUser={currentUser}
              tenantFeatures={activeTenant?.features}
              isStaff={isStaffUser}
              users={users}
              logs={logs.filter(l => !l.tenantId || l.tenantId === activeTenant.id)}
              equipments={equipments}
              problems={problems}
              companyConfig={companyConfig}
              onChangeCompanyConfig={(newCfg) => {
                setCompanyConfig(newCfg);
                triggerSaveNotification('✓ Store settings & company profile saved!');
              }}
              fontSize={fontSize}
              onChangeFontSize={setFontSize}
              onAddUser={addUser}
              onUpdateUser={updateUser}
              onDeleteUser={deleteUser}
              onToggleUserStatus={toggleUserStatus}
              onAddEquipment={addEquipment}
              onDeleteEquipment={deleteEquipment}
              onAddProblem={addProblem}
              onDeleteProblem={deleteProblem}
              appData={{
                clients,
                jobs,
                invoices,
                products,
                ledger,
                payments,
                expenses,
                users,
                categories,
                racks,
                equipments,
                problems,
                companyConfig
              }}
              onRestoreData={(restored) => {
                const tagTenant = (items: any[]) => Array.isArray(items) ? items.map(item => ({ ...item, tenantId: activeTenant.id })) : items;
                if (restored.clients) setClients(tagTenant(restored.clients));
                if (restored.jobs) setJobs(tagTenant(restored.jobs));
                if (restored.invoices) setInvoices(tagTenant(restored.invoices));
                if (restored.products) setProducts(tagTenant(restored.products));
                if (restored.ledger) setLedger(tagTenant(restored.ledger));
                if (restored.payments) setPayments(tagTenant(restored.payments));
                if (restored.expenses) setExpenses(tagTenant(restored.expenses));
                if (restored.users) setUsers(tagTenant(restored.users));
                if (restored.categories) setCategories(tagTenant(restored.categories));
                if (restored.racks) setRacks(tagTenant(restored.racks));
                if (restored.equipments) setEquipments(tagTenant(restored.equipments));
                if (restored.problems) setProblems(tagTenant(restored.problems));
                if (restored.companyConfig) setCompanyConfig(prev => ({ ...prev, ...restored.companyConfig }));
                triggerSaveNotification(`✓ Records & settings successfully restored & synchronized for ${activeTenant.name}!`);
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Native Bottom Navigation Bar */}
      <div 
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg lg:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab(activeTenant.id === 'org-admin' ? 'master_admin' : 'dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'dashboard' || activeTab === 'master_admin'
              ? 'text-teal-700 font-extrabold bg-teal-50/70'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Overview</span>
        </button>

        {activeTenant.id !== 'org-admin' && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('inwards')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
                activeTab === 'inwards'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Briefcase className="w-5 h-5 mb-0.5" />
                {jobs.filter(j => j.status === 'Received' || j.status === 'Under Diagnosis').length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {jobs.filter(j => j.status === 'Received' || j.status === 'Under Diagnosis').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight">Inwards</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('live_queue')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
                activeTab === 'live_queue'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Kanban className="w-5 h-5 mb-0.5" />
                {jobs.filter(j => j.status === 'Under Repair' || j.status === 'Parts Required' || j.status === 'Ready for Delivery').length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-teal-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {jobs.filter(j => j.status === 'Under Repair' || j.status === 'Parts Required' || j.status === 'Ready for Delivery').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight">Queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outwards')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                activeTab === 'outwards'
                  ? 'text-teal-700 font-extrabold bg-teal-50/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">Outwards</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-slate-800"
        >
          <Menu className="w-5 h-5 mb-0.5 text-teal-600" />
          <span className="text-[10px] leading-tight font-medium">Menu</span>
        </button>
      </div>

      {/* Security & Authenticator Modal */}
      <AuthModal
        isOpen={showAuthModal}
        tenants={tenants}
        activeTenantId={activeTenant?.id}
        users={users}
        onAuthenticated={handleAuthenticated}
        onRegisterOrg={handleRegisterOrg}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
