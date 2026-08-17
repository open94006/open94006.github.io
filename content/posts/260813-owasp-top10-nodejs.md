---
date: '2026-08-13T14:53:23+08:00'
title: 'OWASP Top 10 x Node.js'
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

## OWASP 是什麼？

OWASP 全名 **Open Web Application Security Project（開放網路軟體安全計畫）**，是個開放社群、非營利性組織，全球目前有數百個分會。

而 OWASP Top 10 是 OWASP 每隔幾年公布一次的十大應用程式資訊安全風險清單，整理出當今應用系統最常遇到的資安問題，以及預防與找出漏洞的建議。它不只寫給開發人員與資安部門，也讓決策者與大眾能了解這些風險。

> 以下根據 OWASP Top 10:2025 報告來介紹

## 1. Broken Access Control（存取控制失效）

### 這個問題怎麼發生

簡單說就是「這個人不該碰這筆資料，但系統讓他碰到了」。常見的幾種樣子：

- **IDOR（不安全的物件參考）**：網址或參數裡的 ID 被使用者自己改掉（例如`?id=101`改成`102`），後端沒確認這筆資料是不是他的，就直接撈出來或改掉。
- **水平越權**：A 使用者用自己的帳號，去操作 B 使用者的資料。兩人權限一樣大，只是不該碰到對方的東西。
- **垂直越權**：一般使用者跑去打管理員專用的功能，權限由下往上跳，所以叫「垂直」。靠猜網址找到後台頁面的手法叫 **Forced Browsing（強行瀏覽）**。
- **API 缺乏防護**：只擋了前端畫面，卻沒對後端的 POST、PUT、DELETE 請求做身分與權限驗證。畫面藏起來不等於功能關起來，攻擊者可以直接打 API。
- **Mass Assignment（大量賦值）**：後端把`req.body`整包塞進資料庫的 update / create，使用者偷偷夾帶`role: 'ADMIN'`這種不該由自己決定的欄位，就跟著一起被寫進去。
- **SSRF（伺服器端請求偽造）**：功能是「後端幫使用者去抓某個網址」（例如抓連結預覽圖），但沒限制可以抓哪裡，攻擊者就填一個內網網址，借你的伺服器去打你自己的內網或雲端 metadata（如`169.254.169.254`，上面可能有雲端主機的金鑰）。2025 版把這類問題併入存取控制失效。

### 在 Node.js 裡我會怎麼防

如果要避免 **IDOR** 和**水平越權**，需要做到 **Deny by Default（預設拒絕）**，也就是「沒有明確說可以，就一律當作不可以」：把`authMiddleware`掛在整個 router 最上層，之後在這個 router 底下新增的路由都會自動繼承驗證，不需要每條路由各自記得加。

這個中介層只做「有沒有登入」的驗證（如 JWT 簽章、過期），並加入到欲保護的路由，如訂單 API、使用者資料 API 等。

```ts
function verifyToken(token: string): JwtPayload {
    try {
        // algorithms 一定要明確指定，否則攻擊者可能改用其他演算法（甚至宣稱「不簽章」）來繞過驗證
        return jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('TOKEN_EXPIRED');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('TOKEN_INVALID');
        }
        throw error;
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ status: false, message: '使用者 token 不存在' });
        }

        req.user = verifyToken(token); // 正確會通過、錯誤會跳 throw
        next(); // token 通過
    } catch (error) {
        return res.status(401).json({ status: false, message: '登入驗證失敗' });
    }
}

// 「使用者」的路由一次加入 authMiddleware，/user 底下所有路徑都要經過驗證
app.use('/api/v1/user', authMiddleware, apiRouter);
```

> `controller`一律用`req.user.id`／`req.user.user_id`，這是中介層驗證通過，從 JWT 解出來後存入，可當作使用者身分。

每一條會動到資源的 SQL，不管 SELECT/UPDATE/DELETE，都把`user_id = $N`跟資源自己的 id 一起放進 WHERE；如果是用 ORM，也一樣要確保`find`的參數包含使用者身分的篩選，才不會撈到或改到別人的資料。

這樣一來，即使把 URL 裡的 order_no 換成別人的（`GET /order/r/:order_no`），因為 SQL WHERE 條件多了`AND user_id = $1`，查不到就是空的，不會洩漏或誤改別人資料。

---

針對 **Mass Assignment**，`controller`不要把`req.body`整包丟給 ORM，先用`zod`的 schema 挑出允許寫入的欄位，使用者夾帶的`role`、`isAdmin`等欄位會直接被過濾掉，不會進到 SQL。

```ts
const UpdateProfileSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
}); // 只列出使用者被允許自己改的欄位，role、isAdmin 等一律不在清單內

const data = UpdateProfileSchema.parse(req.body);
await prisma.user.update({ where: { id: req.user.id }, data });
```

---

針對 **SSRF（伺服器端請求偽造）**，任何「後端幫使用者發請求」的功能（抓網址預覽、Webhook、匯入外部圖片）都要做**目標網址白名單**，並擋掉私有 IP 網段（`127.0.0.1`、`169.254.169.254`、`10.0.0.0/8`等這些只有內網才連得到的位址），避免被借去打內網或雲端 metadata。

---

再來是**垂直越權**，集中管理 API 端點的存取權限，將 **RBAC（角色權限控制，Role-Based Access Control）** 抽象化為可複用的中介層，避免路由漏掉保護。

> 「先看你是什麼身分，再決定能做什麼」

