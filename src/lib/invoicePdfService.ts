import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyConfig, Invoice } from '../types';

/**
 * Clean string for safe file/folder names
 */
export function sanitizeFolderName(name: string): string {
  return (name || 'default')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Generates a clean, professional GST Tax Invoice PDF using vector jsPDF
 */
export function generateInvoicePdfBlob(invoice: Invoice, company: CompanyConfig): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // Primary theme color (#0f766e - Teal)
      const primaryColor: [number, number, number] = [15, 118, 110];
      const darkColor: [number, number, number] = [15, 23, 42];
      const grayText: [number, number, number] = [71, 85, 105];
      const lightBg: [number, number, number] = [241, 245, 249];

      // Top Border Accent Line
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 4, 'F');

      let currentY = 14;

      // Header: Company Details (Left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...primaryColor);
      doc.text((company.name || 'SERVICE ENTERPRISE').toUpperCase(), margin, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      currentY += 5;
      
      if (company.address) {
        const splitAddress = doc.splitTextToSize(company.address, 110);
        doc.text(splitAddress, margin, currentY);
        currentY += splitAddress.length * 4;
      }

      let contactLine = '';
      if (company.phone) contactLine += `Phone: ${company.phone}`;
      if (company.email) contactLine += `${contactLine ? '  |  ' : ''}Email: ${company.email}`;
      if (contactLine) {
        doc.text(contactLine, margin, currentY);
        currentY += 4;
      }

      if (company.gstin) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text(`GSTIN: ${company.gstin}`, margin, currentY);
        currentY += 4;
      }

      // Header: Invoice Badge & Details (Right)
      const rightX = pageWidth - margin;
      doc.setFillColor(...primaryColor);
      doc.roundedRect(rightX - 32, 10, 32, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('TAX INVOICE', rightX - 16, 14.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text(`#${invoice.id}`, rightX, 22, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      doc.text(`Date: ${invoice.date}`, rightX, 27, { align: 'right' });

      currentY = Math.max(currentY + 2, 34);

      // Section: Billed To Box
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 22, 2, 2, 'S');

      // Left Box content
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('BILLED TO:', margin + 4, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text(invoice.clientName || 'Valued Customer', margin + 4, currentY + 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...grayText);
      let clientDetails = '';
      if (invoice.clientMobile) clientDetails += `Phone: ${invoice.clientMobile}`;
      if (invoice.linkedJobId) clientDetails += `${clientDetails ? '  |  ' : ''}Linked Job: ${invoice.linkedJobId}`;
      if (clientDetails) {
        doc.text(clientDetails, margin + 4, currentY + 16.5);
      }

      // Right Box content (Payment Status)
      const payStatus = invoice.isPaid ? 'PAID' : 'DUE / PENDING';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('PAYMENT STATUS:', rightX - 4, currentY + 5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      if (invoice.isPaid) {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(payStatus, rightX - 4, currentY + 11, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...grayText);
      doc.text(`Mode: ${invoice.paymentMode || 'Cash'}`, rightX - 4, currentY + 16.5, { align: 'right' });

      currentY += 26;

      // Table of Items
      const tableData = invoice.items.map((it, idx) => [
        (idx + 1).toString(),
        it.serialNo ? `${it.productName}\nRef/SN: ${it.serialNo}` : it.productName,
        it.qty.toString(),
        `Rs. ${it.rate.toFixed(2)}`,
        `Rs. ${it.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Item & Description', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: darkColor,
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' }
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          textColor: darkColor
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: margin, right: margin }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;

      // Bottom Totals & Terms
      const subtotal = invoice.subtotal || invoice.items.reduce((acc, it) => acc + it.total, 0);
      const taxAmount = invoice.taxAmount || 0;
      const discount = invoice.discount || 0;
      const deliveryCharges = invoice.deliveryCharges || 0;
      const grandTotal = invoice.grandTotal || (subtotal - discount + taxAmount + deliveryCharges);

      let bottomY = finalY + 8;

      // Terms & Conditions (Left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('TERMS & CONDITIONS:', margin, bottomY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...grayText);
      doc.text('1. Goods or serviced items once accepted are non-refundable.', margin, bottomY + 4);
      doc.text('2. Warranty is applicable as per service/manufacturer terms.', margin, bottomY + 8);
      doc.text('3. This is a computer generated tax invoice valid without signature.', margin, bottomY + 12);
      if (company.upiId) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text(`UPI ID: ${company.upiId}`, margin, bottomY + 17);
      }

      // Summary Card (Right)
      const summaryBoxWidth = 72;
      const summaryBoxX = pageWidth - margin - summaryBoxWidth;
      let sumY = bottomY - 2;

      doc.setFillColor(...lightBg);
      doc.roundedRect(summaryBoxX, sumY, summaryBoxWidth, 34, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(summaryBoxX, sumY, summaryBoxWidth, 34, 1.5, 1.5, 'S');

      sumY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...grayText);
      doc.text('Subtotal:', summaryBoxX + 4, sumY);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, rightX - 4, sumY, { align: 'right' });

      if (discount > 0) {
        sumY += 4.5;
        doc.setTextColor(220, 38, 38);
        doc.text('Discount:', summaryBoxX + 4, sumY);
        doc.text(`-Rs. ${discount.toFixed(2)}`, rightX - 4, sumY, { align: 'right' });
      }

      if (taxAmount > 0) {
        sumY += 4.5;
        doc.setTextColor(...grayText);
        doc.text(`GST / Tax (${invoice.taxPercent || 0}%):`, summaryBoxX + 4, sumY);
        doc.text(`Rs. ${taxAmount.toFixed(2)}`, rightX - 4, sumY, { align: 'right' });
      }

      if (deliveryCharges > 0) {
        sumY += 4.5;
        doc.setTextColor(...grayText);
        doc.text('Delivery Charges:', summaryBoxX + 4, sumY);
        doc.text(`Rs. ${deliveryCharges.toFixed(2)}`, rightX - 4, sumY, { align: 'right' });
      }

      sumY += 5;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(summaryBoxX + 3, sumY, rightX - 3, sumY);

      sumY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('Grand Total:', summaryBoxX + 4, sumY);
      doc.text(`Rs. ${grandTotal.toFixed(2)}`, rightX - 4, sumY, { align: 'right' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Thank you for doing business with ${company.name || 'us'}!`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

      const blob = doc.output('blob');
      resolve(blob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
