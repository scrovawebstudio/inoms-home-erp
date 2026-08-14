/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  Plus,
  FileText,
  Edit,
  QrCode,
  Barcode,
  X,
  User,
  Laptop,
  CheckSquare,
  Image as ImageIcon,
  DollarSign,
  Truck,
  Database,
  ArrowLeft,
  ChevronRight,
  Upload,
  Receipt,
  Printer,
  MessageSquare,
  Share2,
  Trash2,
  Camera,
  Clock,
  PlusCircle,
  CheckCircle2
} from 'lucide-react';
import { RepairJob, Client, Equipment, Problem, Product, JobStatus, CompanyConfig, ClientType, SystemUser, sortJobsByLatest } from '../types';
import { SHOP_TERMS } from '../data';
import AddClientModal from './AddClientModal';
import { TenantFeatures, getTenantFeatures } from './AuthModal';
import LockedAddonModal, { AddonType } from './LockedAddonModal';
import { openWhatsAppForJob } from '../lib/whatsappUtils';

const CODE39_MAP: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
};

function generateCode39SVG(text: string): string {
  if (!text) return '';
  const clean = ('*' + text.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '-') + '*');
  let rects: string[] = [];
  let x = 0;
  const narrowWidth = 2;
  const wideWidth = 5;
  const barHeight = 40;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP['-'];
    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      const w = isWide ? wideWidth : narrowWidth;
      if (isBar) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="#000000"/>`);
      }
      x += w;
    }
    x += narrowWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${barHeight}" width="100%" height="${barHeight}" style="max-height: 48px; display: block; margin: 0 auto;">${rects.join('')}</svg>`;
}

const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface InwardsProps {
  jobs: RepairJob[];
  clients: Client[];
  equipments: Equipment[];
  problems: Problem[];
  products: Product[];
  companyConfig: CompanyConfig;
  users?: SystemUser[];
  currentUser?: SystemUser | null;
  userRole?: string;
  tenantFeatures?: TenantFeatures;
  initialJobIdToView?: string | null;
  onClearInitialJobIdToView?: () => void;
  onAddJob: (job: Omit<RepairJob, 'id'>) => void;
  onUpdateJob: (job: RepairJob) => void;
  onDeleteJob?: (id: string) => void;
  onAddClient?: (client: Omit<Client, 'id'>) => Client;
  onRecordPayment: (payment: { clientId: string; amount: number; mode: string; remarks: string }) => void;
  onOpenOutwardJob?: (jobId: string) => void;
}

const CHECKLIST_ITEMS = [
  'Harddisk', 'RAM', 'Adapter', 'Battery', 'Keyboard',
  'Mouse', 'Bag', 'Pendrive', 'External Drive', 'Data Cable', 'Cover'
];