```ts
export function authorizeRole(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ status: false, message: '未經身分驗證' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            // logger 是第 9 章會設定的 pino instance，這裡先借用
            logger.warn({ userId: req.user.id, url: req.originalUrl }, '越權存取嘗試');
            return res.status(403).json({ status: false, message: '權限不足，拒絕存取' });
        }

        next();
    };
}

// 依照「預設拒絕」原則，明確掛上兩層防護中介層
app.delete(
    '/api/admin/users/:id',
    authMiddleware, // 1. 身分驗證：你是誰
    authorizeRole(['ADMIN', 'SUPERUSER']), // 2. 垂直權限驗證：你能不能做這件事
    deleteUserHandler,
);
```

---

## 2. Security Misconfiguration（安全設定錯誤）

### 這個問題怎麼發生

程式碼本身沒問題，但「設定」沒調好，等於門鎖裝了卻沒上鎖。

- **未改預設值**：保留了出廠預設的管理者帳號、密碼、金鑰等。
- **權限過大**：賦予使用者或服務過高的系統存取權限，可操作的功能全開。
- **資訊洩漏**：在正式環境中誤開啟 **Debug Mode（偵錯模式）**，把系統架構與機敏資料一起吐出來。
- **未定時更新**：沒有定期檢查與修補框架、元件、函式庫（npm 套件）的安全設定或漏洞。

### 在 Node.js 裡我會怎麼防

啟動伺服器時，**強制檢查機敏金鑰**，若為預設值或過短直接拋錯停止服務。與其上線後才發現金鑰還是`default_secret`，不如讓它根本啟動不起來。

```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'default_secret' || JWT_SECRET.length < 32) {
    // 這段跑在 logger 初始化之前，所以這裡用 console 沒問題
    console.error('FATAL ERROR: JWT_SECRET 未設定或使用預設弱金鑰');
    process.exit(1); // 拒絕在不安全的預設組態下啟動
}
```

---

如果有分正式/測試環境，可以透過`isProduction`判斷環境，錯誤細節只在自己開發時看得到，不要吐給外面。

```ts
const isProduction = process.env.NODE_ENV === 'production';

// logger 是 pino instance，設定方式在第 9 章
logger.error(
    {
        ...(isProduction ? {} : { debugInfo: err.message, stack: err.stack }),
    },
    '伺服器內部錯誤',
);
```

---

使用`helmet`可以自動啟用一整組 HTTP 安全 Header（含隱藏`X-Powered-By`、預設開啟 HSTS 等），避免攻擊者知道後端是用 Express 開發，也能降低跨站腳本攻擊、點擊劫持（把你的網站藏在透明的 iframe 裡誘導使用者點擊）的風險。不需要再額外呼叫`app.disable('x-powered-by')`，helmet 的`hidePoweredBy`已經內建處理。

```ts
app.use(helmet({ frameguard: { action: 'deny' } })); // 完全禁止被別人用 iframe 嵌入
```

> `helmet`還能設定更進階的 CSP，第 5 章講 XSS 時會再補上。

---

為了讓合法的來源可以使用我們的 API，需要在後端加上 **CORS（跨來源資源共用）** 設定，指定哪些網域可以存取資源。白名單改用 env 管理，正式環境才不會忘了改、還留著`localhost`；`credentials: true`（允許跨網域帶 Cookie）時尤其不能反射任意來源，否則等於誰都能帶著使用者的 Cookie 來打你的 API。

```ts
const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean); // 例如 'https://app.example.com,https://admin.example.com'

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(cors(corsOptions));
```

---

套件的漏洞掃描也屬於設定的一環，最低限度是把`npm audit`接進 CI/CD Pipeline，掃到高危漏洞就讓部署失敗。這件事在第 3 章會完整展開，包含 audit 掃不到的狀況該怎麼補。

---

只給帳號或服務運作所需的最低權限，遇到沒有明確授權的操作**一律拒絕**。不管是資料庫層面，或是後台系統要開給不同身分的人員登入，都適用這個原則。

以 Dockerfile 為例，使用`USER node`而不是預設的 root 身分，避免攻擊者遠端攻擊成功後，直接取得系統最高權限。

```Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

別忘了搭配`.dockerignore`，否則`COPY . .`會把本機的`.env`、`node_modules`、`.git`一起打包進 image。

```text
.env
.env.*
node_modules
.git
```

---

## 3. Software Supply Chain Failures（軟體供應鏈失效）

### 這個問題怎麼發生

你寫的程式碼可能只佔專案的一小部分，剩下的都是別人寫的套件。「供應鏈」指的就是這一整條「別人的程式碼進到你的專案」的路徑。

- **隱藏依賴**：專案直接引用的套件，底下可能還有許多層遞移相依套件（套件的套件的套件），只要其中一個上游元件被駭，就會連帶遭受汙染。
- **缺乏變更追蹤**：未記錄開發環境、程式碼儲存庫，或是多套件管理工具（`npm` / `pnpm`）在同一個目錄混用，各自生成一份鎖檔（lock file，記錄「這次安裝實際用了哪些版本」的檔案），兩份鎖檔記錄的版本會隨時間各自漂移，沒人知道哪一份才是「真正在跑的那份」。

### 在 Node.js 裡我會怎麼防

> 一個 repo 只認一套套件管理工具（假設使用`pnpm`）

`package-lock.json`和`pnpm-lock.yaml`只會留下一個，其他工具的鎖檔**一律刪掉**。

把要移除的舊鎖檔名稱，加入到`.gitignore`。並防止再次使用`npm install`加回來，在`package.json`加上`"packageManager": "pnpm@x.y.z"`搭配 corepack，或用`only-allow`當 preinstall，用錯工具會直接在安裝時報錯。

```json
// package.json
{
    "packageManager": "pnpm@9.1.0",
    "scripts": {
        "preinstall": "npx only-allow pnpm"
    }
}
```

---

接著是漏洞掃描。定期跑`audit`指令，或是接 Dependabot 等自動化工具，遍歷一次鎖檔內釘住的版本有沒有新出現的問題，並追蹤套件的更新趨勢，畢竟最新的版本也可能含有漏洞。在 CI/CD 裡跑的話，掃到 High 以上的漏洞會**回傳非零狀態碼並阻斷部署**。

```bash
npm audit --audit-level=high
```

---

不過`npm audit`查的是**已知**的漏洞（已經被登記在資料庫裡的），對付不了近年那種「維護者帳號被盜、直接把惡意版本推上 npm」的攻擊——因為版本才剛發布，資料庫還來不及收錄。可以再搭配：

- **版本冷卻期**：新版本發布後先觀察幾天再升級（npm 的`minimumReleaseAge`設定），讓社群有時間抓出惡意版本。
- **Provenance（來源證明）**：安裝時驗證套件的來源簽章（`npm audit signatures`），確認真的是原作者從原始碼發布的版本，而不是別人假冒的。
- 安裝一律加`--ignore-scripts`，擋掉套件在安裝過程中自動執行的惡意腳本，第 8 章會說明原因。

> 跟第 8 章的差別：第 3 章顧的是「你引進來的套件本身乾不乾淨」，第 8 章顧的是「你組裝、建置、發布的流程有沒有被竄改」。

---

## 4. Cryptographic Failures（加密機制失效）

### 這個問題怎麼發生

- **明文傳輸或儲存**：敏感資料（如密碼、信用卡號）未經加密或雜湊就直接採用、寫入資料庫或透過 HTTP 明文傳輸。
- **使用已淘汰的演算法**：雜湊函數如`MD5`、`SHA-1`，或加密演算法如`RC4`。另外`SHA-256`雖然未被破解，但速度太快——攻擊者拿到資料庫後可以每秒試上億組密碼，所以同樣不適合拿來存密碼。
- **金鑰管理不良**：金鑰強度不足、Hardcoded（直接寫死在程式碼中），或沒有定期更換。
- **Timing Attack（時序攻擊）**：程式用`===`比對密碼、Token、簽章這類機密值時，字元一比對到不同就提早返回，攻擊者靠回應時間的微小差異逐字猜出正確值；也常出現在「帳號存在與否」讓回應時間不同，被拿來列舉帳號。

### 在 Node.js 裡我會怎麼防

1. 全面啟用 HTTPS，確保所有網路傳輸都透過 TLS 1.2+ / 1.3，並**加上 HSTS，讓瀏覽器記住此站只走 HTTPS**，防止半路攔截。

2. **先分清楚用途再選演算法**：資料之後要還原（例如存起來、之後要解密來看）用`AES-256-GCM`；只是要確認資料沒被竄改用`HMAC-SHA256`；密碼儲存則用`argon2id`（我的專案採用的就是這個）或`bcrypt`，這類演算法「刻意設計得很慢」，讓攻擊者猜不動。

3. 定期更新金鑰，或透過 Secret Manager 另行管理，避免機密資料全包在專案裡，讓攻擊者一次獲得。

4. 在 Timing Attack 上，帳號不存在時可以加入無意義的運算，**讓驗證花掉跟真帳號一樣的時間**，避免結果提早返回。

```ts
import argon2 from 'argon2';
import crypto from 'crypto';

export const hashOption = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3,
    parallelism: 1,
};

// module 載入時，算一次就好，之後全程重複使用
// 內容本身不重要，純粹是要讓 argon2.verify() 有真的東西可以跑
const DUMMY_HASH_PROMISE = argon2.hash(crypto.randomBytes(16).toString('hex'), hashOption);

// 不存在的帳號也跑一次 verify，讓耗時跟真帳號一致
if (!user) {
    await argon2.verify(await DUMMY_HASH_PROMISE, password);
    return { result: false, token: '', message: '帳號與密碼輸入錯誤' };
}

