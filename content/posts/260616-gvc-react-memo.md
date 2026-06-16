---
date: '2026-06-16T18:22:28+08:00'
title: '撰寫 GVC 與 React 比對後心得筆記'
description:
author: Daniel Lin
summary:
draft: 0
categories: ['心得文']
tags: ['GVC', 'React']
showToc: true # 顯示目錄區塊
TocOpen: true # 展開目錄
ShowReadingTime: true # 閱讀時間
ShowBreadCrumbs: true # 導覽路徑
showCodeCopyButtons: true # 程式碼複製
---

```text
提醒自己寫習慣了 GVC 的框架後
需要在 React 多多注意和練習的部分
```

## 1. 元件宣告與局部重繪

在 counter 之中，透過增減或重置，重繪畫面上的數字
運用到 React 最基本的方法 **useState**
目前是很單純的宣告值和呼叫方法而已，實務上應該會有更多花招和應用

## 2. 生命週期對照

兩家寫法相當不同
GVC 可以透過 onInitial, onCreate, onDestroy 來調整元素顯示週期與使用方式
甚至可以透過 **gvc.notifyDataChange** 自己去手動刷新

但 React 只要 **資料變動**，自動就會刷新，相當方便且有智慧
畫面的更動來自宣告值的改動，可以把想同步更新的方法，寫在 useEffect 內
並透過 deps 調整更新時機

由此可見在撰寫 React 上，真的是 **能用 useXXX 系列就用**
讓 React 都掛載得到你的資料，就不用太在意畫面刷新的問題

## 3. 自動響應資料 (dataList vs useState)

與第二點同理，並且更加強調「React 只要資料變動，自動就會刷新」這件事

## 4. 行內事件綁定 (gvc.event vs JSX 事件屬性)

這裡是使用表單來做 input onchange 的事件，以及送出後做一個 console.log
其中有使用新增標籤的部分，後續也要多練習透過 useState 更新資料陣列時的寫法

另外按照 React 的寫法上的建議
在 useState 定義好資料類型後，在 onchange 後先完成更新即可
送出之前，再一次性做資料驗證會比較符合流程
除非對資料敏感，或需要 onchange 後馬上提醒

## 5. 全域共用狀態 (glitter.share vs Context / Zustand)

GVC 的不必多說，說穿了和使用 window 全域變數差不多，都是跨元件共享資料機制

在 React 的部分使用了 **Zustand** 函式庫，算有點複雜
概念上是為了符合 React 對資料的追蹤處理
否則如果一樣使用全域變數、類別單例等，還是會出現維護性困難

首先是建立 ZustandCountCounter 方法，先 create 一個變數出來
後續在 tsx 的頁面上也不用特別使用 Provider，就可以使用資料方法並更新畫面
只要維持在 SPA (Single Page Application) 中 **同一個前端執行個體**，就不用擔心資料流失
重新整理後則會回歸初始值，如果依然要記住則要用 Localstorage

我的案例使用了 count view & add view 兩個畫面
一個顯示數值並可重置、一個可以加一，切換畫面依然能達成數值變動

並且在這裡也使用了 **react-router**，未來可能會遇到不同版本的路由，需多看文件

## 6. Modal / Dialog 控制

未實作，後續可以嘗試製作彈窗

## 7. 唯一 ID 產生 (getUUID vs useId)

寫前端很常需要一個隨機字串來做元素綁定或隨機值的應用

GVC 有提供唯一 id 的必要，需作為 view 要 bind 的 id 用
React 有 useId，JS 則有提供原生方法 crypto.randomUUID()

所以我撰寫注重生成唯一 id 的使用（實作在 CallRandomIdReact）
這裡則是使用了五種方式實驗：useState、useMemo、useId、useRef、crypto.randomUUID

useId 是拿來做綁定元素間的 id 用的，例如 Label-Input
useMemo 建議是該資料不時常更新，用在避免每次 re-render 都要算一次的大量運算上
而 **useRef 則是很適合作為存值用**
兩個不會因為刷新而更新資料，除非 useMemo 的 deps 有追蹤值
並且 React 運用上不建議顯示 useRef.current，只建議在方法中去做擷取或計算

## 8. 動態注入 CSS (addStyle vs CSS Modules / styled-components)

實作在第 1 個 counter 的 component 上
使用到 gvc.addStyle 和 styled.div
React 的 styled.div 還能做到直接當 div 使用（`<CustomerTitle/>`）還蠻特別的

## 9. 巢狀區塊獨立重繪

未實作，這段基本上是把第 1 ~ 3 點綜合實作

從這就可以看出 GVC 和 React 在撰寫上的差異
GVC 是要透過多個 id 去綁定、逐一追蹤，雖然可以自控，但後期會提升維護的困難

React 則是透過資料的變化，自己去重繪元素，可在 useEffect 中去調整資料與事件

## 10. Native App 硬體溝通

GVC 的硬體溝通可以做到像是開啟相機鏡頭、藍牙控制、列印等
React 的話則是使用到 React native 的部分，未來可以朝終端裝置上做應用

## 總結

要練的東西蠻多的

- useXXX 系列
- 列表在 useState 等方法上的使用
- react router 不同版本、不同開發者的寫法上的不同
- Zustand 運用
- 彈窗應用（常會運用到 callback）
- React Native 終端裝置上做應用（可選）

總之也是希望 React 越寫越好，這邊打基礎是很重要的
