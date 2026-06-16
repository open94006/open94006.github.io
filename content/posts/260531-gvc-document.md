---
date: '2026-05-31T15:07:36+08:00'
title: 'GVC 前端框架生命週期與 MVVM 實作指南'
description:
author: Daniel Lin
summary:
draft: 0
categories: ['程式設計']
tags: ['GVC']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true
---

## 1. 簡介 (Introduction)

GlitterTS 底層的 GVC (Glitter View Controller) 是一個基於 TypeScript 的微型 MVVM 框架。它主要透過自定義的虛擬綁定機制 (Virtual Binding) 與生命週期回呼 (Lifecycle Callbacks) 來落實 Model-View-ViewModel 模式。透過 `gvc.bindView` 宣告畫面結構，並透過唯一的 ID 來進行局部的 DOM 渲染與刷新，實現資料與視圖的同步而無需全網頁重載。

## 2. 畫面與元件宣告 (`gvc.bindView`)

在 GVC 中，我們透過 `gvc.bindView(map)` 來建立視圖元件。`bindView` 執行時會立刻回傳一段標準的 HTML 佔位字串（例如 `<div glem="bindView" gvc-id="{unique_id}"></div>`）。
當 Glitter 核心掃描到 DOM 中的這個佔位標籤時，便會透過內部的 `renderBindView()` 去執行 `view()` 方法產生真實的 DOM 結構，並依序觸發生命週期。

### 宣告範例

```typescript
const myView = gvc.bindView({
    bind: 'my-unique-view-id', // 元件唯一識別 ID
    view: () => {
        return `<div>Hello GVC!</div>`;
    },
});
```

## 3. 生命週期 (Lifecycle Hooks Explained)

`gvc.bindView` 內可以掛載三個主要的生命週期方法，讓開發者在 DOM 的不同狀態下執行特定邏輯：

- **`onInitial()`**: **元件初始化**
  僅會在元件**第一次**被掛載到真實 DOM 時觸發一次。適合用來做一些一次性的資料抓取、元件級別的全域變數設定或是網路請求。
- **`onCreate()`**: **元件渲染完成 / 重畫完成**
  當元件第一次被掛載完成，或是後續因資料變動導致 **局部重繪 (Re-render)** 結束後，都會被觸發。非常適合在這裡進行 DOM 的事件綁定 (例如 jQuery 的 `.on('click')`)。**注意：因為每次重繪 DOM 節點都會被替換更新，舊的事件傾聽會遺失，所以一定要在 `onCreate` 中重新綁定事件。**

- **`onDestroy()`**: **元件消除**
  當該綁定元件所在的 DOM 節點被移除或銷毀時觸發。適合用來清除計時器 (Timer/Interval)、Websocket 斷線、或是針對外部插件清除事件監聽等，以避免 Memory Leak 的殘留狀態。

## 4. 畫面重繪與更新機制

MVVM 的核心在於資料驅動畫面更新，GVC 提供手動與自動兩種方式來進行局部重繪：

### 方式一：手動觸發 (`gvc.notifyDataChange`)

這是最常用且直觀的做法。當 ViewModel 中的資料 (State) 發生改變時，開發者可以主動呼叫 `gvc.notifyDataChange('綁定的ID')`。
底層核心會尋找該 ID 所在的 DOM 位置，重新執行對應的 `view()` 取得新的 HTML 畫面蓋過舊畫面，接著再次觸發 `onCreate()`。

```typescript
let count = 0;
// 假設按鈕被點擊，更新資料並通知特定區塊的 View 重繪
count++;
gvc.notifyDataChange('my-counter-view');
```

### 方式二：自動觀測響應 (`dataList`)

透過在 `bindView` 內傳入 `dataList`，GVC 會針對傳入物件屬性的 Getter/Setter 進行劫持與觀測 (Observer)。當指派新值時，框架會自動觸發重繪，開發者不用自己手動去呼叫 `notifyDataChange`。

