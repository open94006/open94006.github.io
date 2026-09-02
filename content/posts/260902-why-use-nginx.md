---
date: '2026-09-02T14:35:49+08:00'
title: '為何要使用 nginx？'
description:
author: Daniel Lin
summary:
draft: 0
categories: []
tags: []
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

nginx 的核心價值是把「**連線管理、加解密、壓縮、限流、多後端協調**」這些跟業務邏輯無關、但需要高效能處理的工作，從 Express 手上接過去做。透過鍵值設定來驅動。

而它的哲學是：你描述「**規則**」，nginx 的 C 程式碼負責「**執行**」。也就是說，幾乎可以只靠設定完 config 檔案（nginx.conf），就能運作上述提到的繁雜工作。

## nginx.conf 怎麼寫

### 基本的架構長這樣

```nginx
events {}

http {
    server {
        listen 80;
        location / {
            proxy_pass http://app:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 先學習「語法本身」

```nginx
directive value;
block {
    directive value;
}
```

### 再理解每個指令背後對應的「機制」

同一個指令，不懂機制就只是照抄，懂機制才知道為什麼、什麼時候該調

```nginx
keepalive 320;
```

單看這行只知道「數字是 320」，但要理解「為什麼少了這行吞吐量會砍半」，得知道 TCP 三次握手、TIME_WAIT 這些網路層的東西——這些知識不在 conf 語法裡，是需要另外具備的背景知識，conf 只是拿這些知識去下決策的介面。

## nginx 最主要解決的三件事

### 1. 反向代理：把「一群後端」包裝成「一個穩定入口」

```text
沒有 nginx：使用者要嘛直接連 Express，一台機器就是一個單點
有 nginx：使用者永遠打同一個入口，nginx 決定要轉給後面哪一份
```

這件事在 k8s 的 Service 裡也看過類似的概念（固定名稱、動態轉送），但 nginx 做的是**在 k8s 這層之外，或者在 k8s 內部也可以再包一層**，多提供一些 k8s Service 沒有的細緻控制

例如 nginx.conf 可以使用 `map $cookie_env $backend`，用 cookie 判斷要導去哪個後端，這是純 k8s Service 做不到的。

```nginx
map $cookie_env $backend {
    default http://127.0.0.1:3000; # 正式後端
    "beta" http://127.0.0.1:4000; # beta 後端（精確比對 cookie 值）
}
```

### 2. 卸載掉「不該由應用程式處理」的工作

一般的 Express 程式碼架構裡不太會處理這些事，可以透過 nginx 擋掉：

```text
TLS/SSL 加解密      ← nginx 處理，Express 收到的是解密後的明文
gzip 壓縮           ← nginx 處理，Express 不用特別處理壓縮演算法
靜態檔案（圖片、CSS） ← nginx 直接讀硬碟送出，不用經過 Node.js
限流、擋惡意流量      ← nginx 在最前面就擋掉，不會消耗到後端資源
```

**這是很重要的分工邏輯**：Node.js 是單執行緒，做這些事會浪費它寶貴的 event loop 時間；nginx 是用 C 寫的、事件驅動、專門最佳化處理這類 I/O 密集工作，讓它做這些事效率高非常多。把不屬於「業務邏輯」的工作攔在 nginx 這層，Express 就能專心處理 `/api/v1/orders` 這種真正需要商業邏輯的請求。

### 3. 系統的韌性與流量控制

回顧我之前排查過的東西，每一個都是 nginx 提供、Express 自己做不到（或做起來很麻煩）的能力：

| 設定                   | nginx 提供的能力                                           |
| ---------------------- | ---------------------------------------------------------- |
| `keepalive 320`        | 連線重用，省掉重建 TCP 的成本                              |
| `proxy_next_upstream`  | 某個後端掛了自動轉去別台，Express 自己完全不知道有幾台兄弟 |
| `limit_req zone=perip` | 限流擋掉超量請求，Express 完全不用寫這段邏輯               |
| `proxy_read_timeout`   | 統一控管逾時策略，不用每個 API 各自處理                    |

## 為什麼不乾脆讓 Express 自己做這些事

這是更核心的問題，答案是**職責分離 + 效能特性不同**：

### 理由一：Node.js 單執行緒，不擅長高併發的連線管理

```text
Express 自己接 10000 條 TLS 連線
  → 每條連線的加解密運算都要排進同一條 event loop
  → 業務邏輯（處理訂單）也要排進同一條 event loop
  → 兩種完全不同性質的工作互相搶時間
```

```text
nginx 擋在前面
  → nginx 用多 worker process + 事件驅動模型處理海量連線（這是它的專長）
  → 到 Express 的請求，已經是解密好、篩選過的乾淨流量
  → Express 的 event loop 可以專心處理業務邏輯
```

### 理由二：改設定不用重新部署程式碼

在 nginx 上的調校（限流數值、timeout 秒數、gzip 開關）都是**改一個設定檔、reload**，不需要碰 Express 的程式碼、不需要重新 build image、不需要跑測試套件。如果這些邏輯寫進 Express 裡，任何調整都要走一次完整的程式碼發布流程，風險和成本高很多。

### 理由三：nginx 是被大量生產環境驗證過的成熟軟體

TLS 握手、HTTP/2、連線池管理，這些東西**自己在 Node.js 裡重新實作，效能跟安全性都很難超越 nginx**——nginx 已經被全世界無數高流量網站用了二十年，邊界情況、安全漏洞都被磨過很多輪。用 Express 的套件（例如 `express-rate-limit`）做限流當然可行，但論效能跟穩定性通常比不過在更底層、更專職的 nginx 做同樣的事。

## k8s Service 與 nginx 比較

|              | k8s Service（內建）       | nginx（自架）                                          |
| ------------ | ------------------------- | ------------------------------------------------------ |
| 負載平衡     | 有，比較陽春（隨機/輪詢） | ⭐️ 有，且可以用 `least_conn`、依 cookie 分流等進階策略 |
| TLS 終止     | 不管                      | ⭐️ 專職處理                                            |
| 限流         | 完全沒有                  | ⭐️ `limit_req` 內建支援                                |
| 靜態檔案服務 | 不管                      | ⭐️ 內建高效處理                                        |
| 灰度發布     | 只能靠副本數比例調整      | 可以用 `map` 區塊搞定                                  |

**k8s Service 解決的是「怎麼找到一群 Pod」這個基礎問題，nginx 解決的是「找到之後，這條連線的行為要怎麼精細控制」這個進階問題。** 兩者不是互斥的，這架構疊在一起用（`k6 → nginx → Service → Express`），各自負責自己最擅長的那一層，這也是為什麼我會把 nginx 定位成「反向代理」這一層，跟 k8s 的 Service 分開處理。

## 總結

> 讓 nginx 與 Express，兩者各自專注在自己最擅長的事情上。

之所以不讓 Express 自己做，是因為 Node.js 單執行緒的特性不適合處理海量併發連線這種 I/O 密集工作，而且把這些邏輯留在設定檔裡，調整起來遠比改程式碼、重新部署要輕量、安全得多。
