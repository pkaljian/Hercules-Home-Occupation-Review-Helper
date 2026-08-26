# Hercules Home Occupation AUP Review Tool

A static browser-based review tool for City of Hercules Home Occupation Administrative Use Permits.

## What V3 does

1. Accepts both **fillable** and **scanned / flattened** Home Occupation application PDFs.
2. Tries the fast fillable-PDF field reader first.
3. If the file is scanned, automatically finds the Hercules Home Occupation form inside the PDF packet, even when attachments appear before the form.
4. OCRs the application-data pages locally in the browser and populates the review fields automatically.
5. Shows the extracted information as a read-only summary first; the full form remains a correction panel only.
6. Applies a Green / Yellow / Red stoplight review for Hercules Municipal Code §13-35.270.
7. Gives the planner a toggle for the §13-35.270.1 one-room allowance.
8. Lets the planner override any stoplight flag.
9. Generates the existing Hercules Tentative Notice of Decision as a new `.docx` file.
10. Does **not** create or maintain a permit log.

The application itself is not uploaded to a server. PDF rendering, OCR, review logic, and DOCX generation occur in the user's browser. The OCR engine and language model are downloaded by the browser when needed.

## Scanned-PDF workflow

V3 is designed around the real application packets supplied during development:

- a standard five-page scan;
- a scan with a small native text layer;
- a larger packet with attachments before the actual five-page Hercules form.

The tool searches the packet for the page headed **City of Hercules / Administrative Use Permit / Home Occupation**, then treats the following two pages as the application-data pages. That means the form does not have to begin on PDF page 1.

For scanned copies, the normal workflow is:

```text
Upload PDF
   ↓
Find Hercules form in packet
   ↓
OCR application pages 2–3
   ↓
Extract values
   ↓
Planner reviews summary / corrects any OCR error
   ↓
Stoplight review
   ↓
Generate DOCX
```

The tool also performs a small digits-only second OCR pass on the hours line because values such as `25` can otherwise be confused with `29` in low-quality scans.

## Repository structure

```text
/
├─ index.html
├─ styles.css
├─ app.js
├─ README.md
└─ assets/
   └─ AUP-Notice-Template.docx
```

## GitHub setup

1. Create a new repository.
2. Copy these files into the repository root, preserving the `assets` folder.
3. Commit and push.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)` folder.
7. Save. GitHub will provide the Pages URL after deployment.

## Local testing

Do not double-click `index.html` because browsers may block loading the Word template from a `file://` URL.

From the repository folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Browser libraries

The site loads the following libraries from jsDelivr:

- `pdf-lib` 1.17.1 — reads genuine AcroForm fields when they are still present.
- `PDF.js` 3.11.174 — renders scanned PDF pages into browser canvases.
- `Tesseract.js` 5 — OCRs scanned form pages in the browser.
- `JSZip` 3.10.1 — opens and rebuilds the Word `.docx` package.

The first scanned PDF can take longer because the browser must download and initialize the OCR engine/language data. Subsequent scans in the same browser session should feel faster.

## OCR philosophy

OCR is treated as **data entry assistance, not a planning determination**. The extracted summary is always visible before the stoplight review and every field can be corrected in the collapsed correction panel.

The tool intentionally does not infer the §13-35.270.1 one-room allowance. The planner controls that toggle.

Checkboxes are read from the OCR representation where possible. If a yes/no response cannot be confidently identified, it remains `Unknown` rather than being guessed.

## Stoplight meaning

- **Green** — application information appears consistent with the standard.
- **Yellow** — planner review/confirmation is needed.
- **Red** — submitted information appears inconsistent with the standard.

A flag can be clicked to cycle Green → Yellow → Red. Manual overrides can be returned to the calculated status with **Use auto**.

## §13-35.270.1 area logic

The planner controls the **One-room allowance applies** toggle.

- Toggle ON → Green based on the one-room allowance.
- Toggle OFF + business area ≤ 20% of dwelling → Green.
- Toggle OFF + business area > 20% → Red.
- Missing area data → Yellow.

The initial review business area is calculated as office area + storage area, but the planner can edit that number before review.

## Word generation

`assets/AUP-Notice-Template.docx` is the original Hercules Word template supplied for this project.

The browser:

- replaces the Word mail-merge fields for AUP number, request, address, applicant, business name, and appeal deadline;
- replaces the template's hard-coded notice date;
- replaces the variable approval paragraph with the planner-reviewed paragraph from the screen; and
- strips the yellow highlighting from replaced merge-field values.

The generated file name is:

```text
AUP [number] - [address] - Tentative Notice.docx
```

## Debugging a difficult scan

Expand **Edit extracted data → Extraction debug**. It contains:

- any populated AcroForm fields found in the PDF; and
- the raw OCR text from the form header and application pages 2–3.

If a new scanner/export format consistently places or reads data differently, the parser can be adjusted using that raw OCR text without changing the planner workflow.
