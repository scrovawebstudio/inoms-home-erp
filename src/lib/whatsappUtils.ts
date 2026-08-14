/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairJob, CompanyConfig, getEffectiveBillAmount } from '../types';

/**
 * Generates an exact, formatted WhatsApp message string based on the repair job's current status,
 * strictly complying with organisation messaging specifications:
 * 
 * 1. Device Received / Inward:
 *    - Fault description below reported issues
 *    - Remove final bill amount
 *    - Add advance payment
 *    - Contact mobile number, email (if in settings), website (if in settings)
 * 
 * 2. Work in Progress:
 *    - Fault description below reported issues
 *    - NO estimate amt, NO final amt, NO delivery status
 *    - Contact phone, email (if in settings), website (if in settings)
 * 
 * 3. Device Ready / Complete & Ready:
 *    - Fault description below reported issues
 *    - NO estimate amt
 *    - Show final amount, delivery status
 *    - Contact phone, email (if in settings), website (if in settings)
 * 
 * 4. Approval Pending:
 *    - Fault description below reported issues
 *    - Show estimate and final amount
 *    - NO delivery status
 *    - Contact phone, email (if in settings), website (if in settings)
 * 
 * 5. Device Not repairable:
 *    - Fault description below reported issues
 *    - NO estimate amount, NO final amount
 *    - Show advance payment and state it will be returned
 *    - Contact phone, email (if in settings), website (if in settings)
 * 
 * 6. Product Out:
 *    - Fault description below reported issues
 *    - NO estimate amt
 *    - Show final amount, advance paid, remaining balance amt
 *    - Contact phone, email (if in settings), website (if in settings)
 */
