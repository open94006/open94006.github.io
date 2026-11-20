---
date: '2026-11-20T11:56:30+08:00'
title: '261120 Daily Note'
description:
author: Daniel Lin
summary:
draft: 0
categories: []
tags: ['DailyNote', 'React', 'TypeScript', 'Fetch API', 'AbortController', 'XSS', 'Web 安全']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

## 前端的 API 呼叫集中在同一層（baseApi）

各個功能用 fetch 呼叫 API 時，參數、錯誤處理和回傳格式常常各寫各的，專案一大就很難維護。比較好的做法是在前端先包一層類似 `baseApi` 的函式，把 base URL、headers、錯誤格式、逾時和取消請求都集中處理。元件只需要關心「要什麼資料」。

設計重點：

- **用 discriminated union 定義回傳型別**：判斷 `ok` 之後，TypeScript 會自動推斷出 `data` 或 `error` 的型別，呼叫端不用再判斷 null
- **錯誤分成「代碼」和「訊息」**：`code` 給程式判斷，`message` 給使用者看，不要混在同一個欄位
- **取消請求不是錯誤**：元件卸載造成的取消不需要印出 error log
- **支援 FormData 和逾時**：上傳檔案時不能 `JSON.stringify`，也不能自己設 Content-Type

```ts
const API_BASE = '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ApiErrorCode = 'HTTP_ERROR' | 'NETWORK_ERROR' | 'ABORTED' | 'TIMEOUT';

export type ApiError = {
  code: ApiErrorCode;
  status?: number;
  message: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ApiError };

type BaseApiOptions<TBody> = {
  path: string;
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const fail = (error: ApiError): ApiResult<never> => ({ ok: false, data: null, error });

export async function baseApi<TResponse = unknown, TBody = unknown>({
  path,
  method = 'GET',
  body,
  headers,
  signal,
  timeoutMs = 10_000,
}: BaseApiOptions<TBody>): Promise<ApiResult<TResponse>> {
  // 外部取消 + 逾時取消，任一觸發就中止請求
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const finalSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const hasBody = body !== undefined && method !== 'GET';
  const isFormData = body instanceof FormData;

  const finalHeaders = new Headers(headers);
  if (hasBody && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      signal: finalSignal,
      headers: finalHeaders,
      ...(hasBody ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });

    // 204 No Content 或非 JSON 回應時，data 為 null
    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (data as { message?: string } | null)?.message ?? `請求失敗（${res.status}）`;
      return fail({ code: 'HTTP_ERROR', status: res.status, message });
    }

    return { ok: true, data: data as TResponse, error: null };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'TimeoutError') {
        return fail({ code: 'TIMEOUT', message: '請求逾時，請稍後再試' });
      }
      if (err.name === 'AbortError') {
        // 主動取消屬於正常流程，不印 log
        return fail({ code: 'ABORTED', message: '請求已取消' });
      }
    }

    console.error(err);
    return fail({ code: 'NETWORK_ERROR', message: '網路連線錯誤，請稍後再試' });
  }
}
```

呼叫端用起來像這樣，判斷完 `ok` 就能直接取用正確型別：

```ts
const result = await baseApi<User>({ path: '/users/me' });

if (result.ok) {
  console.log(result.data.name); // data 型別為 User，不會是 null
} else {
  toast.error(result.error.message);
}
```

## 防範 XSS，不只是跳脫字元

React 渲染 JSX 文字時會自動跳脫，所以 `<div>{userInput}</div>` 是安全的。不過有幾種情況不在自動保護的範圍內：

| 情境 | 風險 | 處理方式 |
| --- | --- | --- |
| `dangerouslySetInnerHTML` | 直接插入未跳脫的 HTML | 渲染前用 `DOMPurify` 淨化 |
| `href` / `src` 等 URL 屬性 | `javascript:` 協定可以執行程式碼 | 用白名單檢查協定 |
| `ref.current.innerHTML`、第三方套件 | 繞過 React 直接操作 DOM | 避免使用，或同樣先淨化 |
| Markdown 渲染套件 | 部分套件預設允許 raw HTML | 關閉 raw HTML，或搭配淨化 |

如果需求真的要存入並顯示 HTML（例如富文字編輯器），**淨化要在渲染時執行**，不能只在存入時處理一次，因為資料庫裡的資料可能來自其他管道：

```tsx
import DOMPurify from 'dompurify';

function ArticleContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}
```

URL 屬性則用白名單檢查協定，React 對 `javascript:` URL 的處理會依版本不同，不要依賴框架：

```ts
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function safeUrl(input: string): string {
  try {
    const url = new URL(input, window.location.origin);
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

// <a href={safeUrl(user.website)}>個人網站</a>
```

前端的防護只是其中一層。後端同樣要驗證和淨化輸入，再搭配 Content Security Policy（CSP）限制可執行的腳本來源，才算完整的縱深防禦。

## 用 AbortController 避免競態問題

發送 API 請求時加上 `AbortController`，主要解決的是**競態條件（race condition）**。例如使用者快速切換搜尋關鍵字，舊請求比新請求晚回來，就會把畫面蓋成舊的結果。在 cleanup 裡取消上一個請求，就能確保畫面只顯示最新的資料。

搭配前面的 `baseApi`：

```tsx
useEffect(() => {
  const controller = new AbortController();

  const fetchUsers = async () => {
    const result = await baseApi<User[]>({
      path: `/users?keyword=${encodeURIComponent(keyword)}`,
      signal: controller.signal,
    });

    if (result.ok) {
      setUsers(result.data);
    } else if (result.error.code !== 'ABORTED') {
      setError(result.error.message);
    }
  };

  fetchUsers();

  // keyword 改變或元件卸載時，取消上一個請求
  return () => controller.abort();
}, [keyword]);
```
