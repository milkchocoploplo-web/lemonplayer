const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 管理者パスワード（編集・削除共通）
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

// 【修正】メモ更新時もパスワードをチェック
app.post('/update-memo', (req, res) => {
    const { fc, memo, password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'パスワードが違いますおつかれｗＷ' });
    }
    if (playerDatabase[fc]) {
        playerDatabase[fc].memo = memo;
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

app.post('/delete-player', (req, res) => {
    const { fc, password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'パスワードが違いますおつかれＷＷ' });
    }
    if (playerDatabase[fc]) {
        delete playerDatabase[fc];
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Player not found' });
});

app.get('/players', (req, res) => {
    const sortedList = Object.values(playerDatabase).sort((a, b) => {
        return parseInt(a.fc) - parseInt(b.fc);
    });
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
                h1 { font-size: 1.2rem; color: #000000; margin-bottom: 10px; }
                .controls { margin-bottom: 20px; font-size: 0.9em; color: #000000; padding: 10px; background: #f0f0f0; border-radius: 5px; }
                .admin-input { margin-top: 8px; }
                .admin-input input { padding: 5px; border-radius: 4px; border: 1px solid #ccc; width: 200px; }
                table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dadada; }
                th { background: #dddddd; color: #000000; text-transform: uppercase; font-size: 0.85em; }
                .name-history { font-size: 0.8em; color: #5c5c5c; display: block; margin-bottom: 4px; }
                .current-name { font-weight: bold; color: #000000; }
                .fc-cell { font-family: monospace; color: #000000; font-size: 1.3em; font-weight: bold; }
                input[type="text"] { background: #e4e4e4; border: 1px solid #b1b1b1; color: #000000; padding: 8px; border-radius: 4px; width: 90%; }
                .btn-save { background: #48f35f; color: #000; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 5px; }
                .btn-delete { background: #ff4d4d; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                
                .player-card { display: none; background: #ffffff; border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid #cfcfcf; }
                @media (max-width: 600px) {
                    table { display: none; }
                    .player-card { display: block; }
                    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                    .card-memo { display: flex; gap: 8px; flex-wrap: wrap; }
                    .card-memo input { width: 100%; margin-bottom: 8px; }
                }
            </style>
        </head>
        <body>
            <h1>プレイヤーログ一覧</h1>
            <div class="controls">
                <div>作成者 Discord: @omirais_. @987lulu98</div>
                <div class="admin-input">
                    編集用パスワード: <input type="password" id="admin-pass" placeholder="パスワードを入力">
                </div>
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
                // パスワード入力欄を取得
                function getPassword() {
                    return document.getElementById('admin-pass').value;
                }

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
                                    <td><input type="text" id="memo-\${p.fc}" value="\${p.memo || ''}" placeholder="メモを入力..."></td>
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
                                        <div style="text-align: right;">\${historyText}<div class="current-name">\${p.currentName}</div></div>
                                    </div>
                                    <div class="card-memo">
                                        <input type="text" id="m-memo-\${p.fc}" value="\${p.memo || ''}" placeholder="メモ...">
                                        <button class="btn-save" onclick="saveMemo('\${p.fc}', true)">保存</button>
                                        <button class="btn-delete" onclick="deletePlayer('\${p.fc}')">削除</button>
                                    </div>
                                </div>
                            \`;
                        }).join('');
                    } catch (e) { console.error("Update error:", e); }
                }

                async function saveMemo(fc, isMobile = false) {
                    const password = getPassword();
                    if(!password) { alert('パスワードを入力してください'); return; }

                    const inputId = isMobile ? 'm-memo-' + fc : 'memo-' + fc;
                    const memo = document.getElementById(inputId).value;
                    const res = await fetch('/update-memo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, memo, password })
                    });
                    
                    if (res.ok) { 
                        alert('メモを保存しました'); 
                        fetchPlayers(); 
                    } else {
                        const err = await res.json();
                        alert('エラー: ' + err.error);
                    }
                }

                async function deletePlayer(fc) {
                    const password = getPassword();
                    if(!password) { alert('パスワードを入力してください'); return; }

                    if(!confirm('本当に削除しますか？')) return;

                    const res = await fetch('/delete-player', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fc, password })
                    });

                    if (res.ok) {
                        alert('プレイヤーを削除しました');
                        fetchPlayers();
                    } else {
                        const err = await res.json();
                        alert('エラー: ' + err.error);
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
