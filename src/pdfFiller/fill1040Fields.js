// credit for the recurseAcroFieldKids and getRootAcroFields functions goes to Andrew Dillon
// https://github.com/Hopding/pdf-lib/issues/349

import fs from 'fs'
import fetch from 'node-fetch'
import {
    drawImage,
    drawLinesOfText,
    drawRectangle,
    drawText,
    PDFArray,
    PDFContentStream,
    PDFDictionary,
    PDFDocument,
    PDFDocumentFactory,
    PDFDocumentWriter,
    PDFIndirectReference,
    PDFName,
    PDFNumber,
    PDFRawStream,
    PDFString,
    PDFBool,
    PDFDict
} from 'pdf-lib'

const recurseAcroFieldKids = (field) => {
    const kids = field.get(PDFName.of('Kids'))
    if (!kids) return [field];

    const acroFields = new Array(kids.size());
    for (let idx = 0, len = kids.size(); idx < len; idx++) {
        acroFields[idx] = field.context.lookup(kids.get(idx), PDFDict);
    }

    let flatKids = [];
    for (let idx = 0, len = acroFields.length; idx < len; idx++) {
        flatKids.push(...recurseAcroFieldKids(acroFields[idx]));
    }
    return flatKids;
};

const getRootAcroFields = (pdfDoc) => {
    if (!pdfDoc.catalog.get(PDFName.of('AcroForm'))) return [];
    const acroForm = pdfDoc.context.lookup(
        pdfDoc.catalog.get(PDFName.of('AcroForm')),
        PDFDict,
    );

    if (!acroForm.get(PDFName.of('Fields'))) return [];
    const acroFieldRefs = acroForm.context.lookup(
        acroForm.get(PDFName.of('Fields')),
        PDFArray,
    );

    const acroFields = new Array(acroFieldRefs.size());
    for (let idx = 0, len = acroFieldRefs.size(); idx < len; idx++) {
        acroFields[idx] = pdfDoc.context.lookup(acroFieldRefs.get(idx), PDFDict);
    }

    return acroFields;
};

const fillAcroTextField = (
    // pdfDoc,
    acroField,
    // fontObject,
    text,
    // fontSize = 15,
) => {
    acroField.set(PDFName.of('V'), PDFString.of(text));
    acroField.set(PDFName.of('Ff'), PDFNumber.of(
        1 << 0 // Read Only
        |
        1 << 12 // Multiline
    ));
};

// returns PDFDocument in the form of a Uint8Array
export async function fillPDF() {
    const pdfDoc = await PDFDocument.load(await fetch('https://thegrims.github.io/UsTaxes/tax_forms/f1040.pdf').then(res => res.arrayBuffer()))
    const rootAcroFields = getRootAcroFields(pdfDoc)
    const flatFields = rootAcroFields.reduce((accumulator, acrofield) => (accumulator.concat(recurseAcroFieldKids(acrofield))),[])
    console.log('flatFields ', flatFields)
    flatFields.forEach((acrofield, i) => fillAcroTextField(acrofield, "field" + i))
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes
}

// opens new with filled information in the window of the component it is called from
export async function createPDFPopup () {
    const PDF = await fillPDF()
    const blob = new Blob([PDF], { type: 'application/pdf' });
    const blobURL = URL.createObjectURL(blob);
    window.open(blobURL)
}