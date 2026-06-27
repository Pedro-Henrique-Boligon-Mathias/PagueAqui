import { describe, expect, it } from 'vitest';

import { canFetchInvoiceUrl, getInvoiceUrlSupport, parseSvrsNfceHtml } from './enrichment';

const svrsHtml = `
<div id="u20" class="txtTopo">SILVA ATACAREJO LTDA FREDERICO</div>
<table id="tabResult">
  <tr id="Item + 1">
    <td valign="top">
      <span class="txtTit">ENERGETICO BALY MANG</span>
      <span class="RCod">(Código: 75717)</span><br />
      <span class="Rqtd"><strong>Qtde.:</strong>1</span>
      <span class="RUN"><strong>UN: </strong>UNID</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;6,99</span>
    </td>
    <td align="right" valign="top" class="txtTit noWrap">
      Vl. Total<br /><span class="valor">6,99</span>
    </td>
  </tr>
</table>
<div id="totalNota" class="txtRight">
  <div id="linhaTotal" class="linhaShade"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">6,99</span></div>
</div>
<li><strong>Número: </strong>54580<strong> Série: </strong>13<strong> Emissão: </strong>25/06/2026 18:10:30<br /></li>
`;

describe('invoice enrichment parser', () => {
  it('extracts issuer, total, purchase date and items from SVRS NFC-e HTML', () => {
    expect(parseSvrsNfceHtml(svrsHtml)).toEqual({
      issuerName: 'SILVA ATACAREJO LTDA FREDERICO',
      items: [
        {
          code: '75717',
          name: 'ENERGETICO BALY MANG',
          quantity: 1,
          totalPrice: 6.99,
          unit: 'UNID',
          unitPrice: 6.99,
        },
      ],
      purchasedAt: '2026-06-25T21:10:30.000Z',
      totalAmount: 6.99,
    });
  });

  it('returns null when the HTML has no NFC-e fields', () => {
    expect(parseSvrsNfceHtml('<html><body>captcha</body></html>')).toBeNull();
  });

  it('only allows known HTTPS invoice hosts', () => {
    expect(canFetchInvoiceUrl('https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=123')).toBe(true);
    expect(canFetchInvoiceUrl('https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=123')).toBe(true);
    expect(canFetchInvoiceUrl('http://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=123')).toBe(false);
    expect(canFetchInvoiceUrl('https://example.com/Dfe/QrCodeNFce?p=123')).toBe(false);
  });

  it('explains why a host is not supported', () => {
    expect(getInvoiceUrlSupport('https://example.com/Dfe/QrCodeNFce?p=123')).toMatchObject({
      host: 'example.com',
      supported: false,
    });
  });
});
