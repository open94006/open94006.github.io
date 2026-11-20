---
date: '2026-11-19T15:35:09+08:00'
title: '261119 Daily Note'
description:
author: Daniel Lin
summary:
draft: 0
categories: []
tags: ['DailyNote', 'Express', 'Node.js', 'TypeScript', 'SQL', '資料庫索引', 'Cookie']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

## Express 在中介軟體的判斷

Express 會透過函式的參數個數（`fn.length`）判斷它是一般中介軟體還是錯誤處理中介軟體。

Router 內部的 Layer 在正常流程中，**length 大於 3 的函式會被跳過**；錯誤流程中，**length 不等於 4 的函式會被跳過**。

當呼叫 `next(err)` 或在處理過程中拋出錯誤時，Express 會跳過所有一般中介軟體與路由，往下尋找第一個參數個數為 4 的函式來執行。

### 實際寫法

```ts
// *** errors/HttpError.ts ***
// HttpError 類別定義

export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

// *** index.ts ***

import type { ErrorRequestHandler } from 'express';
import { HttpError } from './errors/HttpError';

// 掛載許多路由
const app = express();
app.use(productRouter);
app.use(metricsRouter);
app.use(orderRouter);
app.use(userRouter);

// 搭配四個參數的 errorHandler 做錯誤中介的處理
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
        return void res.status(err.status).json({ message: err.message });
    }

    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
};

app.use(errorHandler);
```

## 資料庫用 EXPLAIN 診斷查詢

`EXPLAIN` 是個診斷工具，用來判斷 SQL 打算怎麼執行這條查詢，可以得知很多數據。

```SQL
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

重點看這幾個欄位：

| 欄位  | 要看什麼                                                      |
| ----- | ------------------------------------------------------------- |
| type  | ALL 代表全表掃描（壞）；ref、range、const 代表有走索引（好）  |
| key   | 實際使用的索引名稱，NULL 代表沒用到索引                       |
| rows  | 預估要掃描的筆數，越少越好                                    |
| Extra | 出現 Using filesort 或 Using temporary 代表排序或暫存表成本高 |

並以此來建立適合情境的索引，如：

```SQL
-- 單一欄位索引（對應 WHERE user_id = ?）
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- JOIN 的外鍵欄位也要有索引
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

-- 複合索引（對應 WHERE + ORDER BY）
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
```

## Express 在後端如何讀取前端的 cookie

使用 Typescript 撰寫，要安裝 `cookie-parser`，接下來就可以引用了。

```bash
npm i cookie-parser
npm i -D @types/cookie-parser
```

```ts
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

app.get('/api/me', (req, res) => {
  const token = req.cookies.token; // 讀取名為 token 的 cookie
  res.json({ token });
});
```
