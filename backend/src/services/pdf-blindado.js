const PDFDocument = require('pdfkit');
const { gerarHash } = require('./pdf');

const AZUL = '#1B2F6E';
const VERDE = '#1A7A4A';
const DOURADO = '#B8860B';

// ── GERAR PDF DO CONTRATO BLINDADO ────────────────────────────
// dados: {
//   codigo, servico, valor, prazo, pagamento, garantia,
//   dataGeracao, dataLiberacao, hashDocumento,
//   partes: [{
//     papelContratual, nome, cpfCnpj, tipoPessoa,
//     telefone, telefoneValidadoEm,
//     assinado, assinadoEm, ip, userAgent,
//     geoCidade, geoUf, geoLat, geoLng, geoAccuracy,
//     selfieBuffer, documentoBuffer
//   }]
// }
function gerarPDFBlindado(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const {
      codigo, servico, valor, prazo, pagamento, garantia,
      dataGeracao, hashDocumento, partes
    } = dados;

    const contratante = partes.find(p => p.papelContratual === 'contratante');
    const prestador = partes.find(p => p.papelContratual === 'prestador');

    // ── CABEÇALHO ────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(AZUL);

    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(22)
      .text('Contrato Blindado', 50, 22);

    doc.fillColor('#E8C547')
      .font('Helvetica').fontSize(10)
      .text('FORMALIZAÇÃO DE ACORDOS COM EVIDÊNCIAS DIGITAIS', 50, 48);

    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(11)
      .text('CONTRATO BLINDADO', 350, 22, { align: 'right', width: 200 });

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
    secao(doc, 'PARTES CONTRATANTES');

    linha(doc, 'CONTRATANTE', descricaoParte(contratante));
    linha(doc, 'PRESTADOR', descricaoParte(prestador));

    // ── SERVIÇO ──────────────────────────────────────────────
    secao(doc, 'OBJETO DO CONTRATO');
    doc.fillColor('#333').font('Helvetica').fontSize(10)
      .text(servico || 'Não informado', 50, doc.y, { lineGap: 4, width: doc.page.width - 100 });

    // ── FINANCEIRO ───────────────────────────────────────────
    secao(doc, 'CONDIÇÕES FINANCEIRAS');

    const valorFmt = Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });

    linha(doc, 'Valor total do serviço', valorFmt, VERDE, true);
    linha(doc, 'Forma de pagamento', pagamento || 'A combinar');
    linha(doc, 'Prazo de execução', prazo || 'A combinar');
    linha(doc, 'Garantia pós-entrega', garantia || 'Não se aplica');

    // ── CLÁUSULAS ────────────────────────────────────────────
    if (doc.y > 600) doc.addPage();
    secao(doc, 'CLÁUSULAS E CONDIÇÕES');

    const clausulas = [
      ['1. OBRIGAÇÕES DO PRESTADOR', 'O prestador compromete-se a executar o serviço descrito com qualidade, pontualidade e dentro do prazo estipulado, utilizando materiais e técnicas adequadas ao escopo contratado.'],
      ['2. OBRIGAÇÕES DO CONTRATANTE', 'O contratante compromete-se a efetuar o pagamento conforme acordado e a disponibilizar acesso ao local do serviço nos horários combinados, bem como fornecer todas as informações necessárias à execução.'],
      ['3. GARANTIA', `O prestador garante o serviço executado pelo período de ${garantia || 'acordado entre as partes'} a partir da data de conclusão, comprometendo-se a corrigir eventuais defeitos decorrentes da execução sem custo adicional.`],
      ['4. RESCISÃO', 'Em caso de desistência após assinatura deste contrato, a parte desistente fica sujeita a multa de 20% sobre o valor total do serviço, salvo acordo mútuo entre as partes.'],
      ['5. NATUREZA DA PLATAFORMA', 'A plataforma Serviço Seguro, por meio da ferramenta Contrato Blindado, atua exclusivamente como instrumento de formalização e registro deste acordo, não sendo parte, intermediadora ou garantidora das obrigações aqui pactuadas.'],
      ['6. CUSTÓDIA DIGITAL', 'Este documento e suas evidências de autenticidade (validação de telefone, geolocalização, endereço IP, imagens anexadas e carimbos de tempo) ficam registrados com hash criptográfico SHA-256, constituindo prova eletrônica nos termos da Lei 14.063/2020.'],
      ['7. VERACIDADE DAS INFORMAÇÕES', 'As partes declaram, sob as penas da lei, que os dados, documentos e imagens fornecidos são verdadeiros e de sua titularidade, responsabilizando-se civil e criminalmente por eventuais falsidades.'],
      ['8. FORO', 'Fica eleito o foro da comarca de domicílio do CONTRATANTE para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'],
    ];

    clausulas.forEach(([titulo, texto]) => {
      if (doc.y > 680) doc.addPage();
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9)
        .text(titulo, 50, doc.y, { lineGap: 2 });
      doc.fillColor('#333').font('Helvetica').fontSize(9)
        .text(texto, 50, doc.y, { lineGap: 3, indent: 10, width: doc.page.width - 100 });
      doc.moveDown(0.5);
    });

    // ── ASSINATURAS ──────────────────────────────────────────
    if (doc.y > 600) doc.addPage();
    secao(doc, 'ASSINATURAS DIGITAIS');

    const yAssinatura = doc.y;
    quadroAssinatura(doc, 50, yAssinatura, contratante, 'CONTRATANTE');
    quadroAssinatura(doc, 330, yAssinatura, prestador, 'PRESTADOR DE SERVIÇO');
    doc.y = yAssinatura + 85;

    // ── PÁGINA DE EVIDÊNCIAS ─────────────────────────────────
    doc.addPage();

    doc.rect(0, 0, doc.page.width, 60).fill(AZUL);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
      .text('ANEXO I — EVIDÊNCIAS DE AUTENTICIDADE', 50, 20);
    doc.fillColor('#E8C547').font('Helvetica').fontSize(9)
      .text(`Contrato ${codigo} — registro probatório nos termos da Lei 14.063/2020`, 50, 40);

    doc.y = 80;

    partes.forEach((parte, idx) => {
      if (doc.y > 560) doc.addPage();

      doc.moveDown(0.5);
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11)
        .text(`PARTE ${idx + 1} — ${parte.papelContratual.toUpperCase()}: ${parte.nome}`, 50, doc.y);
      doc.strokeColor(AZUL).lineWidth(0.5)
        .moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).stroke();
      doc.moveDown(0.6);

      const docLabel = parte.tipoPessoa === 'pj' ? 'CNPJ' : 'CPF';
      linha(doc, docLabel, formatarDoc(parte.cpfCnpj, parte.tipoPessoa));

      if (parte.telefone) {
        const validacao = parte.telefoneValidadoEm
          ? `${formatarTelefone(parte.telefone)} — validado via código WhatsApp em ${formatarData(parte.telefoneValidadoEm)}`
          : formatarTelefone(parte.telefone);
        linha(doc, 'Telefone', validacao, parte.telefoneValidadoEm ? VERDE : '#333');
      }

      if (parte.assinado) {
        linha(doc, 'Assinatura', `Registrada em ${formatarData(parte.assinadoEm)}`, VERDE, true);
        if (parte.ip) linha(doc, 'Endereço IP', parte.ip);
        if (parte.geoCidade || parte.geoLat != null) {
          const local = [
            parte.geoCidade ? `${parte.geoCidade}${parte.geoUf ? '/' + parte.geoUf : ''}` : null,
            parte.geoLat != null ? `(${Number(parte.geoLat).toFixed(6)}, ${Number(parte.geoLng).toFixed(6)}${parte.geoAccuracy ? ` ± ${Math.round(parte.geoAccuracy)}m` : ''})` : null,
          ].filter(Boolean).join(' ');
          linha(doc, 'Localização', local);
        }
        if (parte.userAgent) {
          const y = doc.y;
          doc.fillColor('#777').font('Helvetica').fontSize(9)
            .text('Dispositivo:', 50, y, { width: 170 });
          doc.fillColor('#333').font('Helvetica').fontSize(7)
            .text(parte.userAgent, 225, y + 1, { width: 320 });
          doc.moveDown(0.5);
        }
      } else {
        linha(doc, 'Assinatura', 'Não registrada', '#999');
      }

      // Imagens: selfie e documento lado a lado
      const temImagens = parte.selfieBuffer || parte.documentoBuffer;
      if (temImagens) {
        if (doc.y > 520) doc.addPage();
        const yImg = doc.y + 8;
        const alturaMax = 180;

        if (parte.selfieBuffer) {
          try {
            doc.image(parte.selfieBuffer, 50, yImg, { fit: [240, alturaMax] });
            doc.fillColor('#777').font('Helvetica').fontSize(7)
              .text('Selfie anexada pela parte', 50, yImg + alturaMax + 4);
          } catch (e) {
            console.error('[PDF Blindado] Falha ao embutir selfie:', e.message);
          }
        }
        if (parte.documentoBuffer) {
          try {
            doc.image(parte.documentoBuffer, 310, yImg, { fit: [240, alturaMax] });
            doc.fillColor('#777').font('Helvetica').fontSize(7)
              .text('Documento anexado pela parte', 310, yImg + alturaMax + 4);
          } catch (e) {
            console.error('[PDF Blindado] Falha ao embutir documento:', e.message);
          }
        }
        doc.y = yImg + alturaMax + 16;
      } else {
        doc.fillColor('#999').font('Helvetica-Oblique').fontSize(8)
          .text('Nenhuma imagem anexada por esta parte.', 50, doc.y);
        doc.moveDown(0.5);
      }

      doc.moveDown(1);
    });

    // ── NOTA PROBATÓRIA + HASH ───────────────────────────────
    if (doc.y > 620) doc.addPage();
    doc.moveDown(1);
    doc.fillColor('#555').font('Helvetica').fontSize(8)
      .text(
        'As imagens acima foram anexadas voluntariamente pelas próprias partes e conferidas mutuamente antes da assinatura. ' +
        'A plataforma registra as evidências sem realizar validação documental. ' +
        'A integridade deste documento pode ser verificada pelo hash criptográfico abaixo.',
        50, doc.y, { lineGap: 3, width: doc.page.width - 100 }
      );

    doc.moveDown(1);
    const yHash = doc.y;
    doc.rect(50, yHash, doc.page.width - 100, 35).fill('#F7F9FC');
    doc.fillColor('#888').font('Courier').fontSize(7)
      .text(`Hash SHA-256: ${hashDocumento}`, 55, yHash + 7, { width: doc.page.width - 110 });
    doc.text(`Documento gerado pela ferramenta Contrato Blindado (Serviço Seguro) em ${dataGeracao}`, 55, yHash + 21, { width: doc.page.width - 110 });

    doc.end();
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function descricaoParte(parte) {
  if (!parte) return '--';
  const docLabel = parte.tipoPessoa === 'pj' ? 'CNPJ' : 'CPF';
  return `${parte.nome} — ${docLabel}: ${formatarDoc(parte.cpfCnpj, parte.tipoPessoa)}`;
}

