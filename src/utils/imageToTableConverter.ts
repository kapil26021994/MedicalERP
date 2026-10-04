import { ExtractedTableData, ExtractedTableRow } from '../models/table-extractor.model';

/**
 * Client-Side JS Image to Table Converter.
 * 100% client-side JavaScript execution with Tesseract OCR & HTML5 Canvas algorithms.
 * Zero external AI service dependencies.
 */
export async function convertImageToTableJS(
  fileOrBase64: File | string,
  onProgress?: (progressPercent: number) => void
): Promise<ExtractedTableData> {
  // Step 1: Preprocess Image on HTML5 Canvas using pure JS
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  const imageUrl = typeof fileOrBase64 === 'string' ? fileOrBase64 : URL.createObjectURL(fileOrBase64);
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });

  // Limit canvas dimension for speed and optimal OCR accuracy
  const maxDim = 1600;
  let scale = 1;
  if (img.width > maxDim || img.height > maxDim) {
    scale = Math.min(maxDim / img.width, maxDim / img.height);
  }

  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  if (ctx) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Soft high-contrast grayscale image enhancement for OCR readability
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrast = 1.25; // 25% contrast boost
        const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Canvas pixel contrast enhancement skipped:', e);
    }
  }

  if (onProgress) onProgress(30);

  // Step 2: Client-side JS OCR extraction with Tesseract.js (6s timeout safety)
  let recognizedText = '';
  try {
    const ocrPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      if (onProgress) onProgress(60);
      const ret = await worker.recognize(canvas.toDataURL('image/png'));
      await worker.terminate();
      return ret.data.text;
    })();

    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('OCR Timeout')), 7000)
    );

    recognizedText = await Promise.race([ocrPromise, timeoutPromise]);
    if (onProgress) onProgress(90);
  } catch (err) {
    console.warn('Tesseract OCR fallback to JS pattern extraction:', err);
  }

  // Step 3: Pure JavaScript Tabular Parsing
  const result = await parseRawTextToTableJS(recognizedText, fileOrBase64);
  if (onProgress) onProgress(100);
  return result;
}

/**
 * Pure JavaScript Tabular Parser Function
 * Transforms unformatted OCR text into structured table rows using JS regular expressions.
 */
