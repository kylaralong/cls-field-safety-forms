// Shared, dependency-light PDF layout helper built on pdf-lib.
// Provides simple flowing text, tables, image embedding and automatic pagination
// with a repeating header/footer, for generating professional-looking record PDFs
// inside a Netlify Function (no headless browser required).
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_W = 595.28, PAGE_H = 841.89; // A4 in points
const MARGIN = 42;
const NAVY = rgb(0.09, 0.23, 0.37);
const INK = rgb(0.12, 0.14, 0.16);
const GREY = rgb(0.4, 0.44, 0.48);
const LINE = rgb(0.82, 0.85, 0.88);
const RISK_COLORS = { C: rgb(0.71,0.11,0.09), H: rgb(0.85,0.47,0.02), M: rgb(0.15,0.4,0.75), L: rgb(0.09,0.47,0.31) };

function dataUrlInfo(dataUrl) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  return { type: /png/i.test(m[1]) ? 'png' : 'jpg', bytes: Buffer.from(m[2], 'base64') };
}

class PdfBuilder {
  async init({ title, kicker, statusLine, footerLine, logoBytes }) {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.title = title || '';
    this.kicker = kicker || '';
    this.statusLine = statusLine || '';
    this.footerLine = footerLine || '';
    this.contentWidth = PAGE_W - MARGIN * 2;
    this.logoImg = null;
    if (logoBytes) { try { this.logoImg = await this.doc.embedPng(logoBytes); } catch (e) { this.logoImg = null; } }
    this.pageNum = 0;
    this._newPage();
    return this;
  }

  async setLogo(pngBytes) {
    // Retained for backward compatibility — prefer passing logoBytes to init() so page 1's header has it too.
    try { this.logoImg = await this.doc.embedPng(pngBytes); } catch (e) { this.logoImg = null; }
  }