```typescript
const viewModel = { text: 'Hello' };
gvc.bindView({
    bind: 'my-text-view',
    view: () => `<div>${viewModel.text}</div>`,
    dataList: [{ obj: viewModel, key: 'text' }],
});
// 當我們在別處執行 viewModel.text = 'World' 時，畫面 'my-text-view' 會自動更新重繪
```

## 5. 完整實作範例 (Complete Code Example)

以下是一個完整的「計數器」元件範例，展示了狀態宣告、生命週期 Hooks 以及資料更新區塊重繪機制的結合應用：

```typescript
export class CounterComponent {
    public static render(gvc: any) {
        // ViewModel Data
        let count = 0;

        // 隨機產生一個唯一的 bind ID，確保在同一頁面多次使用元件不會發生 ID 衝突
        const bindId = gvc.glitter.getUUID();

        return gvc.bindView({
            bind: bindId,
            view: () => {
                // Return 回傳畫面模板
                return `
                    <div class="counter-container">
                        <h3>目前的計數：${count}</h3>
                        <button class="add-btn">+1</button>
                    </div>
                `;
            },
            onInitial: () => {
                console.log(`[${bindId}] 第一次進入畫面，執行一次性初始化！`);
            },
            onCreate: () => {
                console.log(`[${bindId}] 畫面渲染完成，綁定點擊事件！`);

                // 【重要】每次 view 重繪後，DOM 都會產生新的 button，因此需要在 onCreate 重新綁定事件
                const container = gvc.getBindViewElem(bindId); // 取出 DOM 元件

                container
                    .find('.add-btn')
                    .off('click')
                    .on('click', () => {
                        count++; // 1. 更新資料
                        gvc.notifyDataChange(bindId); // 2. 通知該區塊的綁定 View 進行局部重繪
                    });
            },
            onDestroy: () => {
                console.log(`[${bindId}] 元件遭到移除，清除記憶體與訂閱！`);
            },
        });
    }
}
```

---

## 6. 方法補充範例

### 6-1. `gvc.event` — 行內 HTML 字串的事件綁定

`gvc.event(fn)` 的用途是把一個閉包函數封裝成可安全寫入 HTML 屬性字串的 ID，
讓 `onclick`、`onchange`、`oninput` 等屬性在字串模板裡也能正確運作並保有 Closure 的變數存取。

```typescript
// 使用情境一：onclick
view: () => {
    return `
    <button onclick="${gvc.event(() => {
        console.log('按鈕被點擊');
        gvc.notifyDataChange(bindId);
    })}">送出</button>
  `;
};

// 使用情境二：onchange (input 輸入框)
view: () => {
    return `
    <input
      type="text"
      value="${vm.keyword}"
      onchange="${gvc.event((e) => {
          vm.keyword = e.target.value; // 取得 input 的值並存入 ViewModel
          gvc.notifyDataChange(bindId);
      })}"
    />
  `;
};

// 使用情境三：動態列表按鈕 (each item 有自己的 onclick)
view: () => {
    const items = ['蘋果', '香蕉', '芒果'];
    return `
    <ul>
      ${items
          .map(
              (item, index) => `
        <li>
          ${item}
          <button onclick="${gvc.event(() => {
              items.splice(index, 1); // 刪除該筆資料
              gvc.notifyDataChange(bindId);
          })}">刪除</button>
        </li>
      `,
          )
          .join('')}
    </ul>
  `;
};
```

---

### 6-2. `gvc.glitter.share` — 跨元件全域狀態共享

`glitter.share` 是一個全域普通物件，可以在任意元件或檔案之間讀寫資料或方法，
無需 import，最常見的用法是把「重繪觸發函數」存在 share 裡以供其他地方呼叫。