export function generateJobWhatsAppMessage(job: RepairJob, companyConfig: CompanyConfig): string {
  const issuesList = job.problems && job.problems.length > 0 
    ? job.problems.join(', ') 
    : 'General Diagnostics & Service';
  
  const faultDescription = (job.problemDescription && job.problemDescription.trim()) 
    ? job.problemDescription.trim() 
    : (job.problems && job.problems.length > 0 ? job.problems.join(', ') : 'Reported for inspection & servicing');

  const advanceAmt = Number(job.advanceAmount) || 0;
  const rawFinalBill = job.finalBillAmount !== undefined && job.finalBillAmount !== null 
    ? Number(job.finalBillAmount) 
    : (Number(job.estimateAmount) || 0);
  const effectiveFinalBill = getEffectiveBillAmount(job);
  const balanceRemaining = Math.max(0, effectiveFinalBill - advanceAmt);

  const status = job.status;
  const isNotRepairable = status === 'Device Not repairable' || (status as string) === 'Not Repaired' || job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired';
  const isWorkInProgress = status === 'Work in Progress' || status === 'Pending';
  const isApprovalPending = status === 'Approval Pending';
  const isReady = status === 'Device Ready' || status === 'Ready' || status === 'Complete & Ready' || status === 'Completed';
  const isProductOut = status === 'Product Out' || status === 'Outwarded';
  // Default to Inward / Device Received if none of the above
  const isInwardReceived = !isNotRepairable && !isWorkInProgress && !isApprovalPending && !isReady && !isProductOut;

  // Header
  let headerTitle = `${companyConfig.name} - Job Card Update`;
  if (isInwardReceived) {
    headerTitle = `${companyConfig.name} - Inward Job Receipt`;
  } else if (isWorkInProgress) {
    headerTitle = `${companyConfig.name} - Repair Work In Progress`;
  } else if (isApprovalPending) {
    headerTitle = `${companyConfig.name} - Cost Approval Pending`;
  } else if (isReady) {
    headerTitle = `${companyConfig.name} - Device Ready for Pickup`;
  } else if (isNotRepairable) {
    headerTitle = `${companyConfig.name} - Device Inspection Update`;
  } else if (isProductOut) {
    headerTitle = `${companyConfig.name} - Outward Delivery Slip`;
  }

  let msg = `*${headerTitle}*\n\n`;
  msg += `Dear *${job.clientName}*,\n`;
  msg += `Your repair job *${job.equipment}* (${job.productName || 'Device'}${job.productModel ? ` - ${job.productModel}` : ''}) [Job ID: *${job.id}*] details:\n\n`;
  
  // Reported Issues & Fault Description (Fault description ALWAYS below reported issues)
  msg += `📌 *Reported Issues:* ${issuesList}\n`;
  msg += `📝 *Fault Description:* ${faultDescription}\n`;
  msg += `🏷️ *Serial / IMEI:* ${job.serialNo || 'N/A'}\n`;
  msg += `📊 *Current Status:* ${job.status}\n`;

  // Status Specific Logic
  if (isNotRepairable) {
    // 5. NOT REPAIRABLE:
    // Don't show estimate amount, don't show final amount, show advance payment and tell will be returned
    if (job.actionTaken) {
      msg += `🛠️ *Diagnostic Outcome:* ${job.actionTaken}\n`;
    } else {
      msg += `🛠️ *Diagnostic Outcome:* Device inspected - Not repairable\n`;
    }
    msg += `💰 *Advance Payment:* ₹${advanceAmt.toLocaleString('en-IN')}\n`;
    if (advanceAmt > 0) {
      msg += `🔄 *Advance Refund:* The advance payment of ₹${advanceAmt.toLocaleString('en-IN')} will be returned/refunded to you upon device handover.\n`;
    } else {
      msg += `ℹ️ *Notice:* No service charges applied. Device is ready for return handover.\n`;
    }
    msg += `📦 Please collect your device from our service center at your convenience.\n`;

  } else if (isWorkInProgress) {
    // 2. WORK IN PROGRESS:
    // Don't show estimate amt, don't show final amt, don't show delivery status
    if (job.actionTaken) {
      msg += `🛠️ *Current Action:* ${job.actionTaken}\n`;
    }
    if (job.assignedTechnician && job.assignedTechnician !== 'Unassigned') {
      msg += `👨‍🔧 *Assigned Engineer:* ${job.assignedTechnician}\n`;
    }
    if (advanceAmt > 0) {
      msg += `💰 *Advance Paid:* ₹${advanceAmt.toLocaleString('en-IN')}${job.advancePaymentMode ? ` (${job.advancePaymentMode})` : ''}\n`;
    }
    msg += `🔧 Our technical team is actively working on the diagnosis and repair of your device.\n`;

  } else if (isApprovalPending) {
    // 4. APPROVAL PENDING:
    // Show estimate and final amount, don't show delivery status
    const est = job.estimateAmount || 0;
    const finalBill = rawFinalBill || est;
    msg += `💰 *Estimated Repair Cost:* ₹${est.toLocaleString('en-IN')}\n`;
    msg += `💵 *Final Proposed Amount:* ₹${finalBill.toLocaleString('en-IN')}\n`;
    if (advanceAmt > 0) {
      msg += `💰 *Advance Paid:* ₹${advanceAmt.toLocaleString('en-IN')}${job.advancePaymentMode ? ` (${job.advancePaymentMode})` : ''}\n`;
    }
    if (job.actionTaken) {
      msg += `🛠️ *Diagnostic Findings:* ${job.actionTaken}\n`;
    }
    msg += `⚠️ *Action Required:* Please reply with your approval to proceed with this repair estimate.\n`;

  } else if (isReady) {
    // 3. DEVICE READY:
    // Don't show estimate amt, show final amount, delivery status
    if (job.actionTaken) {
      msg += `🛠️ *Repair Action Taken:* ${job.actionTaken}\n`;
    }
    msg += `💵 *Final Bill Amount:* ₹${effectiveFinalBill.toLocaleString('en-IN')}\n`;
    if (advanceAmt > 0) {
      msg += `💰 *Advance Paid:* ₹${advanceAmt.toLocaleString('en-IN')}${job.advancePaymentMode ? ` (${job.advancePaymentMode})` : ''}\n`;
      msg += `💳 *Balance Payable at Pickup:* ₹${balanceRemaining.toLocaleString('en-IN')}\n`;
    }
    msg += `🚚 *Delivery Status:* ${job.deliveryStatus || 'Ready for Pickup / Handover'}\n`;
    if (job.courierName) {
      msg += `📦 *Courier / Dispatch:* ${job.courierName} (AWB: ${job.trackingNo || 'N/A'})\n`;
    }
    msg += `🎉 Your device is fully tested and ready for collection!\n`;

  } else if (isProductOut) {
    // 6. PRODUCT OUT:
    // Don't show estimate amt, show final amount, advance paid, remaining balance amt
    if (job.actionTaken) {
      msg += `🛠️ *Repair Action Taken:* ${job.actionTaken}\n`;
    }
    msg += `💵 *Final Bill Amount:* ₹${effectiveFinalBill.toLocaleString('en-IN')}\n`;
    msg += `💰 *Advance Paid:* ₹${advanceAmt.toLocaleString('en-IN')}${job.advancePaymentMode ? ` (${job.advancePaymentMode})` : ''}\n`;
    msg += `💳 *Remaining Balance:* ₹${balanceRemaining.toLocaleString('en-IN')}\n`;
    if (job.paymentStatus) {
      msg += `🧾 *Payment Status:* ${job.paymentStatus}\n`;
    }
    if (job.deliveryStatus) {
      msg += `🚚 *Delivery Status:* ${job.deliveryStatus}\n`;
    }
    if (job.courierName) {
      msg += `📦 *Courier:* ${job.courierName} (AWB: ${job.trackingNo || 'N/A'})\n`;
    }

  } else {
    // 1. INWARD / DEVICE RECEIVED:
    // Remove final bill amount, add advance payment
    if (job.estimateAmount && job.estimateAmount > 0) {
      msg += `💰 *Estimated Repair Cost:* ₹${Number(job.estimateAmount).toLocaleString('en-IN')}\n`;
    }
    msg += `💰 *Advance Payment:* ₹${advanceAmt.toLocaleString('en-IN')}${job.advancePaymentMode ? ` (${job.advancePaymentMode})` : ''}\n`;
    if (job.assignedTechnician && job.assignedTechnician !== 'Unassigned') {
      msg += `👨‍🔧 *Assigned Engineer:* ${job.assignedTechnician}\n`;
    }
  }

  // Footer: Name, Contact phone, Email (if added in settings profile), Website (if added in settings profile)
  msg += `\nThank you for choosing ${companyConfig.name}!\n`;
  if (companyConfig.phone) {
    msg += `📞 Contact: ${companyConfig.phone}\n`;
  }
  if (companyConfig.email && companyConfig.email.trim()) {
    msg += `✉️ Email: ${companyConfig.email.trim()}\n`;
  }
  if (companyConfig.website && companyConfig.website.trim()) {
    const cleanWebsite = companyConfig.website.trim();
    msg += `🌐 Website: ${cleanWebsite}\n`;
  }

  return msg.trim();
}

/**
 * Triggers one-click opening of WhatsApp with pre-filled message for client
 */
export function openWhatsAppForJob(job: RepairJob, companyConfig: CompanyConfig): void {
  const cleanMobile = job.clientMobile ? job.clientMobile.replace(/[^0-9]/g, '') : '';
  const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
  const msg = generateJobWhatsAppMessage(job, companyConfig);
  const encoded = encodeURIComponent(msg);

  if (formattedMobile) {
    window.open(`https://wa.me/${formattedMobile}?text=${encoded}`, '_blank');
  } else {
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
}
