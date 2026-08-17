/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import MicrosoftAuthQR from './MicrosoftAuthQR';
import { saveDirectoryHandle, getDirectoryHandle, removeDirectoryHandle, writeBackupToDirectoryHandle } from '../lib/directoryHandleStorage';
import { getBackupOrgPrefix } from '../lib/backupUtils';
import { getAppStorageItem, setAppStorageItem } from '../lib/storage';
import {
  Settings,
  Plus,
  Trash2,
  X,
  Shield,
  FileCheck,
  RefreshCw,
  FolderSync,
  CloudLightning,
  QrCode,
  UserCheck,
  HardDrive,
  Cpu,
  Key,
  Database,
  Type,
  Download,
  Upload,
  Palette,
  Check,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Laptop,
  Folder,
  Lock,
  ExternalLink,
  ShieldCheck,
  Cloud,
  Mail,
  ArrowRight,
  FileSpreadsheet,
  Info,
  Edit,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react';
import { SystemUser, ActivityLog, Equipment, Problem, CompanyConfig, Client, RepairJob, Invoice, Product, Payment, Expense, DEFAULT_THEME_PALETTE, TenantThemePalette } from '../types';
import { TenantFeatures, getTenantFeatures, TenantOrg } from './AuthModal';
import { updateOrgViaApi, scanAndImportDataFolderApi, getDataFolderStatusApi } from '../lib/api';

interface SettingsProps {
  activeTenantId?: string;
  activeTenant?: TenantOrg;
  onUpdateTenant?: (updatedOrg: TenantOrg) => void;
  userRole?: string;
  currentUser?: SystemUser | null;
  tenantFeatures?: TenantFeatures;
  isStaff?: boolean;
  users: SystemUser[];
  logs: ActivityLog[];
  equipments: Equipment[];
  problems: Problem[];
  companyConfig: CompanyConfig;
  onChangeCompanyConfig: (config: CompanyConfig) => void;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  onAddUser: (user: Omit<SystemUser, 'id'>) => void;
  onUpdateUser?: (user: SystemUser) => void;
  onDeleteUser: (id: string) => void;
  onToggleUserStatus?: (id: string) => void;
  onAddEquipment: (name: string) => void;
  onDeleteEquipment: (id: string) => void;
  onAddProblem: (name: string) => void;
  onDeleteProblem: (id: string) => void;
  appData?: {
    clients: Client[];
    jobs: RepairJob[];
    invoices: Invoice[];
    products: Product[];
    ledger: any[];
    payments: Payment[];
    expenses: Expense[];
    users?: SystemUser[];
    categories?: any[];
    racks?: any[];
    equipments?: Equipment[];
    problems?: Problem[];
    companyConfig?: CompanyConfig;
  };
  onRestoreData?: (data: any) => void;
}

export default function SettingsComponent({
  activeTenantId,
  activeTenant,
  onUpdateTenant,
  userRole,
  currentUser,
  tenantFeatures,
  isStaff = false,
  users,
  logs,
  equipments,
  problems,
  companyConfig,
  onChangeCompanyConfig,
  fontSize,
  onChangeFontSize,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  onAddEquipment,
  onDeleteEquipment,
  onAddProblem,
  onDeleteProblem,
  appData,
  onRestoreData
}: SettingsProps) {
  const features = getTenantFeatures(tenantFeatures);
  const currentTenantId = activeTenantId || 'org-admin';
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'theme' | 'backup' | 'masters' | 'admin'>('profile');
  const [showMicrosoftAuthQRModal, setShowMicrosoftAuthQRModal] = useState<boolean>(false);

  // Organization Security PIN & 2FA state
  const [orgPinInput, setOrgPinInput] = useState<string>(activeTenant?.pin || '');
  const [showOrgPin, setShowOrgPin] = useState<boolean>(false);
  const [isSavingOrgPin, setIsSavingOrgPin] = useState<boolean>(false);
  const [orgPinStatusMsg, setOrgPinStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);

  // Data Folder scan & migration state
  const [isScanningDataFolder, setIsScanningDataFolder] = useState<boolean>(false);
  const [dataFolderResult, setDataFolderResult] = useState<{
    success: boolean;
    filesScanned: number;
    filesImported: string[];
    counts: Record<string, number>;
    message: string;
  } | null>(null);
  const [dataFolderStatus, setDataFolderStatus] = useState<any>(null);

  const loadDataFolderStatus = async () => {
    try {
      const res = await getDataFolderStatusApi();
      if (res && res.success) {
        setDataFolderStatus(res);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (activeSubTab === 'backup') {
      loadDataFolderStatus();
    }
  }, [activeSubTab]);

  const handleScanDataFolder = async () => {
    setIsScanningDataFolder(true);
    setDataFolderResult(null);
    try {
      const res = await scanAndImportDataFolderApi();
      setDataFolderResult(res);
      await loadDataFolderStatus();
      if (res.success && res.filesImported && res.filesImported.length > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2200);
      }
    } catch (err: any) {
      setDataFolderResult({
        success: false,
        filesScanned: 0,
        filesImported: [],
        counts: {},
        message: err?.message || 'Error scanning data folder'
      });
    } finally {
      setIsScanningDataFolder(false);
    }
  };

  useEffect(() => {
    if (activeTenant?.pin !== undefined) {
      setOrgPinInput(activeTenant.pin || '');
    }
  }, [activeTenant?.pin]);

  const handleSaveOrgPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingOrgPin(true);
    setOrgPinStatusMsg(null);
    try {
      const cleanPin = orgPinInput.trim();
      const res = await updateOrgViaApi({
        id: currentTenantId,
        pin: cleanPin // Blank/empty string clears PIN and enforces Microsoft Authenticator TOTP
      });
      if (res.success) {
        if (activeTenant && onUpdateTenant) {
          onUpdateTenant({
            ...activeTenant,
            pin: cleanPin
          });
        }
        setOrgPinStatusMsg({
          text: cleanPin
            ? `✓ Security PIN successfully updated to ${cleanPin.length} digits!`
            : '✓ Security PIN cleared! Workspace now requires 6-digit dynamic passcode from Microsoft Authenticator on login.'
        });
        setTimeout(() => setOrgPinStatusMsg(null), 6000);
      } else {
        setOrgPinStatusMsg({ text: res.message || 'Failed to update PIN', isError: true });
      }
    } catch (err: any) {
      setOrgPinStatusMsg({ text: err.message || 'Failed to update PIN', isError: true });
    } finally {
      setIsSavingOrgPin(false);
    }
  };

  const activePalette: TenantThemePalette = companyConfig.themePalette || DEFAULT_THEME_PALETTE;

  const handleUpdatePalette = (updated: Partial<TenantThemePalette>) => {
    const newPal = { ...activePalette, ...updated };
    onChangeCompanyConfig({
      ...companyConfig,
      themePalette: newPal
    });
  };

  // Logo file upload handler with canvas optimization for fast real-time multi-device sync
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Logo file size must be under 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const rawDataUrl = evt.target?.result as string;
        if (!rawDataUrl) return;

        // Auto-optimize image size (max 400x400) for fast multi-device sync
        const img = new Image();
        img.onload = () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
            onChangeCompanyConfig({
              ...companyConfig,
              logoUrl: optimizedDataUrl
            });
          } else {
            onChangeCompanyConfig({
              ...companyConfig,
              logoUrl: rawDataUrl
            });
          }
        };
        img.onerror = () => {
          onChangeCompanyConfig({
            ...companyConfig,
            logoUrl: rawDataUrl
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    onChangeCompanyConfig({
      ...companyConfig,
      logoUrl: ''
    });
  };

  // Dedicated App Branding Logo Uploader for Master Admin
  const appLogoInputRef = React.useRef<HTMLInputElement | null>(null);
  const appLogoInputRef2 = React.useRef<HTMLInputElement | null>(null);
  const handleAppLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('App logo file size must be under 5MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const rawDataUrl = evt.target?.result as string;
        if (!rawDataUrl) return;

        const img = new Image();
        img.onload = () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedDataUrl = canvas.toDataURL('image/png');
            onChangeCompanyConfig({
              ...companyConfig,
              appLogoUrl: optimizedDataUrl
            });
          } else {
            onChangeCompanyConfig({
              ...companyConfig,
              appLogoUrl: rawDataUrl
            });
          }
        };
        img.onerror = () => {
          onChangeCompanyConfig({
            ...companyConfig,
            appLogoUrl: rawDataUrl
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // UPI QR Code file upload handler
  const upiQrInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleUpiQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('UPI QR Code image size must be under 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onChangeCompanyConfig({
            ...companyConfig,
            upiQrUrl: evt.target.result as string
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveUpiQr = () => {
    onChangeCompanyConfig({
      ...companyConfig,
      upiQrUrl: ''
    });
  };

  // Digital Signature Canvas drawing handlers
  const signatureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);

  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingSignature(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingSignature = () => {
    setIsDrawingSignature(false);
  };

  const clearSignaturePad = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    onChangeCompanyConfig({
      ...companyConfig,
      signatureUrl: ''
    });
  };

  const saveSignaturePad = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChangeCompanyConfig({
      ...companyConfig,
      signatureUrl: dataUrl
    });
    alert('✓ Digital Signature saved successfully!');
  };

  // Export Activity Logs to Excel file handler
  const handleExportActivityLogsExcel = () => {
    const rows = logs.map(l => ({
      'Timestamp': l.timestamp,
      'User / Account': l.user,
      'Action Performed': l.action,
      'Audit Details': l.details
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Info': 'No activity logs recorded yet' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    const filename = `System_Activity_Logs_${companyConfig.name.replace(/[^a-zA-Z0-0]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Master states & refs
  const [newEqName, setNewEqName] = useState('');
  const [newProbName, setNewProbName] = useState('');
  const eqInputRef = useRef<HTMLInputElement>(null);
  const probInputRef = useRef<HTMLInputElement>(null);

  const handleAddEquipment = () => {
    const trimmed = newEqName.trim();
    if (trimmed) {
      onAddEquipment(trimmed.toUpperCase());
      setNewEqName('');
      setTimeout(() => eqInputRef.current?.focus(), 0);
    }
  };

  const handleAddProblem = () => {
    const trimmed = newProbName.trim();
    if (trimmed) {
      onAddProblem(trimmed.toUpperCase());
      setNewProbName('');
      setTimeout(() => probInputRef.current?.focus(), 0);
    }
  };

  // Sync mode states - mapped to companyConfig
  const syncMode = companyConfig.syncMode;
  const setSyncMode = (val: 'offline' | 'wifi' | 'lan') => {
    onChangeCompanyConfig({ ...companyConfig, syncMode: val });
  };

  const lanHostIp = companyConfig.lanHostIp;
  const setLanHostIp = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, lanHostIp: val });
  };

  // Google Drive states - mapped to companyConfig
  const driveConnected = companyConfig.driveConnected;
  const setDriveConnected = (val: boolean) => {
    onChangeCompanyConfig({ ...companyConfig, driveConnected: val });
  };

  const driveEmail = companyConfig.driveAccountEmail || 'sujitg5116@gmail.com';
  const setDriveEmail = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, driveAccountEmail: val });
  };

  const driveFolderPath = companyConfig.driveFolderPath || 'My Drive / INOMS_Cloud_Backups /';
  const setDriveFolderPath = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, driveFolderPath: val });
  };

  const lastDriveBackupTime = companyConfig.lastDriveBackupTime || 'None';
  const setLastDriveBackupTime = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, lastDriveBackupTime: val });
  };

  const autoBackupTimes = companyConfig.autoBackupTimes || ['10:00', '18:00'];
  const setAutoBackupTimes = (val: string[]) => {
    onChangeCompanyConfig({ ...companyConfig, autoBackupTimes: val });
  };

  // Local Machine PC Backup states - mapped to companyConfig
  const localBackupEnabled = companyConfig.localBackupEnabled ?? true;
  const setLocalBackupEnabled = (val: boolean) => {
    onChangeCompanyConfig({ ...companyConfig, localBackupEnabled: val });
  };

  const localBackupPath = companyConfig.localBackupPath || 'C:\\INOMS_Backups\\';
  const setLocalBackupPath = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, localBackupPath: val });
  };

  const localBackupScheduleTime = companyConfig.localBackupScheduleTime || '18:00';
  const setLocalBackupScheduleTime = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, localBackupScheduleTime: val });
  };

  const localBackupFrequency = 'on_sync';
  const setLocalBackupFrequency = (val: CompanyConfig['localBackupFrequency']) => {
    onChangeCompanyConfig({ ...companyConfig, localBackupFrequency: val });
  };

  const lastLocalBackupTime = companyConfig.lastLocalBackupTime || 'None';
  const setLastLocalBackupTime = (val: string) => {
    onChangeCompanyConfig({ ...companyConfig, lastLocalBackupTime: val });
  };

  const [localBackupSuccessMsg, setLocalBackupSuccessMsg] = useState<string>('');

  const [localBackupHistory, setLocalBackupHistory] = useState<Array<{ id: string; filename: string; date: string; size: string; path: string }>>([
    { id: 'l-1', filename: 'RepairTrack_Local_Backup_2026-07-26_08-00-00.json', date: '2026-07-26 08:00:00', size: '142 KB', path: localBackupPath },
    { id: 'l-2', filename: 'RepairTrack_Local_Backup_2026-07-25_18-00-00.json', date: '2026-07-25 18:00:00', size: '138 KB', path: localBackupPath },
  ]);

  // Local Directory Handle state for File System Access API
  const [localDirectoryHandle, setLocalDirectoryHandle] = useState<any>(() => (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`] || (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`] || null);

  useEffect(() => {
    let isMounted = true;
    getDirectoryHandle(currentTenantId).then(handle => {
      if (isMounted) {
        if (handle) {
          (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`] = handle;
          (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`] = handle;
          setLocalDirectoryHandle(handle);
          setLocalBackupPath(handle.name);
        } else {
          setLocalDirectoryHandle(null);
        }
      }
    });
    return () => { isMounted = false; };
  }, [currentTenantId]);

  // Handler to browse and select local PC folder using Directory Picker
  const handleSelectTargetDirectory = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (handle) {
          await saveDirectoryHandle(handle, currentTenantId);
          (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`] = handle;
          (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`] = handle;
          setLocalDirectoryHandle(handle);
          setLocalBackupPath(handle.name);
          setLocalBackupSuccessMsg(`✓ Target PC folder connected: "${handle.name}". Background backups will save directly to this folder silently without popping up any Save window!`);
          setTimeout(() => setLocalBackupSuccessMsg(''), 7000);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Directory Picker error:', err);
        }
      }
    } else {
      const customPath = prompt('Enter target computer folder location on your PC:', localBackupPath);
      if (customPath) {
        setLocalBackupPath(customPath);
        setLocalBackupSuccessMsg(`✓ Target computer path set to: "${customPath}".`);
        setTimeout(() => setLocalBackupSuccessMsg(''), 5000);
      }
    }
  };

  // Handler for manual Local Machine Backup (date and time wise JSON file write/download)
  const triggerLocalMachineBackup = async (isScheduled: boolean = false) => {
    const isOwnerOrMaster = userRole === 'Admin' || userRole === 'Master Admin' || currentTenantId === 'org-admin';
    if (!isOwnerOrMaster) {
      setLocalBackupSuccessMsg('⚠️ Local backup downloads are restricted to Organization Owner and Master Admin accounts.');
      return;
    }
    const dataToExport = appData ? { tenantId: currentTenantId, orgName: companyConfig.name, ...appData } : {
      tenantId: currentTenantId,
      orgName: companyConfig.name,
      clients: JSON.parse(getAppStorageItem(`clients_${currentTenantId}`) || '[]'),
      jobs: JSON.parse(getAppStorageItem(`jobs_${currentTenantId}`) || '[]'),
      invoices: JSON.parse(getAppStorageItem(`invoices_${currentTenantId}`) || '[]'),
      products: JSON.parse(getAppStorageItem(`products_${currentTenantId}`) || '[]'),
      ledger: JSON.parse(getAppStorageItem(`ledger_${currentTenantId}`) || '[]'),
      payments: JSON.parse(getAppStorageItem(`payments_${currentTenantId}`) || '[]'),
      expenses: JSON.parse(getAppStorageItem(`expenses_${currentTenantId}`) || '[]'),
      users: JSON.parse(getAppStorageItem(`users_${currentTenantId}`) || '[]'),
      categories: JSON.parse(getAppStorageItem(`categories_${currentTenantId}`) || '[]'),
      racks: JSON.parse(getAppStorageItem(`racks_${currentTenantId}`) || '[]'),
      equipments: JSON.parse(getAppStorageItem(`equipments_${currentTenantId}`) || '[]'),
      problems: JSON.parse(getAppStorageItem(`problems_${currentTenantId}`) || '[]'),
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
    const orgPrefix = getBackupOrgPrefix(companyConfig.name, currentTenantId);
    const filename = `${orgPrefix}_Local_Backup_${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}.json`;
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const sizeKB = `${Math.ceil(jsonStr.length / 1024)} KB`;

    let dirHandle = localDirectoryHandle || (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`] || (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`];
    if (!dirHandle) {
      dirHandle = await getDirectoryHandle(currentTenantId);
      if (dirHandle) {
        (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`] = dirHandle;
        (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`] = dirHandle;
        setLocalDirectoryHandle(dirHandle);
      }
    }

    // Try direct silent file write if directory handle is selected
    if (dirHandle) {
      const success = await writeBackupToDirectoryHandle(dirHandle, filename, jsonStr);
      if (success) {
        setLastLocalBackupTime(formattedTimestamp);
        setLocalBackupHistory(prev => [
          { id: `l-${Date.now()}`, filename, date: formattedTimestamp, size: sizeKB, path: dirHandle.name },
          ...prev
        ]);

        const msg = isScheduled
          ? `⏰ Auto-Backup Saved: "${filename}" written silently into PC folder "${dirHandle.name}"`
          : `✓ Backup Saved Directly: "${filename}" (${sizeKB}) written silently to PC folder "${dirHandle.name}" without popups!`;

        setLocalBackupSuccessMsg(msg);
        setTimeout(() => setLocalBackupSuccessMsg(''), 7000);
        return;
      }
    }

    // Direct browser file download fallback ONLY for explicit manual button click
    if (!isScheduled) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastLocalBackupTime(formattedTimestamp);
      setLocalBackupHistory(prev => [
        { id: `l-${Date.now()}`, filename, date: formattedTimestamp, size: sizeKB, path: localBackupPath || 'Downloads' },
        ...prev
      ]);
      setLocalBackupSuccessMsg(`✓ Manual backup file "${filename}" generated!`);
      setTimeout(() => setLocalBackupSuccessMsg(''), 5000);
    }
  };

  // Handler for Manual Excel Export with multi-sheets for all application collections
  const triggerExcelExport = () => {
    const clientsData = appData?.clients || JSON.parse(getAppStorageItem(`clients_${currentTenantId}`) || '[]');
    const jobsData = appData?.jobs || JSON.parse(getAppStorageItem(`jobs_${currentTenantId}`) || '[]');
    const invoicesData = appData?.invoices || JSON.parse(getAppStorageItem(`invoices_${currentTenantId}`) || '[]');
    const productsData = appData?.products || JSON.parse(getAppStorageItem(`products_${currentTenantId}`) || '[]');
    const ledgerData = appData?.ledger || JSON.parse(getAppStorageItem(`ledger_${currentTenantId}`) || '[]');
    const paymentsData = appData?.payments || JSON.parse(getAppStorageItem(`payments_${currentTenantId}`) || '[]');
    const expensesData = appData?.expenses || JSON.parse(getAppStorageItem(`expenses_${currentTenantId}`) || '[]');

    const wb = XLSX.utils.book_new();

    // 1. Clients Sheet
    const clientsRows = clientsData.map((c: any) => ({
      'Client ID': c.id,
      'Client Name': c.name,
      'Mobile Number': c.mobile,
      'Email Address': c.email || '',
      'Address': c.address || '',
      'GSTIN': c.gstin || '',
      'Total Repair Jobs': c.totalJobs || 0,
      'Outstanding Balance (₹)': c.outstandingBalance || 0,
      'Created Date': c.createdAt || ''
    }));
    const wsClients = XLSX.utils.json_to_sheet(clientsRows.length > 0 ? clientsRows : [{ 'Info': 'No clients' }]);
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clients');

    // 2. Repair Jobs Sheet
    const jobsRows = jobsData.map((j: any) => ({
      'Job Ticket No': j.jobNo,
      'Client Name': j.clientName,
      'Client Mobile': j.clientMobile || '',
      'Device / Equipment': j.equipment,
      'Brand & Model': j.model,
      'Serial Number': j.serialNo || '',
      'Reported Issue': j.issue,
      'Status': j.status,
      'Technician': j.technician || '',
      'Estimated Cost (₹)': j.estimatedCost || 0,
      'Advance Paid (₹)': j.advancePaid || 0,
      'Received Date': j.receivedDate || j.createdAt || ''
    }));
    const wsJobs = XLSX.utils.json_to_sheet(jobsRows.length > 0 ? jobsRows : [{ 'Info': 'No repair jobs' }]);
    XLSX.utils.book_append_sheet(wb, wsJobs, 'Repair Jobs');

    // 3. Invoices Sheet
    const invoicesRows = invoicesData.map((inv: any) => ({
      'Invoice Number': inv.invoiceNo,
      'Invoice Date': inv.date,
      'Client Name': inv.clientName,
      'Subtotal (₹)': inv.subtotal || 0,
      'Tax Amount (₹)': inv.tax || 0,
      'Discount (₹)': inv.discount || 0,
      'Grand Total (₹)': inv.grandTotal || inv.total || 0,
      'Paid Amount (₹)': inv.paidAmount || 0,
      'Status': inv.status || 'Paid'
    }));
    const wsInvoices = XLSX.utils.json_to_sheet(invoicesRows.length > 0 ? invoicesRows : [{ 'Info': 'No invoices' }]);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // 4. Products / Inventory Sheet
    const productsRows = productsData.map((p: any) => ({
      'SKU / Code': p.code || p.id,
      'Product Name': p.name,
      'Category': p.category || '',
      'In Stock Quantity': p.stock || 0,
      'Purchase Price (₹)': p.buyPrice || 0,
      'Selling Price (₹)': p.sellPrice || p.price || 0,
      'Rack / Storage': p.rack || ''
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productsRows.length > 0 ? productsRows : [{ 'Info': 'No inventory items' }]);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Inventory');

    // 5. General Ledger Sheet
    const ledgerRows = ledgerData.map((l: any) => ({
      'Txn ID': l.id,
      'Date': l.date,
      'Description': l.description,
      'Category': l.category || '',
      'Debit (₹)': l.debit || 0,
      'Credit (₹)': l.credit || 0,
      'Running Balance (₹)': l.balance || 0
    }));
    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows.length > 0 ? ledgerRows : [{ 'Info': 'No ledger entries' }]);
    XLSX.utils.book_append_sheet(wb, wsLedger, 'General Ledger');

    // 6. Payments Received Sheet
    const paymentsRows = paymentsData.map((pay: any) => ({
      'Payment ID': pay.id,
      'Date & Time': pay.date,
      'Client Name': pay.clientName || '',
      'Amount (₹)': pay.amount || 0,
      'Payment Method': pay.method || 'Cash',
      'Ref / UTR No': pay.referenceNo || '',
      'Notes': pay.notes || ''
    }));
    const wsPayments = XLSX.utils.json_to_sheet(paymentsRows.length > 0 ? paymentsRows : [{ 'Info': 'No payment logs' }]);
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments Received');

    // 7. Expenses Sheet
    const expensesRows = expensesData.map((exp: any) => ({
      'Expense ID': exp.id,
      'Date': exp.date,
      'Category': exp.category,
      'Amount (₹)': exp.amount,
      'Description': exp.description || '',
      'Approved By': exp.approvedBy || ''
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesRows.length > 0 ? expensesRows : [{ 'Info': 'No expenses' }]);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

    // 8. Company Profile & System Users Sheet
    const configRows = [
      { 'Setting / User': 'Company Name', 'Details': companyConfig.name },
      { 'Setting / User': 'GSTIN', 'Details': companyConfig.gstin },
      { 'Setting / User': 'Phone', 'Details': companyConfig.phone },
      { 'Setting / User': 'Email', 'Details': companyConfig.email },
      { 'Setting / User': 'Website', 'Details': companyConfig.website || '' },
      { 'Setting / User': 'Address', 'Details': companyConfig.address },
      { 'Setting / User': 'Google Drive Backup Email', 'Details': companyConfig.driveAccountEmail || '' },
      { 'Setting / User': 'Local PC Backup Directory', 'Details': companyConfig.localBackupPath || '' },
      ...users.map(u => ({ 'Setting / User': `User: ${u.name}`, 'Details': `Role: ${u.role} | Mobile: ${u.mobile} | Username: ${u.username}` }))
    ];
    const wsConfig = XLSX.utils.json_to_sheet(configRows);
    XLSX.utils.book_append_sheet(wb, wsConfig, 'Company & System Users');

    // Generate filename date-stamped
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const orgPrefix = getBackupOrgPrefix(companyConfig.name);
    const filename = `${orgPrefix}_ERP_Master_Export_${YYYY}-${MM}-${DD}.xlsx`;

    XLSX.writeFile(wb, filename);

    setLocalBackupSuccessMsg(`✓ Multi-Sheet Excel Workbook exported: Downloaded ${filename} with 8 separate data sheets!`);
    setTimeout(() => setLocalBackupSuccessMsg(''), 7000);
  };

  // Handler for Restore Application Data from Excel (.xlsx)
  const restoreExcelInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleRestoreFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const restoredData: any = {};

        if (wb.SheetNames.includes('Clients Master') || wb.SheetNames.includes('Clients')) {
          const sheetName = wb.SheetNames.includes('Clients Master') ? 'Clients Master' : 'Clients';
          const rawClients = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          restoredData.clients = rawClients.map(c => ({
            id: c['Client ID'] || c['id'] || `c-${Date.now()}`,
            name: c['Client Name'] || c['name'] || 'Unnamed Client',
            type: c['Type'] || c['Client Type'] || c['type'] || 'Walk-in',
            mobile: String(c['Mobile'] || c['mobile'] || ''),
            email: c['Email'] || c['email'] || '',
            gstin: c['GSTIN'] || c['gstin'] || '',
            address: c['Address'] || c['address'] || '',
            state: c['State'] || c['state'] || 'Odisha',
            outstandingBalance: Number(c['Outstanding Balance (₹)'] || c['Outstanding Balance'] || c['outstandingBalance']) || 0
          }));
        }

        if (wb.SheetNames.includes('Inward & Outward Repair Jobs') || wb.SheetNames.includes('Jobs')) {
          const sheetName = wb.SheetNames.includes('Inward & Outward Repair Jobs') ? 'Inward & Outward Repair Jobs' : 'Jobs';
          const rawJobs = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          restoredData.jobs = rawJobs.map(j => ({
            id: String(j['Job ID'] || j['id'] || `job-${Date.now()}`),
            clientId: j['Client ID'] || j['clientId'] || '',
            clientName: j['Client Name'] || j['clientName'] || '',
            clientMobile: String(j['Client Mobile'] || j['clientMobile'] || ''),
            date: j['Inward Date'] || j['Date'] || j['date'] || new Date().toISOString().split('T')[0],
            equipment: j['Equipment Type'] || j['Equipment'] || j['equipment'] || 'LAPTOP',
            productName: j['Product Name'] || j['productName'] || '',
            productModel: j['Product Model'] || j['productModel'] || '',
            serialNo: String(j['Serial / IMEI'] || j['Serial No'] || j['serialNo'] || ''),
            ramHDD: j['RAM / HDD'] || j['ramHDD'] || '',
            problemDescription: j['Problem Description'] || j['problemDescription'] || '',
            problems: j['Reported Problems'] ? String(j['Reported Problems']).split(', ') : (j['problems'] || []),
            componentsChecklist: typeof j['Components Checklist'] === 'string' ? JSON.parse(j['Components Checklist']) : (j['componentsChecklist'] || {}),
            additionalDetails: j['Additional Details'] || j['additionalDetails'] || '',
            status: j['Status'] || j['status'] || 'Received',
            assignedTechnician: j['Assigned Technician'] || j['assignedTechnician'] || 'Jackie A',
            estimateAmount: Number(j['Estimate Amount (₹)'] || j['Estimate Amount'] || j['estimateAmount']) || 0,
            advanceAmount: Number(j['Advance Paid (₹)'] || j['Advance Paid'] || j['advanceAmount']) || 0,
            advancePaymentMode: j['Advance Mode'] || j['advancePaymentMode'] || 'UPI',
            finalBillAmount: Number(j['Final Bill (₹)'] || j['Final Bill Amount'] || j['finalBillAmount']) || 0,
            actionTaken: j['Repair Action Taken'] || j['actionTaken'] || '',
            deliveryStatus: j['Delivery Status'] || j['deliveryStatus'] || 'Pending',
            courierName: j['Courier Name'] || j['courierName'] || '',
            trackingNo: String(j['Tracking / AWB'] || j['trackingNo'] || ''),
            remarks: j['Remarks'] || j['remarks'] || '',
            images: j['images'] || []
          }));
        }

        if (wb.SheetNames.includes('Invoices') || wb.SheetNames.includes('Invoices & Billing')) {
          const sheetName = wb.SheetNames.includes('Invoices') ? 'Invoices' : 'Invoices & Billing';
          const rawInvoices = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          restoredData.invoices = rawInvoices.map(i => ({
            id: String(i['Invoice No'] || i['id'] || `inv-${Date.now()}`),
            date: i['Invoice Date'] || i['Date'] || i['date'] || new Date().toISOString().split('T')[0],
            clientId: i['Client ID'] || i['clientId'] || '',
            clientName: i['Client Name'] || i['clientName'] || '',
            items: typeof i['Items'] === 'string' ? JSON.parse(i['Items']) : (i['items'] || []),
            subtotal: Number(i['Subtotal (₹)'] || i['subtotal']) || 0,
            taxAmount: Number(i['Tax Amount (₹)'] || i['taxAmount']) || 0,
            totalAmount: Number(i['Total Amount (₹)'] || i['totalAmount']) || 0,
            status: i['Status'] || i['status'] || 'Paid'
          }));
        }

        if (wb.SheetNames.includes('Inventory Products') || wb.SheetNames.includes('Products')) {
          const sheetName = wb.SheetNames.includes('Inventory Products') ? 'Inventory Products' : 'Products';
          const rawProducts = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          restoredData.products = rawProducts.map(p => ({
            id: String(p['Product ID'] || p['id'] || `p-${Date.now()}`),
            name: p['Product Name'] || p['name'] || '',
            category: p['Category'] || p['category'] || 'General',
            partNumber: String(p['Part Number'] || p['partNumber'] || ''),
            barcode: String(p['Barcode'] || p['barcode'] || ''),
            stockQty: Number(p['Current Stock Qty'] || p['stockQty']) || 0,
            minStockLevel: Number(p['Min Stock Level'] || p['minStockLevel']) || 5,
            purchasePrice: Number(p['Purchase Price (₹)'] || p['purchasePrice']) || 0,
            sellingPrice: Number(p['Selling Price (₹)'] || p['sellingPrice']) || 0,
            rackLocation: p['Rack Location'] || p['rackLocation'] || ''
          }));
        }

        if (wb.SheetNames.includes('Payments Received') || wb.SheetNames.includes('Payments')) {
          const sheetName = wb.SheetNames.includes('Payments Received') ? 'Payments Received' : 'Payments';
          const rawPayments = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          restoredData.payments = rawPayments.map(pay => ({
            id: String(pay['Payment ID'] || pay['id'] || `pay-${Date.now()}`),
            date: pay['Date & Time'] || pay['Date'] || pay['date'] || new Date().toISOString().split('T')[0],
            clientId: pay['Client ID'] || pay['clientId'] || '',
            clientName: pay['Client Name'] || pay['clientName'] || '',
            amount: Number(pay['Amount (₹)'] || pay['amount']) || 0,
            mode: pay['Payment Method'] || pay['mode'] || 'UPI',
            remarks: pay['Notes'] || pay['remarks'] || ''
          }));
        }

        if (wb.SheetNames.includes('Expenses')) {
          const rawExpenses = XLSX.utils.sheet_to_json(wb.Sheets['Expenses']) as any[];
          restoredData.expenses = rawExpenses.map(exp => ({
            id: String(exp['Expense ID'] || exp['id'] || `exp-${Date.now()}`),
            date: exp['Date'] || exp['date'] || new Date().toISOString().split('T')[0],
            category: exp['Category'] || exp['category'] || 'General',
            description: exp['Description'] || exp['description'] || '',
            amount: Number(exp['Amount (₹)'] || exp['amount']) || 0,
            paymentMode: exp['Payment Mode'] || exp['paymentMode'] || 'Cash'
          }));
        }

        if (onRestoreData) {
          onRestoreData(restoredData);
        }

        setLocalBackupSuccessMsg(`✓ Successfully restored application data from Excel workbook "${file.name}"!`);
        setTimeout(() => setLocalBackupSuccessMsg(''), 7000);
      } catch (err: any) {
        console.error('Error reading Excel restore file:', err);
        alert(`Failed to restore data from Excel: ${err.message || 'Invalid Excel format'}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Auto-backup interval checking effect for Local Machine Backup
  useEffect(() => {
    if (!localBackupEnabled || !localBackupScheduleTime) return;
    const isOwnerOrMaster = userRole === 'Admin' || userRole === 'Master Admin' || currentTenantId === 'org-admin';
    if (!isOwnerOrMaster) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // If current time matches scheduled time and seconds <= 1, fire auto-download
      if (currentHHMM === localBackupScheduleTime && now.getSeconds() === 0) {
        triggerLocalMachineBackup(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [localBackupEnabled, localBackupScheduleTime, localBackupPath]);

  // Admin states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Front Desk' | 'Technician' | 'HR'>('Technician');
  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({
    dashboard: true,
    operations: true,
    clientLedger: false,
    billingInvoice: false,
    payments: false,
    inventoryEdit: false,
    accounts: false,
    setup: false,
    reports: false
  });

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserUsername) return;

    const savedPass = newUserPassword || (editingUser?.password || editingUser?.pin || '1234');

    if (editingUser) {
      if (onUpdateUser) {
        onUpdateUser({
          ...editingUser,
          name: newUserName,
          mobile: newUserMobile,
          email: newUserEmail,
          username: newUserUsername,
          password: savedPass,
          pin: savedPass,
          role: newUserRole,
          permissions
        });
      }
    } else {
      onAddUser({
        name: newUserName,
        mobile: newUserMobile,
        email: newUserEmail,
        username: newUserUsername,
        password: savedPass,
        pin: savedPass,
        role: newUserRole,
        permissions
      });
    }

    setShowAddUserModal(false);
    setEditingUser(null);
    // Reset
    setNewUserName('');
    setNewUserMobile('');
    setNewUserEmail('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserRole('Technician');
  };

  return (
    <div className="space-y-6">
      {/* Settings Tab Shell */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-500" />
          Settings & Configurations
        </h1>
        <p className="text-xs text-slate-400 mt-1">Configure company profiles, dual-sync options, system permissions, and masters list.</p>
        
        {/* Horizontal Navigation Menu */}
        <div className="flex border-b border-slate-100 mt-6 gap-2 text-xs font-bold overflow-x-auto pb-1">
          {(((userRole === 'Admin' || userRole === 'Master Admin' || !currentUser || currentUser.role === 'Admin' || currentTenantId === 'org-admin')
            ? ['profile', 'theme', 'backup', 'masters', 'admin']
            : ['profile', 'theme', 'backup']
          ) as Array<'profile' | 'theme' | 'backup' | 'masters' | 'admin'>).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`pb-2.5 px-3 uppercase tracking-wider transition border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeSubTab === tab
                  ? 'border-teal-600 text-teal-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'profile' && 'Company Profile'}
              {tab === 'theme' && (
                <>
                  <Palette className="w-3.5 h-3.5" />
                  <span>Theme & Custom Colors</span>
                </>
              )}
              {tab === 'backup' && (
                <>
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Backup Settings</span>
                </>
              )}
              {tab === 'masters' && 'Masters List'}
              {tab === 'admin' && (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Staff Control</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: Company Profile */}
      {activeSubTab === 'profile' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6" id="settings-profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left Col: Shop Logo and Stamp Details */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-700 text-sm mb-1 flex items-center gap-2">
                  <span>Organization Logo & Badge</span>
                  {companyConfig.logoUrl && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Organization Badge
                    </span>
                  )}
                </h3>
                <p className="text-slate-400">Upload your official organization logo. Once uploaded, it displays beside your organization name in the top navigation bar and on printed invoice/job card PDF documents.</p>
              </div>

              {/* Real Logo Uploader */}
              <div className="flex items-center gap-4 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center font-black text-teal-600 text-lg overflow-hidden shrink-0 shadow-xs">
                  {companyConfig.logoUrl ? (
                    <img src={companyConfig.logoUrl} alt="Organization Logo" className="w-full h-full object-cover" />
                  ) : (
                    companyConfig.name ? companyConfig.name.substring(0, 2).toUpperCase() : 'RT'
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-2 rounded-xl transition text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Organization Logo</span>
                    </button>
                    {companyConfig.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-2 rounded-xl transition text-xs cursor-pointer border border-rose-200"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">PNG, JPG, or WEBP up to 5MB. Displayed beside organization name in top header and PDF reports.</p>
                </div>
              </div>

              {/* GST and contact */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Company Name</label>
                  <input
                    type="text"
                    value={companyConfig.name}
                    onChange={(e) => onChangeCompanyConfig({ ...companyConfig, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Phone Number</label>
                    <input
                      type="text"
                      value={companyConfig.phone}
                      onChange={(e) => onChangeCompanyConfig({ ...companyConfig, phone: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={companyConfig.email}
                      onChange={(e) => onChangeCompanyConfig({ ...companyConfig, email: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Website URL</label>
                    <input
                      type="text"
                      placeholder="e.g. www.yourcompany.com"
                      value={companyConfig.website || ''}
                      onChange={(e) => onChangeCompanyConfig({ ...companyConfig, website: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">GSTIN / Tax Number</label>
                    <input
                      type="text"
                      value={companyConfig.gstin}
                      onChange={(e) => onChangeCompanyConfig({ ...companyConfig, gstin: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-700"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Registered Address</label>
                  <textarea
                    rows={2}
                    value={companyConfig.address}
                    onChange={(e) => onChangeCompanyConfig({ ...companyConfig, address: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700"
                  />
                </div>

                {(userRole === 'Master Admin' || userRole === 'Admin' || activeTenantId === 'org-admin' || activeTenantId === 'org-nibban') && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>System Application Branding</span>
                        <span className="bg-teal-50 text-teal-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-teal-200">
                          Master Admin Configurable
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Configure global application name, tagline, and header logo shown on the left blue sidebar.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[10px]">Application Name</label>
                        <input
                          type="text"
                          placeholder="e.g. INOMS"
                          value={companyConfig.appName || 'INOMS'}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, appName: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 font-extrabold text-slate-800 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[10px]">Application Tagline</label>
                        <input
                          type="text"
                          placeholder="e.g. Integrated Inward & Outward Management System"
                          value={companyConfig.appTagline || 'Integrated Inward & Outward Management System'}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, appTagline: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 text-xs"
                        />
                      </div>
                    </div>

                    {/* Application Header Logo Upload & Live Preview for Left Blue Sidebar */}
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                          <img
                            src={companyConfig.appLogoUrl || '/inoms_logo.jpg'}
                            alt="Application Header Logo"
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>Left Blue Sidebar Application Logo</span>
                            <span className="bg-teal-500/20 text-teal-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-teal-500/30">
                              ● Live Branding
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Appears live on the left side blue bar beside the Application Name ({companyConfig.appName || 'INOMS'}).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="file"
                          ref={appLogoInputRef}
                          onChange={handleAppLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => appLogoInputRef.current?.click()}
                          className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 py-2 rounded-xl transition text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload App Logo</span>
                        </button>
                        {companyConfig.appLogoUrl && companyConfig.appLogoUrl !== '/inoms_logo.jpg' && (
                          <button
                            type="button"
                            onClick={() => onChangeCompanyConfig({
                              ...companyConfig,
                              appLogoUrl: '/inoms_logo.jpg'
                            })}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl transition text-xs cursor-pointer border border-slate-700"
                          >
                            Reset Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Organization Payment & UPI QR Code Section */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-0.5 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      Organization Payment & UPI Details
                    </h3>
                    <p className="text-slate-400 text-[11px]">Configure your organization's UPI ID, custom QR Code image, or Bank details for tax invoices.</p>
                  </div>

                  <div className="space-y-3">
                    {/* UPI ID input */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase text-[10px]">Organization UPI ID / VPA</label>
                      <input
                        type="text"
                        placeholder="e.g. repairtrack@ybl or 9876543210@paytm"
                        value={companyConfig.upiId || ''}
                        onChange={(e) => onChangeCompanyConfig({ ...companyConfig, upiId: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 text-xs"
                      />
                    </div>

                    {/* Custom UPI QR Code Upload */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase text-[10px]">Upload Custom UPI QR Code Image</label>
                      <input
                        type="file"
                        ref={upiQrInputRef}
                        onChange={handleUpiQrUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="flex items-center gap-3 pt-0.5">
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {companyConfig.upiQrUrl ? (
                            <img src={companyConfig.upiQrUrl} alt="Custom UPI QR" className="w-full h-full object-contain" />
                          ) : companyConfig.upiId ? (
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${companyConfig.upiId}&pn=${companyConfig.name}&cu=INR`)}`}
                              alt="Generated UPI QR"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <QrCode className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => upiQrInputRef.current?.click()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-xs cursor-pointer shadow-xs"
                          >
                            Upload QR Image
                          </button>
                          {companyConfig.upiQrUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveUpiQr}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-1.5 rounded-xl transition text-xs cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bank Details Inputs */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={companyConfig.bankName || ''}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, bankName: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">Account Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 502000123456"
                          value={companyConfig.bankAccountNo || ''}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, bankAccountNo: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-700 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">Account Holder</label>
                        <input
                          type="text"
                          placeholder="e.g. RepairTrack Tech"
                          value={companyConfig.bankAccountName || ''}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, bankAccountName: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-500 uppercase text-[9px]">IFSC Code</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC0001234"
                          value={companyConfig.bankIfsc || ''}
                          onChange={(e) => onChangeCompanyConfig({ ...companyConfig, bankIfsc: e.target.value.toUpperCase() })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-700 text-xs uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Authorised Signature */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-700 text-sm mb-1">Authorized Digital Signature</h3>
                <p className="text-slate-400">Draw or upload signatures appearing on invoice receipts.</p>
              </div>

              {/* Interactive Signature Canvas Board */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2 shadow-2xs">
                <div className="relative bg-slate-50 border border-dashed border-slate-200 rounded-xl overflow-hidden h-36 flex items-center justify-center">
                  {companyConfig.signatureUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-white p-2">
                      <img src={companyConfig.signatureUrl} alt="Saved Signature" className="max-h-28 object-contain" />
                      <span className="absolute bottom-2 right-2 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ Signature Active
                      </span>
                    </div>
                  ) : (
                    <>
                      <canvas
                        ref={signatureCanvasRef}
                        width={400}
                        height={140}
                        onMouseDown={startDrawingSignature}
                        onMouseMove={drawSignature}
                        onMouseUp={stopDrawingSignature}
                        onMouseLeave={stopDrawingSignature}
                        onTouchStart={startDrawingSignature}
                        onTouchMove={drawSignature}
                        onTouchEnd={stopDrawingSignature}
                        className="w-full h-full cursor-crosshair touch-none"
                      />
                      {!isDrawingSignature && (
                        <span className="absolute pointer-events-none text-slate-300 font-bold text-xs tracking-widest italic select-none">
                          ✍️ Draw Signature Here with Mouse / Touch
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400 text-[10px] font-medium">Appears on Invoices & Receipts</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearSignaturePad}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      Clear / Redraw Pad
                    </button>
                    <button
                      type="button"
                      onClick={saveSignaturePad}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                    >
                      Save & Lock Signature
                    </button>
                  </div>
                </div>
              </div>

              {/* Microsoft Authenticator 2FA Security Setup Card */}
              <div className="border border-teal-200 bg-gradient-to-br from-teal-50/70 via-white to-slate-50 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-teal-600 text-white rounded-xl shadow-xs">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        Microsoft Authenticator 2FA Setup
                      </h3>
                      <p className="text-[11px] text-slate-500">Scan QR Code on mobile devices for future login setups.</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-600" /> Active 2FA
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Link <strong>{companyConfig.name}</strong> ({companyConfig.phone}) to Microsoft Authenticator or Google Authenticator app for two-factor mobile verification.
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowMicrosoftAuthQRModal(true)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-teal-400" /> View Microsoft Authenticator QR Code & Key
                  </button>
                </div>
              </div>

              {/* Application Appearance & Typography Customization */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Type className="w-4 h-4 text-teal-600" />
                    App Text & Font Size Settings
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Increase or decrease the font size of the whole application. Your preference will save automatically.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Font Size Selection</span>
                    <span className="text-xs font-bold text-teal-600 px-2 py-0.5 bg-teal-50 rounded-md border border-teal-100 font-mono">
                      {fontSize}px
                    </span>
                  </div>

                  {/* Preset option pills */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Compact', size: '14', desc: 'A-' },
                      { label: 'Normal', size: '16', desc: 'A' },
                      { label: 'Large', size: '18', desc: 'A+' },
                      { label: 'Huge', size: '20', desc: 'A++' }
                    ].map((opt) => (
                      <button
                        key={opt.size}
                        type="button"
                        onClick={() => onChangeFontSize(opt.size)}
                        className={`py-2 px-1 text-center rounded-xl border transition cursor-pointer flex flex-col items-center justify-center ${
                          fontSize === opt.size
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono">{opt.desc}</span>
                        <span className="text-[9px] font-medium opacity-80 mt-0.5">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Manual micro-control buttons */}
                  <div className="flex gap-2 items-center pt-1.5">
                    <button
                      type="button"
                      disabled={parseInt(fontSize) <= 12}
                      onClick={() => onChangeFontSize((Math.max(12, parseInt(fontSize) - 1)).toString())}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-slate-50 text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      A- (Decrease)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeFontSize('16')}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-slate-50 text-xs transition cursor-pointer"
                    >
                      Reset (16px)
                    </button>
                    <button
                      type="button"
                      disabled={parseInt(fontSize) >= 24}
                      onClick={() => onChangeFontSize((Math.min(24, parseInt(fontSize) + 1)).toString())}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-200 font-black text-slate-700 hover:bg-slate-50 text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      A+ (Increase)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: Organization Theme & Color Customizer */}
      {activeSubTab === 'theme' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6" id="settings-theme">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Palette className="w-5 h-5 text-teal-600" />
                Organization Custom Color Palette
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize the UI theme colors for <strong>{companyConfig.name}</strong>. Color selections apply specifically to your organization's workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onChangeCompanyConfig({ ...companyConfig, themePalette: DEFAULT_THEME_PALETTE })}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to Classic Theme
            </button>
          </div>

          {/* Preset Palettes */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Quick Preset Color Palettes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  name: 'Classic Teal',
                  tag: 'Default',
                  palette: { buttonBg: '#0d9488', buttonText: '#ffffff', sidebarBg: '#0f172a', sidebarText: '#94a3b8', appBg: '#f8fafc', fontAccent: '#0f766e', topHeaderBg: '#ffffff' }
                },
                {
                  name: 'Royal Indigo',
                  tag: 'Corporate',
                  palette: { buttonBg: '#4f46e5', buttonText: '#ffffff', sidebarBg: '#1e1b4b', sidebarText: '#c7d2fe', appBg: '#f5f3ff', fontAccent: '#4338ca', topHeaderBg: '#ffffff' }
                },
                {
                  name: 'Emerald Operations',
                  tag: 'Green Eco',
                  palette: { buttonBg: '#059669', buttonText: '#ffffff', sidebarBg: '#022c22', sidebarText: '#a7f3d0', appBg: '#f0fdf4', fontAccent: '#047857', topHeaderBg: '#ffffff' }
                },
                {
                  name: 'Warm Amber & Bronze',
                  tag: 'Industrial',
                  palette: { buttonBg: '#d97706', buttonText: '#ffffff', sidebarBg: '#1c1917', sidebarText: '#fde68a', appBg: '#fff7ed', fontAccent: '#b45309', topHeaderBg: '#ffffff' }
                },
                {
                  name: 'Crimson Fleet',
                  tag: 'High Impact',
                  palette: { buttonBg: '#dc2626', buttonText: '#ffffff', sidebarBg: '#18181b', sidebarText: '#fca5a5', appBg: '#fef2f2', fontAccent: '#b91c1c', topHeaderBg: '#ffffff' }
                },
                {
                  name: 'Dark Onyx Luxury',
                  tag: 'Dark Mode',
                  palette: { buttonBg: '#7c3aed', buttonText: '#ffffff', sidebarBg: '#09090b', sidebarText: '#e9d5ff', appBg: '#0f172a', fontAccent: '#a855f7', topHeaderBg: '#1e293b' }
                }
              ].map((preset) => {
                const isActive = activePalette.buttonBg === preset.palette.buttonBg && activePalette.sidebarBg === preset.palette.sidebarBg;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleUpdatePalette(preset.palette)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer relative flex flex-col justify-between space-y-2.5 ${
                      isActive
                        ? 'border-teal-600 bg-teal-50/40 shadow-xs ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        {preset.name}
                        {isActive && <Check className="w-4 h-4 text-teal-600" />}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {preset.tag}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="w-5 h-5 rounded-md border border-slate-200 shadow-2xs" style={{ backgroundColor: preset.palette.buttonBg }} title="Buttons Color" />
                      <div className="w-5 h-5 rounded-md border border-slate-200 shadow-2xs" style={{ backgroundColor: preset.palette.sidebarBg }} title="Sidebar Panel" />
                      <div className="w-5 h-5 rounded-md border border-slate-200 shadow-2xs" style={{ backgroundColor: preset.palette.appBg }} title="Main Canvas BG" />
                      <div className="w-5 h-5 rounded-md border border-slate-200 shadow-2xs" style={{ backgroundColor: preset.palette.fontAccent }} title="Font Accent" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Custom Color Pickers */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Custom Specific Color Selection</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Option 1: Primary Buttons */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">1. Buttons Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.buttonBg}
                    onChange={(e) => handleUpdatePalette({ buttonBg: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.buttonBg}
                    onChange={(e) => handleUpdatePalette({ buttonBg: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Option 2: Button Text */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">2. Button Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.buttonText}
                    onChange={(e) => handleUpdatePalette({ buttonText: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.buttonText}
                    onChange={(e) => handleUpdatePalette({ buttonText: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Option 3: Left Navigation Sidebar BG */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">3. Left Side Panel Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.sidebarBg}
                    onChange={(e) => handleUpdatePalette({ sidebarBg: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.sidebarBg}
                    onChange={(e) => handleUpdatePalette({ sidebarBg: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Option 4: Left Side Panel Text */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">4. Left Panel Text & Icons</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.sidebarText}
                    onChange={(e) => handleUpdatePalette({ sidebarText: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.sidebarText}
                    onChange={(e) => handleUpdatePalette({ sidebarText: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Option 5: App Workspace BG */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">5. Main Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.appBg}
                    onChange={(e) => handleUpdatePalette({ appBg: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.appBg}
                    onChange={(e) => handleUpdatePalette({ appBg: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Option 6: Font Accent */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700">6. Font Accent / Highlight Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.fontAccent}
                    onChange={(e) => handleUpdatePalette({ fontAccent: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={activePalette.fontAccent}
                    onChange={(e) => handleUpdatePalette({ fontAccent: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Preview Box */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Live Theme Preview ({companyConfig.name})</h3>
            <div className="rounded-2xl border border-slate-200 p-4 shadow-inner flex overflow-hidden min-h-[140px]" style={{ backgroundColor: activePalette.appBg }}>
              {/* Mini Sidebar */}
              <div className="w-36 rounded-xl p-3 flex flex-col justify-between shrink-0" style={{ backgroundColor: activePalette.sidebarBg, color: activePalette.sidebarText }}>
                <div className="space-y-2">
                  <div className="text-[10px] font-black tracking-wider uppercase opacity-90 flex items-center gap-1">
                    <img src="/inoms_logo.jpg" alt="INOMS Logo" className="w-3.5 h-3.5 rounded object-contain bg-white" />
                    <span>INOMS OS</span>
                  </div>
                  <div className="space-y-1 text-[9px] opacity-80 font-medium">
                    <div className="p-1 rounded bg-white/10 font-bold">Dashboard</div>
                    <div className="p-1 rounded">Inwards</div>
                    <div className="p-1 rounded">Billing</div>
                  </div>
                </div>
                <div className="text-[8px] opacity-60 font-mono">{companyConfig.name}</div>
              </div>

              {/* Mini Content Area */}
              <div className="flex-1 pl-4 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: activePalette.fontAccent }}>
                    Active Organization: {companyConfig.name}
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 text-[10px] font-bold rounded-lg shadow-2xs"
                    style={{ backgroundColor: activePalette.buttonBg, color: activePalette.buttonText }}
                  >
                    Action Button
                  </button>
                </div>

                <div className="bg-white/80 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200/80 text-[10px] text-slate-600">
                  This live preview reflects your custom color options. Each organization saves its own palette independently!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: Backup Settings (Local Machine PC & Home Server Cloud Backup) */}
      {activeSubTab === 'backup' && (
        !(userRole === 'Admin' || userRole === 'Master Admin' || !currentUser || currentUser.role === 'Admin' || currentTenantId === 'org-admin') ? (
          <div className="space-y-6" id="settings-backup-staff">
            <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white p-6 rounded-2xl border border-teal-800 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center font-black shrink-0">
                  <FolderSync className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                    <span>Home Server Auto-Sync Active</span>
                    <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      ✓ Staff Account Linked
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Your technician/staff account continuously syncs job cards, invoices, client ledgers, and stock logs directly to the Organization Home Server database.
                  </p>
                </div>
              </div>

              <div className="bg-white/10 p-4 rounded-xl border border-white/10 text-xs text-slate-200 space-y-2">
                <p>• <strong>Real-Time Organization Updates:</strong> Everything you enter on your machine automatically updates the Organization Owner account via the Home Server backend.</p>
                <p>• <strong>Data Security Policy:</strong> Local JSON file downloads are restricted to Organization Owner accounts to prevent unauthorized data leaks from staff machines.</p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLocalBackupSuccessMsg('✓ Synced latest staff entries directly with Home Server database!');
                    setTimeout(() => setLocalBackupSuccessMsg(''), 5000);
                  }}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-2 shadow-xs"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync with Home Server Now</span>
                </button>
              </div>

              {localBackupSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{localBackupSuccessMsg}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="space-y-6" id="settings-backup">
          {/* Section 1: Local Computer Machine Drive Backup */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 text-teal-400 rounded-xl shadow-xs">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span>Local Machine Computer Backup (PC Drive)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      localBackupEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {localBackupEnabled ? 'SCHEDULED ACTIVE' : 'DISABLED'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select your target computer folder once. Backups are saved directly into your chosen directory handle with date & time timestamps.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerLocalMachineBackup(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl transition cursor-pointer text-xs flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Backup Locally to PC Now</span>
                </button>
              </div>
            </div>

            {/* Success toast banner */}
            {localBackupSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{localBackupSuccessMsg}</span>
              </div>
            )}

            {/* Local Backup Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Left Column: Location & Directory Picker */}
              <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-500" />
                  Destination Folder Path on PC
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target Computer Folder</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localDirectoryHandle ? localDirectoryHandle.name : localBackupPath}
                      onChange={e => setLocalBackupPath(e.target.value)}
                      placeholder="e.g. C:\RepairTrack_Backups\"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleSelectTargetDirectory}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>Browse Folder</span>
                    </button>
                    {localDirectoryHandle && (
                      <button
                        type="button"
                        onClick={async () => {
                          await removeDirectoryHandle(currentTenantId);
                          delete (window as any)[`__repairTrackLocalDirectoryHandle_${currentTenantId}`];
                          delete (window as any)[`__nibbanLocalDirectoryHandle_${currentTenantId}`];
                          setLocalDirectoryHandle(null);
                          setLocalBackupPath('C:\\Backups\\');
                          onChangeCompanyConfig({
                            ...companyConfig,
                            localBackupPath: 'C:\\Backups\\'
                          });
                          setLocalBackupSuccessMsg('Target folder disconnected for this organization.');
                          setTimeout(() => setLocalBackupSuccessMsg(''), 4000);
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer border border-rose-200 shrink-0"
                        title="Disconnect backup folder for this organization"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {localDirectoryHandle
                      ? `✓ Directly linked to folder "${localDirectoryHandle.name}". Click "Backup Locally to PC Now" to save files into this folder directly.`
                      : `Click "Browse Folder" to select your destination directory. Downloaded files will automatically include date & time (e.g. ${getBackupOrgPrefix(companyConfig.name)}_Local_Backup_2026-07-28_11-30-00.json).`}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>Scheduled Auto-Download to PC</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={localBackupEnabled}
                      onChange={e => setLocalBackupEnabled(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
                      <select
                        value={localBackupFrequency}
                        onChange={e => setLocalBackupFrequency(e.target.value as any)}
                        disabled={!localBackupEnabled}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none disabled:opacity-50"
                      >
                        <option value="on_sync">⚡ On Every Change / Sync (Background Auto-Download)</option>
                      </select>
                    </div>

                    <div className="space-y-1 flex flex-col justify-center">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Backup Trigger Mode</label>
                      <p className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                        ⚡ Automatic background backup on every data update (no popups)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Recent Local PC Backup History */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-slate-500" />
                      Recent Computer Drive Backups
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">Last: {lastLocalBackupTime}</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {localBackupHistory.map(item => (
                      <div key={item.id} className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-[11px]">
                        <div className="space-y-0.5 overflow-hidden pr-2">
                          <p className="font-mono font-bold text-slate-800 truncate">{item.filename}</p>
                          <p className="text-[9px] text-slate-400 font-mono flex items-center gap-2">
                            <span>{item.date}</span>
                            <span>•</span>
                            <span>{item.size}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerLocalMachineBackup(false)}
                          className="text-teal-600 hover:text-teal-800 font-bold px-2 py-1 bg-teal-50 rounded-lg text-[10px] cursor-pointer shrink-0"
                        >
                          Redownload
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-[10px] text-teal-900 leading-relaxed space-y-1">
                  <p>💡 <strong>To Stop "Save As" Popups & Enable 100% Automatic Downloads:</strong></p>
                  <p>• <strong>Method A (Recommended):</strong> Click <strong>"Browse Folder"</strong> once to connect a local PC folder. Backups write directly into that folder without any windows.</p>
                  <p>• <strong>Method B (Browser Downloads):</strong> In Chrome / Edge browser settings, go to <code>Settings &gt; Downloads</code> and turn <strong>OFF</strong> <em>"Ask where to save each file before downloading"</em>. Files will auto-download instantly to your Downloads folder without asking!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1.5: Copied data Folder Auto-Import & Detection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FolderSync className="w-5 h-5 text-teal-600" />
                  <h4 className="font-bold text-sm text-slate-800">
                    Copied <code className="text-xs bg-slate-100 text-teal-700 px-1.5 py-0.5 rounded font-mono">data/</code> Folder Auto-Import &amp; Migration
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">
                    Host Disk Scanner
                  </span>
                </div>
                <p className="text-slate-500 text-xs max-w-2xl">
                  If you copied your <code className="font-mono font-semibold text-slate-700">data</code> folder from <code className="font-mono text-slate-700">C:\INOMS</code> to <code className="font-mono text-slate-700">D:\INOMS-WebApp\data</code>, click below to scan and automatically import all organizations, clients, jobs, invoices, and ledger records into the active database.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleScanDataFolder}
                  disabled={isScanningDataFolder}
                  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanningDataFolder ? 'animate-spin' : ''}`} />
                  <span>{isScanningDataFolder ? 'Scanning data folder...' : 'Scan & Import data/ Folder'}</span>
                </button>
              </div>
            </div>

            {/* Folder Status Summary */}
            {dataFolderStatus && (
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Primary Database</span>
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dataFolderStatus.sqliteDatabase?.exists ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>{dataFolderStatus.sqliteDatabase?.exists ? `${Math.round((dataFolderStatus.sqliteDatabase?.sizeBytes || 0) / 1024)} KB on disk` : 'In-Memory Only'}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Data Files Found</span>
                  <div className="font-semibold text-slate-700">
                    <span>{dataFolderStatus.filesFound?.length || 0} file(s) ({dataFolderStatus.jsonFilesCount || 0} JSON)</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Clients in Database</span>
                  <div className="font-semibold text-slate-700">
                    <span className="text-teal-700 font-bold">{dataFolderStatus.currentCounts?.clients || 0}</span> clients
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Jobs &amp; Invoices</span>
                  <div className="font-semibold text-slate-700">
                    <span className="text-teal-700 font-bold">{dataFolderStatus.currentCounts?.jobs || 0}</span> jobs / <span className="text-teal-700 font-bold">{dataFolderStatus.currentCounts?.invoices || 0}</span> inv
                  </div>
                </div>
              </div>
            )}

            {/* Scan / Import Result Banner */}
            {dataFolderResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${dataFolderResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <div className="flex items-center gap-2 font-bold">
                  {dataFolderResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{dataFolderResult.message}</span>
                </div>
                {dataFolderResult.filesImported && dataFolderResult.filesImported.length > 0 && (
                  <div className="space-y-1 text-[11px] pt-1">
                    <p className="font-semibold">Imported files:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dataFolderResult.filesImported.map((file, idx) => (
                        <span key={idx} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono text-[10px]">
                          {file}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-[11px] font-semibold text-emerald-800">
                      <div>Orgs: {dataFolderResult.counts?.organizations || 0}</div>
                      <div>Clients: {dataFolderResult.counts?.clients || 0}</div>
                      <div>Jobs: {dataFolderResult.counts?.jobs || 0}</div>
                      <div>Invoices: {dataFolderResult.counts?.invoices || 0}</div>
                      <div>Products: {dataFolderResult.counts?.products || 0}</div>
                      <div>Payments: {dataFolderResult.counts?.payments || 0}</div>
                    </div>
                    <p className="text-[10px] text-emerald-700 italic pt-1">Refreshing page with imported data...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Local Database Backup & Disk Export */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-teal-400" />
                    <span>Database Backup &amp; Local Disks Management</span>
                  </h4>
                  <p className="text-slate-300 text-[11px]">
                    All application data is securely stored in local station storage. You can export multi-sheet Excel files or download JSON backups to your computer disk drive anytime.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <input
                    type="file"
                    ref={restoreExcelInputRef}
                    accept=".xlsx, .xls"
                    onChange={handleRestoreFromExcel}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={triggerExcelExport}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition text-center flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Export all collections into an Excel Workbook (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => restoreExcelInputRef.current?.click()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition text-center flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Restore application data from an exported Excel file (.xlsx)"
                  >
                    <Upload className="w-4 h-4 text-emerald-100" />
                    <span>Restore Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const dataToExport = appData ? { tenantId: currentTenantId, orgName: companyConfig.name, ...appData } : {
                        tenantId: currentTenantId,
                        orgName: companyConfig.name,
                        clients: JSON.parse(getAppStorageItem(`clients_${currentTenantId}`) || '[]'),
                        jobs: JSON.parse(getAppStorageItem(`jobs_${currentTenantId}`) || '[]'),
                        invoices: JSON.parse(getAppStorageItem(`invoices_${currentTenantId}`) || '[]'),
                        products: JSON.parse(getAppStorageItem(`products_${currentTenantId}`) || '[]'),
                        ledger: JSON.parse(getAppStorageItem(`ledger_${currentTenantId}`) || '[]'),
                        payments: JSON.parse(getAppStorageItem(`payments_${currentTenantId}`) || '[]'),
                        expenses: JSON.parse(getAppStorageItem(`expenses_${currentTenantId}`) || '[]'),
                        users: JSON.parse(getAppStorageItem(`users_${currentTenantId}`) || '[]'),
                        categories: JSON.parse(getAppStorageItem(`categories_${currentTenantId}`) || '[]'),
                        racks: JSON.parse(getAppStorageItem(`racks_${currentTenantId}`) || '[]'),
                        equipments: JSON.parse(getAppStorageItem(`equipments_${currentTenantId}`) || '[]'),
                        problems: JSON.parse(getAppStorageItem(`problems_${currentTenantId}`) || '[]'),
                        companyConfig
                      };
                      const jsonStr = JSON.stringify(dataToExport, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const orgPrefix = getBackupOrgPrefix(companyConfig.name, currentTenantId);
                      a.download = `${orgPrefix}_Local_Backup_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-3.5 rounded-xl transition text-center flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-teal-400" />
                    <span>Export JSON</span>
                  </button>

                  <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-3.5 rounded-xl transition cursor-pointer text-center flex items-center gap-1.5 border border-slate-700">
                    <Upload className="w-4 h-4 text-teal-400" />
                    <span>Restore JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const parsed = JSON.parse(event.target?.result as string);
                            if (parsed) {
                              if (onRestoreData) {
                                onRestoreData(parsed);
                              } else {
                                if (parsed.clients) setAppStorageItem(`clients_${currentTenantId}`, JSON.stringify(parsed.clients));
                                if (parsed.jobs) setAppStorageItem(`jobs_${currentTenantId}`, JSON.stringify(parsed.jobs));
                                if (parsed.invoices) setAppStorageItem(`invoices_${currentTenantId}`, JSON.stringify(parsed.invoices));
                                if (parsed.products) setAppStorageItem(`products_${currentTenantId}`, JSON.stringify(parsed.products));
                                if (parsed.ledger) setAppStorageItem(`ledger_${currentTenantId}`, JSON.stringify(parsed.ledger));
                                if (parsed.payments) setAppStorageItem(`payments_${currentTenantId}`, JSON.stringify(parsed.payments));
                                if (parsed.expenses) setAppStorageItem(`expenses_${currentTenantId}`, JSON.stringify(parsed.expenses));
                                if (parsed.users) setAppStorageItem(`users_${currentTenantId}`, JSON.stringify(parsed.users));
                                if (parsed.categories) setAppStorageItem(`categories_${currentTenantId}`, JSON.stringify(parsed.categories));
                                if (parsed.racks) setAppStorageItem(`racks_${currentTenantId}`, JSON.stringify(parsed.racks));
                                if (parsed.equipments) setAppStorageItem(`equipments_${currentTenantId}`, JSON.stringify(parsed.equipments));
                                if (parsed.problems) setAppStorageItem(`problems_${currentTenantId}`, JSON.stringify(parsed.problems));
                                if (parsed.companyConfig) setAppStorageItem(`company_config_${currentTenantId}`, JSON.stringify(parsed.companyConfig));
                                window.location.reload();
                              }
                            }
                          } catch (err) {
                            alert('Invalid JSON backup file. Please select a valid backup file.');
                          }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        )
      )}

      {/* SUB-TAB 4: Masters List */}
      {activeSubTab === 'masters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="settings-masters">
          {/* Equipments configuration */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Diagnostics Equipment Masters</h3>
              <p className="text-[10px] text-slate-400">Configure device intake categories.</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddEquipment();
              }}
              className="flex gap-2 text-xs"
            >
              <input
                ref={eqInputRef}
                type="text"
                placeholder="e.g. MOTHERBOARD"
                value={newEqName}
                onChange={(e) => setNewEqName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEquipment();
                  }
                }}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 uppercase font-bold"
              />
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="border border-slate-100 rounded-xl overflow-hidden text-xs font-semibold text-slate-700">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {equipments.map(eq => (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="p-3 uppercase">{eq.name}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onDeleteEquipment(eq.id)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Problems configuration */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Diagnostics Problems Masters</h3>
              <p className="text-[10px] text-slate-400">Add common failure categories for checkboxes intake.</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddProblem();
              }}
              className="flex gap-2 text-xs"
            >
              <input
                ref={probInputRef}
                type="text"
                placeholder="e.g. HINGE BROKEN"
                value={newProbName}
                onChange={(e) => setNewProbName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddProblem();
                  }
                }}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 uppercase font-bold"
              />
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="border border-slate-100 rounded-xl overflow-hidden text-xs font-semibold text-slate-700">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {problems.map(prob => (
                    <tr key={prob.id} className="hover:bg-slate-50">
                      <td className="p-3 uppercase">{prob.name}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onDeleteProblem(prob.id)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: Admin Panel & User Staff Management */}
      {activeSubTab === 'admin' && (
        <div className="space-y-6" id="settings-admin">
          {/* Master Admin Application Identity & Branding Config Card - RESTRICTED TO MASTER ADMIN */}
          {(userRole === 'Master Admin' || userRole === 'Admin' || activeTenantId === 'org-admin' || activeTenantId === 'org-nibban') && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center font-black shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                      <span>Master Admin Branding & Logo Settings</span>
                      <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/30">
                        🛡️ Master Admin Only
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Edit the global application name, system tagline, and corporate logo icon displayed on sidebar navigation and footers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs pt-1">
                {/* App Name */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={companyConfig.appName || 'INOMS'}
                    onChange={(e) => onChangeCompanyConfig({
                      ...companyConfig,
                      appName: e.target.value
                    })}
                    placeholder="e.g. INOMS"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                  />
                </div>

                {/* App Tagline */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                    Integrated System Tagline
                  </label>
                  <input
                    type="text"
                    value={companyConfig.appTagline || 'Integrated Inward & Outward Management System'}
                    onChange={(e) => onChangeCompanyConfig({
                      ...companyConfig,
                      appTagline: e.target.value
                    })}
                    placeholder="e.g. Integrated Inward & Outward Management System"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>

              {/* App Logo Uploader & Realtime Preview */}
              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="w-14 h-14 rounded-xl bg-white border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                    <img
                      src={companyConfig.appLogoUrl || '/inoms_logo.jpg'}
                      alt="Application Logo"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>Application Header Logo Icon</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ● Active Logo
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Appears live on the left sidebar, mobile headers, and system footers across all active accounts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="file"
                    ref={appLogoInputRef2}
                    onChange={handleAppLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => appLogoInputRef2.current?.click()}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 rounded-xl transition text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Application Logo</span>
                  </button>

                  {companyConfig.appLogoUrl && companyConfig.appLogoUrl !== '/inoms_logo.jpg' && (
                    <button
                      type="button"
                      onClick={() => onChangeCompanyConfig({
                        ...companyConfig,
                        appLogoUrl: '/inoms_logo.jpg'
                      })}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-3 py-2.5 rounded-xl transition text-xs cursor-pointer border border-slate-600"
                    >
                      Reset Logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Organization Security PIN & 2FA Access Management Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 tracking-tight flex items-center gap-2">
                    <span>Organization Security PIN &amp; 2FA Access</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      orgPinInput.trim().length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {orgPinInput.trim().length > 0 ? `● PIN Active (${orgPinInput.trim().length} digits)` : '🛡️ TOTP 2FA Only (PIN Blank)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure your workspace security PIN and Microsoft Authenticator two-factor authentication for owner logins.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                  Workspace: {activeTenant?.code || companyConfig.name || 'ORG'}
                </span>
              </div>
            </div>

            {orgPinStatusMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                orgPinStatusMsg.isError
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}>
                {orgPinStatusMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                <span>{orgPinStatusMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Security PIN Configuration */}
              <form onSubmit={handleSaveOrgPin} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Security PIN (Access Code)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Used to quickly unlock this workspace during owner mobile login.
                  </p>
                  
                  <div className="relative flex items-center">
                    <input
                      type={showOrgPin ? 'text' : 'password'}
                      value={orgPinInput}
                      onChange={(e) => setOrgPinInput(e.target.value)}
                      placeholder="Enter 4 to 6 digit security PIN (or leave blank)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-11 text-slate-800 font-mono text-sm tracking-widest outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOrgPin(!showOrgPin)}
                      title={showOrgPin ? 'Hide PIN (Mask as *)' : 'Show PIN'}
                      className="absolute right-2.5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    >
                      {showOrgPin ? <EyeOff className="w-4 h-4 text-teal-600" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/70 text-[11px] space-y-1 text-slate-600">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>How PIN &amp; 2FA Work:</span>
                  </div>
                  <p className="leading-relaxed">
                    • <strong>Static PIN Set:</strong> You can log in using either your Security PIN or your Microsoft Authenticator 6-digit passcode.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Blank PIN:</strong> If kept blank, static PIN login is disabled and the workspace <strong>only accepts the 6-digit dynamic passcode from Microsoft Authenticator app</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSavingOrgPin}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-xs hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingOrgPin ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Security PIN</span>
                      </>
                    )}
                  </button>

                  {orgPinInput.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrgPinInput('');
                        setTimeout(() => handleSaveOrgPin(), 50);
                      }}
                      disabled={isSavingOrgPin}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs py-2.5 px-3 rounded-xl transition cursor-pointer"
                    >
                      Clear PIN (TOTP Only)
                    </button>
                  )}
                </div>
              </form>

              {/* Right Column: Microsoft Authenticator 2FA Card */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">Microsoft Authenticator 2FA</h4>
                        <p className="text-[10px] text-slate-400">Standard RFC 6238 TOTP (30-second rotating code)</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5 rounded-full">
                      ✓ Supported
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Link your smartphone's <strong>Microsoft Authenticator</strong> or <strong>Google Authenticator</strong> app to scan this organization's QR code. You can use dynamic 6-digit codes to authenticate securely from any device.
                  </p>

                  {activeTenant?.secretKey && (
                    <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Secret Key (Manual Entry):</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeTenant?.secretKey) {
                              navigator.clipboard.writeText(activeTenant.secretKey);
                              setCopiedSecret(true);
                              setTimeout(() => setCopiedSecret(false), 3000);
                            }
                          }}
                          className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSecret ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-xs font-bold text-amber-300 tracking-wider break-all select-all">
                        {activeTenant.secretKey}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowMicrosoftAuthQRModal(true)}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <QrCode className="w-4 h-4" />
                  <span>View Microsoft Authenticator QR Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Staff Control Main Section Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-800 tracking-tight">Staff Control &amp; Access Privileges</h2>
                <p className="text-xs text-slate-400">Manage technician logins, mobile credentials, and granular operational rights for your organization account.</p>
              </div>
            </div>
          </div>

          {/* Technician Login Instructions Banner */}
          {!features.allowTechnicianAccounts ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs text-amber-950 space-y-1">
                <h4 className="font-bold text-sm text-amber-900">Technician &amp; Staff Sub-Accounts Feature Disabled</h4>
                <p className="leading-relaxed">
                  Your organization's subscription plan is configured for single-account owner access. Adding or logging into technician and staff sub-accounts is not enabled. If your workshop needs multi-technician logins and granular role privileges, please contact the Platform Master Administrator.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-teal-100 text-teal-700 rounded-xl shrink-0 mt-0.5">
                <Info className="w-5 h-5" />
              </div>
              <div className="text-xs text-teal-950 space-y-1">
                <h4 className="font-bold text-sm text-teal-900">How Technicians &amp; Staff Log In to the App</h4>
                <p className="leading-relaxed">
                  1. <strong>Add Profile:</strong> When you add a Technician or Staff member below with a <strong>Username / Mobile Number</strong>, <strong>Password</strong>, and <strong>Role</strong>, their account is activated for your organization.
                </p>
                <p className="leading-relaxed">
                  2. <strong>Staff Login Tab:</strong> Technicians go to the main Login window and click the <strong>"Staff &amp; Technician Login"</strong> tab.
                </p>
                <p className="leading-relaxed">
                  3. <strong>Access Workspace:</strong> They select your organization workspace, enter their <strong>Mobile/Username</strong> and <strong>Password</strong>, and get instant access to their customized technician dashboard &amp; repair cards.
                </p>
              </div>
            </div>
          )}

          {/* User management and activities side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            {/* Staff & Admin accounts list panel */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Admin &amp; Staff Directory</h3>
                  <p className="text-[10px] text-slate-400">Manage, deactivate or delete Admin and Staff profiles.</p>
                </div>
                {features.allowTechnicianAccounts && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null);
                      setNewUserName('');
                      setNewUserMobile('');
                      setNewUserEmail('');
                      setNewUserUsername('');
                      setNewUserPassword('');
                      setNewUserRole('Technician');
                      setPermissions({
                        dashboard: true,
                        operations: true,
                        accounts: false,
                        setup: false,
                        reports: false
                      });
                      setShowAddUserModal(true);
                    }}
                    className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="Add New Admin or Staff User"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add User</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {users.filter(u => {
                  if (currentTenantId !== 'org-admin') {
                    if (u.mobile?.includes('8149862034') || u.username === 'scrova' || u.email === 'admin@mastersystem.com' || u.name === 'Master System Admin') {
                      return false;
                    }
                  }
                  return true;
                }).map((u, uIdx) => {
                  const roleStr = String(u.role);
                  const isMasterSystemAdmin = u.mobile?.includes('8149862034') || u.email === 'admin@mastersystem.com';
                  const isDeactivated = u.isDeactivated || u.status === 'Deactivated';

                  return (
                    <div 
                      key={u.id ? `${u.id}-${uIdx}` : `u-${uIdx}`} 
                      className={`p-3.5 rounded-xl border transition-all ${
                        isDeactivated 
                          ? 'bg-amber-50/50 border-amber-200/80 opacity-80' 
                          : roleStr === 'Admin' 
                          ? 'bg-slate-900 text-white border-slate-800 shadow-xs' 
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold text-xs ${roleStr === 'Admin' && !isDeactivated ? 'text-white' : 'text-slate-800'}`}>
                              {u.name}
                            </span>
                            
                            {/* Role Badge */}
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                              roleStr === 'Admin'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}>
                              {u.role}
                            </span>

                            {/* Status Badge */}
                            {isDeactivated ? (
                              <span className="text-[9px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-black border border-rose-300 flex items-center gap-1">
                                🔒 DEACTIVATED
                              </span>
                            ) : (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border flex items-center gap-1 ${
                                roleStr === 'Admin' 
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}>
                                ● ACTIVE
                              </span>
                            )}

                            {/* Master Admin Badge */}
                            {isMasterSystemAdmin && (
                              <span className="text-[9px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-extrabold border border-amber-400/30">
                                🛡️ Master Admin
                              </span>
                            )}
                          </div>

                          <p className={`text-[10px] font-mono ${roleStr === 'Admin' && !isDeactivated ? 'text-slate-300' : 'text-slate-500'}`}>
                            Username: <span className="font-bold">{u.username}</span> {u.mobile && `• Mobile: ${u.mobile}`}
                          </p>
                        </div>

                        {/* Action buttons: Edit, Deactivate & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setNewUserName(u.name || '');
                              setNewUserMobile(u.mobile || '');
                              setNewUserEmail(u.email || '');
                              setNewUserUsername(u.username || '');
                              setNewUserPassword(u.password || u.pin || '');
                              setNewUserRole((u.role as any) || 'Technician');
                              setPermissions({
                                dashboard: u.permissions?.dashboard ?? true,
                                operations: u.permissions?.operations ?? true,
                                clientLedger: u.permissions?.clientLedger ?? false,
                                billingInvoice: u.permissions?.billingInvoice ?? false,
                                payments: u.permissions?.payments ?? false,
                                inventoryEdit: u.permissions?.inventoryEdit ?? false,
                                accounts: u.permissions?.accounts ?? false,
                                setup: u.permissions?.setup ?? false,
                                reports: u.permissions?.reports ?? false
                              });
                              setShowAddUserModal(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                              roleStr === 'Admin' && !isDeactivated
                                ? 'bg-slate-800 hover:bg-slate-700 text-teal-300 border-slate-700'
                                : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
                            }`}
                            title="Edit Staff Account Profile"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {/* Deactivate / Activate Button */}
                          {onToggleUserStatus && !isMasterSystemAdmin && (
                            <button
                              type="button"
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                                isDeactivated
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                                  : roleStr === 'Admin'
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                              }`}
                              title={isDeactivated ? 'Activate Account' : 'Deactivate Account'}
                            >
                              {isDeactivated ? (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>Activate</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Deactivate</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isMasterSystemAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to PERMANENTLY DELETE account "${u.name}" (${u.role})? This cannot be undone.`)) {
                                  onDeleteUser(u.id);
                                }
                              }}
                              className={`p-1.5 rounded-lg transition cursor-pointer border ${
                                roleStr === 'Admin' && !isDeactivated
                                  ? 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/30'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                              }`}
                              title="Permanently Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit log activity trails panel */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">System activity log trail</h3>
                  <p className="text-[10px] text-slate-400">Account logs audits history tracking.</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportActivityLogsExcel}
                  className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 rounded-lg px-3 py-1.5 text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                  Export Logs To Excel
                </button>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-bold text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">User</th>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-mono text-slate-400 text-[10px]">{log.timestamp}</td>
                        <td className="p-2.5 text-teal-600 font-bold">{log.user}</td>
                        <td className="p-2.5">
                          <span className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 font-medium">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User staff profile modal */}
      {showAddUserModal && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddUserModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xs font-bold text-slate-800">
                {editingUser ? 'Edit Staff Account Profile' : 'Add Staff Profile User'}
              </h2>
              <button onClick={() => { setShowAddUserModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Staff Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jackie A"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Staff Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5"
                  >
                    <option value="Admin">Admin / Primary Owner</option>
                    <option value="Front Desk">Front Desk / Intake</option>
                    <option value="Technician">Technician / Engineer</option>
                    <option value="HR">Human Resources</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="jackie"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Password</label>
                  <input
                    type="password"
                    placeholder="Secure password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="Staff phone"
                    value={newUserMobile}
                    onChange={(e) => setNewUserMobile(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Detailed Granular Access Privileges & Module Permissions */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Granular Staff & Technician Access Privileges</h4>
                  <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">In-Depth Permission Control</span>
                </div>

                {/* Section 1: Top-Level Navigation Modules */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">1. Main Navigation Modules</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-slate-800 text-[11px] font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={permissions.dashboard !== false}
                        onChange={() => setPermissions({ ...permissions, dashboard: permissions.dashboard === false })}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Dashboard</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={permissions.operations !== false}
                        onChange={() => {
                          const val = permissions.operations === false;
                          setPermissions({
                            ...permissions,
                            operations: val,
                            inwardView: val,
                            inwardCreate: val,
                            inwardEdit: val,
                            outwardView: val,
                            outwardEdit: val
                          });
                        }}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Repair Jobs (All)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.clientLedger}
                        onChange={() => {
                          const val = !permissions.clientLedger;
                          setPermissions({ ...permissions, clientLedger: val, clientView: val, clientCreateEdit: val });
                        }}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Client Ledger</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.billingInvoice || !!permissions.billing}
                        onChange={() => {
                          const val = !(permissions.billingInvoice || permissions.billing);
                          setPermissions({ ...permissions, billingInvoice: val, billing: val, billingView: val, billingCreate: val, billingEdit: val });
                        }}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Invoices / Billing</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.payments}
                        onChange={() => {
                          const val = !permissions.payments;
                          setPermissions({ ...permissions, payments: val, paymentsView: val, paymentsCreate: val });
                        }}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Payments</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.inventoryEdit || !!permissions.inventory}
                        onChange={() => {
                          const val = !(permissions.inventoryEdit || permissions.inventory);
                          setPermissions({ ...permissions, inventoryEdit: val, inventory: val, inventoryView: val, inventoryEditStock: val });
                        }}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Inventory / Stock</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.accounts}
                        onChange={() => setPermissions({ ...permissions, accounts: !permissions.accounts })}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Expenses Outflow</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.reports}
                        onChange={() => setPermissions({ ...permissions, reports: !permissions.reports })}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>Reports Hub</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-teal-50/50">
                      <input
                        type="checkbox"
                        checked={!!permissions.setup}
                        onChange={() => setPermissions({ ...permissions, setup: !permissions.setup })}
                        className="rounded text-teal-600 w-3.5 h-3.5"
                      />
                      <span>System Settings</span>
                    </label>
                  </div>
                </div>

                {/* Section 2: In-Depth Operational Access Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">2. In-Depth Operational Rights (Create / Edit / View)</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {/* Inward Intake */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                      <span className="font-bold text-teal-800 text-[10px]">Repair Inwards Access:</span>
                      <div className="flex flex-wrap gap-2 text-slate-700">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.inwardView !== false}
                            onChange={() => setPermissions({ ...permissions, inwardView: permissions.inwardView === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>View Jobs</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.inwardCreate !== false}
                            onChange={() => setPermissions({ ...permissions, inwardCreate: permissions.inwardCreate === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Create Inward</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.inwardEdit !== false}
                            onChange={() => setPermissions({ ...permissions, inwardEdit: permissions.inwardEdit === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Edit / Update Job</span>
                        </label>
                      </div>
                    </div>

                    {/* Outward Jobs */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                      <span className="font-bold text-amber-800 text-[10px]">Outward Delivery Access:</span>
                      <div className="flex flex-wrap gap-2 text-slate-700">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.outwardView !== false}
                            onChange={() => setPermissions({ ...permissions, outwardView: permissions.outwardView === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>View Outwards</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.outwardEdit !== false}
                            onChange={() => setPermissions({ ...permissions, outwardEdit: permissions.outwardEdit === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Edit / Outward Delivery</span>
                        </label>
                      </div>
                    </div>

                    {/* Billing & Invoices */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                      <span className="font-bold text-blue-800 text-[10px]">Billing & Invoices Access:</span>
                      <div className="flex flex-wrap gap-2 text-slate-700">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.billingView !== false && (!!permissions.billingInvoice || !!permissions.billing)}
                            onChange={() => setPermissions({ ...permissions, billingView: permissions.billingView === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>View Invoices</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.billingCreate !== false && (!!permissions.billingInvoice || !!permissions.billing)}
                            onChange={() => setPermissions({ ...permissions, billingCreate: permissions.billingCreate === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Create Invoice</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.billingEdit !== false && (!!permissions.billingInvoice || !!permissions.billing)}
                            onChange={() => setPermissions({ ...permissions, billingEdit: permissions.billingEdit === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Edit / Modify Invoice</span>
                        </label>
                      </div>
                    </div>

                    {/* Payments & Clients */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                      <span className="font-bold text-purple-800 text-[10px]">Clients & Cashbook Rights:</span>
                      <div className="flex flex-wrap gap-2 text-slate-700">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.clientCreateEdit !== false && !!permissions.clientLedger}
                            onChange={() => setPermissions({ ...permissions, clientCreateEdit: permissions.clientCreateEdit === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Add/Edit Clients</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.paymentsCreate !== false && !!permissions.payments}
                            onChange={() => setPermissions({ ...permissions, paymentsCreate: permissions.paymentsCreate === false })}
                            className="rounded text-teal-600 w-3 h-3"
                          />
                          <span>Record Payment Receipts</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer"
                >
                  {editingUser ? 'Update Staff Profile' : 'Save User Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Microsoft Authenticator 2FA Setup Modal */}
      {showMicrosoftAuthQRModal && (
        <MicrosoftAuthQR
          isModal
          onClose={() => setShowMicrosoftAuthQRModal(false)}
          orgName={companyConfig.name}
          ownerMobile={companyConfig.phone}
          title="Microsoft Authenticator 2FA Setup"
          subtitle={`Link ${companyConfig.name} (${companyConfig.phone}) to Microsoft Authenticator or Google Authenticator app for two-factor authentication.`}
        />
      )}

    </div>
  );
}