// 真帳號的判斷
const passwordVerify = await argon2.verify(user.password, password);
if (!passwordVerify) {
    return { result: false, token: '', message: '帳號與密碼輸入錯誤' };
}
```

比對 Token、簽章、API Key 這類固定長度的機密值時，不要用`===`，改用`crypto.timingSafeEqual`。它的特色是「不管對不對，都會把整串比完才回答」，攻擊者就量不出時間差：

```ts
import crypto from 'crypto';

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // 長度不同要先擋掉，timingSafeEqual 長度不等會直接 throw
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
```

---

## 5. Injection（注入攻擊）

### 這個問題怎麼發生

攻擊者把惡意程式碼、指令或提示詞塞入系統的輸入欄位中。核心成因都一樣：**系統把「使用者填的資料」當成「要執行的指令」**。可能是透過：

- 表單字串鍵入 **SQL 語法**送出，系統沒有檢查清楚，直接執行命令。
- 透過惡意塞入的 **XSS（跨網站指令碼）**。
- 平台提供的 AI agent 或問答，透過**提示詞**推敲惡意攻擊。

導致洩漏機密資料、Cookie、修改資料庫內容或控制整個程式。

### 在 Node.js 裡我會怎麼防

#### SQL Injection

採用**主流 ORM（例如 Prisma, Drizzle）** 可以做到第一線的 SQL 注入防禦。要注意 ORM 不是完全免疫——像 Prisma 的`$queryRawUnsafe`、Drizzle 的`sql.raw()`這類跳出 query builder 的 API，一樣是把字串直接拼進 SQL，用法上等同原生 SQL，一樣要走參數化查詢。

如果為了效能或可控性偏好使用原生 SQL，也應一律使用 **Prepared Statements（參數化查詢）**：把 SQL 語法和使用者填的值分開送給資料庫，值就永遠只會被當成值，不會被當成語法執行。

```ts
await client.query(
    `INSERT INTO b_order(user_id, order_no) VALUES ($1, $2) RETURNING id;
    `,
    [user_id, orderNo], // 值另外用陣列傳，不要拼進上面的字串
);
```

對於無法參數化的 SQL 識別字（例如欄位名、資料表名、排序方向），則採用 **switch 或白名單映射硬性比對**，而不是直接把使用者輸入拼進 SQL。這樣能兼顧 SQL 的靈活性與安全性。

```ts
if (query.orderString) {
    switch (query.orderString) {
        case 'created_time_desc':
            orderBy = 'ORDER BY created_time DESC';
            break;
        case 'created_time_asc':
            orderBy = 'ORDER BY created_time ASC';
            break;
        case 'next_charge_at_desc':
            orderBy = 'ORDER BY next_charge_at DESC';
            break;
        case 'next_charge_at_asc':
            orderBy = 'ORDER BY next_charge_at ASC';
            break;
        default:
            break;
    }
}
```

---

#### XSS（跨網站指令碼）

攻擊者讓自己的 JavaScript 在別人的瀏覽器上執行，分成三種：

- **Stored（儲存型）**：惡意碼寫進資料庫，每個看到該頁的人都中
- **Reflected（反射型）**：惡意碼夾在網址裡，需誘導點擊
- **DOM-based（DOM 型）**：惡意碼沒送到後端，純在前端 JS 被執行

可以從輸入端做格式驗證：型別、長度、白名單，例如 email 就必須長得像 email。輸出端做跳脫編碼，把`<`、`>`、`&`、`"`、`'`都轉成對應的 HTML entity，瀏覽器就只會把它當文字顯示，不會當成程式碼執行。

編碼方式要看輸出位置，HTML 內文與屬性、JS 字串、URL 各自不同，所以沒辦法在輸入時就先做掉。實務上不需要自己刻跳脫函式，React、Vue 這類框架預設就會自動跳脫輸出，只要不主動繞過（`dangerouslySetInnerHTML`、`v-html`、`innerHTML`）就不會中；真正需要手動處理的通常只剩使用者提供的富文本內容。

**前端 DOM 型**的 XSS 可以呼叫`textContent`方法，或引入`dompurify`來避免 innerHTML 插入非法程式碼。

```ts
import DOMPurify from 'dompurify';

// 方法 1：僅渲染純文字內容（自動跳脫）
document.getElementById('content').textContent = userInput;

// 方法 2：若必須渲染富文本，先經過 DOMPurify 過濾掉危險標籤
const cleanHtml = DOMPurify.sanitize(userInput);
document.getElementById('content').innerHTML = cleanHtml;
```

> 另外設定`HttpOnly`（禁止 JS 讀取 Cookie），無法完全擋住 XSS 的發生，但能讓攻擊者就算注入成功也偷不走 Cookie，屬於減災措施。完整的 Cookie 設定會在第 7 章一起講。

接著在`helmet`加入 **CSP（內容安全政策，Content Security Policy）**，透過 HTTP 回應標頭設定白名單，明確告訴瀏覽器哪些來源的指令碼、樣式或圖片可以載入與執行。就算攻擊者成功注入了`<script>`，只要來源不在白名單上，瀏覽器就會拒絕執行，等於多一道保險。

```ts
app.use(
    helmet({
        // 第 2 章提到的 frameguard，禁止 iframe
        frameguard: {
            action: 'deny',
        },

        // 新增內容安全政策 CSP
        contentSecurityPolicy: {
            directives: {
                // 預設只能載入同源資源
                defaultSrc: ["'self'"],

                // 允許同源與指定 CDN 的 JS
                scriptSrc: ["'self'", 'https://trusted-cdn.com'],

                // 'unsafe-inline' 是為了相容既有 inline style 的妥協，能改用 nonce 就改
                styleSrc: ["'self'", "'unsafe-inline'"],

                // 禁止 Flash 等物件
                objectSrc: ["'none'"],

                // 自動將 HTTP 升級為 HTTPS
                upgradeInsecureRequests: [],
            },
        },
    }),
);
```

---

#### Prompt Injection（AI 提示詞注入）

隨著 LLM 應用普及而出現，攻擊者透過隱藏式或引導式的語句問答，來讓 AI agent 回答機密資料，或聽從惡意指令。

> 說明防範之前，要先接受一個事實

雖然我們可以在系統提示詞裡加入最高原則的規範來限制模型，但**寫在提示詞裡的規則是有機會被繞過的**。例如讓模型改用 base64、拆字、換一種語言講，規範可能就會失效了。

所以真正的邊界要放在**工具層（tool）**，也就是 agent 實際去執行動作的那層程式碼。agent 能呼叫的每個 tool，本身就帶著使用者身分去查（回到第 1 章的`WHERE user_id = $1`），這樣就算模型被說服要撈別人的訂單，工具層也撈不到。

