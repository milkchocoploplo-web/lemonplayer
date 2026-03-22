const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000; [cite: 1, 2]

const ADMIN_PASSWORD = "うんち123"; 

let playerDatabase = {}; [cite: 2]

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
}); [cite: 3]
app.use(bodyParser.json()); [cite: 4]

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const SELF_URL = process.env.RENDER_EXTERNAL_HOSTNAME 
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health` 
    : null; [cite: 5]

setInterval(async () => {
    if (SELF_URL) {
        try {
            await axios.get(SELF_URL);
            console.log(`[HealthCheck] Pinging ${SELF_URL} - Success`);
        } catch (err) {
            console.error(`[HealthCheck] Failed: ${err.message}`);
        }
    }
}, 4 * 60 * 1000); [cite: 6]

app.post('/report', (req, res) => {
    const { players } = req.body;
    if (!players || !Array.isArray(players)) return res.status(400).send('Invalid data');

    players.forEach(p => {
        const fc = String(p.fc); [cite: 7]
        const newName = p.name;
        if (playerDatabase[fc]) {
            if (playerDatabase[fc].currentName !== newName) {
                if (!playerDatabase[fc].history.includes(playerDatabase[fc].currentName)) {
                    playerDatabase[fc].history.push(playerDatabase[fc].currentName); [cite: 8]
                }
                playerDatabase[fc].currentName = newName;
            }
        } else {
            playerDatabase[fc] = { fc: fc, currentName: newName, history: [], memo: "" }; [cite: 9]
        }
    });
    res.json({ success: true });
});

app.post('/update-memo', (req, res) => {
    const { fc, memo, password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'パスワードが違いますおつかれｗＷ' });
    
    if (playerDatabase[fc]) {
        playerDatabase[fc].memo = memo; [cite: 10]
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

app.post('/delete-player', (req, res) => {
    const { fc, password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'パスワードが違いますおつかれＷＷ' });

    if (playerDatabase[fc]) {
        delete playerDatabase[fc];
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

app.get('/players', (req, res) => {
    const sortedList = Object.values(playerDatabase).sort((a, b) => parseInt(a.fc) - parseInt(b.fc)); [cite: 11]
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
                body { background: #ffffff; color: #000000; font-family: sans-serif; margin: 0; padding: 10px; } [cite: 13]
                h1 { font-size: 1.2rem; margin-bottom: 5px; color: #000; }
                .controls { margin-bottom: 15px; font-size: 0.9em; color: #555; } [cite: 13]
                
                .auth-section { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #ddd; }
                .auth-section label { font-weight: bold; font-size: 1rem; display: block; margin-bottom: 8px; }
                
                #admin-pass { 
                    padding: 12px; width: 250px; border: 2px solid #888; border-radius: 4px; 
                    font-size: 1.1rem; background: #fff; color: #000;
                }

                table { width: 100%; border-collapse: collapse; background: #ffffff; } [cite: 14]
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dadada; } [cite: 14]
                th { background: #dddddd; font-size: 0.85em; color: #000; } [cite: 14]
                
                .name-history { font-size: 0.85em; color: #5c5c5c; display: block; } [cite: 15, 16]
                .current-name { font-weight: bold; font-size: 1.1rem; color: #000; } [cite: 16, 17]
                .fc-cell { font-family: monospace; font-size: 1.3rem; font-weight: bold; color: #000; } [cite: 17, 18]
                
                input[type="text"].memo-input { 
                    background: #fff; border: 2px solid #b1b1b1; color: #000; 
                    padding: 10px; border-radius: 4px; width: 95%; 
                    font-size: 1.2rem; font-weight: bold;
                } [cite: 18, 19]

                .btn-save { background: #28a745; color: #fff; border: none; padding: 10px 18px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; } [cite: 20, 21]
                .btn-delete { background: #dc3545; color: #fff; border: none; padding: 10px 18px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; margin-left: 5px; }
                
                .player-card { display: none; background: #fff; border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; border-radius: 8px; } [cite: 22, 23]
                @media (max-width: 600px) {
                    table { display: none; } [cite: 24, 25]
                    .player-card { display: block; } [cite: 25, 26]
                    .memo-input { margin-bottom: 10px; width: 100% !important; font-size: 1.1rem; }
                }
            </style>
        </head>
        <body>
            <h1>プレイヤーログ一覧</h1>
            <div class="controls">
                作成者 Discord: @omirais_.
            </div>

            <div class="auth-section">
                <label>編集用パスワードを入力：</label>
                <input type="text" id="admin-pass" placeholder="ここにパスワードを入力" autocomplete="off">
            </div>

            <table id="pc-table">
                <thead>
                    <tr>
                        <th>フレンドコード</th> [cite: 30]
                        <th>名前</th> [cite: 31]
                        <th>メモ</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="player-table"></tbody> [cite: 32]
            </table>

            <div id="mobile-list"></div>

            <script>
                async function fetchPlayers() {
                    try {
                        const res = await fetch('/players'); [cite: 33]
                        const players = await res.json(); [cite: 34]
                        
                        const tbody = document.getElementById('player-table'); [cite: 34]
                        tbody.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 ? \`<span class="name-history">\${p.history.join(' → ')} →</span>\` : ''; [cite: 35]
                            return \`
                                <tr>
                                    <td class="fc-cell">\${p.fc}</td> [cite: 37]
                                    <td>\${historyText}<span class="current-name">\${p.currentName}</span></td> [cite: 37]
                                    <td><input type="text" class="memo-input" id="memo-\${p.fc}" value="\${p.memo || ''}"></td> [cite: 37]
                                    <td>
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}')">保存</button> [cite: 38]
                                        <button class="btn-delete" onclick="deletePlayer('\${p.fc}')">削除</button>
                                    </td>
                                </tr>
                            \`;
                        }).join(''); [cite: 39]

                        const mobileList = document.getElementById('mobile-list'); [cite: 39]
                        mobileList.innerHTML = players.map(p => {
                            const historyText = p.history.length > 0 ? \`<span class="name-history">\${p.history.join(' → ')}</span>\` : ''; [cite: 40, 41]
                            return \`
                                <div class="player-card">
                                    <div class="card-header">
                                        <div class="fc-cell">\${p.fc}</div> [cite: 42]
                                        <div class="current-name">\${p.currentName}</div> [cite: 43]
                                        \${historyText}
                                    </div>
                                    <input type="text" class="memo-input" id="m-memo-\${p.fc}" value="\${p.memo || ''}"> [cite: 45]
                                    <div style="display:flex; justify-content: flex-end; margin-top:10px;">
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}', true)">保存</button> [cite: 45, 46]
                                        <button class="btn-delete" onclick="deletePlayer('\${p.fc}', true)">削除</button>
                                    </div>
                                </div>
                            \`;
                        }).join(''); [cite: 47]
                    } catch (e) { console.error("Update error:", e); }
                }

                async function saveMemo(fc, isMobile = false) {
                    const password = document.getElementById('admin-pass').value; [cite: 48]
                    if(!password) return alert('パスワードを入力してください');

                    const inputId = isMobile ? 'm-memo-' + fc : 'memo-' + fc; [cite: 48]
                    const memo = document.getElementById(inputId).value;

                    const res = await fetch('/update-memo', { [cite: 49]
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, memo, password })
                    }); [cite: 49, 50]

                    if (res.ok) {
                        alert('保存しました');
                        fetchPlayers(); [cite: 51]
                    } else {
                        const err = await res.json();
                        alert('失敗: ' + err.error);
                    }
                }

                async function deletePlayer(fc) {
                    const password = document.getElementById('admin-pass').value;
                    if(!password) return alert('パスワードを入力してください');
                    if(!confirm('このプレイヤーを完全に削除しますか？')) return;

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
    `); [cite: 53]
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
