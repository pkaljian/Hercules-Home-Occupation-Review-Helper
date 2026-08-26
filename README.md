# Hercules Home Occupation AUP Review Tool

A static browser-based review tool for City of Hercules Home Occupation Administrative Use Permits.

## What V2 does

1. Loads the completed 2025 Home Occupation AUP fillable PDF directly in the browser.
2. Pulls completed AcroForm values directly from the PDF and shows them first as a read-only extracted summary.
3. Keeps the full data-entry fields collapsed as a **correction panel only**; normal applications should not require re-entry.
4. Applies a Green / Yellow / Red stoplight review for Hercules Municipal Code §13-35.270.
5. Gives the planner a toggle for the §13-35.270.1 one-room allowance.
6. Lets the planner override any stoplight flag.
7. Generates the existing Hercules Tentative Notice of Decision as a new `.docx` file.
8. Does **not** create or maintain a permit log.

No application data is sent to a server. PDF reading and DOCX generation happen in the browser.

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

## External browser libraries

The site currently loads two libraries from jsDelivr:

- `pdf-lib` 1.17.1 - reading fillable PDF fields
- `JSZip` 3.10.1 - opening and rebuilding the Word `.docx` package

The permit/application data itself remains local in the browser.

## Important PDF-field note

The 2025 Hercules PDF contains several inherited or shifted AcroForm field names. For example, the visible **Hours per day** field is internally named after the following deliveries question. V2 maps these to the visible fields in the provided 2025 form. V2 also fixes the PDF reader so it does not depend on minified JavaScript class names when identifying text and radio fields.

A **PDF field debug** section is included in the app. When testing a real completed application, expand it if a value appears in the wrong place. The table shows the exact PDF field names and values so the mapping can be corrected quickly.

## Stoplight meaning

- **Green** - application information appears consistent with the standard.
- **Yellow** - planner review/confirmation is needed.
- **Red** - submitted information appears inconsistent with the standard.

A flag can be clicked to cycle Green → Yellow → Red. Manual overrides can be returned to the calculated status with **Use auto**.

The code intentionally treats keyword-based text checks as Yellow rather than automatically making a discretionary finding.

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

## Recommended first test

Use one previously approved, completed Home Occupation application and compare:

1. values imported into the screen;
2. stoplight flags;
3. generated decision paragraph; and
4. generated Word document against the manually produced notice.

If a real completed application still does not import, check whether it has been **flattened, printed to PDF, or scanned**. Those copies no longer contain the original fillable-field values. A real example of that file type can be used to add a text/OCR fallback without changing the normal digital-form workflow.
