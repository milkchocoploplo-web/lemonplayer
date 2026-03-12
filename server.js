const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
// corsモジュールの依存を削除し、自前でヘッダーを設定します
const app = express();
const PORT = process.env.PORT || 3000;

// メモリ内データベース
let playerDatabase = {};

// CORSを自前で許可するミドルウェア（corsモジュール不要）
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(bodyParser.json());

// ヘルスチェック
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Renderのスリープ防止対策
const SELF_URL = process.env.RENDER_EXTERNAL_HOSTNAME 
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health` 
    : null;

setInterval(async () => {
    if (SELF_URL) {
        try {
            await axios.get(SELF_URL);
            console.log(`[HealthCheck] Pinging ${SELF_URL} - Success`);
        } catch (err) {
            console.error(`[HealthCheck] Failed: ${err.message}`);
        }
    }
}, 14 * 60 * 1000); 

// プレイヤーデータの報告を受信
app.post('/report', (req, res) => {
    const { players } = req.body;
    if (!players || !Array.isArray(players)) return res.status(400).send('Invalid data');

    players.forEach(p => {
        const fc = String(p.fc);
        const newName = p.name;

        if (playerDatabase[fc]) {
            if (playerDatabase[fc].currentName !== newName) {
                if (!playerDatabase[fc].history.includes(playerDatabase[fc].currentName)) {
                    playerDatabase[fc].history.push(playerDatabase[fc].currentName);
                }
                playerDatabase[fc].currentName = newName;
            }
        } else {
            playerDatabase[fc] = {
                fc: fc,
                currentName: newName,
                history: [],
                memo: ""
            };
        }
    });

    res.json({ success: true });
});

// メモの更新
app.post('/update-memo', (req, res) => {
    const { fc, memo } = req.body;
    if (playerDatabase[fc]) {
        playerDatabase[fc].memo = memo;
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

// プレイヤーリストの取得 (フレコ昇順)
app.get('/players', (req, res) => {
    const sortedList = Object.values(playerDatabase).sort((a, b) => {
        return parseInt(a.fc) - parseInt(b.fc);
    });
    res.json(sortedList);
});

// フロントエンド画面
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Player Log Viewer</title>
            <style>
                body { background: #ffffff; color: #ffffff; font-family: sans-serif; margin: 0; padding: 10px; }
                h1 { font-size: 1.2rem; color: #000000; margin-bottom: 10px; }
                .controls { margin-bottom: 20px; font-size: 1.1em; color: #000000; }
                
                /* PC向けテーブル表示 */
                table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dadada; }
                th { background: #dddddd; color: #ffffff; text-transform: uppercase; font-size: 0.85em; }
                .name-history { font-size: 0.8em; color: #5c5c5c; display: block; margin-bottom: 4px; }
                .current-name { font-weight: bold; color: #000000; }
                .fc-cell { font-family: monospace; color: #000000; font-size: 1.3em; font-weight: bold; }
                
                input[type="text"] { background: #c9c9c9; border: 1px solid #cecece; color: #fcfcfc; padding: 8px; border-radius: 4px; width: 90%; }
                .btn-save { background: #48f35f; color: #000; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                
                /* スマホ向けカード表示の定義 */
                .player-card { 
                    display: none;
                    background: #ffffff; 
                    border-radius: 8px; 
                    padding: 12px; 
                    margin-bottom: 10px; 
                    border: 1px solid #cfcfcf;
                    box-shadow: 0 2px 4px rgb(255, 255, 255);
                }

                @media (max-width: 600px) {
                    table { display: none; }
                    .player-card { display: block; }
                    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                    .card-memo { display: flex; gap: 8px; }
                    .card-memo input { flex-grow: 1; }
                }
            </style>
        </head>
        <body>
            <h1>プレイヤーログ一覧</h1>
            <div class="controls">
                <span>作成者 Discord: @omirais_. @987lulu98 </span>
            </div>

            <table id="pc-table">
                <thead>
                    <tr>
                        <th>フレンドコード</th>
                        <th>名前</th>
                        <th>メモ</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="player-table"></tbody>
            </table>

            <div id="mobile-list"></div>

            <script>
                async function fetchPlayers() {
                    try {
                        const res = await fetch('/players');
                        const players = await res.json();
                        
                        // PCテーブル更新
                        const tbody = document.getElementById('player-table');
                        tbody.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 
                                ? \`<span class="name-history">\${p.history.join(' → ')} →</span>\` 
                                : '';
                            return \`
                                <tr>
                                    <td class="fc-cell">\${p.fc}</td>
                                    <td>\${historyText}<span class="current-name">\${p.currentName}</span></td>
                                    <td><input type="text" id="memo-\${p.fc}" value="\${p.memo || ''}" placeholder="メモを入力..."></td>
                                    <td><button class="btn-save" onclick="saveMemo('\${p.fc}')">保存</button></td>
                                </tr>
                            \`;
                        }).join('');

                        // スマホカード更新
                        const mobileList = document.getElementById('mobile-list');
                        mobileList.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 
                                ? \`<span class="name-history">\${p.history.join(' → ')}</span>\` 
                                : '';
                            return \`
                                <div class="player-card">
                                    <div class="card-header">
                                        <div class="fc-cell">\${p.fc}</div>
                                        <div style="text-align: right;">
                                            \${historyText}
                                            <div class="current-name">\${p.currentName}</div>
                                        </div>
                                    </div>
                                    <div class="card-memo">
                                        <input type="text" id="m-memo-\${p.fc}" value="\${p.memo || ''}" placeholder="メモ...">
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}', true)">保存</button>
                                    </div>
                                </div>
                            \`;
                        }).join('');

                    } catch (e) { console.error("Update error:", e); }
                }

                async function saveMemo(fc, isMobile = false) {
                    const inputId = isMobile ? 'm-memo-' + fc : 'memo-' + fc;
                    const memo = document.getElementById(inputId).value;
                    const res = await fetch('/update-memo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, memo })
                    });
                    if (res.ok) {
                        alert('メモを保存しました');
                        fetchPlayers();
                    }
                }

                fetchPlayers();
                setInterval(fetchPlayers, 15000);
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port \${PORT}`);
});
