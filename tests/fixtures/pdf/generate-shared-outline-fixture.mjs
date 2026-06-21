import { writeFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFNull, StandardFonts } from 'pdf-lib';

const WIDTH = 612;
const HEIGHT = 792;

const doc = await PDFDocument.create();
const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
const regularFont = await doc.embedFont(StandardFonts.Helvetica);

const sections = [
	{ title: 'First Section', body: 'This is the alpha body for the first section.', pageY: 750 },
	{ title: 'Second Section', body: 'This is the beta body for the second section.', pageY: 650 },
	{
		title: 'Third Section',
		body: 'This is the gamma body for the third section.',
		pageY: 750,
		newPage: true
	}
];

let currentPage = null;
const outlineItems = [];

for (const s of sections) {
	if (!currentPage || s.newPage) {
		currentPage = doc.addPage([WIDTH, HEIGHT]);
	}
	currentPage.drawText(s.title, { x: 50, y: s.pageY, size: 18, font: boldFont });
	currentPage.drawText(s.body, { x: 50, y: s.pageY - 30, size: 12, font: regularFont });
	outlineItems.push({ title: s.title, pageRef: currentPage.ref, y: s.pageY });
}

const context = doc.context;
const itemDicts = outlineItems.map((s) => {
	const dict = context.obj({
		Title: PDFString.of(s.title),
		Dest: context.obj([
			s.pageRef,
			PDFName.of('XYZ'),
			PDFNumber.of(0),
			PDFNumber.of(s.y),
			PDFNull.instance
		])
	});
	context.register(dict);
	return dict;
});

const itemRefs = itemDicts.map((d) => context.getObjectRef(d));

for (let i = 0; i < itemDicts.length; i++) {
	const cur = itemDicts[i];
	if (i > 0) cur.set(PDFName.of('Prev'), itemRefs[i - 1]);
	if (i < itemDicts.length - 1) cur.set(PDFName.of('Next'), itemRefs[i + 1]);
}

const outlinesDict = context.obj({
	Type: PDFName.of('Outlines'),
	First: itemRefs[0],
	Last: itemRefs[itemDicts.length - 1],
	Count: PDFNumber.of(itemDicts.length)
});
context.register(outlinesDict);
const outlinesRef = context.getObjectRef(outlinesDict);

for (const dict of itemDicts) {
	dict.set(PDFName.of('Parent'), outlinesRef);
}

doc.catalog.set(PDFName.of('Outlines'), outlinesRef);

const bytes = await doc.save();
writeFileSync('./tests/fixtures/pdf/shared_outline_same_page.pdf', bytes);
console.log('wrote shared_outline_same_page.pdf');