export default function Inwards({
  jobs,
  clients,
  equipments,
  problems,
  products,
  companyConfig,
  users,
  currentUser,
  userRole,
  tenantFeatures,
  initialJobIdToView,
  onClearInitialJobIdToView,
  onAddJob,
  onUpdateJob,
  onDeleteJob,
  onAddClient,
  onRecordPayment,
  onOpenOutwardJob
}: InwardsProps) {
  const features = getTenantFeatures(tenantFeatures);
  const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin';
  const perms = currentUser?.permissions;
  const canCreateInward = isAdmin || perms?.inwardCreate !== false;
  const canEditInward = isAdmin || perms?.inwardEdit !== false;
  const canDeleteInward = isAdmin || perms?.inwardDelete === true;

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [showManageJobModal, setShowManageJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [activeTab, setActiveTab] = useState<'inwards' | 'images' | 'estimate' | 'outwards' | 'parts'>('inwards');

  useEffect(() => {
    if (initialJobIdToView) {
      const match = jobs.find(j => j.id === initialJobIdToView || j.id.includes(initialJobIdToView));
      if (match) {
        setSelectedJob(match);
        setShowManageJobModal(true);
      }
      onClearInitialJobIdToView?.();
    }
  }, [initialJobIdToView, jobs, onClearInitialJobIdToView]);

  // Quick Add Client modal state
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientType, setQuickClientType] = useState<ClientType>('Walk-in');
  const [quickClientMobile, setQuickClientMobile] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientAddress, setQuickClientAddress] = useState('');
  const [quickClientOpeningBal, setQuickClientOpeningBal] = useState<number>(0);

  // Camera state & refs
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Component specs state
  const [componentSpecs, setComponentSpecs] = useState<{ [key: string]: string }>({});

  // Preview modals
  const [previewDoc, setPreviewDoc] = useState<'inward_slip' | 'qr_label' | 'barcode_label' | null>(null);
  const [previewJob, setPreviewJob] = useState<RepairJob | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [lockedAddon, setLockedAddon] = useState<AddonType | null>(null);

  useEffect(() => {
    if (previewJob && previewDoc === 'qr_label') {
      const qrText = `JOB ID: ${previewJob.id}\nCLIENT: ${previewJob.clientName}\nPRODUCT: ${previewJob.productName || previewJob.equipment}\nSERIAL: ${previewJob.serialNo || 'N/A'}\nSTATUS: ${previewJob.status}`;
      QRCode.toDataURL(qrText, { margin: 1, width: 220 })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [previewJob, previewDoc]);

  useEffect(() => {
    if (showCameraModal && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [showCameraModal, mediaStream]);

  const startCamera = async () => {
    try {
      setShowCameraModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setMediaStream(stream);
    } catch (err) {
      console.error('Camera error:', err);
      alert('Unable to access camera. Please allow camera permissions in browser or upload photos manually.');
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setJobImages(prev => [...prev, dataUrl]);
    }
    stopCamera();
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setJobImages(prev => [...prev, String(evt.target?.result)]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Form states for New / Edit Job
  const [clientId, setClientId] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [equipmentType, setEquipmentType] = useState('LAPTOP');
  const [productName, setProductName] = useState('');
  const [productModel, setProductModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [ramHDD, setRamHDD] = useState('');
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [problemDescription, setProblemDescription] = useState('');
  const [accompanyingItems, setAccompanyingItems] = useState<string[]>([]);
  const [newAccompanyingInput, setNewAccompanyingInput] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState<number>(1);
  const [partsConsumedList, setPartsConsumedList] = useState<{ partName: string; qty: number; price: number }[]>([]);
  const [componentsChecklist, setComponentsChecklist] = useState<{ [key: string]: boolean }>({});
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [jobImages, setJobImages] = useState<string[]>([]);
  const [estimateAmount, setEstimateAmount] = useState<number>(0);
  const [inwardPaymentAmount, setInwardPaymentAmount] = useState<number>(0);
  const [inwardPaymentMode, setInwardPaymentMode] = useState<string>('UPI');
  const [remarks, setRemarks] = useState('');

  const getDefaultTechnicianName = () => {
    if (currentUser?.name) {
      if (userRole === 'Technician' || currentUser.role === 'Technician' || users?.some(u => u.name === currentUser.name)) {
        return currentUser.name;
      }
    }
    return 'Unassigned';
  };

  const [assignedTechnician, setAssignedTechnician] = useState<string>(() => getDefaultTechnicianName());

  useEffect(() => {
    if (currentUser?.name && (assignedTechnician === 'Unassigned' || !assignedTechnician)) {
      setAssignedTechnician(getDefaultTechnicianName());
    }
  }, [currentUser?.name, userRole]);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleAddAccompanyingItem = (itemText?: string) => {
    const textToAdd = (itemText || newAccompanyingInput).trim();
    if (!textToAdd) return;
    if (!accompanyingItems.includes(textToAdd)) {
      setAccompanyingItems(prev => [...prev, textToAdd]);
    }
    setNewAccompanyingInput('');
  };

  const handleRemoveAccompanyingItem = (index: number) => {
    setAccompanyingItems(prev => prev.filter((_, i) => i !== index));
  };

  // Form states for Outward / Action
  const [jobStatus, setJobStatus] = useState<JobStatus>('Device Received');
  const [finalBillAmount, setFinalBillAmount] = useState<number>(0);
  const [actionTaken, setActionTaken] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('Pending');
  const [courierName, setCourierName] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [isReturnCase, setIsReturnCase] = useState(false);

  // Filter repair jobs: ALL EXCEPT Product Out or Outwarded (sorted by latest on top)
  const inwardJobs = sortJobsByLatest(jobs.filter(j => j.status !== 'Product Out' && j.status !== 'Outwarded'));

  const filteredJobs = sortJobsByLatest(inwardJobs.filter(j =>
    j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.serialNo.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const handleOpenNewJob = () => {
    setClientId('');
    setClientSearchQuery('');
    setIsClientDropdownOpen(false);
    setEquipmentType(equipments[0]?.name || 'LAPTOP');
    setProductName('');
    setProductModel('');
    setSerialNo('');
    setRamHDD('');
    setSelectedProblems([]);
    setProblemDescription('');
    setAccompanyingItems([]);
    setNewAccompanyingInput('');
    setComponentsChecklist({});
    setComponentSpecs({});
    setAdditionalDetails('');
    setJobImages([]);
    setEstimateAmount(0);
    setInwardPaymentAmount(0);
    setInwardPaymentMode('UPI');
    setRemarks('');
    setAssignedTechnician(getDefaultTechnicianName());
    setJobStatus('Device Received');
    setShowNewJobModal(true);
  };

  const handleSaveQuickClient = () => {
    if (!quickClientName || !quickClientMobile) {
      alert('Please enter Client Name and Mobile Number.');
      return;
    }
    if (onAddClient) {
      try {
        const created = onAddClient({
          name: quickClientName,
          type: quickClientType,
          mobile: quickClientMobile,
          email: quickClientEmail,
          address: quickClientAddress,
          state: 'Maharashtra',
          outstandingBalance: quickClientOpeningBal
        });
        if (created && created.id) {
          setClientId(created.id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setQuickClientName('');
    setQuickClientType('Walk-in');
    setQuickClientMobile('');
    setQuickClientEmail('');
    setQuickClientAddress('');
    setQuickClientOpeningBal(0);
    setShowQuickAddClient(false);
  };

  const handleSaveNewJob = (keepOpenAndAddAnother: boolean = false) => {
    if (!clientId) {
      alert('Please select or add a client for this repair job.');
      return;
    }
    if (!productName || !serialNo) {
      alert('Please enter product name and serial number.');
      return;
    }
    const clientObj = clients.find(c => c.id === clientId);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fullCreatedAt = `${dateStr} ${timeStr}`;

    const itemsChecklistObj = accompanyingItems.reduce((acc, item) => {
      acc[item] = true;
      return acc;
    }, {} as { [key: string]: boolean });

    const savedProductName = productName;

    onAddJob({
      clientId,
      clientName: clientObj?.name || 'Unknown',
      clientMobile: clientObj?.mobile || '',
      date: dateStr,
      createdAt: fullCreatedAt,
      equipment: equipmentType,
      productName,
      productModel,
      serialNo,
      ramHDD,
      componentSpecs,
      problems: selectedProblems,
      problemDescription,
      componentsChecklist: itemsChecklistObj,
      additionalDetails: accompanyingItems.length > 0 ? accompanyingItems.join(', ') + (additionalDetails ? ` | ${additionalDetails}` : '') : additionalDetails,
      images: jobImages,
      estimateAmount,
      advanceAmount: Number(inwardPaymentAmount) || 0,
      advancePaymentMode: inwardPaymentMode,
      remarks,
      assignedTechnician,
      status: jobStatus || 'Device Received'
    });

    if (keepOpenAndAddAnother) {
      // Clear device-specific fields while leaving selected clientId unchanged
      setProductName('');
      setProductModel('');
      setSerialNo('');
      setRamHDD('');
      setSelectedProblems([]);
      setProblemDescription('');
      setAccompanyingItems([]);
      setNewAccompanyingInput('');
      setComponentsChecklist({});
      setComponentSpecs({});
      setAdditionalDetails('');
      setJobImages([]);
      setEstimateAmount(0);
      setInwardPaymentAmount(0);
      setRemarks('');
      setSuccessToast(`✓ Saved "${savedProductName}" for ${clientObj?.name || 'Client'}! Enter details for the next device below.`);
    } else {
      setSuccessToast(null);
      setShowNewJobModal(false);
    }
  };

  const handleOpenManageJob = (job: RepairJob) => {
    setSelectedJob(job);
    setClientId(job.clientId);
    const matchedClient = clients.find(c => c.id === job.clientId);
    setClientSearchQuery(matchedClient ? `${matchedClient.name} (${matchedClient.mobile})` : job.clientName);
    setIsClientDropdownOpen(false);
    setEquipmentType(job.equipment);
    setProductName(job.productName);
    setProductModel(job.productModel);
    setSerialNo(job.serialNo);
    setRamHDD(job.ramHDD || '');
    setComponentSpecs(job.componentSpecs || {});
    setSelectedProblems(job.problems || []);
    setProblemDescription(job.problemDescription || '');

    // Parse items from componentsChecklist or additionalDetails
    const activeChecklist = Object.entries(job.componentsChecklist || {})
      .filter(([_, val]) => val)
      .map(([key]) => key);
    let items = activeChecklist;
    if (job.additionalDetails && job.additionalDetails.trim()) {
      const parts = job.additionalDetails.split('|')[0].split(',').map(s => s.trim()).filter(Boolean);
      items = Array.from(new Set([...items, ...parts]));
    }
    setAccompanyingItems(items);
    setNewAccompanyingInput('');

    setComponentsChecklist(job.componentsChecklist || {});
    setAdditionalDetails(job.additionalDetails || '');
    setJobImages(job.images || []);
    setEstimateAmount(job.estimateAmount || 0);
    setInwardPaymentAmount(job.advanceAmount || 0);
    setInwardPaymentMode(job.advancePaymentMode || 'UPI');
    setRemarks(job.remarks || '');
    setAssignedTechnician(job.assignedTechnician || 'Unassigned');

    setJobStatus(job.status);
    setFinalBillAmount(job.finalBillAmount || job.estimateAmount || 0);
    setActionTaken(job.actionTaken || '');
    setDeliveryStatus(job.deliveryStatus || 'Pending');
    setCourierName(job.courierName || '');
    setTrackingNo(job.trackingNo || '');
    setIsReturnCase(job.isReturnCase || false);

    setShowManageJobModal(true);
  };

  const handleSaveManagedJob = (sendWhatsApp: boolean = false) => {
    if (!selectedJob) return;

    // Explicitly resolve client from clients array using clientId
    const matchedClient = clients.find(c => c.id === clientId);
    const resolvedName = matchedClient ? matchedClient.name : selectedJob.clientName;
    const resolvedMobile = matchedClient ? matchedClient.mobile : selectedJob.clientMobile;

    // Check if advance payment was changed or added
    const prevAdvance = selectedJob.advanceAmount || 0;
    const newAdvance = Number(inwardPaymentAmount) || 0;
    if (newAdvance > prevAdvance) {
      const addedAmount = newAdvance - prevAdvance;
      onRecordPayment({
        clientId: clientId,
        amount: addedAmount,
        mode: inwardPaymentMode,
        remarks: `Advance payment for Job CARD #${selectedJob.id}`
      });
    }

    const itemsChecklistObj = accompanyingItems.reduce((acc, item) => {
      acc[item] = true;
      return acc;
    }, {} as { [key: string]: boolean });

    const updatedJob: RepairJob = {
      ...selectedJob,
      clientId,
      clientName: resolvedName,
      clientMobile: resolvedMobile,
      equipment: equipmentType,
      productName,
      productModel,
      serialNo,
      ramHDD,
      componentSpecs,
      problems: selectedProblems,
      problemDescription,
      componentsChecklist: itemsChecklistObj,
      additionalDetails: accompanyingItems.length > 0 ? accompanyingItems.join(', ') + (additionalDetails ? ` | ${additionalDetails}` : '') : additionalDetails,
      images: jobImages,
      estimateAmount,
      advanceAmount: newAdvance,
      advancePaymentMode: inwardPaymentMode,
      remarks,
      assignedTechnician,
      status: jobStatus,
      finalBillAmount,
      actionTaken,
      deliveryStatus,
      courierName,
      trackingNo,
      isReturnCase
    };

    onUpdateJob(updatedJob);
    setShowManageJobModal(false);

    if (sendWhatsApp) {
      handleTriggerWhatsApp(updatedJob);
    }

    if (jobStatus === 'Product Out' && onOpenOutwardJob) {
      onOpenOutwardJob(selectedJob.id);
    }
  };

  const handleAddPartConsumed = () => {
    const matchedPart = products.find(p => p.id === selectedPartId);
    if (!matchedPart) return;
    if (matchedPart.stock < partQty) {
      alert(`Insufficient stock. Only ${matchedPart.stock} left.`);
      return;
    }
    setPartsConsumedList([
      ...partsConsumedList,
      { partName: matchedPart.name, qty: partQty, price: matchedPart.price }
    ]);
    setSelectedPartId('');
  };

  const toggleProblem = (probName: string) => {
    if (selectedProblems.includes(probName)) {
      setSelectedProblems(selectedProblems.filter(p => p !== probName));
    } else {
      setSelectedProblems([...selectedProblems, probName]);
    }
  };

  const toggleChecklistItem = (item: string) => {
    setComponentsChecklist({
      ...componentsChecklist,
      [item]: !componentsChecklist[item]
    });
  };

  const handleOpenDocPreview = (job: RepairJob, docType: 'inward_slip' | 'qr_label' | 'barcode_label') => {
    setPreviewJob(job);
    setPreviewDoc(docType);
  };

  const handleTriggerDocPreview = (job: RepairJob, docType: 'inward_slip' | 'qr_label' | 'barcode_label') => {
    if ((docType === 'qr_label' || docType === 'barcode_label') && !features.allowBarcodeQrTags) {
      setLockedAddon('barcode_qr');
      return;
    }
    handleOpenDocPreview(job, docType);
  };

  const handleTriggerWhatsApp = (job: RepairJob) => {
    if (!features.allowWhatsAppMessaging) {
      setLockedAddon('whatsapp');
      return;
    }
    handleSendWhatsAppNotification(job);
  };

  const handleSendWhatsAppNotification = (job: RepairJob) => {
    openWhatsAppForJob(job, companyConfig);
  };

  return (
    <div className="space-y-6">
      {/* Header operations */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Inward Repair Diagnostics <span className="text-xs font-semibold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{inwardJobs.length} Inward Jobs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Accept repair cards, run accessory check logs, print QR tags, and assign engineers.</p>
        </div>
        <div>
          {canCreateInward && (
            <button
              onClick={handleOpenNewJob}
              id="new-job-btn"
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Job Entry
            </button>
          )}
        </div>
      </div>

      {/* Tables Log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/40 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Job ID, Client Name, Device Name or Serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Mobile Cards List View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <div key={job.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition">
                {/* Top: Job ID, Date, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {job.id}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (job.date || '—')}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{job.clientName}</span>
                      {job.clientMobile && (
                        <a 
                          href={`tel:${job.clientMobile}`}
                          className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100 transition"
                        >
                          {job.clientMobile}
                        </a>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                      job.status === 'Received' || job.status === 'Device Received'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : job.status === 'Work in Progress' || job.status === 'Pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : job.status === 'Approval Pending'
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : job.status === 'Ready' || job.status === 'Complete & Ready' || job.status === 'Completed' || job.status === 'Device Ready'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : (job.status as string) === 'Device Not repairable' || (job.status as string) === 'Not Repaired' || job.repairOutcome === 'Not Repaired'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {job.status === 'Received' ? 'Device Received' : job.status === 'Ready' || job.status === 'Completed' || job.status === 'Complete & Ready' ? 'Device Ready' : job.status === 'Pending' ? 'Work in Progress' : job.status}
                  </span>
                </div>

                {/* Device Specs & Fault */}
                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-800 font-semibold">
                    <span className="truncate">{job.productName || job.equipment || 'Device'}</span>
                    {job.productModel && <span className="text-[11px] text-slate-500 font-normal ml-2 truncate">{job.productModel}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {job.serialNo && <span>S/N: <span className="font-mono text-slate-700">{job.serialNo}</span></span>}
                    {(job.ramHDD || (job.componentSpecs && (job.componentSpecs['RAM'] || job.componentSpecs['Harddisk']))) && (
                      <span>RAM/HDD: <span className="font-mono text-slate-700">{job.ramHDD || [job.componentSpecs?.['RAM'], job.componentSpecs?.['Harddisk']].filter(Boolean).join(' / ')}</span></span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 line-clamp-2 pt-0.5">
                    <span className="font-medium text-slate-700">Fault: </span>
                    {job.problemDescription || (job.problems && job.problems.length > 0 ? job.problems.join(', ') : 'General Repair Service')}
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleTriggerWhatsApp(job)}
                      title="Send WhatsApp Update"
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        features.allowWhatsAppMessaging
                          ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTriggerDocPreview(job, 'inward_slip')}
                      title="Inward Job Slip"
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTriggerDocPreview(job, 'qr_label')}
                      title="QR Tag"
                      className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTriggerDocPreview(job, 'barcode_label')}
                      title="Barcode"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                    {canDeleteInward && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete Inward Job #${job.id}? This action cannot be undone.`)) {
                            onDeleteJob?.(job.id);
                          }
                        }}
                        title="Delete Inward Job"
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {canEditInward && (
                    <button
                      onClick={() => handleOpenManageJob(job)}
                      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs cursor-pointer shrink-0"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Manage</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              No diagnostics jobs found matching search query.
            </div>
          )}
        </div>

        {/* Desktop Table Listing */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4">Job ID</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Product Name / Model</th>
                <th className="py-3.5 px-4">Serial No</th>
                <th className="py-3.5 px-4">RAM / HDD</th>
                <th className="py-3.5 px-4">Fault Desc</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 flex items-center gap-1.5">
                      <button
                        onClick={() => handleTriggerWhatsApp(job)}
                        title={features.allowWhatsAppMessaging ? "Send WhatsApp Update to Client" : "WhatsApp Messaging (Add-on Locked)"}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          features.allowWhatsAppMessaging
                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                        }`}
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                      </button>
                      {canEditInward && (
                        <button
                          onClick={() => handleOpenManageJob(job)}
                          title="Manage Diagnostics & Delivery"
                          className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleTriggerDocPreview(job, 'inward_slip')}
                        title="Inward Job Slip"
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTriggerDocPreview(job, 'qr_label')}
                        title={features.allowBarcodeQrTags ? "Print QR Tag Sheet" : "Print QR Tag Sheet (Add-on Locked)"}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          features.allowBarcodeQrTags
                            ? "bg-purple-50 hover:bg-purple-100 text-purple-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTriggerDocPreview(job, 'barcode_label')}
                        title={features.allowBarcodeQrTags ? "Print Barcode Tag Sheet" : "Print Barcode Tag Sheet (Add-on Locked)"}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          features.allowBarcodeQrTags
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                        }`}
                      >
                        <Barcode className="w-3.5 h-3.5" />
                      </button>
                      {canDeleteInward && (
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete Inward Job #${job.id}? This action cannot be undone.`)) {
                              onDeleteJob?.(job.id);
                            }
                          }}
                          title="Delete Inward Job"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-800">
                            {job.createdAt
                              ? new Date(job.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : job.date || '—'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {job.createdAt && job.createdAt.includes(' ')
                              ? job.createdAt.split(' ').slice(1).join(' ')
                              : job.createdAt
                              ? new Date(job.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                              : '10:30 AM'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{job.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{job.clientName}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div>{job.productName || 'Device'}</div>
                      {job.productModel && <div className="text-[10px] text-slate-400 font-normal">{job.productModel}</div>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{job.serialNo || '—'}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {job.ramHDD || (job.componentSpecs ? [job.componentSpecs['RAM'], job.componentSpecs['Harddisk'] || job.componentSpecs['HDD']].filter(Boolean).join(' / ') : '') || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                      <div className="line-clamp-2" title={job.problemDescription || (job.problems && job.problems.join(', ')) || ''}>
                        {job.problemDescription || (job.problems && job.problems.length > 0 ? job.problems.join(', ') : 'General Repair Service')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          job.status === 'Received' || job.status === 'Device Received'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : job.status === 'Work in Progress' || job.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : job.status === 'Approval Pending'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : job.status === 'Ready' || job.status === 'Complete & Ready' || job.status === 'Completed' || job.status === 'Device Ready'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : (job.status as string) === 'Device Not repairable' || (job.status as string) === 'Not Repaired' || job.repairOutcome === 'Not Repaired'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-extrabold'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {job.status === 'Received' ? 'Device Received' : job.status === 'Ready' || job.status === 'Completed' || job.status === 'Complete & Ready' ? 'Device Ready' : job.status === 'Pending' ? 'Work in Progress' : job.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                    No diagnostics jobs found matching search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact Unified Inward Entry & Edit Modal */}
      {(showNewJobModal || showManageJobModal) && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewJobModal(false);
              setShowManageJobModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full my-6 overflow-hidden flex flex-col max-h-[92vh] animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header Title with Prominent Top-Right Job Card Status */}
            <div className="bg-slate-900 px-5 py-3 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold tracking-tight">
                  {showNewJobModal ? 'New Inward Diagnostic Entry' : `Manage Inward Job Card: ${selectedJob?.id}`}
                </h2>
                <p className="text-[11px] text-slate-400">All-in-one job details, diagnostic checklists, intake photos & advance payment</p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                {/* PROMINENT TOP-RIGHT JOB CARD STATUS SELECTOR */}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-teal-400 whitespace-nowrap flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                    JOB STATUS:
                  </label>
                  <select
                    value={jobStatus}
                    onChange={(e) => setJobStatus(e.target.value as JobStatus)}
                    className="bg-slate-900 text-white font-extrabold text-xs rounded-xl px-3 py-1 border-2 border-teal-500 hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 cursor-pointer shadow-sm"
                  >
                    <option value="Device Received" className="bg-slate-900 text-blue-400 font-bold">Device Received</option>
                    <option value="Work in Progress" className="bg-slate-900 text-amber-400 font-bold">Work in Progress</option>
                    <option value="Approval Pending" className="bg-slate-900 text-orange-400 font-bold">Approval Pending</option>
                    <option value="Device Ready" className="bg-slate-900 text-purple-400 font-bold">Device Ready</option>
                    <option value="Device Not repairable" className="bg-slate-900 text-rose-400 font-bold">Device Not repairable</option>
                    <option value="Product Out" className="bg-slate-900 text-emerald-400 font-bold">Product Out (Outward)</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setShowNewJobModal(false);
                    setShowManageJobModal(false);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 shrink-0"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Compact Form Content */}
            <div className="p-3.5 overflow-y-auto flex-1 text-xs space-y-3">
              
              {successToast && (
                <div className="p-2.5 bg-emerald-50 border-2 border-emerald-500/80 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successToast}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessToast(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-bold p-1 hover:bg-emerald-100 rounded cursor-pointer transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* LEFT COLUMN: Section 1 & Section 4 */}
                <div className="space-y-3">
                  {/* SECTION 1: Client & Device Details */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-teal-600" />
                        Client & Device Information
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddClient(true)}
                        className="flex items-center gap-1 text-teal-700 bg-teal-100/80 hover:bg-teal-200/80 border border-teal-300 font-bold px-2 py-0.5 rounded-lg text-[10px] transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add Client
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1 relative sm:col-span-2">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Select Client *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={clientSearchQuery}
                            onFocus={() => setIsClientDropdownOpen(true)}
                            onChange={(e) => {
                              setClientSearchQuery(e.target.value);
                              setIsClientDropdownOpen(true);
                            }}
                            placeholder="Search client by name, phone..."
                            className="w-full border border-slate-300 bg-white rounded-lg pl-7 pr-7 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-teal-500 shadow-2xs"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                          {clientSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setClientSearchQuery('');
                                setClientId('');
                                setIsClientDropdownOpen(true);
                              }}
                              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Instant client search popup */}
                        {isClientDropdownOpen && (
                          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {clients.filter(c =>
                              !clientSearchQuery ||
                              c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                              c.mobile.includes(clientSearchQuery) ||
                              c.id.toLowerCase().includes(clientSearchQuery.toLowerCase())
                            ).length > 0 ? (
                              clients.filter(c =>
                                !clientSearchQuery ||
                                c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                                c.mobile.includes(clientSearchQuery) ||
                                c.id.toLowerCase().includes(clientSearchQuery.toLowerCase())
                              ).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setClientId(c.id);
                                    setClientSearchQuery(`${c.name} (${c.mobile})`);
                                    setIsClientDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 transition flex items-center justify-between cursor-pointer ${
                                    clientId === c.id ? 'bg-teal-50/90 font-bold text-teal-800' : 'text-slate-700'
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 block">{c.name}</span>
                                    <span className="font-mono text-[10px] text-slate-400">Ph: {c.mobile}</span>
                                  </div>
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                    {c.type || 'Walk-in'}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="p-2.5 text-center text-xs text-slate-400 italic">
                                No matching client found. Click "+ Add Client" above.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Equipment Category *</label>
                        <div className="flex flex-wrap gap-1">
                          {equipments.map(eq => (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => setEquipmentType(eq.name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                equipmentType === eq.name
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {eq.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Product Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dell Inspiron 15"
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Product Model</label>
                        <input
                          type="text"
                          placeholder="e.g. Model 3511 / Latitude 5420"
                          value={productModel}
                          onChange={(e) => setProductModel(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Serial No / IMEI *</label>
                        <input
                          type="text"
                          required
                          placeholder="Manufacturer serial or IMEI"
                          value={serialNo}
                          onChange={(e) => setSerialNo(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">RAM / Harddisk Specs</label>
                        <input
                          type="text"
                          placeholder="e.g. 16GB RAM / 512GB SSD"
                          value={ramHDD}
                          onChange={(e) => setRamHDD(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: Estimate, Advance Payment & Job Assignment */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                    <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                      Cost Estimate, Advance Payment & Assignment
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Repair Cost Estimate (₹)</label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0.00"
                          value={estimateAmount === 0 ? '' : estimateAmount}
                          onChange={(e) => setEstimateAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Assigned Technician</label>
                        <select
                          value={assignedTechnician}
                          onChange={(e) => setAssignedTechnician(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="Unassigned">Unassigned / Front Desk Queue</option>
                          {users && users.length > 0 ? (
                            users.map(u => (
                              <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                            ))
                          ) : (
                            <>
                              <option value="Senior Technician">Senior Technician</option>
                              <option value="Diagnostics Lead">Diagnostics Lead</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Job Card Status</label>
                        <select
                          value={jobStatus}
                          onChange={(e) => setJobStatus(e.target.value as JobStatus)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="Device Received">Device Received</option>
                          <option value="Work in Progress">Work in Progress</option>
                          <option value="Approval Pending">Approval Pending</option>
                          <option value="Device Ready">Device Ready</option>
                          <option value="Device Not repairable">Device Not repairable</option>
                          <option value="Product Out">Product Out (Move to Outward)</option>
                        </select>
                      </div>

                      {/* Advance Payment Section */}
                      <div className="space-y-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <label className="block font-bold text-emerald-800 uppercase text-[10px]">Advance Payment Accepted (₹)</label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0.00"
                          value={inwardPaymentAmount === 0 ? '' : inwardPaymentAmount}
                          onChange={(e) => setInwardPaymentAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 font-mono font-bold text-emerald-900 focus:ring-1 focus:ring-emerald-500 text-xs"
                        />
                      </div>

                      <div className="space-y-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <label className="block font-bold text-emerald-800 uppercase text-[10px]">Advance Mode</label>
                        <select
                          value={inwardPaymentMode}
                          onChange={(e) => setInwardPaymentMode(e.target.value)}
                          className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-900"
                        >
                          <option value="UPI">UPI / QR Scan</option>
                          <option value="Cash">Cash Handover</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Card">Card Swipe</option>
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="block font-bold text-slate-600 uppercase text-[10px]">Diagnostic Notes / Remarks</label>
                        <input
                          type="text"
                          placeholder="Internal diagnostic notes..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Section 2 & Section 3 */}
                <div className="space-y-3">
                  {/* SECTION 2: Fault Diagnosis & Accessories Checklist */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                    <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                      Fault Diagnosis & Accessories
                    </h3>

                    {/* Common Problem Tags */}
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase text-[10px]">Reported Common Faults</label>
                      <div className="flex flex-wrap gap-1">
                        {problems.map((prob) => (
                          <button
                            key={prob.id}
                            type="button"
                            onClick={() => toggleProblem(prob.name)}
                            className={`px-2 py-0.5 border rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                              selectedProblems.includes(prob.name)
                                ? 'border-teal-600 bg-teal-100/90 text-teal-800 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {prob.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase text-[10px]">Fault Description Details</label>
                      <textarea
                        placeholder="Describe specific fault symptoms reported..."
                        rows={1}
                        value={problemDescription}
                        onChange={(e) => setProblemDescription(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Fast Accompanying Items Entry */}
                    <div className="space-y-1.5 border-t border-slate-200/80 pt-2">
                      <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                        Accompanying Items & Accessories
                      </label>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Type item e.g. Original Charger & Enter..."
                          value={newAccompanyingInput}
                          onChange={(e) => setNewAccompanyingInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAccompanyingItem();
                            }
                          }}
                          className="flex-1 border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddAccompanyingItem()}
                          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Quick Add:</span>
                        {[
                          'Original Charger', 'Power Cable', 'Laptop Bag', 'Wireless Mouse',
                          'Original Box', 'Battery', 'RAM Chip'
                        ].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddAccompanyingItem(preset)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 font-bold rounded text-[10px] border border-slate-200 transition cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>

                      {/* Added Items List */}
                      {accompanyingItems.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {accompanyingItems.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 border border-teal-300 text-teal-900 rounded text-xs font-bold shadow-2xs"
                            >
                              <span>{item}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAccompanyingItem(idx)}
                                className="text-teal-600 hover:text-rose-600 rounded p-0.5 transition cursor-pointer"
                                title="Remove item"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No accompanying items added yet.</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-500 uppercase text-[10px]">Additional Check Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Cosmetic scratches, missing bottom screw"
                        value={additionalDetails}
                        onChange={(e) => setAdditionalDetails(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* SECTION 3: Device Images & Camera Module */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                        Device Intake Images & Photos
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-xs transition cursor-pointer"
                        >
                          <Camera className="w-3 h-3" /> Photo
                        </button>
                        <label className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-300 text-[11px] cursor-pointer transition">
                          <Upload className="w-3 h-3 text-slate-500" /> Upload
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {jobImages.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {jobImages.map((img, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-square bg-slate-100">
                            <img src={img} alt={`Device photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setJobImages(jobImages.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 cursor-pointer shadow-sm"
                              title="Remove Image"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                        <Camera className="w-5 h-5 text-slate-300 mx-auto mb-0.5" />
                        <p className="text-[10px] font-medium">No intake photos captured. Click "Photo" or "Upload".</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Bottom Actions Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                {showNewJobModal && (
                  <span className="inline-flex items-center gap-1.5 text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-[11px] font-bold">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    Client: <strong className="text-slate-900">{clients.find(c => c.id === clientId)?.name || 'Selected Client'}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewJobModal(false);
                    setShowManageJobModal(false);
                    setSuccessToast(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                {showNewJobModal ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveNewJob(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-4 h-4" /> Save & Add Another Device
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveNewJob(false)}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Save & Close
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveManagedJob(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" /> Save & Send WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveManagedJob(false)}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl font-bold transition shadow-sm cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip Document Viewer Modal */}
      {previewDoc && previewJob && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewDoc(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full my-8 overflow-hidden flex flex-col animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Control Bar */}
            <div className="no-print bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Document Slip Generator
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (previewJob) {
                      handleTriggerWhatsApp(previewJob);
                    }
                  }}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Frame Area */}
            <div className="p-8 bg-slate-100 overflow-y-auto flex-1">
              
              {/* Slip 1: INWARD SERVICE JOB RECEIPT */}
              {previewDoc === 'inward_slip' && (
                <div className="printable-area bg-white p-8 max-w-2xl mx-auto rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 space-y-6 print:shadow-none print:border-none">
                  {/* Shop Header */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{companyConfig.name}</h2>
                      <p className="text-[10px] text-slate-400">{companyConfig.address}</p>
                      <p className="text-[10px] text-slate-400">Phone: {companyConfig.phone} | Email: {companyConfig.email}</p>
                      <p className="text-[10px] text-slate-400">GSTIN: <span className="font-mono">{companyConfig.gstin}</span></p>
                    </div>
                    <div className="text-right">
                      <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded font-black tracking-widest block uppercase">Job Receipt</span>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">DOC No: {previewJob.id}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Date: {previewJob.date}</p>
                    </div>
                  </div>

                  {/* Client Details */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client Details</h4>
                      <p className="font-bold text-slate-800">{previewJob.clientName}</p>
                      <p className="font-mono text-slate-500">Ph: {previewJob.clientMobile}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Device Details</h4>
                      <p className="font-bold text-slate-800">{previewJob.equipment} - {previewJob.productName}</p>
                      <p className="text-slate-500">Model: {previewJob.productModel || '—'}</p>
                      <p className="font-mono text-slate-500">S/N: {previewJob.serialNo}</p>
                    </div>
                  </div>

                  {/* Problems list */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-1 text-[11px]">Problems Reported & Diagnostic Points</h4>
                    {((previewJob.problems && previewJob.problems.length > 0) || previewJob.problemDescription || previewJob.additionalDetails) ? (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500">
                            <th className="p-2 w-10">#</th>
                            <th className="p-2">Problem / Description Point</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewJob.problems && previewJob.problems.map((prob, idx) => (
                            <tr key={`prob-${idx}`} className="border-b border-slate-100">
                              <td className="p-2 font-mono font-bold text-slate-400 text-xs">{idx + 1}</td>
                              <td className="p-2 font-semibold text-slate-800 text-xs">{prob}</td>
                            </tr>
                          ))}
                          {previewJob.problemDescription && (
                            <tr className="border-b border-slate-100 bg-amber-50/40">
                              <td className="p-2 font-mono font-bold text-amber-700 text-xs">Note</td>
                              <td className="p-2 font-medium text-slate-800 text-xs">{previewJob.problemDescription}</td>
                            </tr>
                          )}
                          {previewJob.additionalDetails && (
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <td className="p-2 font-mono font-bold text-slate-400 text-xs">Info</td>
                              <td className="p-2 font-medium text-slate-600 text-xs">{previewJob.additionalDetails}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                        General Inspection & Service Required
                      </div>
                    )}
                  </div>

                  {/* Terms & Signatures */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-600 text-[10px] uppercase">Terms & Conditions</h5>
                      <ol className="list-decimal pl-4 text-[9px] text-slate-400 space-y-1">
                        {SHOP_TERMS.slice(0, 3).map((term, i) => (
                          <li key={i}>{term}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex justify-between items-end text-center h-20 pt-4">
                      <div>
                        <div className="w-24 border-b border-slate-300 mx-auto"></div>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block">Customer Signature</span>
                      </div>
                      <div>
                        <div className="w-24 border-b border-slate-300 mx-auto"></div>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block">Authorized Signatory</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Slip 2: QR LABELS SHEET */}
              {previewDoc === 'qr_label' && (
                <div className="printable-area bg-white p-6 max-w-xl mx-auto rounded-lg shadow-sm border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2 mb-4 text-center">QR Tags Sticker Grid Sheet</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="border border-slate-200 p-3 rounded-lg text-center space-y-1.5 flex flex-col items-center">
                        <span className="text-[9px] bg-slate-900 text-white font-mono px-1.5 py-0.5 rounded font-black block">JOB: {previewJob.id}</span>
                        <div className="w-24 h-24 bg-white rounded border border-slate-200 flex items-center justify-center p-1">
                          {qrDataUrl ? (
                            <img src={qrDataUrl} alt={`QR Code ${previewJob.id}`} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-slate-400">Generating...</span>
                          )}
                        </div>
                        <div className="text-[8px] text-slate-500 font-bold leading-tight">
                          <p>{previewJob.equipment} - {previewJob.productName}</p>
                          <p className="font-mono text-slate-400">S/N: {previewJob.serialNo || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slip 3: BARCODE LABELS SHEET */}
              {previewDoc === 'barcode_label' && (
                <div className="printable-area bg-white p-6 max-w-xl mx-auto rounded-lg shadow-sm border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2 mb-4 text-center">Barcode Labels Sticker Grid Sheet</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="border border-slate-200 p-4 rounded-lg text-center space-y-2 flex flex-col items-center">
                        <span className="text-[10px] bg-slate-950 text-white font-mono px-2 py-0.5 rounded font-black block">JOB: {previewJob.id}</span>
                        
                        <div className="w-full py-1 bg-white flex items-center justify-center border-y border-slate-100">
                          <div
                            className="w-full"
                            dangerouslySetInnerHTML={{ __html: generateCode39SVG(previewJob.id) }}
                          />
                        </div>

                        <div className="text-[9px] text-slate-500 font-bold leading-tight">
                          <p>{previewJob.equipment} - {previewJob.productName}</p>
                          <p className="font-mono text-slate-400">SN: {previewJob.serialNo || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Reusable Unified Add Client Modal */}
      <AddClientModal
        isOpen={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        onAddClient={(clientData) => {
          if (onAddClient) {
            const created = onAddClient(clientData);
            if (created && created.id) {
              setClientId(created.id);
            }
            return created;
          }
        }}
      />

      {/* Live Camera Capture Modal */}
      {showCameraModal && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={stopCamera}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm">Capture Device Photo</h3>
              </div>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center bg-black relative min-h-[280px] justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-[360px] object-contain rounded-lg border border-slate-800"
              />
              {!mediaStream && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                  Starting camera stream...
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs shadow-md cursor-pointer transition"
              >
                <Camera className="w-4 h-4" /> Snap & Attach Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Locked Add-on Feature Modal */}
      <LockedAddonModal
        isOpen={!!lockedAddon}
        onClose={() => setLockedAddon(null)}
        addonType={lockedAddon || 'whatsapp'}
        orgName={companyConfig.name}
      />

    </div>
  );
}
