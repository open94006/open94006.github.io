---
date: '2026-10-22T16:05:37+08:00'
title: 'Node.js 專案運作時，遇到無法負荷的流量，該怎麼辦？'
description: ''
author: Daniel Lin
summary: '流量一大就加機器？先用 k6 找出真正的瓶頸，從非同步處理、佇列、索引、連線池、Redis 快取等低成本手段著手，最後才考慮 cluster 與擴展。'
draft: 0
categories: ['程式設計']
tags: ['Node.js', 'k6', '效能優化', '高併發']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

## 前言

流量一大、API 開始變慢、Service 處理時間過長，很多人的第一反應是「加機器」。
但如果瓶頸是一條沒有索引的 SQL，加了十台機器也只是讓十台一起等 DB。

我處理高流量／高併發時，會按照以下順序：

1. **先量測**：用 k6 找出真正的瓶頸和目前的上限，之後每次修改都拿數據比較
2. **最佳化程式碼與 DB**：非同步處理、佇列、索引、連線池、快取，這些通常成本最低、效果最明顯
3. **最後才擴展**：程式碼和 DB 都調整過還不夠，才用 cluster 用滿多核，再做水平或垂直擴展

越前面的步驟越便宜，越後面的步驟越花錢，也越難回頭。

## k6 量測

> 先測量系統當前的瓶頸、花費時間、服務水準

使用 k6 量測，才不會出現什麼「Order API 感覺變慢了」、「查詢訂單到底要多久」這種體感語句

k6 也提供簡單的 html 視覺化生成測量的結果

![k6-dashboard](images/k6-dashboard.jpg?h=360)

設定的 breakpoint option 範例架構如下：

```ts
const option = {
  executor: 'ramping-arrival-rate',
  startRate: 50,
  timeUnit: '1s',
  preAllocatedVUs: 200,
  maxVUs: 3000,
  stages: [
      { duration: '1m', target: LIMIT * 0.5 },
      { duration: '4m', target: LIMIT * 2 },
  ],
}
```

同時建立服務標準與是否加入斷點：

```ts
const thresholds = {
  http_req_duration: [{ threshold: 'p(95)<200', abortOnFail: true, delayAbortEval: '10s' }],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
}
```

option 建議多寫以下幾種型態，正確的測試，才得以分析成有用的資訊：

| 英文         | 中文       | 解釋                                                      |
| ------------ | ---------- | --------------------------------------------------------- |
| `smoke`      | 冒煙測試   | 改完程式先跑一次，確認功能正常，時長 30 秒                |
| `baseline`   | 基準測試   | 固定在上限的一半跑 2 分鐘，用來比較每次修改前後的 p95     |
| `breakpoint` | 斷點測試   | 只在「預期上限會改變」的修改之後才跑                      |
| `spike`      | 尖峰測試   | 瞬間衝到上限的 2 倍，看系統會不會崩，以及退回後能不能恢復 |
| `soak`       | 長時間測試 | 上限的 60% 跑 30 分鐘，抓記憶體洩漏、連線沒釋放等狀況     |

### k6 的 executor 怎麼看

k6 共有 7 種 executor，可以分成三類。

#### 封閉模型：用 VU 數量控制流量

每個 VU 送出請求後，要等回應回來才會送下一個。伺服器變慢時，送出的請求也會跟著變少。

| <div style="width: 160px;">Executor</div> | 怎麼跑                         | 適合情境                                        |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------- |
| `shared-iterations`                       | 所有 VU 合計跑完固定次數就結束 | 「總共跑 1000 次」，例如批次匯入資料            |
| `per-vu-iterations`                       | 每個 VU 各自跑固定次數         | 每個使用者跑固定流程，例如每人登入、下單各 1 次 |
| `constant-vus`                            | 固定 VU 數，跑一段時間         | 冒煙測試時使用                                  |
| `ramping-vus`                             | VU 數依照 stages 增減          | 模擬「同時在線人數」變化                        |

#### 開放模型：用每秒請求數控制流量

不管伺服器快慢，都照固定的頻率送出請求。伺服器變慢時，k6 會自動加開 VU 來維持流量。

| <div style="width: 200px;">Executor</div> | 怎麼跑                     | 適合情境             |
| ----------------------------------------- | -------------------------- | -------------------- |
| `constant-arrival-rate`                   | 每秒固定送幾個請求         | 基準測試、長時間測試 |
| `ramping-arrival-rate`                    | 每秒請求數依照 stages 增減 | 斷點測試、尖峰測試   |

#### 手動控制

| <div style="width: 200px;">Executor</div> | 怎麼跑                                                                           | 適合情境                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `externally-controlled`                   | 使用以下指令，隨時調整： <br/>`k6 pause`<br/>`k6 resume`<br/>`k6 scale --vus 50` | 一邊觀察一邊手動加壓。只能在本機執行，也不能和其他 scenario 一起用 |

## 程式碼

> 非同步處理、耗時任務移到佇列

- **互不相依的 await 改成並行**：連續 `await` 會一個等一個，彼此無關的查詢用 `Promise.all` 一起送出
- **不要阻塞 event loop**：Node 只有一條主執行緒，大量 JSON 處理、加解密、同步 I/O（`fs.readFileSync`）都會卡住所有請求；CPU 密集的工作改用 `worker_threads`
- **不需要馬上回覆的任務丟佇列**：寄信、產報表、呼叫第三方 API 等，丟進佇列（如 BullMQ）由 worker 處理，API 先回 `202 Accepted`