其次是縮小範圍：查訂單的 tool 就只回訂單欄位，不要順手把使用者資料一起帶出來。上線初期先只開放讀取，等多次測試、版本穩定後，再逐步放寬到寫入。

---

## 6. Insecure Design（不安全設計）

### 這個問題怎麼發生

不安全設計強調的是「設計階段的缺陷」，與「實作層面的 Bug」不同，這意味著程式碼寫得再完美，如果從業務邏輯或架構設計上就出錯，依然會被攻擊者利用。

舉個例子來說明：

> 設計註冊的 API `/register`

腦內模型通常是**一個真人填表單**。這個模型下，回饋清楚的錯誤訊息（例如已註冊過的會回應「此信箱已被註冊」），或是註冊後會插入的初始值、範例資料、甚至背後觸發各種外部動作（發信、建立雲端資源、呼叫第三方 API）等，這些都是為了改善使用者體驗。

但這個設計**沒有身分、沒有前情提要**，任何人都能打。一旦把「一個真人」的假設換成「一支迴圈」，這兩個為了體驗設計的行為就變成**攻擊面**。

「此信箱已被註冊」這個提示會告訴攻擊者此信箱是存在的，可以嘗試登入破解；註冊後所做的初始行為，在海量的假身分註冊中會造成拖慢處理效率、增加資料庫負擔，甚至導致系統崩潰。

### 在 Node.js 裡我會怎麼防

1. 在`/register`裝上`express-rate-limit`（限制同一來源在一段時間內能打幾次），鍵值用 IP 來篩選。這能擋掉攻擊者「隨手寫個 for 迴圈打」的低成本濫用。

```ts
import rateLimit from 'express-rate-limit';

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 5, // 每 IP 限制 5 次嘗試
    message: {
        status: 429,
        message: '重複註冊次數過多，請 15 分鐘後再試',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 如果前面隔了一層 proxy（如 Nginx），要這樣設定才拿得到真實來源 IP
app.set('trust proxy', 1);

// 套用至註冊路由
app.post('/register', registerLimiter, registerController);
```

`express-rate-limit`預設把計數存在記憶體裡，只在**單一 process** 內有效；如果用 PM2 cluster 或多台機器橫向擴充，每個 instance 各算各的，額度等於直接乘倍，要接 Redis store 才會是全域共用的額度。

1. 考慮削弱體驗最佳化的部分，把「此信箱已被註冊」改成「已寄送確認信到該信箱」，但後端仍然可以判斷信箱是否存在，這種操作可以同時應用在**註冊、登入、忘記密碼**等邏輯。
2. 註冊後的預設操作，可以移到「第一次登入」時才觸發，減少註冊當下要處理的工作。

---

## 7. Authentication Failures（身分驗證失效）

### 這個問題怎麼發生

1. **未提供或未強制執行 MFA（多因子驗證）**：系統僅依賴「帳號/密碼」作為唯一身分識別手段。一旦密碼因 Credential Stuffing（憑證填充，拿其他網站外洩的帳密整包來試登入）、釣魚或社交工程攻擊洩漏，攻擊者便能直接登入。

2. **Session / Token 管理缺陷**：使用者登入後 Session ID 未重新產生，或是 JWT 簽署密鑰過弱、未驗證過期時間（`exp`），甚至將敏感資料直接曝露在 Token Payload 中（JWT 的內容只是編碼、不是加密，任何人都解得開來看）。

3. **不安全的資料儲存**：後端採用明碼或弱雜湊（如`MD5`、`SHA1`）儲存密碼。

4. **密碼設置流程過於簡單**：沒有做弱密碼掃描、密碼長度不夠長，以及重置密碼時僅要求輸入像是「國小名稱」這種 Low Entropy（低熵，指可能的答案很少、容易被猜中）且容易被社交工程問出來的資訊。

### 在 Node.js 裡我會怎麼防

首先針對**憑證填充攻擊**與**暴力破解**，使用`otplib`與`qrcode`處理 TOTP（以目前時間產生、每 30 秒換一次的一次性密碼，如 Google Authenticator）的 Secret 產生與驗證，加入到需要驗證身分的地方。

```ts
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

// 為使用者產生 TOTP Secret 並輸出 QRCode
export async function generateMfaSecret(userEmail: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(userEmail, 'appName', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // 將 secret 加密後存入使用者資料庫（例如 user.mfaSecret），預設 user.mfaEnabled 為 false
    return { secret, qrCodeUrl };
}

// 驗證使用者輸入的 6 位數一次性密碼
export function verifyMfaToken(userSecret: string, token: string): boolean {
    try {
        return authenticator.verify({ token, secret: userSecret });
    } catch (error) {
        return false;
    }
}
```

啟用 MFA 時要注意三件事：

1. 產生 Secret 後不能直接把`mfaEnabled`設成`true`，要先讓使用者輸入一次 App 產生的 6 位數驗證成功，才代表真的掃到 QR Code，不然使用者掃錯或沒掃到，之後永遠登不進去。
2. 驗證端點本身要限流——6 位數只有 100 萬種組合，沒有限流的話 MFA 等於沒設。
3. 提供一組一次性的 **Recovery Codes（備用碼）**，手機遺失或 App 資料遺失時還有路可以救回帳號。

---

登入路由同樣要套上第 6 章的`rateLimit`擋暴力破解。差別是登入還要多防一件事：攻擊者換一堆代理 IP 輪流打，每個 IP 都沒超過額度，但同一個帳號已經被試了幾千次。所以除了 IP，最好**同時對「帳號」也設一把鎖**。

