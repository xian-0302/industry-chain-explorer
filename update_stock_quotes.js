/**
 * update_stock_quotes.js
 * --------------------------------------------------------
 * 在你自己的電腦上執行這支程式（不是在瀏覽器裡跑），
 * 抓取台灣證交所（上市）與櫃買中心（上櫃）最近一個交易日的
 * 收盤價／漲跌資料，輸出成 stock_quotes.json。
 *
 * 用法：
 *   1. 確認電腦有安裝 Node.js 18 以上版本（內建 fetch，免裝套件）
 *      在命令提示字元打 node -v 確認版本
 *   2. 把這支檔案跟 industry-chain-explorer.html 放在同一個資料夾
 *   3. 在該資料夾打開命令提示字元，執行：
 *        node update_stock_quotes.js
 *   4. 執行完會產生 stock_quotes.json，跟 html 一起上傳到 GitHub 即可
 *
 * 建議：每個交易日收盤後（下午 1:30 後）重新執行一次本程式，
 *       再把更新後的 stock_quotes.json 一起上傳，網頁就會顯示當天的漲跌。
 * --------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const TSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';

function pickNum(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const v = parseFloat(String(obj[k]).replace(/[, ]/g, ''));
      if (!isNaN(v)) return v;
    }
  }
  return NaN;
}
function pickStr(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return String(obj[k]).trim();
    }
  }
  return '';
}

async function fetchJson(url, label) {
  console.log(`正在抓取 ${label} ...`);
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`${label} HTTP ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error(`${label} 回傳格式不是陣列，可能該日尚無資料或休市`);
  console.log(`${label} 共取得 ${data.length} 筆`);
  return data;
}

async function main() {
  const quotes = {};
  let tseCount = 0, otcCount = 0;

  try {
    const tseData = await fetchJson(TSE_URL, '上市(TSE)');
    tseData.forEach(row => {
      const code = pickStr(row, ['Code']);
      const close = pickNum(row, ['ClosingPrice']);
      const change = pickNum(row, ['Change']);
      if (!code || isNaN(close) || isNaN(change)) return;
      const prevClose = close - change;
      if (prevClose <= 0) return;
      quotes[code] = {
        close,
        change,
        changePercent: Math.round((change / prevClose) * 10000) / 100
      };
      tseCount++;
    });
  } catch (e) {
    console.error('抓取上市資料失敗：', e.message);
  }

  try {
    const otcData = await fetchJson(TPEX_URL, '上櫃(TPEx)');
    otcData.forEach(row => {
      const code = pickStr(row, ['SecuritiesCompanyCode']);
      const close = pickNum(row, ['Close']);
      const change = pickNum(row, ['Change']);
      if (!code || isNaN(close) || isNaN(change)) return;
      const prevClose = close - change;
      if (prevClose <= 0) return;
      if (!quotes[code]) {
        quotes[code] = {
          close,
          change,
          changePercent: Math.round((change / prevClose) * 10000) / 100
        };
        otcCount++;
      }
    });
  } catch (e) {
    console.error('抓取上櫃資料失敗：', e.message);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    updatedAtLocal: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    tseCount,
    otcCount,
    quotes
  };

  const outPath = path.join(__dirname, 'stock_quotes.json');
  fs.writeFileSync(outPath, JSON.stringify(output), 'utf8');

  console.log('--------------------------------------------------');
  console.log(`完成！共寫入 ${tseCount + otcCount} 檔個股（上市 ${tseCount}／上櫃 ${otcCount}）`);
  console.log(`檔案位置：${outPath}`);
  console.log('請把 stock_quotes.json 跟 index.html 一起上傳到 GitHub。');
  console.log('--------------------------------------------------');
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