```ts
// 之前：兩個查詢依序等待，總時間 = A + B
const user = await getUser(id);
const orders = await getOrders(id);

// 之後：同時送出，總時間 ≈ max(A, B)
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

## 資料庫

> #連線池 #索引 #讀寫分離

- **連線池**：每個請求都重新建立連線很耗費資源；池子太小請求會排隊，太大則會把 DB 的連線數吃滿。要注意「池大小 × 行程數」不能超過 DB 的 `max_connections`
- **索引**：用 `EXPLAIN` 檢查慢查詢是否走全表掃描，替 `WHERE`、`JOIN`、`ORDER BY` 常用的欄位加索引
- **避免 N+1 查詢**：迴圈裡逐筆查詢改成一次 `IN (...)` 或 `JOIN`
- **讀寫分離**：寫入走主庫、讀取走副本；要注意副本有同步延遲，剛寫入的資料可能還讀不到

```ts
// 讀寫分離簡易寫法
const primary = mysql.createPool({ host: 'db-primary', /* user, password... */ });
const replica = mysql.createPool({ host: 'db-replica', /* user, password... */ });

// 寫入
await primary.query('UPDATE users SET name = ? WHERE id = ?', [name, id]);

// 讀取（可接受些微延遲的資料）
const [rows] = await replica.query('SELECT * FROM products WHERE ...');
```

## 把請求擋在 Node 前面

> CDN／Nginx、Redis 快取、限流與驗證

最快的請求，是根本沒進到 Node 的請求。

- **靜態檔案交給 CDN／Nginx**：圖片、JS、CSS 不該由 Node 回傳
- **Redis 快取**：常被查詢使用、不常改變的資料（如商品列表、設定檔）先查 Redis，沒有才查 DB，並設定合理的 TTL
- **限流**：在 Nginx（`limit_req`）或 API Gateway 限制單一 IP 的請求頻率，擋掉惡意或異常流量
- **提早驗證**：參數錯誤、未登入的請求，在最外層就回 4xx，不要讓它們跑到 DB

```ts
async function getProducts() {
  const cached = await redis.get('products');
  if (cached) return JSON.parse(cached);

  const products = await db.query('SELECT * FROM products');
  await redis.set('products', JSON.stringify(products), 'EX', 60); // 快取 60 秒
  return products;
}
```

## 讓應用程式不在記憶體存狀態

> 準備採行多個行程、多台機器的前提

下面的 cluster 與水平擴展，都會讓同一個使用者的請求落在不同的行程上。如果狀態存在記憶體裡，就會出現「剛登入、下一個請求又變成未登入」的狀況。

- **Session**：改存 Redis，或改用 JWT
- **快取**：行程內的 `Map` 快取改用 Redis 共用
- **上傳檔案**：不要存在本機硬碟，改放 S3 等物件儲存
- **排程**：`setInterval` 定時任務在多個行程會重複執行，改用佇列或只讓一個行程跑
- **WebSocket**：多行程之間要透過 Redis adapter 廣播訊息

這些準備都妥當後，再來考慮多個行程與水平擴展等使用情境。

## 單機用滿多核

> 單機撰寫 `node:cluster` 來讓多核 CPU 分工，提供多個行程來跑專案。

```ts
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

// 核心數
const WORKERS = Number(process.env.WORKERS ?? 4);

if (cluster.isPrimary) {
    console.log(`primary ${process.pid}：啟動 ${WORKERS} 個 worker（本機共 ${availableParallelism()} 核）`);

    for (let i = 0; i < WORKERS; i++) cluster.fork();

    // worker 掛掉就無條件重啟
    // 如果啟動時就失敗（例如 DB 連不上）會不停重啟，正式環境要加次數限制
    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} 結束（code=${code}, signal=${signal}），重新啟動`);
        cluster.fork();
    });
} else {
    // 直接載入原本的 app，app.listen(5100) 會自動共用同一個 port
    await import('./index.js');
}
```

## 水平擴展

> 負載平衡、k8s

單機用滿之後，就是加機器。前面放一個負載平衡器，把流量分給多台主機。

- **負載平衡**：AWS ALB、GCP Cloud Load Balancing，或自己用 Nginx `upstream` 分流
- **健康檢查**：提供 `/health` 端點，讓負載平衡器自動避開掛掉的機器
- **自動擴展**：依 CPU 或請求數自動增減機器，例如 AWS Auto Scaling、k8s 的 HPA
- **瓶頸會往後移**：Node 加到 10 台，DB 還是只有 1 台，記得回頭檢查連線數與 DB 負載

## 垂直擴展

> 隨時可以用來止血，但有上限

直接升級主機的 CPU、記憶體，不用改任何程式碼，是流量突然暴增時最快的解法。

- **好處**：馬上生效，架構不用動
- **缺點**：硬體規格有上限、價格不是線性成長，而且單台機器掛掉就全部停擺
- **注意**：Node 單一行程只用得到一個核心，升級 CPU 核心數前，要先做好上面的 cluster，不然多買的核心都是閒置的