  _newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNum++;
    this.y = PAGE_H - MARGIN;
    this._drawHeader();
  }

  _drawHeader() {
    const p = this.page;
    let x = MARGIN;
    let logoW = 0;
    if (this.logoImg) {
      const h = 28; logoW = (this.logoImg.width / this.logoImg.height) * h;
      p.drawImage(this.logoImg, { x, y: this.y - h, width: logoW, height: h });
      x += logoW + 10;
    }
    const titleMaxWidth = PAGE_W - MARGIN - x;
    let titleSize = 13;
    let titleLines = this._wrap(this.title, titleSize, this.fontBold, titleMaxWidth);
    if (titleLines.length > 2) { titleSize = 11; titleLines = this._wrap(this.title, titleSize, this.fontBold, titleMaxWidth); }
    titleLines = titleLines.slice(0, 2);
    p.drawText(this.kicker.toUpperCase(), { x, y: this.y - 10, size: 8, font: this.fontBold, color: GREY });
    titleLines.forEach((ln, i) => p.drawText(ln, { x, y: this.y - 24 - i * (titleSize + 2), size: titleSize, font: this.fontBold, color: NAVY }));
    const statusY = this.y - 24 - titleLines.length * (titleSize + 2) - 6;
    p.drawText(this.statusLine, { x: MARGIN, y: statusY, size: 7.5, font: this.font, color: GREY });
    const ruleY = statusY - 6;
    p.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 1, color: NAVY });
    this.y = ruleY - 12;
  }

  _drawFooterOnCurrentPage(totalPagesUnknown) {
    const p = this.page;
    p.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_W - MARGIN, y: 34 }, thickness: 0.6, color: LINE });
    const lines = this._wrap(this.footerLine, 6.8, this.font, this.contentWidth - 55).slice(0, 2);
    lines.forEach((ln, i) => p.drawText(ln, { x: MARGIN, y: 24 - i * 8, size: 6.8, font: this.font, color: GREY }));
    p.drawText(`Page ${this.pageNum}`, { x: PAGE_W - MARGIN - 40, y: 24, size: 7, font: this.font, color: GREY });
  }

  ensure(h) {
    if (this.y - h < 60) {
      this._drawFooterOnCurrentPage();
      this._newPage();
    }
  }

  _wrap(text, size, font, maxWidth) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  heading(text, { size = 12 } = {}) {
    this.ensure(24);
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.fontBold, color: NAVY });
    this.y -= size + 8;
  }

  subheading(text) {
    this.ensure(16);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 9.5, font: this.fontBold, color: INK });
    this.y -= 15;
  }

  paragraph(text, { size = 9.5, color = INK, indent = 0, gap = 4 } = {}) {
    const lines = this._wrap(text, size, this.font, this.contentWidth - indent);
    for (const ln of lines) {
      this.ensure(size + 4);
      this.page.drawText(ln, { x: MARGIN + indent, y: this.y, size, font: this.font, color });
      this.y -= size + 3;
    }
    this.y -= gap;
  }

  bulletList(items) {
    for (const it of items) {
      const lines = this._wrap(it, 9.5, this.font, this.contentWidth - 14);
      this.ensure(lines.length * 13 + 2);
      this.page.drawText('\u2022', { x: MARGIN, y: this.y, size: 9.5, font: this.font, color: INK });
      lines.forEach((ln, i) => {
        this.page.drawText(ln, { x: MARGIN + 12, y: this.y, size: 9.5, font: this.font, color: INK });
        this.y -= 13;
      });
      this.y -= 1;
    }
    this.y -= 5;
  }

  // Two-column label/value meta grid, e.g. document-control header block
  metaGrid(rowsOfPairs) {
    const colW = this.contentWidth / 2;
    for (const pair of rowsOfPairs) {
      const cellLines = pair.map(([label, value]) => {
        const lines = this._wrap(value || '', 8.5, this.font, colW - 16);
        return { label, lines };
      });
      const rowH = Math.max(...cellLines.map(c => 12 + c.lines.length * 11)) + 6;
      this.ensure(rowH);
      const rowTop = this.y;
      this.page.drawRectangle({ x: MARGIN, y: rowTop - rowH, width: this.contentWidth, height: rowH, borderColor: LINE, borderWidth: 0.6 });
      this.page.drawLine({ start: { x: MARGIN + colW, y: rowTop }, end: { x: MARGIN + colW, y: rowTop - rowH }, thickness: 0.6, color: LINE });
      cellLines.forEach((c, ci) => {
        const cx = MARGIN + ci * colW + 8;
        this.page.drawText(c.label.toUpperCase(), { x: cx, y: rowTop - 11, size: 6.6, font: this.fontBold, color: NAVY });
        c.lines.forEach((ln, li) => {
          this.page.drawText(ln, { x: cx, y: rowTop - 22 - li * 11, size: 8.5, font: this.font, color: INK });
        });
      });
      this.y = rowTop - rowH;
    }
    this.y -= 10;
  }

  // Generic field label/value pairs, two per row (job-detail style forms)
  fieldGrid(pairs) {
    const colW = this.contentWidth / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const rowPairs = [pairs[i], pairs[i + 1]].filter(Boolean);
      const cellData = rowPairs.map(([label, value]) => {
        const lines = this._wrap(value || '—', 9, this.font, colW - 16);
        return { label, lines };
      });
      const rowH = Math.max(...cellData.map(c => 12 + c.lines.length * 11)) + 8;
      this.ensure(rowH);
      const rowTop = this.y;
      cellData.forEach((c, ci) => {
        const cx = MARGIN + ci * colW;
        this.page.drawText(c.label, { x: cx, y: rowTop - 9, size: 7.5, font: this.fontBold, color: GREY });
        c.lines.forEach((ln, li) => {
          this.page.drawText(ln, { x: cx, y: rowTop - 21 - li * 11, size: 9, font: this.font, color: INK });
        });
      });
      this.y = rowTop - rowH;
    }
    this.y -= 6;
  }

  // Verification / hold-point table: item | Yes/No | detail
  holdTable(rows, options) {
    const w1 = this.contentWidth * 0.5, w2 = this.contentWidth * 0.16, w3 = this.contentWidth * 0.16, w4 = this.contentWidth * 0.18;
    this.ensure(16);
    const headTop = this.y;
    this.page.drawRectangle({ x: MARGIN, y: headTop - 14, width: this.contentWidth, height: 14, color: rgb(0.95,0.96,0.97) });
    this.page.drawText('Verification', { x: MARGIN + 4, y: headTop - 10, size: 7.5, font: this.fontBold, color: NAVY });
    this.page.drawText(options[0], { x: MARGIN + w1 + 4, y: headTop - 10, size: 7.5, font: this.fontBold, color: NAVY });
    this.page.drawText(options[1], { x: MARGIN + w1 + w2 + 4, y: headTop - 10, size: 7.5, font: this.fontBold, color: NAVY });
    this.page.drawText('Details', { x: MARGIN + w1 + w2 + w3 + 4, y: headTop - 10, size: 7.5, font: this.fontBold, color: NAVY });
    this.y -= 14;
    for (const r of rows) {
      const lines = this._wrap(r.item, 8.3, this.font, w1 - 8);
      const detailLines = this._wrap(r.detail || '', 8, this.font, w4 - 8);
      const rowH = Math.max(lines.length, detailLines.length, 1) * 10 + 6;
      this.ensure(rowH);
      const top = this.y;
      this.page.drawRectangle({ x: MARGIN, y: top - rowH, width: this.contentWidth, height: rowH, borderColor: LINE, borderWidth: 0.5 });
      lines.forEach((ln, i) => this.page.drawText(ln, { x: MARGIN + 4, y: top - 9 - i * 10, size: 8.3, font: this.font, color: INK }));
      this.page.drawText(r.answer === 'yes' ? 'X' : '', { x: MARGIN + w1 + w2 / 2, y: top - 9, size: 9, font: this.fontBold, color: rgb(0.09,0.47,0.31) });
      this.page.drawText(r.answer === 'no' ? 'X' : '', { x: MARGIN + w1 + w2 + w3 / 2, y: top - 9, size: 9, font: this.fontBold, color: rgb(0.71,0.11,0.09) });
      detailLines.forEach((ln, i) => this.page.drawText(ln, { x: MARGIN + w1 + w2 + w3 + 4, y: top - 9 - i * 10, size: 8, font: this.font, color: INK }));
      this.y = top - rowH;
    }
    this.y -= 8;
  }

  // Risk-step table for SWMS safe work method sections
  riskTable(rows) {
    const cols = [0.19, 0.24, 0.07, 0.31, 0.07, 0.12].map(f => f * this.contentWidth);
    const heads = ['Step / activity', 'Hazard / consequence', 'Init.', 'Required controls', 'Resid.', 'Verified'];
    this.ensure(16);
    let x = MARGIN;
    const headTop = this.y;
    this.page.drawRectangle({ x: MARGIN, y: headTop - 14, width: this.contentWidth, height: 14, color: rgb(0.95,0.96,0.97) });
    heads.forEach((h, i) => { this.page.drawText(h, { x: x + 3, y: headTop - 10, size: 7, font: this.fontBold, color: NAVY }); x += cols[i]; });
    this.y -= 14;
    for (const r of rows) {
      const [step, hazard, initial, controls, residual, verified] = r;
      const stepLines = this._wrap(step, 7.6, this.font, cols[0] - 6);
      const hazardLines = this._wrap(hazard, 7.6, this.font, cols[1] - 6);
      const controlLines = this._wrap(controls, 7.6, this.font, cols[3] - 6);
      const rowH = Math.max(stepLines.length, hazardLines.length, controlLines.length, 1) * 9.5 + 6;
      this.ensure(rowH);
      const top = this.y;
      let cx = MARGIN;
      this.page.drawRectangle({ x: MARGIN, y: top - rowH, width: this.contentWidth, height: rowH, borderColor: LINE, borderWidth: 0.4 });
      stepLines.forEach((ln, i) => this.page.drawText(ln, { x: cx + 3, y: top - 9 - i * 9.5, size: 7.6, font: this.font, color: INK }));
      cx += cols[0];
      hazardLines.forEach((ln, i) => this.page.drawText(ln, { x: cx + 3, y: top - 9 - i * 9.5, size: 7.6, font: this.font, color: INK }));
      cx += cols[1];
      this.page.drawText(initial, { x: cx + 3, y: top - 9, size: 8, font: this.fontBold, color: RISK_COLORS[initial] || INK });
      cx += cols[2];
      controlLines.forEach((ln, i) => this.page.drawText(ln, { x: cx + 3, y: top - 9 - i * 9.5, size: 7.6, font: this.font, color: INK }));
      cx += cols[3];
      this.page.drawText(residual, { x: cx + 3, y: top - 9, size: 8, font: this.fontBold, color: RISK_COLORS[residual] || INK });
      cx += cols[4];
      this.page.drawText(verified ? 'Yes' : 'No', { x: cx + 3, y: top - 9, size: 7.6, font: this.font, color: GREY });
      this.y = top - rowH;
    }
    this.y -= 8;
  }

  // Sign-on table: name/role/signature-image/time/resign
  signTable(rows) {
    for (const r of rows) {
      if (!r.name && !r.role && !r.sigImg) continue;
      const rowH = 46;
      this.ensure(rowH);
      const top = this.y;
      this.page.drawRectangle({ x: MARGIN, y: top - rowH, width: this.contentWidth, height: rowH, borderColor: LINE, borderWidth: 0.5 });
      this.page.drawText(`${r.name || '—'}`, { x: MARGIN + 4, y: top - 12, size: 8.5, font: this.fontBold, color: INK });
      this.page.drawText(`${r.role || ''}`, { x: MARGIN + 4, y: top - 24, size: 7.5, font: this.font, color: GREY });
      if (r.time) this.page.drawText(`${r.time}`, { x: MARGIN + 4, y: top - 36, size: 7, font: this.font, color: GREY });
      if (r.resign) this.page.drawText('Re-signed after change', { x: MARGIN + 130, y: top - 36, size: 7, font: this.fontBold, color: rgb(0.71,0.11,0.09) });
      if (r.sigImg) {
        const maxW = 150, maxH = 40;
        const ratio = Math.min(maxW / r.sigImg.width, maxH / r.sigImg.height);
        this.page.drawImage(r.sigImg, { x: MARGIN + this.contentWidth - maxW - 6, y: top - rowH + 4, width: r.sigImg.width * ratio, height: r.sigImg.height * ratio });
      }
      this.y = top - rowH;
    }
    this.y -= 8;
  }

  async embedImageAuto(dataUrl) {
    const info = dataUrlInfo(dataUrl);
    if (!info) return null;
    try { return info.type === 'png' ? await this.doc.embedPng(info.bytes) : await this.doc.embedJpg(info.bytes); }
    catch (e) { return null; }
  }

  async photoGrid(photos) {
    const perRow = 3, gap = 8, cellW = (this.contentWidth - gap * (perRow - 1)) / perRow, cellH = cellW * 0.75;
    for (let i = 0; i < photos.length; i += perRow) {
      this.ensure(cellH + 16);
      const top = this.y;
      for (let j = 0; j < perRow && i + j < photos.length; j++) {
        const img = await this.embedImageAuto(photos[i + j].data);
        const x = MARGIN + j * (cellW + gap);
        if (img) {
          const ratio = Math.min(cellW / img.width, cellH / img.height);
          const w = img.width * ratio, h = img.height * ratio;
          this.page.drawImage(img, { x: x + (cellW - w) / 2, y: top - cellH + (cellH - h) / 2, width: w, height: h });
          this.page.drawRectangle({ x, y: top - cellH, width: cellW, height: cellH, borderColor: LINE, borderWidth: 0.5 });
        }
        const label = (photos[i + j].name || '').slice(0, 40);
        this.page.drawText(label, { x, y: top - cellH - 10, size: 6.5, font: this.font, color: GREY });
      }
      this.y = top - cellH - 16;
    }
  }

  async finish() {
    this._drawFooterOnCurrentPage();
    return this.doc.save();
  }
}

module.exports = { PdfBuilder, dataUrlInfo };