```typescript
// ── 父元件 (parent-panel.ts) ──
export class ParentPanel {
    public static render(gvc: any) {
        const vm = { list: [] as string[] };
        const listBindId = gvc.glitter.getUUID();

        return gvc.bindView({
            bind: listBindId,
            view: () => `
        <div>
          <ul>
            ${vm.list.map((item) => `<li>${item}</li>`).join('')}
          </ul>
          ${ChildForm.render(gvc)} <!-- 巢狀子元件 -->
        </div>
      `,
            onInitial: () => {
                // 把「重繪自己的函數」掛到 share，讓子元件可以呼叫
                gvc.glitter.share.refreshParentList = (newItem: string) => {
                    vm.list.push(newItem);
                    gvc.notifyDataChange(listBindId); // 觸發父元件的列表區塊重繪
                };
            },
        });
    }
}

// ── 子元件 (child-form.ts) ──
export class ChildForm {
    public static render(gvc: any) {
        const vm = { inputVal: '' };
        const bindId = gvc.glitter.getUUID();

        return gvc.bindView({
            bind: bindId,
            view: () => `
        <div>
          <input class="item-input" type="text" value="${vm.inputVal}" placeholder="輸入新項目" />
          <button class="submit-btn">新增</button>
        </div>
      `,
            onCreate: () => {
                const el = gvc.getBindViewElem(bindId);

                el.find('.item-input')
                    .off('input')
                    .on('input', (e: any) => {
                        vm.inputVal = e.target.value;
                    });

                el.find('.submit-btn')
                    .off('click')
                    .on('click', () => {
                        if (!vm.inputVal.trim()) return;
                        // 呼叫父元件掛在 share 上的函數，把新項目傳回去
                        gvc.glitter.share.refreshParentList?.(vm.inputVal);
                        vm.inputVal = '';
                        gvc.notifyDataChange(bindId); // 清空輸入框
                    });
            },
        });
    }
}
```

---

### 6-3. `gvc.glitter.innerDialog` — 彈跳視窗 (Modal)

`innerDialog` 用來在畫面上層疊加一個浮動視窗，第二個參數為 Dialog 的唯一名稱，
可以在任意地方透過 `gvc.glitter.closeDiaLog(name)` 關閉它。

```typescript
// 開啟 Dialog：例如點擊「編輯」按鈕後呼叫
function openEditDialog(gvc: any, item: { id: string; name: string }) {
    gvc.glitter.innerDialog((dialogGvc: any) => {
        const vm = { name: item.name }; // 複製一份資料供編輯用
        const bindId = dialogGvc.glitter.getUUID();

        return dialogGvc.bindView({
            bind: bindId,
            view: () => `
        <div style="padding:24px; min-width:320px;">
          <h4>編輯名稱</h4>
          <input class="name-input" type="text" value="${vm.name}" />
          <div style="margin-top:16px; display:flex; gap:8px;">
            <button class="cancel-btn">取消</button>
            <button class="confirm-btn">確認儲存</button>
          </div>
        </div>
      `,
            onCreate: () => {
                const el = dialogGvc.getBindViewElem(bindId);

                el.find('.name-input')
                    .off('input')
                    .on('input', (e: any) => {
                        vm.name = e.target.value;
                    });

                el.find('.cancel-btn')
                    .off('click')
                    .on('click', () => {
                        // 直接關閉，不儲存
                        gvc.glitter.closeDiaLog('edit-dialog');
                    });

                el.find('.confirm-btn')
                    .off('click')
                    .on('click', async () => {
                        // 呼叫 API 儲存
                        await fetch(`/api/items/${item.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ name: vm.name }),
                        });
                        gvc.glitter.closeDiaLog('edit-dialog');
                        // 通知外部列表重繪（若有掛在 share）
                        gvc.glitter.share.refreshList?.();
                    });
            },
        });
    }, 'edit-dialog'); // Dialog 的唯一名稱
}
```

---

### 6-4. `gvc.glitter.getUUID` — 避免 ID 衝突的元件實例化

當同一個元件在頁面中被產生多次（例如商品列表的每個 Card），若 `bind` ID 寫死，
多個相同 ID 會彼此干擾。正確做法是在元件最頂層生成 UUID 後傳入所有需要 ID 的地方。

```typescript
// ❌ 錯誤做法：bind ID 寫死，多個 card 時只有第一個會正常運作
function ProductCard(gvc: any, product: any) {
    return gvc.bindView({
        bind: 'product-card', // 所有 card 共用同一個 ID，發生衝突！
        view: () => `<div>${product.name}</div>`,
    });
}