```ts
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    // 改用「IP + 帳號」當計數的鍵值，換 IP 也繞不過同一個帳號的額度
    keyGenerator: (req) => `${req.ip}:${req.body.email ?? ''}`,
    message: {
        status: 429,
        message: '登入嘗試次數過多，請 15 分鐘後再試',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/v1/auth/login', loginLimiter, handleLogin);
```

---

在發放 Token 時需設定合理的過期時間，並透過 HttpOnly Cookie 帶給前端，防止 XSS 竊取 Session。若採用 JWT（無狀態），Session Fixation 則不適用；若仍用傳統 Session，登入後要呼叫`req.session.regenerate()`來換發新 ID。

```ts
export function sendAuthToken(res: Response, userId: string) {
    // 簽發 JWT 並使用強密鑰與過期時間
    const token = jwt.sign(
        { userId },
        process.env.JWT_SECRET!, // 確保 Secret 為高強度亂數
        { expiresIn: '15m', algorithm: 'HS256' },
    );

    // 寫入安全的 HttpOnly Cookie
    res.cookie('token', token, {
        httpOnly: true, // 防止 JS 讀取（防 XSS 竊取）
        secure: process.env.NODE_ENV === 'production', // 僅限 HTTPS
        sameSite: 'strict', // 只有從本站發出的請求才會帶上這個 Cookie
        maxAge: 15 * 60 * 1000,
    });
}
```

---

#### CSRF（跨站請求偽造）防護

CSRF 指的是：使用者已經登入你的網站，攻擊者誘導他去點別的頁面，那個頁面偷偷對你的 API 發請求，瀏覽器就會自動把使用者的 Cookie 一起帶上去——伺服器看起來完全像是本人操作的。

上面的`sameSite: 'strict'`只是縱深防禦的一層，不是完整解法：`lax`擋得住跨站的 POST，但擋不住「跨站導覽的 GET」，如果系統裡有任何 GET 端點會改資料（不應該有，但常常有），一樣會中；而`strict`／`lax`都綁在瀏覽器的支援與同站定義上，子網域被攻陷一樣繞得過去。

會改狀態的端點（POST/PUT/DELETE）最保險是搭配 **CSRF Token**：伺服器發一組隨機值給前端，前端要在後續請求的 Header 或 Body 帶回來，跟 Cookie 裡的值比對。因為攻擊者的網頁讀不到你網站的 Cookie，也就湊不出這組值。

```ts
import crypto from 'crypto';

app.get('/api/csrf-token', authMiddleware, (req, res) => {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', csrfToken, { httpOnly: false, sameSite: 'strict', secure: true });
    res.json({ csrfToken });
});

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
    const cookieToken = req.cookies.csrf_token;
    const headerToken = req.get('x-csrf-token');

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ status: false, message: 'CSRF 驗證失敗' });
    }
    next();
}
```

如果認證改用 Authorization Header 帶 JWT（而不是 Cookie），CSRF 天生就不成立——瀏覽器不會自動夾帶自訂 Header，但代價是要自己處理 Token 被 XSS 偷走的風險（通常存在`localStorage`，沒有`HttpOnly`保護）。這是兩種方案的取捨，不是其中一個絕對安全。

---

**資料庫絕對不要明碼儲存密碼**，要採用`argon2id`或`bcrypt`等加鹽雜湊（在密碼裡混入一段隨機值再雜湊，讓相同密碼的兩個人存出來也不一樣），並在登入時驗證比對。密碼不一定要提高複雜度，但要避免使用像是`Password123`的弱密碼，長度建議 12 碼以上，可以使用`zod`來驗證。

參數沿用第 4 章定義好的`hashOption`就好，不用每個檔案各寫一份：

```ts
import { hashOption } from './crypto-config';

// 註冊時：加密儲存
export async function hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, hashOption);
}

// 登入時：安全比對
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
    return await argon2.verify(hash, password);
}
```

最後避開安全提問的低熵，改採「密碼連結以信件寄送」來重設密碼，連結附的 token 需**一次性使用、短期過期、高熵隨機產生**。

---

#### Token 過期後怎麼辦

15 分鐘的短效 JWT 過期後，總不能讓使用者每 15 分鐘重登入一次，常見做法是搭配一組長效的 **Refresh Token**（存資料庫或 Redis，可主動撤銷），前端用它換發新的 Access Token。撤銷的時機至少要覆蓋：登出、改密碼、偵測到異常登入。

因為 JWT 是無狀態的——伺服器不會記著它、只驗簽章——所以單靠它自己沒辦法「提早失效」，能撤銷的必須是資料庫裡有紀錄的 Refresh Token。

---

## 8. Software or Data Integrity Failures（軟體或資料完整性失效）

### 這個問題怎麼發生

第 3 章顧的是「引進來的套件乾不乾淨」，這章則是「從程式碼變成上線服務的這段路，有沒有被人動手腳」。

- **不安全的軟體供應鏈**：Node.js 生態系中使用大量來自`npm`下載的套件，可能有植入後門程式或惡意程式碼，混入專案環境裡被執行。
- **Prototype Pollution（原型鏈污染）**：JS 的物件都會共用一份「祖先範本」（`Object.prototype`）。當不可信的 JSON（例如前端傳入的物件）被直接 merge 進既有物件，且鍵名未過濾`__proto__` / `constructor.prototype`時，攻擊者就能改到那份範本，讓全站所有物件都跟著被污染；另外像`node-serialize`這類套件會把字串還原成可執行函式，等同變相`eval`。
- **CI/CD Pipeline 與更新機制安全缺陷**：部署流程缺乏原始碼簽章驗證、套件鎖定機制，或是更新發布管道未經加密與雜湊校驗，導致建置過程被中途竄改、資料竊取等。

