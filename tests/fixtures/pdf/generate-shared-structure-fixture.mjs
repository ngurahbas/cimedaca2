import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shared Structure Tree Test</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.5; }
    h1 { font-size: 18pt; margin-top: 0; }
  </style>
</head>
<body>
  <h1>First Section</h1>
  <p>This is the alpha body for the first section.</p>
  <h1>Second Section</h1>
  <p>This is the beta body for the second section.</p>
</body>
</html>
`);
await page.pdf({
	path: './tests/fixtures/pdf/shared_structure_same_page.pdf',
	tagged: true,
	width: '612px',
	height: '792px'
});
await browser.close();
console.log('wrote shared_structure_same_page.pdf');
