---
date: '2026-08-24T14:30:43+08:00'
title: '我對 Docker 的基本理解'
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

## 置頂：觀念釐清

- 雖然 Database 和 Docker Volume 功能相近，但需要 Volume 的情境包含：
    1. 暫存檔案
    2. log 檔案持久化
    3. 某些 stateful 服務（不是資料庫）需要保留資料
- GitHub vs Docker Registry
    1. **GitHub**：存放你的**程式碼**，有版本歷史、能追蹤誰改了什麼
    2. **Docker Registry**（Docker Hub / GitHub Container Registry / GCP Artifact Registry）：存放**建置好的 image**（已經編譯打包完成的執行檔案+環境），不是原始碼
    3. 兩者可能會同時使用（程式碼 → GitHub, 映像檔 → Docker Registry）

---

## 我對 Docker 的理解

> - 基本語法與旗標（-d, -it, -t 等系列）
> - 映像檔 image → 映像檔上傳到 Registry（例如 Docker Hub）
> - 容器 container
> - 網路 network
> - volume 的資料持久化
> - dockerfile / docker-compose
> - 可牽涉到一點反向代理（nginx）
> - 此文章目前不提及 docker-compose

---

## Docker 指令語法結構

`docker [操作: run, start, rm, exec] [各種旗標: -d -it -p -f] [容器: id or name / 映像檔: image] [容器內部要跑的指令: 指定編譯器 sh、列表 ls]`

## Docker 我已經習慣的語法

`docker ps` 查看正在執行工作的容器

`docker ps -a` 查看所有已建立的容器

`docker images` 查看本地所有的映像檔

`docker build -t <image> .` 讀取當前位置該指令找到的 dockerfile 建立映像檔

`docker run -d --name <container_name> -p <主機port:容器port> <image>` 建立容器服務，並採取背景執行

`docker exec -it <container_id_or_name> sh` 進入正在執行中的容器

`docker start <container_id_or_name>` 啟用容器

`docker stop <container_id_or_name>` 優雅停止容器

`docker restart <container_id_or_name>` 重啟容器

`docker logs <container_id_or_name>` 查看容器紀錄檔

## Docker 其他基本語法

`docker system prune -a`會清理未使用的 container、network、image 與 build cache
其中`-a`會進一步清理所有「沒有被任何 container 使用」的 image；如果不加`-a`，image 部分只會清理 dangling image。Volume 預設不會被刪除，需要額外加上`--volumes`。

`docker rm <container_id_or_name>` 刪除容器（需要停止容器才能刪除）

`docker rmi <image_id_or_name>`（rmi 就是 remove image 簡寫）

`docker build -t <映像名稱:版本> .` 建立映像檔，「.」是當前目錄路徑的意思

`docker build -f docker/Dockerfile .` **-f 是檔案的意思**，這代表建置來自 \*\*\*\*docker/Dockerfile 的檔案

`docker volume ls` 可以得到容器之外有建立的容積（儲存庫）

`docker inspect <container_id_or_name>` 查看容器詳細資訊

## Docker 旗標介紹

`-f` 在 build 時是指檔案、在 rm 是 force 強制執行、在 logs 是 follow 跟隨

`-d` 背景執行，如果沒輸入的話會讓該服務佔用終端機，需要透過 ctrl + c 才能繼續操作終端機

`-i` 保持 STDIN 開啟, `-t` 分配終端機格式化畫面，否則會缺少終端機的格式化
通常會使用 `docker exec -it <container>` 進入已在背景執行的容器內操作指令

`-e` 環境參數，例如 `-e POSTGRES_USER=myuser`就是建立 postgres user 的變數於容器

`-p` 主機和容器連接的轉發規則，用法是 `-p 主機埠號:容器埠號`

`-v` 掛 volume 做資料持久化

`--tail 100` 通常用在 logs 後面，可以查看最近一百筆紀錄

## Docker pull / run

兩步驟（先 pull 再 run）可以直接一個動作完成，便是直接

```docker
docker run xxx-image
```

這個步驟會先檢查本地是否有 xxx-image

如果沒有，會到 Docker Hub 去尋找並下載下來執行

## Docker 網路列表

```docker
docker network ls
```

`bridge`、`host`、`none` 這三個是 docker 基礎預設的網路，分別是橋接、主機、無

## Registry 和 Repository

```docker
Docker Hub（Registry -> **Docker Hub, GitHub Container Registry 等**）
├── node（Repository）
│   ├── node:20
│   ├── node:20-alpine
│   ├── node:21
│   └── node:latest
├── nginx（Repository）
│   ├── nginx:alpine
│   └── nginx:latest
└── yourusername/my-app（Repository）
    ├── my-app:v1.0
    ├── my-app:v1.1
    └── my-app:latest
```

**Docker Hub 和 GitHub Container Registry** 是線上公共的儲存庫，可以下載不同的 Registry

## Cloud Run

先在 GCP 上建立一個 **部署 Web 服務**

我是使用 GitHub 存放區，好處是很多都可以按照預設走，剩下靠 GCP 和 GitHub 自動更新觸發條件，即可完成部署

只是目前我覺得 `cloudbuild.yaml` 這個檔案還是自己寫比較好（目前的兩個專案都是這樣）

也可以請 ai 幫我跑完整個 `cloudbuild` 檔案建立的流程

不外乎就是把 docker 建立，和 Cloud SDK 可以 Run

Cloud SQL 成本估計會略高，未來看有沒有需要換到便宜部署資料庫（Supabase, Neon）或開 MicroVM 自行架設