// ✅ 正確做法：每個元件實例各自產生唯一 ID
function ProductCard(gvc: any, product: any) {
    const cardId = gvc.glitter.getUUID(); // 外層 bindView 的 ID
    const btnId = gvc.glitter.getUUID(); // 若有需要直接操作 button 的 ID

    return gvc.bindView({
        bind: cardId,
        view: () => `
      <div class="product-card">
        <p>${product.name}</p>
        <p>NT$ ${product.price}</p>
        <button id="${btnId}" class="add-cart-btn">加入購物車</button>
      </div>
    `,
        onCreate: () => {
            gvc.getBindViewElem(cardId)
                .find('.add-cart-btn')
                .off('click')
                .on('click', () => {
                    console.log(`加入購物車：${product.name}`);
                    gvc.glitter.share.addToCart?.(product);
                });
        },
    });
}

// 使用：在父元件的 view() 中使用 map 產生多個 card
view: () => `
  <div class="product-list">
    ${productList.map((product) => ProductCard(gvc, product)).join('')}
  </div>
`;
```

---

### 6-5. `gvc.addStyle` — 動態注入 CSS

`addStyle` 可以在執行階段把 CSS 樣式字串注入到 `<head>` 裡，
通常放在 `onInitial` 中確保只注入一次，避免重複插入造成樣式堆疊。

```typescript
gvc.bindView({
    bind: gvc.glitter.getUUID(),
    view: () => `
    <div class="toast-message show">操作成功！</div>
  `,
    onInitial: () => {
        // 注入元件所需的 CSS，只執行一次
        gvc.addStyle(`
      .toast-message {
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        background: #333;
        color: #fff;
        border-radius: 8px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .toast-message.show {
        opacity: 1;
      }
    `);
    },
});
```

---

### 6-6. 巢狀 `bindView` — 拆分大型畫面區塊

當一個頁面包含多個獨立的可更新區塊時，建議利用巢狀 `bindView` 把它們拆開，
讓每個區塊各自維護自己的 ID，`notifyDataChange` 時只刷新真正需要更新的部分。

```typescript
export class OrderPage {
    public static render(gvc: any) {
        const vm = {
            orderList: [] as any[],
            summaryTotal: 0,
            loading: true,
        };

        // 為每個區塊分配獨立 ID
        const ids = {
            page: gvc.glitter.getUUID(), // 最外層容器
            list: gvc.glitter.getUUID(), // 訂單列表區塊
            summary: gvc.glitter.getUUID(), // 合計摘要區塊
        };

        return gvc.bindView({
            bind: ids.page,
            view: () => `
        <div class="order-page">
          <!-- 訂單列表區塊 (獨立可刷新) -->
          ${gvc.bindView({
              bind: ids.list,
              view: () => (vm.loading ? `<p>載入中...</p>` : vm.orderList.map((o) => `<div class="order-item">${o.name} x${o.qty}</div>`).join('')),
          })}

          <!-- 合計摘要區塊 (獨立可刷新) -->
          ${gvc.bindView({
              bind: ids.summary,
              view: () => `
              <div class="summary">
                <strong>合計：NT$ ${vm.summaryTotal}</strong>
              </div>
            `,
          })}
        </div>
      `,
            onInitial: async () => {
                // 呼叫 API 取得訂單資料
                const res = await fetch('/api/orders');
                const data = await res.json();
                vm.orderList = data.list;
                vm.summaryTotal = data.total;
                vm.loading = false;

                // 只刷新列表和摘要，不重繪整個 page
                gvc.notifyDataChange([ids.list, ids.summary]);
            },
        });
    }
}
```
