const PDFDocument = require('pdfkit');
const crypto = require('crypto');

// ── GERAR HASH SHA-256 ────────────────────────────────────────
function gerarHash(dados) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(dados))
    .digest('hex');
}

// ── GERAR PDF DO CONTRATO ─────────────────────────────────────
function gerarPDF(dadosContrato) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const {
      codigo, contNome, contCpf, contTelefone, prestNome, prestCpf, prestTelefone,
      servico, valor, comissaoValor, comissaoPct,
      prazo, pagamento, garantia, dataGeracao, hashDocumento,
      assinadoCliente, assinadoPrestador, ipCliente, ipPrestador,
      timestampCliente, timestampPrestador,
      uaCliente, uaPrestador, geoCliente, geoPrestador, telCliente, telPrestador,
    } = dadosContrato;

    const tipoLabel = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS';
    const AZUL = '#1B2F6E';
    const VERDE = '#1A7A4A';

    // ── CABEÇALHO ────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(AZUL);

    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(22)
      .text('ServiçoSeguro', 50, 22);

    doc.fillColor('#2ECC71')
      .font('Helvetica').fontSize(10)
      .text('SERVIÇOS PROFISSIONAIS COM SEGURANÇA', 50, 48);

    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(11)
      .text(tipoLabel, 350, 22, { align: 'right', width: 200 });

    doc.fillColor('rgba(255,255,255,0.7)')
      .font('Helvetica').fontSize(8)
      .text(`Código: ${codigo}`, 350, 38, { align: 'right', width: 200 });

    doc.fillColor('rgba(255,255,255,0.7)')
      .font('Helvetica').fontSize(8)
      .text(`Gerado em: ${dataGeracao}`, 350, 50, { align: 'right', width: 200 });

    // ── TÍTULO ───────────────────────────────────────────────
    doc.moveDown(3);
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(14)
      .text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { align: 'center' });

    doc.moveDown(0.5);
    doc.strokeColor(AZUL).lineWidth(2)
      .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();

    // ── PARTES ───────────────────────────────────────────────
    doc.moveDown(1);
    secao(doc, 'PARTES CONTRATANTES', AZUL);

    linha(doc, 'CONTRATANTE', `${contNome}${contCpf ? ` — CPF: ${contCpf}` : ''}${contTelefone ? ` — Tel: ${contTelefone}` : ''}`);
    linha(doc, 'PRESTADOR', `${prestNome}${prestCpf ? ` — CPF: ${prestCpf}` : ''}${prestTelefone ? ` — Tel: ${prestTelefone}` : ''}`);
    linha(doc, 'INTERMEDIADORA', 'Serviço Seguro Plataforma Digital LTDA');

    // ── SERVIÇO ───────────────────────────────────────────────
    secao(doc, 'OBJETO DO CONTRATO', AZUL);
    doc.fillColor('#333').font('Helvetica').fontSize(10)
      .text(servico, { lineGap: 4 });

    // ── FINANCEIRO ────────────────────────────────────────────
    secao(doc, 'CONDIÇÕES FINANCEIRAS', AZUL);

    const valorFmt = Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });
    const comFmt = Number(comissaoValor).toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });

    linha(doc, 'Valor total do serviço', valorFmt, VERDE, true);
    linha(doc, `Comissão da plataforma (${comissaoPct})`, comFmt);
    linha(doc, 'Forma de pagamento', pagamento);
    linha(doc, 'Prazo de execução', prazo);
    linha(doc, 'Garantia pós-entrega', garantia);

    // ── CLÁUSULAS ────────────────────────────────────────────
    if (doc.y > 600) doc.addPage();
    secao(doc, 'CLÁUSULAS E CONDIÇÕES', AZUL);

    const clausulas = [
      ['1. OBRIGAÇÕES DO PRESTADOR', 'O prestador compromete-se a executar o serviço descrito com qualidade, pontualidade e dentro do prazo estipulado, utilizando materiais e técnicas adequadas ao escopo contratado.'],
      ['2. OBRIGAÇÕES DO CONTRATANTE', 'O contratante compromete-se a efetuar o pagamento conforme acordado e a disponibilizar acesso ao local do serviço nos horários combinados, bem como fornecer todas as informações necessárias à execução.'],
      ['3. GARANTIA', `O prestador garante o serviço executado pelo período de ${garantia} a partir da data de conclusão, comprometendo-se a corrigir eventuais defeitos decorrentes da execução sem custo adicional.`],
      ['4. RESCISÃO', 'Em caso de desistência após assinatura deste contrato, a parte desistente fica sujeita a multa de 20% sobre o valor total do serviço, salvo acordo mútuo entre as partes.'],
      ['5. COMISSÃO DA PLATAFORMA', `O PRESTADOR compromete-se a pagar à Serviço Seguro Plataforma Digital LTDA a comissão de ${comFmt} (${comissaoPct}), no prazo máximo de 5 (cinco) dias úteis após a conclusão do serviço, mediante transferência bancária ou PIX para os dados informados pela plataforma. O não pagamento no prazo implicará suspensão do perfil na plataforma e cobrança de multa de 2% ao mês sobre o valor devido.`],
      ['6. MEDIAÇÃO', 'A plataforma Serviço Seguro atuará como mediadora em caso de disputas, tendo acesso ao histórico completo das interações, acordos e documentos registrados na plataforma.'],
      ['7. CUSTÓDIA DIGITAL', 'Todas as interações entre as partes realizadas pela plataforma ficam registradas com timestamp e hash criptográfico, constituindo prova eletrônica nos termos da Lei 14.063/2020.'],
      ['8. FORO', 'Fica eleito o foro da comarca de Santa Maria/RS para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'],
    ];

    clausulas.forEach(([titulo, texto]) => {
      if (doc.y > 680) doc.addPage();
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9)
        .text(titulo, { lineGap: 2 });
      doc.fillColor('#333').font('Helvetica').fontSize(9)
        .text(texto, { lineGap: 3, indent: 10 });
      doc.moveDown(0.5);
    });

    // ── ASSINATURAS ───────────────────────────────────────────
    if (doc.y > 620) doc.addPage();
    secao(doc, 'ASSINATURAS DIGITAIS', AZUL);

    const yAssinatura = doc.y;

    // Contratante
    doc.rect(50, yAssinatura, 220, 70)
      .strokeColor(assinadoCliente ? VERDE : '#ccc')
      .lineWidth(1).stroke();

    if (assinadoCliente) {
      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(9)
        .text('✓ ASSINADO', 60, yAssinatura + 8);
      doc.fillColor('#333').font('Helvetica').fontSize(8)
        .text(`Por: ${contNome}`, 60, yAssinatura + 22)
        .text(`Em: ${timestampCliente || '--'}`, 60, yAssinatura + 34)
        .text(`IP: ${ipCliente || '--'}`, 60, yAssinatura + 46);
    } else {
      doc.fillColor('#999').font('Helvetica').fontSize(9)
        .text('Aguardando assinatura', 60, yAssinatura + 28);
    }

    doc.fillColor('#333').font('Helvetica-Bold').fontSize(8)
      .text('CONTRATANTE', 60, yAssinatura + 58);

    // Prestador
    doc.rect(330, yAssinatura, 220, 70)
      .strokeColor(assinadoPrestador ? VERDE : '#ccc')
      .lineWidth(1).stroke();

    if (assinadoPrestador) {
      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(9)
        .text('✓ ASSINADO', 340, yAssinatura + 8);
      doc.fillColor('#333').font('Helvetica').fontSize(8)
        .text(`Por: ${prestNome}`, 340, yAssinatura + 22)
        .text(`Em: ${timestampPrestador || '--'}`, 340, yAssinatura + 34)
        .text(`IP: ${ipPrestador || '--'}`, 340, yAssinatura + 46);
    } else {
      doc.fillColor('#999').font('Helvetica').fontSize(9)
        .text('Aguardando assinatura', 340, yAssinatura + 28);
    }

    doc.fillColor('#333').font('Helvetica-Bold').fontSize(8)
      .text('PRESTADOR DE SERVIÇO', 340, yAssinatura + 58);

    // ── EVIDÊNCIAS DIGITAIS ───────────────────────────────────
    if (assinadoCliente || assinadoPrestador) {
      if (doc.y > 550) doc.addPage();
      secao(doc, 'EVIDÊNCIAS DIGITAIS (Lei 14.063/2020)', AZUL);

      if (assinadoCliente) {
        doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9).text('ASSINATURA DO CONTRATANTE:');
        if (timestampCliente) linha(doc, 'Timestamp', timestampCliente);
        if (ipCliente) linha(doc, 'IP', ipCliente);
        if (telCliente) linha(doc, 'Telefone', telCliente);
        if (geoCliente) linha(doc, 'Geolocalização', `Lat ${geoCliente.lat?.toFixed(5)}, Lng ${geoCliente.lng?.toFixed(5)} (±${Math.round(geoCliente.accuracy || 0)}m)`);
        if (uaCliente) {
          doc.fillColor('#777').font('Helvetica').fontSize(8).text('User-Agent:', 50, doc.y);
          doc.fillColor('#333').font('Courier').fontSize(7).text(uaCliente, { indent: 10, lineGap: 2 });
        }
        doc.moveDown(0.5);
      }

      if (assinadoPrestador) {
        doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9).text('ASSINATURA DO PRESTADOR:');
        if (timestampPrestador) linha(doc, 'Timestamp', timestampPrestador);
        if (ipPrestador) linha(doc, 'IP', ipPrestador);
        if (telPrestador) linha(doc, 'Telefone', telPrestador);
        if (geoPrestador) linha(doc, 'Geolocalização', `Lat ${geoPrestador.lat?.toFixed(5)}, Lng ${geoPrestador.lng?.toFixed(5)} (±${Math.round(geoPrestador.accuracy || 0)}m)`);
        if (uaPrestador) {
          doc.fillColor('#777').font('Helvetica').fontSize(8).text('User-Agent:', 50, doc.y);
          doc.fillColor('#333').font('Courier').fontSize(7).text(uaPrestador, { indent: 10, lineGap: 2 });
        }
        doc.moveDown(0.5);
      }
    }

    // ── HASH / RODAPÉ ─────────────────────────────────────────
    doc.moveDown(3);
    doc.rect(50, doc.y, doc.page.width - 100, 35).fill('#F7F9FC');
    doc.fillColor('#888').font('Courier').fontSize(7)
      .text(`🔒 Hash SHA-256: ${hashDocumento}`, 55, doc.y - 28, { width: doc.page.width - 110 });
    doc.text(`Documento gerado pela plataforma Serviço Seguro em ${dataGeracao}`, 55, doc.y - 14, { width: doc.page.width - 110 });

    doc.end();
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function secao(doc, titulo, cor) {
  doc.moveDown(0.8);
  doc.fillColor(cor).font('Helvetica-Bold').fontSize(10)
    .text(titulo);
  doc.strokeColor(cor).lineWidth(0.5)
    .moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke();
  doc.moveDown(0.6);
}

function linha(doc, chave, valor, corValor = '#333', negrito = false) {
  const y = doc.y;
  doc.fillColor('#777').font('Helvetica').fontSize(9)
    .text(chave + ':', 50, y, { width: 170 });
  doc.fillColor(corValor)
    .font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
    .text(valor, 225, y, { width: 320 });
  doc.moveDown(0.5);
}

module.exports = { gerarPDF, gerarHash };
