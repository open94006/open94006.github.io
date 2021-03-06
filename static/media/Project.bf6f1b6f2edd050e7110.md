<blockquote class="mainTitle"><h1>目前我獨立完成的專案有...</h1></blockquote>

- [PHP Laravel 與 React.js 的前後端分離](#laravel&reactjs)  
  
- [PHP Laravel 動畫評分網站 — AnimeRank](#animerank)  
  
- [React.js GitHub Pages](#gh-pages)  
  
- [Python 隨機生成威力彩號碼](#lotto-random)  
  

---

<h2 id="laravel&reactjs">【PHP Laravel 與 React.js 的前後端分離】</h2>

一個以react.js為前端框架，api則使用Laravel為後端框架的小型CRUD網站  

### 為何學習？  
- 試做一個**前後端分離**的簡單CRUD網站  
- 符合業界上的**職務分工**，理解前後端各自會遇到的問題，以及**需要溝通**的部分  
- 練習使用Laravel該如何結合前端框架  

### 畫面展示  
- 首頁頁面(載入畫面)  
![首頁載入畫面](https://i.imgur.com/Yp62fks.png)  
- 首頁頁面(載入完成)  
![首頁完成載入](https://i.imgur.com/8lbJR1w.png)  
- 新增資料(讀取前)  
![新增讀取前](https://i.imgur.com/CouzdMu.png)  
- 新增資料(讀取中)  
![新增讀取中](https://i.imgur.com/zJ0FXKS.png)  
- 首頁頁面(新增後)  
![首頁新增後](https://i.imgur.com/azR7XpG.png)  

### 完成心得  
以往在Laravel上是以controller來傳遞資料，在blade模板呈現資料的，基本上都在路由上操作就可以了。  
  
這麼做的缺點就是**CRUD的動作都要重整一次頁面**，雖然有一部份可以用AJAX解決，但只有少部分頁面能做到**即時與畫面互動**。  
  
這次使用react.js來去呼叫api，laravel的部分**只需要整理好資料**就可以了，也因此多接觸到resources的功能rreact.js也能專心作呈現畫面的工作，**前後端分離的優勢**就出來了。  

### 參考資源  
Laravel ReactJS CRUD with RestAPI Tutorial  
網址：https://www.youtube.com/watch?v=RXD7wgP5BXU  
Eloquent API Resources  
網址：https://blog.johnsonlu.org/laravel-eloquent-api-resources/  

---

<h2 id="animerank">【PHP Laravel 動畫評分網站 — AnimeRank】</h2>
喜好動畫的人可以觀看排行榜，與評比分數的網站  

### 為何學習？  
- **第一個使用PHP Laravel framework的專案**
- 因為喜歡看動畫，自己發想出一個評分系統來記錄自己看動畫的過程
- 作為一個資管人，需要一份從頭到尾來完成專案的能力

### 來去看看
[AnimeRank(新站)](http://gettingstartedapp-env.eba-gpunezib.us-east-2.elasticbeanstalk.com/)  
(新站使用AWS的Elastic Beanstalk佈署，網址是AWS提供的)  
  
[AnimeRank(舊站)](https://animerank.great-site.net/)  
(舊站則是使用英國免費主機InfinityFree架設的，連線速度較慢，網址為自己設計，SSL為免費憑證)  

### AnimeRank看點
- 依照看動畫的習慣，分成**一、四、七、十月新番**來做分類
- 每部動畫都有提供**製作公司、標籤類型、線上看的網址**
- 動畫清單能直接做到**邊打字、邊找尋想看的動畫**的功能
- 排行榜能觀看作者對每一年的動畫評分的呈現，**越高分越有看頭**

### 畫面呈現  

- 首頁  
![首頁](https://i.imgur.com/AOrQnVg.png)  
- 會員登入  
![會員登入](https://i.imgur.com/I3y1sYe.png)  
- 排行榜  
![排行榜](https://i.imgur.com/a6CTdn4.png)  
- 動畫清單  
![動畫清單](https://i.imgur.com/np3bJRV.png)  
- 詳細/編輯頁面  
![詳細/編輯頁面](https://i.imgur.com/l0ogmkz.png)  

### 完成心得  
第一個使用Laravel製作的網站，撰寫程式的能力還很生疏，不過我能初步完成Laravel在**CRUD、登入註冊、傳送郵件**等功能。
  
缺陷還是很多的，例如**評分沒有身份區別**，只要有登入就能更改分數，讓會員登入就真的只有登入的功能了，在資料庫的設計和後端應增加區分評分人的身份。
  
我平時也會使用這個網站來記錄與評分動畫的習慣，對我來說是一個**使用自己的專業**來完成**自己想要的網站**，日後配合客戶及上司的需求來製作網站，AnimeRank就可以作為我撰寫Laravel的基石。

### 參考資源  
Laravel 官方文件  
網址：https://laravel.com/  
Laravel 實戰經驗分享  鐵人賽文章  
網址：https://bit.ly/3zJxIAe  
Laravel 8 custom authentication  
網址：https://www.youtube.com/watch?v=UGW01ttsfpQ  
Laravel 8 Mail | Laravel 8 Send Email Tutorial  
網址：https://www.itsolutionstuff.com/post/laravel-8-mail-laravel-8-send-email-tutorialexample.html  

---

<h2 id="gh-pages">【React.js GitHub Pages】</h2>
製作個人的GitHub Pages，並使用React.js  

### 為何學習？  
- 想要建立個人網站，把自我介紹和做過的專案整理上去
- 不靠網路上一些HTML模板，打算自己完成有RWD的頁面

### 畫面呈現  
> 其實就是您現在所瀏覽的這個網站...

### 完成心得  
會使用GitHub Pages主要是能快速佈署靜態網站，同時也能有SSL及高推廣性的優勢。  
  
另外也能藉此多練習Git語法，對練習上傳自己的程式碼很有幫助  

### 參考資源  
How to Deploy React App to GitHub Pages  
網址：https://www.youtube.com/watch?v=F8s4Ng-re0E  

---

<h2 id="lotto-random">【Python 隨機生成威力彩號碼】</h2>

台灣威力彩的隨機選號，可決定想要生成的數量  

### 為何學習？  
- 有段期間台灣的樂透連續槓龜，頭獎獎金屢屢創下新高，很感興趣  
- 原本有在jupyter上撰寫類似的程式，想濃縮程式碼，越短越好  
- 寫過許多小程式，沒用過py轉exe，順便了解一下  

### 畫面呈現  
- 開啟lotto random.exe，會顯示此畫面  
![image](https://user-images.githubusercontent.com/52010921/138228324-b8c3548a-7f68-4c93-9659-5a8ceb40853e.png)  
- 指定生成數量後，會產生該數量的隨機投注組合  
![image](https://user-images.githubusercontent.com/52010921/138228520-f80dc6fa-3ce1-4e0c-9c04-35ccb20e5a5d.png)  
- [點我前往Lotto Random的GitHub](https://github.com/open94006/lotto-random)  

### 完成心得  
其實也只是寫個小程式而已，濃縮程式碼才是練習目的。
    
另外無論是我或是朋友，使用該程式**還是沒中獎**，略顯可惜。  

### 參考資源  
威力彩遊戲介紹  
網址：https://bit.ly/33lK1a2