function formatarDoc(digits, tipoPessoa) {
  if (!digits) return '--';
  const d = String(digits).replace(/\D/g, '');
  if (tipoPessoa === 'pj' && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return d;
}

function formatarTelefone(digits) {
  if (!digits) return '--';
  const d = String(digits).replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    return `+55 (${ddd}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
  }
  return d;
}

function formatarData(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function quadroAssinatura(doc, x, y, parte, rotulo) {
  const assinado = parte && parte.assinado;
  doc.rect(x, y, 220, 70)
    .strokeColor(assinado ? VERDE : '#ccc')
    .lineWidth(1).stroke();

  if (assinado) {
    doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(9)
      .text('ASSINADO', x + 10, y + 8);
    doc.fillColor('#333').font('Helvetica').fontSize(8)
      .text(`Por: ${parte.nome}`, x + 10, y + 22, { width: 200 })
      .text(`Em: ${formatarData(parte.assinadoEm)}`, x + 10, y + 34)
      .text(`IP: ${parte.ip || '--'}`, x + 10, y + 46);
  } else {
    doc.fillColor('#999').font('Helvetica').fontSize(9)
      .text('Aguardando assinatura', x + 10, y + 28);
  }

  doc.fillColor('#333').font('Helvetica-Bold').fontSize(8)
    .text(rotulo, x + 10, y + 58);
}

function secao(doc, titulo) {
  doc.moveDown(0.8);
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(10)
    .text(titulo, 50, doc.y);
  doc.strokeColor(AZUL).lineWidth(0.5)
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

module.exports = { gerarPDFBlindado, gerarHash };
