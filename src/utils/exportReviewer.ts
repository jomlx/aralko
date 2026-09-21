import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';

type Block =
  | { type: 'text'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

function parseBlocks(content: string, isPdf: boolean = false): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  
  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    line = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#/g, '').trim();

    if (isPdf) {
      // jsPDF standard fonts only support ASCII and Latin-1.
      // Emojis and high-unicode characters cause the weird spacing and symbol corruption.
      line = line.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
    }

    if (line.includes('|') && i + 1 < lines.length) {
      let nextLine = lines[i + 1].trim();
      if (nextLine.includes('|') && nextLine.includes('---')) {
        // Table detected
        const parseRow = (rowStr: string) => {
          let cols = rowStr.split('|').map(s => s.trim());
          if (rowStr.startsWith('|')) cols.shift();
          if (rowStr.endsWith('|')) cols.pop();
          return cols;
        };

        const headers = parseRow(line);
        const rows: string[][] = [];
        
        i += 2; // skip header and separator
        while (i < lines.length) {
          let rowLine = lines[i].trim();
          
          if (isPdf) {
             rowLine = rowLine.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
          }

          if (!rowLine.includes('|')) break;
          rows.push(parseRow(rowLine));
          i++;
        }
        
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }
    
    blocks.push({ type: 'text', content: line });
    i++;
  }
  return blocks;
}

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

  const blocks = parseBlocks(content, true);

  for (const block of blocks) {
    if (block.type === 'text') {
      if (!block.content) {
        y += 4;
        continue;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(block.content, maxWidth);
      
      for (const wline of wrapped) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = 20;
        }
        doc.text(wline, margin, y);
        y += lineHeight;
      }
    } else if (block.type === 'table') {
      autoTable(doc, {
        startY: y,
        head: [block.headers],
        body: block.rows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [122, 133, 245] }, // accent color
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  doc.save(`${activityName} - Reviewer.pdf`);
}

export async function exportReviewerAsDocx(content: string, activityName: string) {
  const blocks = parseBlocks(content);
  const docChildren: any[] = [];

  // Title
  docChildren.push(
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
    })
  );

  for (const block of blocks) {
    if (block.type === 'text') {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.content,
              size: 22, // 11pt
              font: 'Calibri',
            }),
          ],
          spacing: { after: block.content ? 80 : 160 },
        })
      );
    } else if (block.type === 'table') {
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: block.headers.map(
                header =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
                    shading: { fill: '7A85F5', color: 'auto' }, // accent color
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                  })
              ),
            }),
            ...block.rows.map(
              row =>
                new TableRow({
                  children: row.map(
                    cell =>
                      new TableCell({
                        children: [new Paragraph(cell)],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                      })
                  ),
                })
            ),
          ],
        })
      );
      // Add a spacer paragraph after table
      docChildren.push(new Paragraph({ spacing: { after: 200 } }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${activityName} - Reviewer.docx`);
}
