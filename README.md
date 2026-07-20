# 織夢 · Woven Dreams

一個可部署為靜態網頁的**文字冒險小說引擎**，支援 GalGame 風格的多結局敘事。

故事內容與引擎完全解耦：你只需要寫 Markdown 劇本，就能產出一個完整的遊戲。

本專案包含**兩個應用**：
- `index.html` — 遊戲本身（玩家玩的）
- `editor.html` — 圖形化劇本編輯器（作者用的）

---

## ✨ 特色

- 🎨 **經典 GalGame 風格**：立繪（三格版面＋自由座標/錨點/縮放）、背景淡入淡出、BGM 持續播放；<br>對話可選三種呈現樣式——浮框 / 貼底滿版 / 電影字幕
- 📖 **劇本用 Markdown 寫作**：作家友善，支援 YAML front matter；卡片 / Markdown / JSON 三種檢視隨時互換
- 🔀 **自然銜接的分支**：不是生硬的「岔路口」，而是用狀態旗標（flags）讓劇情在選擇後無縫收束
- 🎬 **33 種演出指令**：帷幕、鏡頭（縮放/位移/暗角）、立繪動畫、浮動文字、視頻、粒子（雪/雨/花瓣）、語音配音…
- 💾 **完整 GalGame 功能**：打字機效果、9 格存讀檔、回溯、自動播放（可指令化）、跳過、結局圖鑑
- 🛠 **完整圖形編輯器**：六大分頁（劇本/資產/敘事地圖/個性化/發布/設定）、游標即時預覽、資產引用追蹤、全域搜尋、自動存檔
- 🌐 **純靜態網頁**：無需後端，不需要編譯，`python -m http.server` 就能跑
- 🦊 **跨瀏覽器**：Chrome/Edge 直接讀寫本機資料夾；Firefox/Safari 自動切記憶體模式（ZIP 匯入匯出）
- 📱 **響應式設計**：桌機與行動裝置皆可
- 🎭 **SVG fallback**：即使沒有立繪/背景圖檔也會自動產生 placeholder

---

## 🚀 快速開始

### 方法 1：開發用伺服器（推薦）

```bash
cd galgame-engine
python tools/dev_server.py
```

然後瀏覽 <http://127.0.0.1:8123>

> 這支伺服器和 `python -m http.server` 一樣是純靜態，但會回應「不要快取」標頭。
> 因為本專案是原生 ES modules，瀏覽器會依模組 URL 各自快取；改完 `.js` 後若快取
> 沒清乾淨，可能出現「新舊模組混用」（症狀：`xxx is not a function`）。用這支
> 伺服器就**改完直接重整即可，不需要硬重整**。
>
> 若你只是要跑遊戲（不改程式），`python -m http.server 8000` 也完全可以。

### 方法 2：Node.js serve

```bash
npx serve .
```

### 部署

由於是純靜態網頁，可以直接部署到：
- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel
- 任何靜態檔案主機

只要把整個專案資料夾上傳即可，**不需要打包步驟**。

---

## 🛠 圖形化編輯器

在瀏覽器打開 `editor.html` 即可使用。Chrome/Edge/Opera 直接讀寫本機資料夾（File System Access API）；
**Firefox/Safari 自動切換記憶體模式**——用「開啟專案」選 ZIP 匯入、「⬇ ZIP」匯出保存，內容暫存在瀏覽器（IndexedDB）。

### 六大分頁

| 分頁 | 內容 |
|------|------|
| **劇本** | 三欄常駐：結構樹（章節分組＋搜尋）｜事件卡片（卡片/MD/JSON 三檢視）｜預覽＋檢查器。點選任何指令，右側立即顯示「執行到這一行」的畫面（靜態求值，不播動畫）；按「▶ 運行」才實際播放 |
| **資產** | 背景/立繪/BGM/音效/語音/視頻 匯入管理；每個資產顯示引用數或「⚠ 游離」，刪除前列出受影響位置；「位置與錨點」可拖曳格線自訂立繪位置 |
| **敘事地圖** | 橫向分支圖：選項直接列在節點內、各自拉線；未引用場景虛線標示；縮放/適應畫面；左欄變量管理（登記/搜尋/篩選）與結局清單 |
| **個性化** | 遊戲外觀主題（規劃中） |
| **發布** | ZIP 匯出（一鍵網頁版規劃中） |
| **設定** | 專案基本資訊、編輯器偏好 |

### 其他能力

- **全域搜尋**（`Ctrl+Shift+F`）：跨場景搜台詞/角色/變量/資產檔名，點擊跳到該行
- **自動存檔**：改動後 2.5 秒自動寫回，狀態列可隨時開關
- **即時 Linter**：拼錯的 flag、無效的 goto、未定義的角色、不可達的場景
- **智慧改名**：改場景 ID / flag 名自動更新所有引用
- **Undo/Redo**：Ctrl+Z / Ctrl+Shift+Z
- **雙向相容**：編輯器輸出的 Markdown 與手寫完全相容，可以兩邊切換使用

### 快速開始

