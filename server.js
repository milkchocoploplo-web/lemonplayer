const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 簡易的なメモリ内データベース（再起動すると消えます。永続化が必要なら外部DBを使用してください）
let playerHistory = [];

// 1. プレイヤーデータ受信
app.post('/api/report', (req, res) => {
    const players = req.body.players;
    const timestamp = new Date().toLocaleString('ja-JP');
    
    if (Array.isArray(players)) {
        playerHistory.unshift({ timestamp, players });
        // 履歴を最新50件に制限
        if (playerHistory.length > 50) playerHistory.pop();
        console.log(`[${timestamp}] プレイヤーリスト受信: ${players.length}人`);
        res.json({ ok: true });
    } else {
        res.status(400).json({ ok: false, error: 'Invalid data' });
    }
});

// 2. 閲覧用ページ
app.get('/', (req, res) => {
    let html = `<h1>Player History</h1><p>Auto-refreshing every 30s</p><script>setTimeout(()=>location.reload(), 30000)</script>`;
    playerHistory.forEach(entry => {
        html += `<div style="border:1px solid #ccc; margin:10px; padding:10px;">
                    <h3>${entry.timestamp}</h3><ul>`;
        entry.players.forEach(p => {
            html += `<li>[${p.slot}] <b>${p.nickname}</b> (HP: ${p.hp}) - ID: ${p.number}</li>`;
        });
        html += `</ul></div>`;
    });
    res.send(playerHistory.length ? html : "No data received yet.");
});

// 3. Renderのスリープ防止 (Self-Ping)
setInterval(() => {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`;
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        https.get(url, (res) => {
            console.log(`Keep-alive ping sent to ${url}: ${res.statusCode}`);
        }).on('error', (e) => console.error("Ping error:", e));
    }
}, 10 * 60 * 1000); // 10分おき

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
