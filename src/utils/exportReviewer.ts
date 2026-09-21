import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export async function exportReviewerAsPDF(content: string, activityName: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  let y = 20;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${activityName} — Study Reviewer`, margin, y);
  y += 12;

  // Content
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const lines = content.split('\n');
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line || ' ', maxWidth);
    for (const wline of wrapped) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(wline, margin, y);
      y += lineHeight;
    }
  }

  doc.save(`${activityName} - Reviewer.pdf`);
}

export async function exportReviewerAsDocx(content: string, activityName: string) {
  const lines = content.split('\n');
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 22, // 11pt
            font: 'Calibri',
          }),
        ],
        spacing: { after: 80 },
      })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${activityName} — Study Reviewer`,
                bold: true,
                size: 32, // 16pt
                font: 'Calibri',
              }),
            ],
            spacing: { after: 240 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${activityName} - Reviewer.docx`);
}