export async function parseRawTextToTableJS(rawText: string, fileOrBase64?: File | string): Promise<ExtractedTableData> {
  const lines = rawText ? rawText.split('\n').map(l => l.trim()).filter(Boolean) : [];
  
  let supplierName = '';
  let invoiceNumber = '';
  let date = new Date().toISOString().split('T')[0];
  const candidateRows: ExtractedTableRow[] = [];

  // Extract Invoice Metadata using JS RegEx
  for (const line of lines) {
    if (!supplierName && /^[A-Za-z0-9\s&.,'-]{5,40}$/i.test(line) && !/invoice|bill|date|total|amount|qty|tax|sl|description|subtotal|gstin|dl|drug|lic|phone/i.test(line)) {
      supplierName = line;
    }
    const invMatch = line.match(/(?:inv|invoice|bill|no|num|#)[#:\s]*([a-z0-9-]+)/i);
    if (invMatch && !invoiceNumber) {
      invoiceNumber = invMatch[1].toUpperCase();
    }
    const dateMatch = line.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})\b/);
    if (dateMatch && dateMatch[1]) {
      date = dateMatch[1];
    }
  }

  // Extract Table Rows from text lines
  lines.forEach((line, idx) => {
    // Parse OCR text directly; catalog values must not replace invoice values.
    const ignoreRegex = /\b(?:total|subtotal|tax|cgst|sgst|vat|discount|phone|gstin|invoice|bill|address|prop|drug|lic|terms|rupees|sig|dl|email|website|page|checked|authorized|signature|receive|receiver|conditions|bank|payment|delivery|ordered|freight|loading|packing|round\s+off|grand\s+total|gross\s+amount|net\s+amount|net\s+payable)\b/i;
    if (ignoreRegex.test(line)) {
      return;
    }
    if (line.length < 10) return;

    const letterCount = (line.match(/[A-Za-z]/g) || []).length;
    if (letterCount < 5) return;

    const hasPharmaKeywords = /TAB|TABS|SYP|INJ|CAP|CAPS|SUSP|CRM|GEL|OINT|DROP|DROPS|SOLN|ML|MG|GM|10S|15T/i.test(line);

    let remainingLine = line;

    // Extract Expiry Date
    let expDate = '';
    const expMatch = remainingLine.match(/\b(0[1-9]|1[0-2])[\/\.-](\d{2,4})\b/);
    if (expMatch) {
      expDate = expMatch[0];
      remainingLine = remainingLine.replace(expMatch[0], ' ');
    }

    // Extract Pack
    let pack = '';
    const packMatch = remainingLine.match(/\b(\d+\s*(?:ML|S|T|TAB|CAP|PC|PCS|BOTTLE|VIAL|AMP|G|GM|KG))\b/i);
    if (packMatch) {
      pack = packMatch[1].toUpperCase();
      remainingLine = remainingLine.replace(packMatch[1], ' ');
    }

    // Extract HSN
    let hsnCode = '';
    const hsnMatch = remainingLine.match(/\b(300\d{1,5}|30\d{2,6})\b/);
    if (hsnMatch) {
      hsnCode = hsnMatch[1];
      remainingLine = remainingLine.replace(hsnMatch[1], ' ');
    }

    // Extract Batch
    let batchNo = '';
    const batchMatch = remainingLine.match(/\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z0-9]{4,15}\b/i);
    if (batchMatch) {
      batchNo = batchMatch[0].toUpperCase();
      remainingLine = remainingLine.replace(batchMatch[0], ' ');
    } else {
      const numericBatchMatch = remainingLine.match(/\b\d{5,10}\b/);
      if (numericBatchMatch) {
        batchNo = numericBatchMatch[0];
        remainingLine = remainingLine.replace(numericBatchMatch[0], ' ');
      }
    }

    const numbersMatch = remainingLine.match(/\b\d+(?:\.\d+)?\b/g);
    const nums = numbersMatch ? numbersMatch.map(Number).filter(n => n > 0) : [];

    // Extract Description
    const words = remainingLine.trim().split(/\s+/);
    const descWords: string[] = [];
    let columnsStarted = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isNumeric = /^\d+(?:\.\d+)?$/.test(word);
      
      if (isNumeric) {
        // If it's a number, check if it's a product strength or if it's a column value.
        // Product strengths are typically followed by TAB, TABS, CAP, CAPS, MG, ML, etc.
        const nextWord = words[i + 1] || '';
        const isStrength = /^(?:MG|ML|TAB|TABS|CAP|CAPS|INJ|G|GM|PC|PCS|S|T)$/i.test(nextWord) || 
                           // Or if it's sandwiched between words (e.g. "PAN 40 TAB")
                           (i > 0 && i < words.length - 1 && !/^\d+(?:\.\d+)?$/.test(words[i - 1]) && !/^\d+(?:\.\d+)?$/.test(words[i + 1]));

        if (isStrength && !columnsStarted) {
          descWords.push(word);
        } else {
          // It's a column value (Qty, Rate, MRP, etc.)
          columnsStarted = true;
        }
      } else {
        if (!columnsStarted) {
          descWords.push(word);
        }
      }
    }
    const itemDescription = descWords.join(' ').replace(/[^a-zA-Z0-9\s&.,'-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

    if (itemDescription.length < 4 || !/[A-Z]/.test(itemDescription)) {
      return;
    }

    const hasValidNumbers = nums.length >= 3 || (nums.length >= 2 && hasPharmaKeywords);
    if (!hasValidNumbers) {
      return;
    }

    let quantity = 0;
    let freeQty = 0;
    let rate = 0;
    let mrp = 0;
    let oldMrp = 0;
    let amount = 0;

    // Mathematical solver: Qty * Rate = Amount
    let solved = false;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < nums.length; k++) {
          if (k === i || k === j) continue;
          const q = nums[i];
          const r = nums[j];
          const a = nums[k];
          
          if (Math.abs(q * r - a) < 2.0 || (q > 1 && Math.abs((q - 0.5) * r - a) < 2.0)) {
            quantity = q;
            rate = r;
            amount = a;
            solved = true;
            break;
          }
        }
        if (solved) break;
      }
      if (solved) break;
    }

    if (!solved) {
      const sortedNums = [...nums].sort((a, b) => b - a);
      if (sortedNums.length >= 2) {
        amount = sortedNums[0];
        const potentialRates = sortedNums.slice(1).filter(n => n < amount);
        rate = potentialRates.length > 0 ? potentialRates[0] : amount;
        
        const potentialQtys = sortedNums.filter(n => n > 0 && n <= 50 && Number.isInteger(n));
        quantity = potentialQtys.length > 0 ? potentialQtys[0] : Math.round(amount / rate);
        if (quantity === 0) quantity = 1;
        rate = Math.round((amount / quantity) * 100) / 100;
      } else if (sortedNums.length === 1) {
        amount = sortedNums[0];
        rate = amount;
        quantity = 1;
      }
    }

    const smallNums = nums.filter(n => n !== quantity && n !== rate && n !== amount && n > 0 && n <= 10);
    if (smallNums.length > 0) {
      freeQty = smallNums[0];
    }

    candidateRows.push({
      id: `row-${idx}-${Date.now()}`,
      itemDescription,
      hsnCode,
      oldMrp,
      pack,
      batchNo,
      expDate,
      mrp,
      quantity,
      freeQty,
      rate,
      discountPercent: 0,
      gstPercent: 0,
      amount: Math.round(quantity * rate * 100) / 100
    });
  });

  let rows: ExtractedTableRow[] = [];

  const seen = new Set<string>();
  candidateRows.forEach(r => {
    const key = [
      r.itemDescription.trim().toUpperCase(),
      r.hsnCode || '',
      r.batchNo || '',
      r.expDate || '',
      r.quantity,
      r.rate
    ].join('|');
    if (seen.has(key) || r.itemDescription.length < 2) return;
    seen.add(key);
    rows.push(r);
  });

  if (rows.length === 0) {
    rows = candidateRows;
  }

  const subtotal = rows.reduce((acc, r) => acc + (r.amount || (r.quantity * r.rate)), 0);
  const discount = 0;
  const taxableAmount = Math.round((subtotal - discount) * 100) / 100;
  const tax = Math.round(taxableAmount * 0.05 * 100) / 100;
  const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

  return {
    supplierName,
    invoiceNumber,
    date,
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    tax,
    totalAmount,
    rows,
    rawExtractedText: rawText || lines.join('\n')
  };
}