1. 啟動靜態伺服器：`python tools/dev_server.py`
2. 打開 `http://127.0.0.1:8123/editor.html`
3. 點「開啟專案」選擇 `public/stories/demo_story/` 或你自己的故事資料夾
4. 編輯——自動存檔會替你寫回（或 Ctrl+S 手動存）

---

## 📝 劇本撰寫指南

劇本放在 `public/stories/<你的故事 ID>/`，由 `story.json` 與 `scenes/*.md` 組成。

### story.json（故事元資料）

```json
{
  "id": "my_story",
  "title": "故事標題",
  "subtitle": "副標題",
  "start": "01_開場",
  "characters": {
    "小鈴": {
      "default": "ling_normal.svg",
      "emotions": {
        "smile": "ling_smile.svg",
        "sad": "ling_sad.svg"
      }
    }
  },
  "endings": [
    {
      "id": "ending_happy",
      "title": "幸福結局",
      "description": "兩人從此過著幸福快樂的日子。"
    }
  ]
}
```

### 場景檔（.md）格式

每個場景一個 `.md` 檔，由 **front matter** 與 **本文** 組成。

```markdown
---
id: 01_開場
title: 第一章 · 相遇
background: school.svg
bgm: calm_piano.mp3
next: 02_下一場景       # 沒有選項結尾時會自動跳過去
---

@bg school.svg fade=1000
@bgm calm_piano.mp3
@show 小鈴 center smile

小鈴: 「你好呀！」

主角: 「……」

主角(心聲): 這個女孩是誰？
```

---

## 📚 劇本語法速查

### 對話與旁白

```markdown
角色名: 「說話內容」
角色名(心聲): 「內心獨白」   # 括號會一起顯示在 speaker 欄位
旁白的文字沒有冒號，直接寫一行就是旁白
```

### `@` 畫面指令

完整語法與參數見 **[劇本寫作指引.md](./劇本寫作指引.md)**，以下為總表：

