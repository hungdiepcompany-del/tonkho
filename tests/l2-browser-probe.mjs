import fs from 'node:fs';
import { chromium } from 'playwright';

function sanitize(raw) {
  try {
    const u = new URL(raw);
    return {host:u.hostname,path:u.pathname,queryKeys:[...u.searchParams.keys()].sort()};
  } catch { return {host:'INVALID',path:'',queryKeys:[]}; }
}

async function inspectDownload(download) {
  try {
    const p = await download.path();
    if (!p) return {download:true,pdfMagic:false,size:0};
    const b = fs.readFileSync(p);
    return {
      download:true,
      pdfMagic:b.subarray(0,5).toString('latin1') === '%PDF-',
      size:b.length,
      suggestedExt:(download.suggestedFilename().split('.').pop()||'').toLowerCase()
    };
  } catch (e) {
    return {download:true,pdfMagic:false,error:String(e?.message||e)};
  }
}

async function navigateWithDownload(page, url, timeout=45000) {
  let download = null;
  page.once('download', d => { download = d; });
  let response = null;
  let navError = '';
  try {
    response = await page.goto(url,{waitUntil:'domcontentloaded',timeout});
    await page.waitForTimeout(5000);
  } catch (e) {
    navError = String(e?.message||e).slice(0,160);
    await page.waitForTimeout(3000).catch(()=>{});
  }
  const result = {
    responseStatus:response?.status?.() ?? null,
    final:sanitize(page.url()),
    navError:Boolean(navError),
    download:false,
    pdfMagic:false
  };
  if (download) Object.assign(result,await inspectDownload(download));
  return result;
}

async function pageFlags(page) {
  const text = await page.locator('body').innerText({timeout:5000}).catch(()=> '');
  return {
    cloudflare:/cloudflare|checking your browser|verify you are human|ray id/i.test(text),
    captcha:/captcha|recaptcha|mã xác thực/i.test(text),
    login:/đăng nhập|login|sign in/i.test(text),
    downloadPdfText:/tải[^\n]{0,40}pdf|download[^\n]{0,40}pdf/i.test(text),
    invoiceText:/hóa đơn|invoice/i.test(text)
  };
}

const easy = fs.readFileSync(process.env.RUNNER_TEMP+'/easy.url','utf8').trim();
const misa = fs.readFileSync(process.env.RUNNER_TEMP+'/misa.url','utf8').trim();
const report={mode:'STOCK_CHROMIUM_READ_ONLY',productionMutation:false,gmailMutation:false,driveMutation:false,sheetMutation:false,providers:[]};
const browser=await chromium.launch({headless:true});
try {
  {
    const ctx=await browser.newContext({locale:'vi-VN',acceptDownloads:true});
    const page=await ctx.newPage();
    const attempts=[];
    attempts.push({label:'direct_download',...(await navigateWithDownload(page,easy))});
    attempts.at(-1).flags=await pageFlags(page);
    if (!attempts.some(a=>a.pdfMagic)) {
      const v=new URL(easy); v.pathname=v.pathname.replace(/\/DownloadInvPdf$/i,'/ViewFromEmail');
      attempts.push({label:'view_page',...(await navigateWithDownload(page,v.href))});
      attempts.at(-1).flags=await pageFlags(page);
      const pdfLocator=page.getByText(/tải.*pdf|download.*pdf/i).first();
      if (await pdfLocator.count().catch(()=>0)) {
        let dl=null;
        try {
          const [download]=await Promise.all([page.waitForEvent('download',{timeout:10000}),pdfLocator.click({timeout:10000})]);
          dl=await inspectDownload(download);
        } catch {}
        attempts.push({label:'click_pdf_action',...(dl||{download:false,pdfMagic:false}),final:sanitize(page.url()),flags:await pageFlags(page)});
      }
    }
    report.providers.push({provider:'EASYINVOICE',attempts});
    console.log('EASYINVOICE_BROWSER_PDF='+(attempts.some(a=>a.pdfMagic)?'PASS':'NO'));
    for(const a of attempts) console.log(`EASYINVOICE_BROWSER_${a.label}=STATUS:${a.responseStatus};PDF:${a.pdfMagic?'YES':'NO'};PATH:${a.final?.path||''};CF:${a.flags?.cloudflare?'YES':'NO'};CAPTCHA:${a.flags?.captcha?'YES':'NO'};LOGIN:${a.flags?.login?'YES':'NO'}`);
    await ctx.close();
  }

  {
    const ctx=await browser.newContext({locale:'vi-VN',acceptDownloads:true});
    const page=await ctx.newPage();
    const attempts=[];
    attempts.push({label:'lookup',...(await navigateWithDownload(page,misa,60000))});
    attempts.at(-1).flags=await pageFlags(page);
    if (!attempts[0].flags.cloudflare && !attempts[0].flags.captcha) {
      const pdfLocator=page.getByText(/tải.*pdf|download.*pdf/i).first();
      if (await pdfLocator.count().catch(()=>0)) {
        let dl=null;
        try {
          const [download]=await Promise.all([page.waitForEvent('download',{timeout:10000}),pdfLocator.click({timeout:10000})]);
          dl=await inspectDownload(download);
        } catch {}
        attempts.push({label:'click_pdf_action',...(dl||{download:false,pdfMagic:false}),final:sanitize(page.url()),flags:await pageFlags(page)});
      }
    }
    report.providers.push({provider:'MISA',attempts});
    console.log('MISA_BROWSER_PDF='+(attempts.some(a=>a.pdfMagic)?'PASS':'NO'));
    for(const a of attempts) console.log(`MISA_BROWSER_${a.label}=STATUS:${a.responseStatus};PDF:${a.pdfMagic?'YES':'NO'};PATH:${a.final?.path||''};CF:${a.flags?.cloudflare?'YES':'NO'};CAPTCHA:${a.flags?.captcha?'YES':'NO'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
report.status='COMPLETED';
fs.writeFileSync('l2-browser-live-report.json',JSON.stringify(report,null,2));
