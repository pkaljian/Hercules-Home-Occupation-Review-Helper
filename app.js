(() => {
  'use strict';

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const TEMPLATE_URL = 'assets/AUP-Notice-Template.docx';

  const $ = (id) => document.getElementById(id);

  const els = {
    pdfFile: $('pdf-file'),
    pdfStatus: $('pdf-status'),
    pdfError: $('pdf-error'),
    clearForm: $('clear-form'),
    rawFields: $('raw-fields'),
    extractionResult: $('extraction-result'),
    applicationSummary: $('application-summary'),
    editDataPanel: $('edit-data-panel'),

    aupNumber: $('aup-number'),
    propertyAddress: $('property-address'),
    applicantName: $('applicant-name'),
    businessName: $('business-name'),
    businessDescription: $('business-description'),
    homeOperation: $('home-operation'),
    clientsVisit: $('clients-visit'),
    hoursDay: $('hours-day'),
    hoursWeek: $('hours-week'),
    clientDetails: $('client-details'),
    deliveries: $('deliveries'),
    vehicle: $('vehicle'),
    areaLocation: $('area-location'),
    officeSqft: $('office-sqft'),
    storageSqft: $('storage-sqft'),
    reviewSqft: $('review-sqft'),
    homeSqft: $('home-sqft'),
    materials: $('materials'),
    materialsLocation: $('materials-location'),
    hazardous: $('hazardous'),
    peopleCount: $('people-count'),
    improvements: $('improvements'),

    oneRoom: $('one-room'),
    nonresidentEmployees: $('nonresident-employees'),
    noExterior: $('no-exterior'),
    areaUsedDisplay: $('area-used-display'),
    areaLimitDisplay: $('area-limit-display'),
    areaPercentDisplay: $('area-percent-display'),
    reviewList: $('review-list'),
    greenCount: $('green-count'),
    yellowCount: $('yellow-count'),
    redCount: $('red-count'),

    noticeDate: $('notice-date'),
    appealDeadline: $('appeal-deadline'),
    requestDescription: $('request-description'),
    typeOfService: $('type-of-service'),
    whereOperations: $('where-operations'),
    clientSentence: $('client-sentence'),
    decisionParagraph: $('decision-paragraph'),
    refreshNotice: $('refresh-notice'),
    generateDocx: $('generate-docx'),
    generateMessage: $('generate-message'),
  };

  const reviewOverrides = new Map();
  let lastAutoBusinessArea = null;
  let lastImportedBusinessName = '';

  const standards = [
    { id: 's1', code: '§13-35.270.1', title: 'Area / secondary use', evaluate: evaluateArea },
    { id: 's2', code: '§13-35.270.2', title: 'Garage parking', evaluate: evaluateGarage },
    { id: 's3', code: '§13-35.270.3', title: 'Employment', evaluate: evaluateEmployees },
    { id: 's4', code: '§13-35.270.4', title: 'Exterior operations', evaluate: evaluateExterior },
    { id: 's5', code: '§13-35.270.5', title: 'Traffic / large vehicles', evaluate: evaluateTraffic },
    { id: 's6', code: '§13-35.270.6', title: 'Articles offered for sale', evaluate: evaluateSales },
    { id: 's7', code: '§13-35.270.7', title: 'Signs / exterior display', evaluate: () => ({ status: 'green', basis: 'Standard acknowledged in signed application; no separate sign proposal identified.' }) },
    { id: 's8', code: '§13-35.270.8', title: 'Prohibited activities', evaluate: evaluateProhibited },
    { id: 's9', code: '§13-35.270.9', title: 'Noise / odor / vibration / fumes', evaluate: evaluateNuisance },
    { id: 's10', code: '§13-35.270.10', title: 'Outdoor storage', evaluate: evaluateOutdoorStorage },
    { id: 's11', code: '§13-35.270.11', title: 'Waste disposal', evaluate: () => ({ status: 'green', basis: 'Standard acknowledged in signed application.' }) },
    { id: 's12', code: '§13-35.270.12', title: 'Business vehicle', evaluate: evaluateBusinessVehicle },
  ];

  function init() {
    const today = new Date();
    els.noticeDate.value = toDateInput(today);

    els.pdfFile.addEventListener('change', handlePdfUpload);
    els.clearForm.addEventListener('click', clearAll);
    els.refreshNotice.addEventListener('click', () => refreshNoticeParagraph(true));
    els.generateDocx.addEventListener('click', generateDocx);

    const watched = [
      els.aupNumber, els.propertyAddress, els.applicantName, els.businessName,
      els.businessDescription, els.homeOperation, els.clientsVisit, els.hoursDay,
      els.hoursWeek, els.clientDetails, els.deliveries, els.vehicle, els.areaLocation,
      els.officeSqft, els.storageSqft, els.reviewSqft, els.homeSqft, els.materials,
      els.materialsLocation, els.hazardous, els.peopleCount, els.improvements,
      els.oneRoom, els.nonresidentEmployees, els.noExterior,
      els.requestDescription, els.typeOfService, els.whereOperations, els.clientSentence,
    ];

    watched.forEach((el) => {
      el.addEventListener('input', handleInputChange);
      el.addEventListener('change', handleInputChange);
    });

    els.officeSqft.addEventListener('input', syncAutoBusinessArea);
    els.storageSqft.addEventListener('input', syncAutoBusinessArea);

    els.businessName.addEventListener('input', () => {
      if (!els.requestDescription.value || els.requestDescription.value === `Home Occupation - ${lastImportedBusinessName}`) {
        els.requestDescription.value = els.businessName.value ? `Home Occupation - ${els.businessName.value}` : 'Home Occupation';
      }
      lastImportedBusinessName = els.businessName.value;
    });

    els.clientsVisit.addEventListener('change', syncClientSentence);
    renderApplicationSummary();
    renderReview();
    refreshNoticeParagraph(false);
  }

  function handleInputChange() {
    renderApplicationSummary();
    renderReview();
    refreshNoticeParagraph(false);
  }

  function setPdfStatus(text, kind = 'neutral') {
    els.pdfStatus.textContent = text;
    els.pdfStatus.className = `pill ${kind}`;
  }

  async function handlePdfUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    hidePdfError();
    setPdfStatus('Reading PDF…', 'warning');

    try {
      if (!window.PDFLib) throw new Error('PDF library did not load. Check the internet connection and reload the page.');

      const bytes = await file.arrayBuffer();
      const pdf = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
      const form = pdf.getForm();
      const raw = extractPdfFields(form);
      const populatedCount = countPopulatedRawFields(raw);
      populateFromPdf(raw);
      renderRawFields(raw);
      renderApplicationSummary();

      if (populatedCount === 0) {
        setPdfStatus('PDF has no filled fields', 'warning');
        setExtractionResult('No completed form values were found in the PDF. If this is a scanned or print-to-PDF copy, send me one example so I can add a flattened/scanned-PDF fallback. For the normal fillable Hercules form, no re-entry should be required.', 'warning');
        els.editDataPanel.open = true;
      } else {
        const mapped = countMappedApplicationValues();
        setPdfStatus(`PDF loaded · ${mapped} values extracted`, 'success');
        setExtractionResult(`${mapped} application values were pulled directly from the PDF. Review the summary below; only open the correction panel if something imported incorrectly.`, mapped >= 8 ? 'success' : 'warning');
        els.editDataPanel.open = false;
      }

      renderReview();
      refreshNoticeParagraph(false);
    } catch (error) {
      console.error(error);
      setPdfStatus('Could not read PDF', 'warning');
      showPdfError(`Could not read the form fields in this PDF. ${error.message || ''}`.trim());
    }
  }

  function extractPdfFields(form) {
    const raw = {};
    for (const field of form.getFields()) {
      const name = field.getName();
      let type = 'Unknown';
      let value = '';

      try {
        // Do not rely on constructor.name here. The production pdf-lib bundle can
        // minify class names, which caused V1 to see every field as blank.
        if (typeof field.getText === 'function') {
          type = 'Text';
          value = field.getText() || '';
        } else if (typeof field.getSelected === 'function') {
          const selected = field.getSelected();
          type = Array.isArray(selected) ? 'Choice' : 'Radio';
          value = Array.isArray(selected) ? selected.join(', ') : (selected || '');
        } else if (typeof field.isChecked === 'function') {
          type = 'Checkbox';
          value = field.isChecked() ? 'Yes' : 'No';
        }
      } catch (error) {
        value = '';
      }

      raw[name] = { value: String(value ?? '').trim(), type };
    }
    return raw;
  }

  function countPopulatedRawFields(raw) {
    return Object.values(raw).filter((item) => String(item?.value || '').trim()).length;
  }

  function getRaw(raw, name) {
    return raw[name]?.value?.trim() || '';
  }

  function joinRaw(raw, ...names) {
    return names.map((n) => getRaw(raw, n)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeRadio(value) {
    const v = String(value || '').toLowerCase();
    if (v.startsWith('yes')) return 'yes';
    if (v.startsWith('no')) return 'no';
    return 'unknown';
  }

  function populateFromPdf(raw) {
    els.aupNumber.value = getRaw(raw, 'AUP No');
    els.propertyAddress.value = getRaw(raw, 'Property Address');
    els.businessName.value = getRaw(raw, 'Name of Business');
    els.applicantName.value = getRaw(raw, 'Applicant Name');
    els.businessDescription.value = joinRaw(raw, 'Describe your business 1', 'Describe your business 2');
    els.homeOperation.value = joinRaw(raw, 'Describe how your business will operate from home 1', 'Describe how your business will operate from home 2');
    els.clientsVisit.value = normalizeRadio(getRaw(raw, 'Will clients or customers visit your home to obtain product or services'));
    els.clientDetails.value = joinRaw(raw, 'If yes how many at one time and how will they be scheduled 1', 'If yes how many at one time and how will they be scheduled 2');

    // The source PDF contains several inherited/shifted AcroForm names. These mappings are based on field position in the 2025 form.
    els.hoursDay.value = getRaw(raw, 'Other than US mail describe any deliveries to your address of products materials or equipment for the');
    els.hoursWeek.value = getRaw(raw, 'Per week');
    els.deliveries.value = joinRaw(raw, 'business 1', 'business 2');
    els.vehicle.value = getRaw(raw, 'undefined_4');
    els.areaLocation.value = getRaw(raw, 'What area of your houseapartmentcondo will be used for your business be sure to include and indicate');
    els.officeSqft.value = numberOrBlank(getRaw(raw, 'Size of area to be used for office square feet'));
    els.storageSqft.value = numberOrBlank(getRaw(raw, 'Size of area to be used for storage square feet'));
    els.homeSqft.value = numberOrBlank(getRaw(raw, '1'));
    els.materials.value = getRaw(raw, '2');
    els.materialsLocation.value = joinRaw(raw, 'Where will any such materials be stored Indicate on floor plan', 'Are any materials classified as hazardous');
    els.hazardous.value = normalizeRadio(getRaw(raw, 'undefined_5'));
    els.peopleCount.value = getRaw(raw, 'NOTE Employees who are not residents of your address see Condition No 3 below') || getRaw(raw, 'How many people will operate your home business');
    els.improvements.value = normalizeRadio(getRaw(raw, 'Will your home business require any improvements to your residence'));

    syncAutoBusinessArea(true);

    if (!els.requestDescription.value || els.requestDescription.value === 'Home Occupation') {
      els.requestDescription.value = els.businessName.value ? `Home Occupation - ${els.businessName.value}` : 'Home Occupation';
    }
    lastImportedBusinessName = els.businessName.value;

    if (!els.typeOfService.value) {
      els.typeOfService.value = shortServiceDescription(els.businessDescription.value);
    }
    inferWhereOperations();
    syncClientSentence();
  }

  function setExtractionResult(message, kind = 'neutral') {
    els.extractionResult.textContent = message;
    els.extractionResult.className = `extraction-result ${kind}`;
  }

  function summaryValue(value, fallback = 'Not found in PDF') {
    const clean = String(value ?? '').trim();
    return { text: clean || fallback, missing: !clean };
  }

  function yesNoLabel(value) {
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
    return '';
  }

  function applicationSummaryItems() {
    const businessArea = numeric(els.reviewSqft);
    const homeArea = numeric(els.homeSqft);
    const hours = [els.hoursDay.value.trim() && `${els.hoursDay.value.trim()} / day`, els.hoursWeek.value.trim() && `${els.hoursWeek.value.trim()} / week`].filter(Boolean).join(' · ');

    return [
      ['AUP #', els.aupNumber.value],
      ['Property address', els.propertyAddress.value],
      ['Applicant', els.applicantName.value],
      ['Business', els.businessName.value],
      ['Business description', els.businessDescription.value],
      ['Home operation', els.homeOperation.value],
      ['Clients visit home', yesNoLabel(els.clientsVisit.value)],
      ['Hours', hours],
      ['Deliveries', els.deliveries.value],
      ['Vehicle', els.vehicle.value],
      ['Area used', els.areaLocation.value],
      ['Business area', businessArea === null ? '' : `${formatNumber(businessArea)} sq. ft.`],
      ['Dwelling area', homeArea === null ? '' : `${formatNumber(homeArea)} sq. ft.`],
      ['Materials stored', els.materials.value],
      ['Materials location', els.materialsLocation.value],
      ['Hazardous materials', yesNoLabel(els.hazardous.value)],
      ['People operating business', els.peopleCount.value],
      ['Residence improvements', yesNoLabel(els.improvements.value)],
    ];
  }

  function countMappedApplicationValues() {
    return applicationSummaryItems().filter(([, value]) => String(value ?? '').trim()).length;
  }

  function renderApplicationSummary() {
    if (!els.applicationSummary) return;
    const items = applicationSummaryItems();
    const hasAnyValue = items.some(([, value]) => String(value ?? '').trim());
    if (!hasAnyValue) {
      els.applicationSummary.innerHTML = '<div class="summary-empty">No application loaded yet.</div>';
      return;
    }
    const cards = items.map(([label, value]) => {
      const result = summaryValue(value);
      return `<div class="summary-item ${result.missing ? 'missing' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(result.text)}</strong></div>`;
    }).join('');
    els.applicationSummary.innerHTML = cards;
  }

  function renderRawFields(raw) {
    const rows = Object.entries(raw)
      .filter(([, item]) => item.value)
      .map(([name, item]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.value)}</td></tr>`)
      .join('');

    els.rawFields.innerHTML = rows
      ? `<table><thead><tr><th>PDF field name</th><th>Type</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p>No populated form fields were found.</p>';
  }

  function showPdfError(message) {
    els.pdfError.hidden = false;
    els.pdfError.textContent = message;
  }

  function hidePdfError() {
    els.pdfError.hidden = true;
    els.pdfError.textContent = '';
  }

  function numberOrBlank(value) {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? match[0] : '';
  }

  function numeric(el) {
    const n = Number.parseFloat(String(el.value || '').replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function syncAutoBusinessArea(force = false) {
    const office = numeric(els.officeSqft) ?? 0;
    const storage = numeric(els.storageSqft) ?? 0;
    const autoValue = office + storage;
    const current = numeric(els.reviewSqft);

    if (force || current === null || current === lastAutoBusinessArea) {
      els.reviewSqft.value = autoValue || '';
    }
    lastAutoBusinessArea = autoValue;
    renderReview();
  }

  function evaluateArea() {
    const area = numeric(els.reviewSqft);
    const home = numeric(els.homeSqft);

    if (els.oneRoom.checked) {
      return { status: 'green', basis: 'Planner confirmed the one-room allowance applies.' };
    }
    if (area === null || home === null || home <= 0) {
      return { status: 'yellow', basis: 'Enter the business area and total dwelling area, or confirm the one-room allowance.' };
    }

    const pct = (area / home) * 100;
    if (pct <= 20) return { status: 'green', basis: `${formatNumber(area)} sq. ft. is ${pct.toFixed(1)}% of the dwelling (≤20%).` };
    return { status: 'red', basis: `${formatNumber(area)} sq. ft. is ${pct.toFixed(1)}% of the dwelling and the one-room allowance is not selected.` };
  }

  function evaluateGarage() {
    const text = combinedText(els.areaLocation.value, els.homeOperation.value);
    if (/garage/i.test(text)) return { status: 'yellow', basis: 'Garage use is identified; confirm required off-street parking is not eliminated or changed.' };
    return { status: 'green', basis: 'No garage use identified in the imported application text.' };
  }

  function evaluateEmployees() {
    const v = els.nonresidentEmployees.value;
    if (v === '0') return { status: 'green', basis: 'Planner confirmed no nonresident employees.' };
    if (v === '1') return { status: 'yellow', basis: 'One nonresident employee requires the Director/designee findings in §13-35.270.3.A-D.' };
    if (v === '2plus') return { status: 'red', basis: 'More than one nonresident employee is inconsistent with the home occupation standard.' };
    return { status: 'yellow', basis: 'Confirm whether any person operating the business is a nonresident employee.' };
  }

  function evaluateExterior() {
    if (!els.noExterior.checked) return { status: 'red', basis: 'Planner indicated exterior business operations are proposed.' };
    const text = combinedText(els.businessDescription.value, els.homeOperation.value, els.areaLocation.value);
    if (containsPositiveOutdoorOperation(text)) return { status: 'yellow', basis: 'Application text mentions an outdoor/exterior area; confirm no exterior operation will occur.' };
    return { status: 'green', basis: 'Planner confirmed no exterior operations are proposed.' };
  }

  function evaluateTraffic() {
    const text = combinedText(els.clientDetails.value, els.deliveries.value, els.vehicle.value);
    if (/\b(6\s*-?wheel|six\s*-?wheel|semi|tractor\s*trailer|box\s*truck)\b/i.test(text)) {
      return { status: 'red', basis: 'Application text may identify a vehicle with 6 or more wheels for service, pickup, or delivery.' };
    }
    if (els.clientsVisit.value === 'yes') return { status: 'yellow', basis: 'Client/customer visits are proposed; confirm traffic remains normal for the surrounding area.' };
    if (/(daily|frequent|multiple|several|truck|delivery)/i.test(els.deliveries.value)) return { status: 'yellow', basis: 'Delivery activity is described; confirm traffic will not exceed normal residential levels.' };
    if (els.clientsVisit.value === 'unknown') return { status: 'yellow', basis: 'Client/customer visit response is unknown.' };
    return { status: 'green', basis: 'No client visits or unusual traffic-generating activity identified.' };
  }

  function evaluateSales() {
    const text = combinedText(els.businessDescription.value, els.homeOperation.value, els.materials.value);
    if (/\b(retail|sell|sales|store|merchandise|inventory|product|products|goods)\b/i.test(text)) {
      return { status: 'yellow', basis: 'Application appears to involve goods or sales; confirm §13-35.270.6 is satisfied.' };
    }
    return { status: 'green', basis: 'No retail/product-sales activity identified from the application text.' };
  }

  function evaluateProhibited() {
    if (els.hazardous.value === 'yes') return { status: 'red', basis: 'Applicant identified hazardous materials; §13-35.270.8.G prohibits their storage.' };

    const text = combinedText(
      els.businessDescription.value,
      els.homeOperation.value,
      els.clientDetails.value,
      els.materials.value,
      els.materialsLocation.value
    );

    const possible = [];
    if (/\b(boarding|kennel|animal care|pet care|grooming animals?)\b/i.test(text)) possible.push('animal care/boarding');
    if (/\b(auto repair|vehicle repair|mechanic|body shop)\b/i.test(text)) possible.push('vehicle repair');
    if (/\b(class|classes|lesson|lessons|students|instruction)\b/i.test(text)) possible.push('organized classes');
    if (/\b(subcontractor|crew|workers assemble|equipment staging|dispatch)\b/i.test(text)) possible.push('off-site worker/equipment assembly');
    if (containsPositiveOutdoorStorage(text)) possible.push('outdoor storage');

    if (possible.length) return { status: 'yellow', basis: `Potential prohibited-activity keyword detected (${possible.join(', ')}); planner review required.` };
    if (els.hazardous.value === 'unknown') return { status: 'yellow', basis: 'Hazardous-material response is unknown; confirm no §13-35.270.8 activity applies.' };
    return { status: 'green', basis: 'No prohibited activity is identified from the application responses.' };
  }

  function evaluateNuisance() {
    const text = combinedText(els.businessDescription.value, els.homeOperation.value);
    if (/\b(welding|woodworking|fabrication|manufactur|machining|spray|paint booth|music lessons?|drum|saw|compressor)\b/i.test(text)) {
      return { status: 'yellow', basis: 'Business description may involve noise, odor, vibration, dust, fumes, or similar effects; confirm impacts are not discernible at parcel boundaries.' };
    }
    return { status: 'green', basis: 'No obvious nuisance-generating activity identified; standard is acknowledged in the application.' };
  }

  function evaluateOutdoorStorage() {
    const text = combinedText(els.materialsLocation.value, els.homeOperation.value);
    if (containsPositiveOutdoorStorage(text)) return { status: 'red', basis: 'Application text appears to propose outdoor storage.' };
    return { status: 'green', basis: 'No outdoor storage identified from the application responses.' };
  }

  function evaluateBusinessVehicle() {
    const vehicle = els.vehicle.value.trim();
    if (!vehicle) return { status: 'green', basis: 'No business vehicle information was entered in the application field.' };
    return { status: 'yellow', basis: `Vehicle listed (${vehicle}); confirm no more than one business vehicle, ≤¾-ton, resident-owned/operated, and parked off-street.` };
  }

  function combinedText(...parts) {
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function containsPositiveOutdoorStorage(text) {
    const lower = String(text || '').toLowerCase();
    if (!/(outdoor|outside|yard|driveway|patio)/.test(lower)) return false;
    if (/(no|none|not|without)\s+(outdoor|outside|yard|driveway|patio)/.test(lower)) return false;
    return /(stor|equipment|suppl|material|inventory|vehicle)/.test(lower);
  }

  function containsPositiveOutdoorOperation(text) {
    const lower = String(text || '').toLowerCase();
    if (!/(outdoor|outside|yard|driveway|patio)/.test(lower)) return false;
    if (/(no|none|not|without)\s+(outdoor|outside)/.test(lower)) return false;
    return true;
  }

  function renderReview() {
    const area = numeric(els.reviewSqft);
    const home = numeric(els.homeSqft);
    const limit = home !== null ? home * 0.2 : null;
    const pct = area !== null && home ? (area / home) * 100 : null;

    els.areaUsedDisplay.textContent = area === null ? '—' : `${formatNumber(area)} sq. ft.`;
    els.areaLimitDisplay.textContent = limit === null ? '—' : `${formatNumber(limit)} sq. ft.`;
    els.areaPercentDisplay.textContent = pct === null ? '—' : `${pct.toFixed(1)}%`;

    const results = standards.map((standard) => {
      const auto = standard.evaluate();
      const status = reviewOverrides.get(standard.id) || auto.status;
      return { ...standard, auto, status, overridden: reviewOverrides.has(standard.id) };
    });

    els.reviewList.innerHTML = results.map((item) => `
      <div class="review-row status-${item.status}" data-standard-id="${item.id}">
        <button type="button" class="flag-button ${item.status}" data-flag="${item.id}" aria-label="${item.code} status: ${item.status}. Click to change."></button>
        <div class="review-standard">${item.code}<br>${escapeHtml(item.title)}</div>
        <div class="review-basis">${escapeHtml(item.auto.basis)}${item.overridden ? ` <strong>(Manual: ${capitalize(item.status)})</strong>` : ''}</div>
        <button type="button" class="auto-button" data-auto="${item.id}" ${item.overridden ? '' : 'hidden'}>Use auto</button>
      </div>
    `).join('');

    els.reviewList.querySelectorAll('[data-flag]').forEach((button) => {
      button.addEventListener('click', () => cycleReviewStatus(button.dataset.flag));
    });
    els.reviewList.querySelectorAll('[data-auto]').forEach((button) => {
      button.addEventListener('click', () => {
        reviewOverrides.delete(button.dataset.auto);
        renderReview();
      });
    });

    const counts = results.reduce((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { green: 0, yellow: 0, red: 0 });

    els.greenCount.textContent = counts.green;
    els.yellowCount.textContent = counts.yellow;
    els.redCount.textContent = counts.red;

    if (counts.red > 0) {
      els.generateMessage.textContent = `${counts.red} red flag${counts.red === 1 ? '' : 's'} remain. Review before issuing an approval notice.`;
      els.generateMessage.classList.add('has-red');
    } else {
      els.generateMessage.textContent = 'The original Hercules Word template is used for the output.';
      els.generateMessage.classList.remove('has-red');
    }
  }

  function cycleReviewStatus(id) {
    const standard = standards.find((s) => s.id === id);
    if (!standard) return;
    const current = reviewOverrides.get(id) || standard.evaluate().status;
    const next = current === 'green' ? 'yellow' : current === 'yellow' ? 'red' : 'green';
    reviewOverrides.set(id, next);
    renderReview();
  }

  function inferWhereOperations() {
    const text = combinedText(els.businessDescription.value, els.homeOperation.value).toLowerCase();
    if (/off[- ]?site|at client|client locations?|customer locations?|mobile/.test(text)) {
      if (/home|residence|office/.test(text)) els.whereOperations.value = 'within the residence and off-site';
      else els.whereOperations.value = 'primarily off-site';
    } else {
      els.whereOperations.value = 'within the residence';
    }
  }

  function syncClientSentence() {
    if (els.clientsVisit.value === 'no') {
      els.clientSentence.value = 'No clients will visit the home.';
    } else if (els.clientsVisit.value === 'yes') {
      els.clientSentence.value = els.clientDetails.value
        ? `Client visits will occur by appointment as described in the application (${els.clientDetails.value}).`
        : 'Client visits may occur by appointment.';
    } else if (!els.clientSentence.value) {
      els.clientSentence.value = 'Client visitation shall be as described in the approved application.';
    }
  }

  function shortServiceDescription(text) {
    const value = String(text || '').trim().replace(/\s+/g, ' ');
    if (!value) return '';
    const sentence = value.split(/(?<=[.!?])\s+/)[0];
    return sentence.replace(/[.!?]+$/, '').slice(0, 150);
  }

  function refreshNoticeParagraph(force) {
    const file = els.aupNumber.value.trim() || '[AUP NUMBER]';
    const service = els.typeOfService.value.trim() || '[SERVICE DESCRIPTION]';
    const area = numeric(els.reviewSqft);
    const home = numeric(els.homeSqft);
    const roomPhrase = els.oneRoom.checked ? 'in one room' : 'within the residence';
    const where = els.whereOperations.value || 'within the residence';
    const hours = els.hoursWeek.value.trim();
    const clientSentence = els.clientSentence.value.trim() || 'Client visitation shall be as described in the approved application.';
    const outdoorSentence = els.noExterior.checked ? 'No outdoor operations are proposed.' : 'Outdoor operations are proposed.';

    const areaText = area === null ? '[BUSINESS AREA]' : formatNumber(area);
    const homeText = home === null ? '[HOME AREA]' : formatNumber(home);
    const hoursClause = hours ? ` for approximately ${hours} hours per week` : '';

    const paragraph = `The Community Development Department has tentatively approved Administrative Use Permit (AUP) #${file}, subject to certain conditions. This permit authorizes a home-based business providing ${service} to use approximately ${areaText} square feet of space ${roomPhrase} of the existing ${homeText}-square-foot residence at the above address. Business operations will be conducted ${where}${hoursClause}. ${clientSentence} ${outdoorSentence}`;

    if (force || !els.decisionParagraph.value.trim() || els.decisionParagraph.dataset.generated === 'true') {
      els.decisionParagraph.value = paragraph;
      els.decisionParagraph.dataset.generated = 'true';
    }
  }

  els.decisionParagraph.addEventListener('input', () => {
    els.decisionParagraph.dataset.generated = 'false';
  });

  async function generateDocx() {
    hidePdfError();
    els.generateDocx.disabled = true;
    const originalLabel = els.generateDocx.textContent;
    els.generateDocx.textContent = 'Generating…';

    try {
      if (!window.JSZip) throw new Error('DOCX library did not load. Check the internet connection and reload the page.');
      if (!els.aupNumber.value.trim()) throw new Error('Enter an AUP number before generating the notice.');
      if (!els.propertyAddress.value.trim()) throw new Error('Enter the property address before generating the notice.');
      if (!els.applicantName.value.trim()) throw new Error('Enter the applicant name before generating the notice.');
      if (!els.businessName.value.trim()) throw new Error('Enter the business name before generating the notice.');
      if (!els.appealDeadline.value) throw new Error('Enter the appeal deadline before generating the notice.');

      if (els.decisionParagraph.dataset.generated === 'true') refreshNoticeParagraph(true);

      const templateResponse = await fetch(TEMPLATE_URL);
      if (!templateResponse.ok) throw new Error(`Could not load ${TEMPLATE_URL}. If testing locally, run the site through a local web server instead of opening index.html directly.`);
      const templateBytes = await templateResponse.arrayBuffer();
      const zip = await window.JSZip.loadAsync(templateBytes);
      const documentFile = zip.file('word/document.xml');
      if (!documentFile) throw new Error('The Word template is missing word/document.xml.');

      const xmlText = await documentFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parseError) throw new Error('Could not parse the Word template XML.');

      replaceDecisionParagraph(xmlDoc, els.decisionParagraph.value.trim());
      replaceNoticeDateParagraph(xmlDoc, formatDateForNotice(els.noticeDate.value));

      const replacements = {
        File: els.aupNumber.value.trim(),
        Description: els.requestDescription.value.trim() || 'Home Occupation',
        StreetAddress: els.propertyAddress.value.trim(),
        Applicant: els.applicantName.value.trim(),
        BusnessName: els.businessName.value.trim(),
        AppealDeadline: formatDateForNotice(els.appealDeadline.value),
      };

      for (const [field, value] of Object.entries(replacements)) {
        replaceAllMergeFields(xmlDoc, field, value);
      }

      stripAllHighlights(xmlDoc);

      const serializer = new XMLSerializer();
      zip.file('word/document.xml', serializer.serializeToString(xmlDoc));

      const out = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        compression: 'DEFLATE',
      });

      const filename = buildOutputFilename();
      downloadBlob(out, filename);
    } catch (error) {
      console.error(error);
      showPdfError(error.message || 'Could not generate the Word document.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      els.generateDocx.disabled = false;
      els.generateDocx.textContent = originalLabel;
    }
  }

  function replaceAllMergeFields(xmlDoc, fieldName, value) {
    let safety = 0;
    while (safety < 50) {
      const instruction = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'instrText'))
        .find((node) => mergeFieldName(node.textContent) === fieldName);
      if (!instruction) break;
      replaceSingleMergeField(xmlDoc, instruction, value);
      safety += 1;
    }
  }

  function mergeFieldName(instructionText) {
    const match = String(instructionText || '').match(/MERGEFIELD\s+"?([^"\\\s]+)"?/i);
    return match ? match[1] : '';
  }

  function replaceSingleMergeField(xmlDoc, instructionNode, value) {
    const instructionRun = closestByLocalName(instructionNode, 'r');
    const paragraph = closestByLocalName(instructionNode, 'p');
    if (!instructionRun || !paragraph) return;

    const children = Array.from(paragraph.childNodes);
    const instructionIndex = children.indexOf(instructionRun);
    if (instructionIndex < 0) return;

    let beginIndex = -1;
    let separateIndex = -1;
    let endIndex = -1;

    for (let i = instructionIndex; i >= 0; i -= 1) {
      if (fieldCharType(children[i]) === 'begin') { beginIndex = i; break; }
    }
    for (let i = instructionIndex; i < children.length; i += 1) {
      const type = fieldCharType(children[i]);
      if (type === 'separate' && separateIndex < 0) separateIndex = i;
      if (type === 'end') { endIndex = i; break; }
    }

    if (beginIndex < 0 || separateIndex < 0 || endIndex < 0) {
      // Fallback: replace the visible merge result text if field structure is unusual.
      const visible = Array.from(paragraph.getElementsByTagNameNS(W_NS, 't'))
        .find((node) => node.textContent === `«${mergeFieldName(instructionNode.textContent)}»`);
      if (visible) {
        visible.textContent = value;
        removeHighlight(closestByLocalName(visible, 'r'));
      }
      return;
    }

    let resultRun = null;
    for (let i = separateIndex + 1; i < endIndex; i += 1) {
      if (children[i]?.localName === 'r' && children[i].getElementsByTagNameNS(W_NS, 't').length) {
        resultRun = children[i];
        break;
      }
    }

    if (!resultRun) {
      resultRun = xmlDoc.createElementNS(W_NS, 'w:r');
      paragraph.insertBefore(resultRun, children[endIndex]);
    }

    let textNode = resultRun.getElementsByTagNameNS(W_NS, 't')[0];
    if (!textNode) {
      textNode = xmlDoc.createElementNS(W_NS, 'w:t');
      resultRun.appendChild(textNode);
    }
    textNode.setAttribute('xml:space', 'preserve');
    textNode.textContent = value;
    removeHighlight(resultRun);

    const fieldNodes = Array.from(paragraph.childNodes).slice(beginIndex, endIndex + 1);
    fieldNodes.forEach((node) => {
      if (node !== resultRun && node.parentNode === paragraph) paragraph.removeChild(node);
    });
  }

  function fieldCharType(node) {
    if (!node || node.localName !== 'r') return '';
    const fld = node.getElementsByTagNameNS(W_NS, 'fldChar')[0];
    return fld?.getAttributeNS(W_NS, 'fldCharType') || fld?.getAttribute('w:fldCharType') || '';
  }

  function removeHighlight(run) {
    if (!run) return;
    Array.from(run.getElementsByTagNameNS(W_NS, 'highlight')).forEach((node) => node.remove());
  }

  function paragraphText(paragraph) {
    return Array.from(paragraph.getElementsByTagNameNS(W_NS, 't')).map((node) => node.textContent || '').join('');
  }

  function replaceDecisionParagraph(xmlDoc, text) {
    const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'p'));
    const paragraph = paragraphs.find((p) => paragraphText(p).includes('This permit authorizes a home-based business providing'));
    if (!paragraph) throw new Error('Could not locate the variable approval paragraph in the Word template.');
    replaceParagraphText(xmlDoc, paragraph, text);
  }

  function replaceNoticeDateParagraph(xmlDoc, text) {
    const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'p'));
    const paragraph = paragraphs.find((p) => /^[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/.test(paragraphText(p).trim()));
    if (!paragraph) throw new Error('Could not locate the notice date in the Word template.');
    replaceParagraphText(xmlDoc, paragraph, text);
  }

  function replaceParagraphText(xmlDoc, paragraph, text) {
    const pPr = Array.from(paragraph.childNodes).find((node) => node.localName === 'pPr') || null;
    const sourceRun = Array.from(paragraph.getElementsByTagNameNS(W_NS, 'r'))
      .find((run) => run.getElementsByTagNameNS(W_NS, 't').length);
    const sourceRPr = sourceRun?.getElementsByTagNameNS(W_NS, 'rPr')[0] || null;

    Array.from(paragraph.childNodes).forEach((node) => {
      if (node !== pPr) paragraph.removeChild(node);
    });

    const run = xmlDoc.createElementNS(W_NS, 'w:r');
    if (sourceRPr) {
      const clonedRPr = sourceRPr.cloneNode(true);
      Array.from(clonedRPr.getElementsByTagNameNS(W_NS, 'highlight')).forEach((node) => node.remove());
      run.appendChild(clonedRPr);
    }
    const textNode = xmlDoc.createElementNS(W_NS, 'w:t');
    textNode.setAttribute('xml:space', 'preserve');
    textNode.textContent = text;
    run.appendChild(textNode);
    paragraph.appendChild(run);
  }

  function stripAllHighlights(xmlDoc) {
    Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'highlight')).forEach((node) => node.remove());
  }

  function closestByLocalName(node, localName) {
    let current = node;
    while (current) {
      if (current.localName === localName) return current;
      current = current.parentNode;
    }
    return null;
  }

  function buildOutputFilename() {
    const aup = els.aupNumber.value.trim();
    const address = els.propertyAddress.value.trim();
    return sanitizeFilename(`AUP ${aup} - ${address} - Tentative Notice.docx`);
  }

  function sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toDateInput(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateForNotice(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clearAll() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
    inputs.forEach((el) => { el.value = ''; });
    document.querySelectorAll('select').forEach((el) => { el.selectedIndex = 0; });

    els.pdfFile.value = '';
    els.noticeDate.value = toDateInput(new Date());
    els.requestDescription.value = 'Home Occupation';
    els.whereOperations.value = 'within the residence';
    els.noExterior.checked = true;
    els.oneRoom.checked = false;
    els.nonresidentEmployees.value = 'unknown';
    els.clientsVisit.value = 'unknown';
    els.hazardous.value = 'unknown';
    els.improvements.value = 'unknown';
    els.rawFields.innerHTML = '';
    reviewOverrides.clear();
    lastAutoBusinessArea = null;
    lastImportedBusinessName = '';
    setPdfStatus('No PDF loaded', 'neutral');
    setExtractionResult('Upload a completed application and the values below will be read directly from the PDF.', 'neutral');
    els.editDataPanel.open = false;
    hidePdfError();
    els.decisionParagraph.dataset.generated = 'true';
    renderApplicationSummary();
    renderReview();
    refreshNoticeParagraph(true);
  }

  init();
})();