### 在 Node.js 裡我會怎麼防

要確保軟體供應鏈的安全，安裝套件一律用`npm ci`而非`npm install`，強制依照`package-lock.json`裡鎖定的版本與 hash 安裝，避免被暗中置換成惡意版本；並搭配第 3 章的`npm audit`與 Dependabot 一起跑。

```json
// package.json
{
    "scripts": {
        "ci": "npm ci --ignore-scripts && npm audit --audit-level=high"
    }
}
```

`--ignore-scripts`則是關掉「套件安裝時自動執行腳本」的能力（`postinstall`）。這是惡意套件最愛用的入口——你只是安裝它，還沒有 import，程式碼就已經在你的機器上跑過一輪了。

---

針對 Prototype Pollution，收到外部 JSON 後避免用會遞迴合併的函式（舊版`lodash.merge` /`_.defaultsDeep`）直接套用在信任物件上；資料結構一律用`zod`驗證過再使用，不要把整包物件原封不動塞進系統。

```ts
import { z } from 'zod';

const UserInputSchema = z.object({
    name: z.string(),
    age: z.number(),
}); // zod 預設就會忽略 schema 之外的欄位（含 __proto__），不需額外處理

export function parseUserInput(raw: unknown) {
    return UserInputSchema.parse(raw);
}
```

Node 啟動時還可以加上`--disable-proto=delete`，直接移除`__proto__`這個常見攻擊入口，搭配內部資料結構改用`Map`或`Object.create(null)`（建立一個沒有祖先範本的乾淨物件）。這比全域`Object.freeze(Object.prototype)`更不容易破壞既有套件。

```bash
# 加入至啟動指令，縮小 __proto__ 這個常見攻擊面
node --disable-proto=delete dist/server.js
```

在 CI/CD 與發布管道，建置產物要有完整性校驗（例如發布時附上 SHA-256 checksum 或用 Sigstore / cosign 簽章，讓下載的人可以驗證檔案沒被掉包），Pipeline 的 Secret 與部署權限採最小權限原則，避免第三方 Action / Plugin 有過大的寫入權限。

---

## 9. Security Logging and Alerting Failures（安全日誌與警示失效）

### 這個問題怎麼發生

這類失效發生在系統無法記錄關鍵的安全事件、日誌品質太差難以查證，或是就算寫了 Log 也沒人會在第一時間發現異常。

這種失效不會直接讓系統被入侵，但會讓攻擊者**進來之後沒人知道**。業界資安報告常提到，攻擊者入侵後平均可以潛伏數個月才被發現，核心原因通常是：

- **未記錄關鍵安全事件**：登入失敗、權限變更、密碼重置、高風險 API（如批次匯出資料）完全沒留 Log。
- **日誌品質差、沒集中管理**：Log 只印在單一機器上、格式是純文字而非結構化 JSON，缺乏`traceId` /`userId` /`ip`這些可追蹤欄位；也沒同步到中心化系統（如 ELK、Datadog），一旦這台機器被攻陷或重啟，證據就跟著消失。
- **沒有異常監測與即時告警**：Log 寫了但沒設規則，例如 1 分鐘內出現 500 次登入失敗，維運團隊完全不會收到通知。
- **Log 本身洩漏敏感資料**：直接把明碼密碼、信用卡號、JWT Token 印進 Log，讓 Log 系統本身變成新的資安破口。

### 在 Node.js 裡我會怎麼防

#### 用 Pino 輸出結構化 JSON，並帶入 traceId

前面幾章零星用到的`logger`，就是在這裡設定的。不要用`console.log`，改用效能較好的`pino`輸出 JSON 格式（機器讀得懂，才能丟給後面的分析系統查詢），並透過`AsyncLocalStorage`讓同一個請求不管經過多少層非同步呼叫，都能拿到同一個`traceId`（這次請求的專屬編號），方便事後把散落各處的 Log 串起來看完整流程。

```ts
import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';

export const asyncLocalStorage = new AsyncLocalStorage<{ traceId: string; userId?: string }>();

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
});

// 每個請求進來時開一個新的 context，後面不管經過多少層 async 呼叫都拿得到同一個 traceId
// 掛在全域最上層（app.use(traceIdMiddleware)），userId 要等 authMiddleware 跑完才有值
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
    asyncLocalStorage.run({ traceId: crypto.randomUUID(), userId: req.user?.id }, next);
}

// 記錄安全事件的專用 helper
export function logSecurityEvent(event: string, details: Record<string, unknown>) {
    const store = asyncLocalStorage.getStore();

    logger.warn(
        {
            category: 'SECURITY',
            event,
            traceId: store?.traceId ?? 'N/A',
            userId: store?.userId ?? 'anonymous',
            ...details,
        },
        `[SECURITY EVENT] ${event}`,
    );
}
```

---

#### Middleware 自動遮蔽敏感欄位

密碼、Token、信用卡號這類欄位絕對不能原封不動印進 Log，寫入前先用黑名單做遮蔽：

