---
date: '2026-11-26T12:19:09+08:00'
title: '261126 Daily Note'
description:
author: Daniel Lin
summary:
draft: 0
categories: []
tags: ['DailyNote', 'Node.js', 'PM2', 'Kubernetes', 'TypeScript', 'PostgreSQL', 'MySQL', '讀寫分離', '資料庫鎖', '隔離等級']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

## Node.js Cluster, PM2, K8s 方案比較

| 方案 | 適用情境 | 優點 | 取捨 |
| --- | --- | --- | --- |
| 原生 `node:cluster` | 單機 VM、想零依賴、需要客製 primary 邏輯 | 無外部依賴，行為完全可控 | 重啟、零停機 reload、日誌、監控都要自己寫 |
| PM2 cluster mode | 傳統 VM / 實體機部署 | `pm2 start app.js -i max` 一行搞定，內建 `pm2 reload` 零停機、記憶體上限自動重啟、log 管理 | 多一層工具；放進容器時容易和編排平台的職責重疊 |
| 容器多副本（K8s / ECS / Docker Swarm） | 已經容器化 | 每個容器跑單一程序，由平台負責擴縮、健康檢查、滾動更新 | 需要編排平台；單一 Pod 吃不滿多核時，要靠調整 CPU request 與副本數 |
| `worker_threads` | CPU 密集運算（圖片處理、加解密、大型 JSON 處理） | 不同的記憶體可以用 message passing 互相傳資料，開銷比多程序小 | 不是用來擴展 HTTP 吞吐的；官方建議不需要程序隔離時改用 worker_threads |

- 流量不大、一台機器撐得住：用 `單台 VM + PM2`。要擴就先升級規格（垂直）。
- 需要高可用（不能因為一台機器掛掉就停機），或流量會超過單機上限：一定要有跨機器的水平擴展。如果團隊還沒有容器化，就用 `多台 VM + PM2 + LB`；已經容器化，或服務數量多，就上 `K8s`。
- 手寫 `node:cluster`：只在單機場景下、需要客製行為時才用，它不會帶給你任何跨機器的能力。

## Typescript 泛型

- <https://willh.gitbook.io/typescript-tutorial/advanced/generics>
- <https://ithelp.ithome.com.tw/articles/10278375>
- <https://ithelp.ithome.com.tw/articles/10412384>

## PostgreSQL vs MySQL

| 評估構面 | 傾向選擇 PostgreSQL | 傾向選擇 MySQL |
| --- | --- | --- |
| **業務發展階段** | 需求變化快、Schema 演進頻繁，需靠 `JSONB` 與嚴格約束降低重構風險 | 業務模式明確、存取模式固定，追求快速上線與穩定可預期 |
| **架構精簡度** | 希望「一套資料庫打天下」，盡量減少額外引入快取或搜尋引擎 | 系統已拆分為多組件（如搭配 Redis、Elasticsearch），DB 只負責純粹儲存 |
| **團隊工程背景** | 偏重後端應用開發主導（App-centric），習慣用強大 SQL 與型別保護業務邏輯 | 有專職維運或深厚 MySQL 調校經驗，重視儲存引擎層的可控性 |
| **未來演進路線** | 預期會加入報表分析、地理定位、AI 向量搜尋或複雜計費邏輯 | 預期流量規模極大但單筆邏輯簡單，未來走分庫分表或分散式 MySQL 路線 |

## 讀寫分離

> 以 MySQL 的機制舉例

- 兩個主機各自建立 DB：replica DB, primary DB
- `Select` 使用 replica
- `Insert`、`Update`、`Delete` 使用 primary
- 如果 primary 的資料鍵入完成，需要即時看見更新，可以設定成寫入後一段時間的讀取走 primary
- primary 處理後的 binlog 要保留，為的就是 replica 出現異常故障時，可以透過 GTID 追回
- primary 故障時，將資料最新的 replica promote 為新的 primary（failover 故障轉移），再補一台新的 replica，不必修好舊機再切回去。

## 悲觀鎖 vs 樂觀鎖

- 悲觀鎖：`BEGIN`, `FOR UPDATE`, `COMMIT`
  - 優點：在 A Transaction 內，被 `FOR UPDATE` 鎖住的 rows，其他交易的 `UPDATE`、`DELETE`、`FOR UPDATE` 都要等 A commit 才能執行，保證期間不被修改
  - 缺點：排隊過長可能 lock timeout、有死鎖風險；WHERE 條件沒加上索引時，會鎖住所有掃描到的 rows，效果接近鎖表
  - 適合場景：強一致性、重要資料、高風險的情境，如庫存、搶票、錢包餘額等
- 樂觀鎖：使用 `version` 比對
  - 優點：搭配原子更新（`UPDATE ... WHERE version = ?`），透過 affected rows 判斷是否有衝突（0 代表未完成更新，遇到衝突），後續好重試或回報
  - 缺點：高併發下可能會因為重試風暴而崩潰、要做到冪等性
  - 適合場景：讀多寫少、低風險、失敗代價低，例如後台資料編輯、設定更新等

## 隔離等級（Isolation Level）是什麼

> 隔離等級決定了 **「同時執行的多個 Transaction，彼此之間能看到對方多少變動」**。
> 它是 ACID 裡「I（Isolation）」的具體設定值。

完美的隔離是讓每個交易都像是排隊、一個接一個執行（互相完全看不到），但這樣效能最差。所以資料庫提供不同等級，讓你在資料正確性與併發效能之間取捨：等級越高，越不容易出現異常，但鎖或衝突檢查的成本越高，吞吐量越低。

四個等級由寬到嚴，以「交易 A 在進行中，交易 B 同時在改資料」來看：

|隔離等級|A能看到 B 的什麼|能擋住的問題|
|---|---|---|
|Read Uncommitted|B 還沒 commit 的變動也看得到|什麼都擋不住（幾乎不使用）|
|Read Committed|只看得到 B 已 commit 的變動，每次查詢都讀最新已 commit 的資料|擋住髒讀|
|Repeatable Read|在 A 開始後，整個交易期間看到的資料一致（像拍了一張快照）|擋住髒讀、不可重複讀|
|Serializable|效果等同所有交易依序執行|擋住髒讀、不可重複讀、幻讀|