| 分類 | 指令 |
|------|------|
| 背景/立繪 | `@bg` · `@show`（含 `pos=` `anchor=` `scale=` 自由定位）· `@hide` · `@move` |
| 音訊 | `@bgm` · `@bgm-stop` · `@se` · `@se-stop` · `@voice`（獨立 VO）<br>單句配音用行內屬性：`角色 voice=檔名: 台詞` |
| 節奏 | `@wait` · `@auto`（自動播放）· `@textcfg`（打字速度/淡入/等待圖標/**對話樣式**） |
| 特效 | `@shake` · `@flash` · `@tint` · `@tint-clear` · `@curtain`（帷幕）· `@ui`（隱藏界面） |
| 鏡頭 | `@camera`（縮放/位移/暗角）· `@camera-reset` |
| 動畫 | `@sprite`（立繪跳動/搖晃/位移）· `@float`（浮動文字） |
| 媒體 | `@video` · `@video-stop` · `@particles`（雪/雨/花瓣）· `@particles-stop` |
| 場控 | `@clear`（銷毀場景） |
| 資料/流程 | `@set` · `@goto` · `@ending` |

**立繪位置**：內建 `left`、`center`、`right`；也可在 story.json 的 `positions` 宣告具名位置，
或直接在 `@show` 加 `pos=x,y anchor=錨點 scale=倍率` 自由定位（九種錨點）。

**表情**：需在 `story.json` 的 `characters[名字].emotions` 中定義。

**含空白的參數要加引號**：`@float "好痛 啊！" x=50`。

### `::` 控制流程

```markdown
:: if met_alice && charm > 2
這段話只有在 met_alice 為 true 且 charm > 2 時才會顯示。
:: elif met_alice
已經認識艾莉絲，但好感度不夠。
:: else
你甚至不認識艾莉絲。
:: endif
```

**支援的比較運算子**：`==`、`!=`、`>`、`<`、`>=`、`<=`、`&&`、`||`、`!`、`()`

**標籤**（給 goto 用的錨點）：

```markdown
:: label after_choice
```

### `??` 選項

```markdown
?? choice
- text: 「請坐吧。」
  set: { invited_her: true, charm: 1 }
  goto: continue
- text: 「抱歉，我在等人。」
  set: { invited_her: false }
  goto: continue
??
```

- `text`：按鈕文字
- `set`：選擇此選項時設定的旗標（直接賦值，若要遞增請在選項後用 `@set`）
- `goto`：跳到同場景的 `:: label` 或其他場景 id

### 結局

```markdown
@ending id="ending_happy" title="幸福結局" desc="你們從此幸福快樂。"
```

觸發後會自動記錄到圖鑑（localStorage），下次打開就能看到解鎖。

---

## 🎭 「自然銜接分支」的設計訣竅

這個引擎的核心價值是讓分支劇情**無縫收束**。傳統做法是選項直接導向完全不同的檔案，玩家會感覺每次選擇都是突兀的岔路。

**正確做法**是把「選擇」視為**狀態變化**，而不是**岔路口**。

### 範例模式

```markdown
?? choice
- text: 請她坐下
  set: { invited: true }
  goto: merge
- text: 婉拒
  set: { invited: false }
  goto: merge
??

:: label merge

# 同一個 label 下，依據 flag 產生不同敘述
:: if invited
她坐到我對面，放下包包。
:: else
她輕輕點頭，轉身離開了。
:: endif

# ⚠️ 關鍵：無論哪個分支，都會繼續下面這段共同劇情
# 劇情「收束」到同一條時間線，只是心境不同

窗外的風鈴響了一聲。時間好像慢了下來。
```

玩家會感覺自己的選擇**自然融入**後續故事，而不是被硬切到另一條支線。

### 進階技巧：回聲（echo）

在很遠之後的場景，仍可以用 flag 製造「回聲」：

```markdown
:: if invited
她看著我笑了笑，像是想起了那天咖啡廳裡的事。
:: else
她朝我點了個頭，禮貌但疏離——像是想起了我們第一次相遇的那個下午。
:: endif
```

一個看似無關緊要的選項，在第五場景被輕輕回扣，會讓玩家覺得「我的選擇有重量」。這是敘事沉浸感的秘密。

---

## 🎯 控制與快捷鍵

| 操作 | 鍵盤 | UI 按鈕 |
|------|------|---------|
| 前進 / 跳過打字 | Enter / Space / 點擊 | — |
| 自動播放 | — | 自動 |
| 跳過 | — | 跳過 |
| 回溯 | — | 回溯 |
| 儲存 | — | 存檔 |
| 讀取 | — | 讀檔 |
| 回主選單 | Esc | 主選單 |

---

## 📁 專案結構

```
galgame-engine/
├── index.html              # 遊戲入口
├── editor.html             # 圖形化劇本編輯器
├── preview.html            # 編輯器的預覽沙盒（iframe）
├── tools/dev_server.py     # 開發用不快取靜態伺服器
├── src/
│   ├── main.js             # 遊戲裝配
│   ├── preview.js          # 預覽裝配（scrub/play 雙模式）
│   ├── engine/
│   │   ├── StoryEngine.js       # 核心引擎（含靜態求值 evaluateTo）
│   │   ├── SceneParser.js       # Markdown 劇本解析（MD → AST）
│   │   ├── ConditionEvaluator.js # 條件判斷器
│   │   └── SaveManager.js       # 存讀檔
│   ├── ui/
│   │   ├── GameRuntime.js       # 引擎↔UI 接線（遊戲與預覽共用）
│   │   ├── TextBox.js           # 文字框 + 打字機
│   │   ├── ChoiceMenu.js        # 選項
│   │   ├── CharacterLayer.js    # 立繪（含自由定位）與背景
│   │   ├── AudioManager.js      # BGM/音效/語音
│   │   ├── ScreenEffects.js     # 震動/閃光/染色/帷幕/暗角
│   │   ├── ParticleLayer.js     # 粒子（雪/雨/花瓣）
│   │   └── anchors.js           # 錨點定義（引擎與編輯器共用）
│   ├── editor/                  # 編輯器（views / widgets / core）
│   └── styles/main.css
└── public/stories/
    └── demo_story/              # 範例：雨後的書店
        ├── story.json
        ├── scenes/*.md
        ├── characters/          # 立繪（SVG 或 PNG）
        ├── backgrounds/         # 背景
        ├── bgm/  se/            # 音樂與音效（選用）
        └── voice/  video/       # 語音與視頻（選用）
```

---

## 🔧 新增自己的故事

1. 在 `public/stories/` 建立資料夾，例如 `my_story/`
2. 建立 `story.json` 與 `scenes/` 目錄
3. 寫下你的場景 `.md` 檔
4. 在 `src/main.js` 修改 `STORY_PATH`：
   ```js
   const STORY_PATH = "./public/stories/my_story";
   ```
5. 重新整理頁面即可

立繪與背景可以是 `.png`、`.jpg` 或 `.svg`，找不到檔案時引擎會自動產生漸層 placeholder，方便先搭骨架再做美術。

---

## ⚙️ 技術細節

- **純 Vanilla JS**，使用 ES Modules（`type="module"`），現代瀏覽器原生支援
- **不需要 build**：所有 JS/CSS 都是原樣被瀏覽器載入
- **存檔位置**：`localStorage`，key 為 `galgame.save.<storyId>.<slot>`
- **圖鑑位置**：`localStorage`，key 為 `galgame.endings.<storyId>`
- **回溯深度**：80 步（可在 `StoryEngine.maxHistory` 調整）

---

## 🎨 自訂外觀

修改 `src/styles/main.css` 的 `:root` CSS 變數即可換主題色：

```css
:root {
  --ink-900: #1a1814;       /* 主暗色 */
  --sakura: #d4869c;        /* 粉色 */
  --gold: #c9a45e;          /* 金色點綴 */
  --font-body: "Noto Serif TC", serif;
  ...
}
```

---

## 📄 範例故事

附的範例「雨後的書店」是一個小故事，展示：
- 早期小選擇（躲雨地點）如何影響後續心境
- 兩次選擇交互產生的 4 條收束路徑
- 不同結局如何回扣前面的選擇細節

建議玩過至少兩遍，感受相同場景的不同敘述。

---

## 授權

本引擎採 MIT 授權，你可以自由使用、修改、散布。
