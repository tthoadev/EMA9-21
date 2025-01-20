const { google } = require('googleapis');
const ccxt = require('ccxt');
const technicalindicators = require('technicalindicators');
require('dotenv').config();


const SPREADSHEET_ID = '';
const SHEET_NAME = '';

const GOOGLE_PRIVATE_KEY = "";
const GOOGLE_CLIENT_EMAIL = "";


const bybit = new ccxt.bybit({
    enableRateLimit: true,
    options: { defaultType: 'spot' }
});


const auth = new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

async function getOHLCV(symbol, timeframe = '1m', limit = 100) {
    const ohlcv = await bybit.fetchOHLCV(symbol, timeframe, undefined, limit);
    const completedCandles = ohlcv.slice(0, ohlcv.length - 1);
    return completedCandles.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
    }));
}

function calculateEMA(data) {
    const closes = data.map(item => item.close);
    const ema9 = technicalindicators.ema({ period: 9, values: closes });
    const ema21 = technicalindicators.ema({ period: 21, values: closes });

    return { ema9, ema21 };
}

async function updateGoogleSheet(ema9, ema21, status) {
    const sheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:D`
    });

    const rows = sheet.data.values || [];
    let lastStatus = "";

    if (rows.length > 0) {
        lastStatus = rows[rows.length - 1][3];
    }

    let currentStt = rows.length > 0 ? parseInt(rows[rows.length - 1][0], 10) + 1 : 1;

    let currentStatus = "Foll";
    if (ema9 > ema21) {
        if (lastStatus === "Foll") {
            currentStatus = "Cut";
        } else {
            currentStatus = "Skip";
        }
    } else if (ema9 < ema21) {
        currentStatus = "Foll";
    }

    const newRow = [
        [currentStt, ema9, ema21, currentStatus]
    ];

    const resource = {
        values: newRow
    };

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        resource: resource
    });

    console.log('Cập nhật Google Sheets thành công!');
}

async function run() {
    const symbol = 'SONIC/USDT';
    const ohlcvData = await getOHLCV(symbol);

    const { ema9, ema21 } = calculateEMA(ohlcvData);
    const ema9Last = ema9[ema9.length - 1];
    const ema21Last = ema21[ema21.length - 1];

    console.log(`EMA9: ${ema9Last}`);
    console.log(`EMA21: ${ema21Last}`);

    await updateGoogleSheet(ema9Last, ema21Last);
}

run().catch(console.error);
setInterval(run, 60 * 1000);  
