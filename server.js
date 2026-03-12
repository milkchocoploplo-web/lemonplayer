const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// メモリ内データベース（Renderが再起動するとリセットされます）
let playerDatabase = {};

app.use(bodyParser.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Renderのスリープ防止対策 (14分おきに自分自身を叩く)
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
            // 名前変更の検知
            if (playerDatabase[fc].currentName !== newName) {
                // 以前の名前を履歴に追加（重複回避）
                if (!playerDatabase[fc].history.includes(playerDatabase[fc].currentName)) {
                    playerDatabase[fc].history.push(playerDatabase[fc].currentName);
                }
                playerDatabase[fc].currentName = newName;
            }
        } else {
            // 新規プレイヤー登録
            playerDatabase[fc] = {
                fc: fc,
                currentName: newName,
                history: [],
                memo: "",
                firstSeen: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
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
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Player Log Viewer</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #ffffff; margin: 0; padding: 20px; }
                h1 { color: #000000; border-bottom: 2px solid #ffffff; padding-bottom: 10px; }
                .controls { margin-bottom: 20px; font-size: 1.1em; color: #000000; }
                table { width: 100%; border-collapse: collapse; background: #fffefe; box-shadow: 0 4px 6px rgba(241, 241, 241, 0.98); }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #c2c2c2; }
                th { background: #cecece; color: #000000; text-transform: uppercase; font-size: 0.85em; }
                tr:hover { background: #dfdfdf; }
                .name-history { font-size: 0.8em; color: #000000; display: block; margin-bottom: 4px; }
                .current-name { font-weight: bold; color: #000000; }
                input[type="text"] { background: #e4e2e2; border: 1px solid #dfdfdf; color: #000000; padding: 6px; border-radius: 4px; width: 90%; }
                .btn-save { background: #48f35f; color: #000; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .btn-save:hover { background: #48f35f; }
                .fc-cell { font-family: monospace; color: #000000; font-size: 1.3em; }
            </style>
        </head>
        <body>
            <h1>プレイヤーログ一覧</h1>
            <div class="controls">
                <span>作成者　Discord: @omirais_. @987lulu98 </span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>フレンドコード</th>
                        <th>名前</th>
                        <th>初回確認</th>
                        <th>メモ</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="player-table"></tbody>
            </table>

            <script>
                async function fetchPlayers() {
                    try {
                        const res = await fetch('/players');
                        const players = await res.json();
                        const tbody = document.getElementById('player-table');
                        
                        tbody.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 
                                ? \`<span class="name-history">\${p.history.join(' → ')} →</span>\` 
                                : '';
                            
                            return \`
                                <tr>
                                    <td class="fc-cell">\${p.fc}</td>
                                    <td>
                                        \${historyText}
                                        <span class="current-name">\${p.currentName}</span>
                                    </td>
                                    <td style="font-size:0.85em; color:#888;">\${p.firstSeen}</td>
                                    <td><input type="text" id="memo-\${p.fc}" value="\${p.memo || ''}" placeholder="メモを入力..."></td>
                                    <td><button class="btn-save" onclick="saveMemo('\${p.fc}')">保存</button></td>
                                </tr>
                            \`;
                        }).join('');
                    } catch (e) { console.error("Update error:", e); }
                }

                async function saveMemo(fc) {
                    const memo = document.getElementById('memo-' + fc).value;
                    const res = await fetch('/update-memo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, memo })
                    });
                    if (res.ok) alert('メモを保存しました');
                }

                fetchPlayers();
                setInterval(fetchPlayers, 10000);
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
