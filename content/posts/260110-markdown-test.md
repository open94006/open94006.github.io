---
date: '2026-01-10T10:00:00+08:00'
title: 'Markdown 語法測試與樣式預覽'
description: 測試 PaperMod 主題的 Markdown 樣式渲染效果
author: Daniel Lin
summary: 本文包含各種 Markdown 語法範例，用於測試主題樣式、行距以及目錄功能。
draft: 0
categories: ['測試用']
tags: ['Markdown', 'Test']
showToc: true
TocOpen: true
ShowReadingTime: true
ShowBreadCrumbs: true
showCodeCopyButtons: true
---

這是一篇用於測試 **Markdown** 語法顯示效果的文章。你可以透過此文檢查字體大小、行高、顏色以及目錄跳轉功能是否正常。

## 標題測試 (H2)

以下是不同層級的標題展示。

### H3 標題

#### H4 標題

##### H5 標題

###### H6 標題

---

## 文字樣式 (Text Styles)

- **粗體文字 (Bold)**
- _斜體文字 (Italic)_
- ~~刪除線 (Strikethrough)~~
- `行內程式碼 (Inline Code)`
- [連結範例 (Link to Google)](https://google.com)

> 這是一段引用文字 (Blockquote)。
>
> 這是引用的第二行。

---

## 列表 (Lists)

### 無序列表

- 項目一
- 項目二
    - 子項目 A
    - 子項目 B
- 項目三

### 有序列表

1. 第一點
2. 第二點
    1. 子步驟一
    2. 子步驟二
3. 第三點

---

## 程式碼區塊 (Code Blocks)

### JavaScript

```javascript
function helloWorld() {
    console.log('Hello, World!');
    const a = 10;
    const b = 20;
    return a + b;
}
```

### CSS

```css
.post-content {
    line-height: 1.9;
    color: #333;
}
```

### Go

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Hugo!")
}
```

---

## 表格 (Tables)

| 標題一   |  標題二  | 標題三 |
| :------- | :------: | -----: |
| 左對齊   | 置中對齊 | 右對齊 |
| 內容 A   |  內容 B  | 內容 C |
| 測試文字 |  12345   |  $99.9 |

---

## 圖片 (Images)

![測試圖片](https://www.moedict.tw/%E7%AF%84%E4%BE%8B.png?font=wt064&h=300 '這是一張佔位圖片')

---

## 其他 (Misc)

這是一段較長的文字段落，用於測試行高 (line-height) 的設定是否生效。設定適當的行高可以讓閱讀體驗更加舒適，避免文字過於擁擠。如果你看到這段文字的行距明顯比預設寬鬆，代表 CSS 設定已成功應用。

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

---

End of Test.