```ts
import type { NextFunction, Request, Response } from 'express';

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'creditcard', 'secret']);

function sanitize(obj: unknown, seen = new WeakSet()): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return '[CIRCULAR]'; // 物件互相參照時，避免無限遞迴下去
    seen.add(obj);

    if (Array.isArray(obj)) return obj.map((item) => sanitize(item, seen));

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(value, seen);
    }
    return result;
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
    logger.info(
        {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            body: sanitize(req.body),
        },
        'Incoming Request',
    );

    next();
}
```

黑名單式遮蔽的風險是「漏加欄位」——之後新增`apiKey`、`refreshToken`忘記補進`SENSITIVE_KEYS`就會原樣印進 Log。更穩妥的做法是搭配 pino 內建的`redact`選項，用路徑（如`req.headers.authorization`）指定要遮蔽的位置，而不是全靠自己維護一份清單。

---

#### 集中傳輸 Log 並設定即時告警

前面只解決了「Log 寫得乾不乾淨」，但 Log 若只留在本機，攻擊者入侵後照樣能刪掉滅證。實務上會用`pino-transport`（或旁掛 Fluent Bit / Vector 之類的 agent）把 Log 即時傳到中心化系統（ELK、Datadog、S3 等），確保單機被攻陷也留有備份。

在關鍵驗證失敗點上，也要主動計數並觸發告警，而不是被動等人翻 Log：

```ts
// isHighRiskIp、sendSecurityAlertToSlack 為示意用的自訂函式
export async function handleLoginFailure(req: Request, email: string, reason: string) {
    logSecurityEvent('AUTH_LOGIN_FAILED', {
        email,
        reason,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    // 短時間內同一 IP 失敗次數暴增時，推播到 Slack / PagerDuty
    if (await isHighRiskIp(req.ip)) {
        await sendSecurityAlertToSlack({
            title: '🚨 高風險登入異常告警',
            message: `IP: ${req.ip} 短時間內多次登入失敗`,
        });
    }
}
```

---

## 10. Mishandling of Exceptional Conditions（例外狀況處理不當）

### 這個問題怎麼發生

這問題常發生在系統面對非預期錯誤、異常輸入或程式崩潰時沒有妥善捕捉與控制。原因有：

- **錯誤資訊過度揭露**：API 發生未捕捉的例外時，直接把完整的 Stack Trace、SQL 語法、內部檔案路徑回傳給前端，等於幫攻擊者畫出系統架構圖。
- **未處理的非同步錯誤讓程式崩潰**：Node.js 是非同步環境，`Promise`被 reject 或事件監聽器裡拋出的錯誤如果沒被捕捉，會讓整個 process 無預警死掉，變成一種 DoS（阻斷服務，讓正常使用者也用不了）。
- **靜默吞掉錯誤**：用空的`catch (e) {}`把錯誤吃掉，系統進入不一致的狀態（例如扣款成功但訂單沒建立），且完全沒留紀錄可查。

### 在 Node.js 裡我會怎麼防

#### 統一的 Express 錯誤處理 Middleware

自訂一個「預期內的業務錯誤」型別，讓 Middleware 能分辨這是可預期的錯誤（該回什麼訊息給使用者）還是不可預期的例外（生產環境一律不能洩漏細節）。

```ts
export class AppError extends Error {
    constructor(
        public statusCode: number,
        message: string,
    ) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
    }
}

export function globalErrorHandler(err: Error | AppError, req: Request, res: Response, _next: NextFunction) {
    const isProduction = process.env.NODE_ENV === 'production';
    const statusCode = err instanceof AppError ? err.statusCode : 500;

    logger.error({ err, url: req.originalUrl, method: req.method, ip: req.ip }, `[Unhandled Error] ${err.message}`);

    res.status(statusCode).json({
        status: 'error',
        // AppError 是我們自己丟出的，訊息可以放心給使用者看；其他未預期的錯誤一律用罐頭訊息，避免洩漏內部細節
        message: err instanceof AppError || !isProduction ? err.message : '系統發生內部錯誤，請稍後再試',
    });
}
```

---

#### Process 層級攔截未捕捉例外

`uncaughtException` /`unhandledRejection`觸發代表 process 已經進入不可預期的狀態，記錄後盡快重啟。

```ts
function gracefulShutdown(code: number) {
    // 停止接收新請求；等現有連線處理完後才真正 exit
    server.close((err) => {
        if (err) {
            logger.error({ err }, 'Error occurred during server close');
        }
        process.exit(code);
    });

    // 安全網：避免某些連線（例如 keep-alive）遲遲不結束，導致 server.close() 的 callback 永遠不觸發
    // 逾時後強制退出，交給 PM2 / Kubernetes 之類的流程管理工具負責重啟
    setTimeout(() => {
        logger.warn('Forcing shutdown after timeout, some connections may not have closed gracefully');
        process.exit(code);
    }, 10_000).unref();
}

process.on('unhandledRejection', (reason: Error) => {
    logger.fatal({ err: reason }, 'Unhandled Promise Rejection detected!');
    gracefulShutdown(1);
});

process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught Exception detected! Shutting down...');
    gracefulShutdown(1);
});
```

---

#### 非同步路由不漏接錯誤

在 Express 5，路由裡`async`函式拋出的錯誤會自動被接住並轉交給上面的`globalErrorHandler`。

如果環境是 Express 4，這些錯誤不會自動被 Express 接住，需要包一層 wrapper 才會轉交：

```ts
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
};

app.post(
    '/api/v1/payment',
    catchAsync(async (req, res) => {
        const result = await processPayment(req.body);

        if (!result.success) {
            throw new AppError(400, '交易失敗：付款卡號無效');
        }

        res.status(200).json({ status: 'success', data: result });
    }),
);
```
