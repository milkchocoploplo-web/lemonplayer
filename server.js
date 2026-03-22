const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 【設定】編集・削除用の共通パスワード（日本語OK）
const ADMIN_PASSWORD = "うんち123"; 

let playerDatabase = {};

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

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

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
}, 4 * 60 * 1000);

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
            playerDatabase[fc] = { fc: fc, currentName: newName, history: [], memo: "" };
        }
    });
    res.json({ success: true });
});

// メモ更新（パスワードチェック追加）
app.post('/update-memo', (req, res) => {
    const { fc, memo, password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'パスワードが違います' });
    
    if (playerDatabase[fc]) {
        playerDatabase[fc].memo = memo;
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

// プレイヤー削除（パスワードチェック）
app.post('/delete-player', (req, res) => {
    const { fc, password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'パスワードが違います' });

    if (playerDatabase[fc]) {
        delete playerDatabase[fc];
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

app.get('/players', (req, res) => {
    const sortedList = Object.values(playerDatabase).sort((a, b) => parseInt(a.fc) - parseInt(b.fc));
    res.json(sortedList);
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Player Log Viewer</title>
            <style>
                body { background: #ffffff; color: #000000; font-family: sans-serif; margin: 0; padding: 10px; }
                h1 { font-size: 1.2rem; margin-bottom: 5px; }
                .controls { margin-bottom: 15px; font-size: 0.9em; color: #555; }
                
                /* パスワード入力エリア */
                .auth-section { background: #f0f0f0; padding: 10px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #ccc; }
                .auth-section label { font-weight: bold; font-size: 0.9em; display: block; margin-bottom: 5px; }
                #admin-pass { padding: 8px; width: 200px; border: 1px solid #999; border-radius: 4px; font-size: 1rem; }

                table { width: 100%; border-collapse: collapse; background: #ffffff; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dadada; }
                th { background: #dddddd; font-size: 0.85em; }
                
                .name-history { font-size: 0.8em; color: #5c5c5c; display: block; }
                .current-name { font-weight: bold; font-size: 1.1em; }
                .fc-cell { font-family: monospace; font-size: 1.2em; font-weight: bold; }
                
                /* メモ入力欄を大きく */
                input[type="text"].memo-input { 
                    background: #fff; border: 2px solid #b1b1b1; color: #000; 
                    padding: 10px; border-radius: 4px; width: 95%; 
                    font-size: 1.1rem; font-weight: bold;
                }

                .btn-save { background: #28a745; color: #fff; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .btn-delete { background: #dc3545; color: #fff; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 5px; }
                
                .player-card { display: none; background: #fff; border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
                @media (max-width: 600px) {
                    table { display: none; }
                    .player-card { display: block; }
                    .card-header { margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    .memo-input { margin-bottom: 10px; width: 100% !important; }
                }
            </style>
        </head>
        <body>
            <h1>プレイヤーログ一覧</h1>
            <div class="controls">
                作成者 Discord: @omirais_. @987lulu98
            </div>

            <div class="auth-section">
                <label>編集用パスワードを入力：</label>
                <input type="password" id="admin-pass" placeholder="パスワードを入力...">
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
                        
                        const tbody = document.getElementById('player-table');
                        tbody.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 ? \`<span class="name-history">\${p.history.join(' → ')} →</span>\` : '';
                            return \`
                                <tr>
                                    <td class="fc-cell">\${p.fc}</td>
                                    <td>\${historyText}<span class="current-name">\${p.currentName}</span></td>
                                    <td><input type="text" class="memo-input" id="memo-\${p.fc}" value="\${p.memo || ''}"></td>
                                    <td>
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}')">保存</button>
                                        <button class="btn-delete" onclick="deletePlayer('\${p.fc}')">削除</button>
                                    </td>
                                </tr>
                            \`;
                        }).join('');

                        const mobileList = document.getElementById('mobile-list');
                        mobileList.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 ? \`<span class="name-history">\${p.history.join(' → ')}</span>\` : '';
                            return \`
                                <div class="player-card">
                                    <div class="card-header">
                                        <div class="fc-cell">\${p.fc}</div>
                                        <div class="current-name">\${p.currentName}</div>
                                        \${historyText}
                                    </div>
                                    <input type="text" class="memo-input" id="m-memo-\${p.fc}" value="\${p.memo || ''}">
                                    <div style="display:flex; justify-content: flex-end;">
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}', true)">保存</button>
                                        <button class="btn-delete" onclick="deletePlayer('\${p.fc}')">削除</button>
                                    </div>
                                </div>
                            \`;
                        }).join('');
                    } catch (e) { console.error("Update error:", e); }
                }

                async function saveMemo(fc, isMobile = false) {
                    const password = document.getElementById('admin-pass').value;
                    if(!password) return alert('パスワードを入力してください');

                    const inputId = isMobile ? 'm-memo-' + fc : 'memo-' + fc;
                    const memo = document.getElementById(inputId).value;

                    const res = await fetch('/update-memo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, memo, password })
                    });

                    if (res.ok) {
                        alert('保存しました');
                        fetchPlayers();
                    } else {
                        const err = await res.json();
                        alert('失敗: ' + err.error);
                    }
                }

                async function deletePlayer(fc) {
                    const password = document.getElementById('admin-pass').value;
                    if(!password) return alert('パスワードを入力してください');
                    if(!confirm('本当に削除しますか？')) return;

                    const res = await fetch('/delete-player', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, password })
                    });

                    if (res.ok) {
                        alert('削除しました');
                        fetchPlayers();
                    } else {
                        const err = await res.json();
                        alert('失敗: ' + err.error);
                    }
                }

                fetchPlayers();
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
