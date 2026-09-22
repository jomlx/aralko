
const JSZip = require('jszip');

const docXml = \
<w:document><w:body>
  <w:p><w:t>Hello </w:t><w:t>World!</w:t></w:p>
  <w:p><w:t>This is </w:t><w:t>DOCX.</w:t></w:p>
</w:body></w:document>
\;

let text = '';
const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/gi;
let pMatch;
while ((pMatch = pRegex.exec(docXml)) !== null) {
  const pContent = pMatch[1];
  const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
  let tMatch;
  let pText = '';
  while ((tMatch = tRegex.exec(pContent)) !== null) {
    pText += tMatch[1];
  }
  if (pText) {
    text += pText + '\n';
  }
}
console.log('DOCX Text:', text);

const slideXml = \
<p:slide><p:cSld><p:spTree>
  <p:sp>
    <p:txBody>
      <a:p><a:r><a:t>Slide </a:t></a:r><a:r><a:t>1</a:t></a:r></a:p>
      <a:p><a:r><a:t>Bullet point</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:slide>
\;

let fullText = '';
const slideRegex = /<a:p[^>]*>([\s\S]*?)<\/a:p>/gi;
let sMatch;
while ((sMatch = slideRegex.exec(slideXml)) !== null) {
  const pContent = sMatch[1];
  const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
  let tMatch;
  let pText = '';
  while ((tMatch = tRegex.exec(pContent)) !== null) {
    pText += tMatch[1];
  }
  if (pText) {
    fullText += pText + '\n';
  }
}
console.log('PPTX Text:', fullText);

