# 織夢 · Woven Dreams

一個可部署為靜態網頁的**文字冒險小說引擎**，支援 GalGame 風格的多結局敘事。

故事內容與引擎完全解耦：你只需要寫 Markdown 劇本，就能產出一個完整的遊戲。

本專案包含**兩個應用**：
- `index.html` — 遊戲本身（玩家玩的）
- `editor.html` — 圖形化劇本編輯器（作者用的）

---

## ✨ 特色

- 🎨 **經典 GalGame 風格**：半透明文字框、三位置立繪（左/中/右）、背景淡入淡出、BGM 持續播放
- 📖 **劇本用 Markdown 寫作**：作家友善，支援 YAML front matter
- 🔀 **自然銜接的分支**：不是生硬的「岔路口」，而是用狀態旗標（flags）讓劇情在選擇後無縫收束
- 💾 **完整 GalGame 功能**：打字機效果、9 格存讀檔、回溯、自動播放、跳過、結局圖鑑
- 🌐 **純靜態網頁**：無需後端，不需要編譯，`python -m http.server` 就能跑
- 📱 **響應式設計**：桌機與行動裝置皆可
- 🎭 **SVG fallback**：即使沒有立繪/背景圖檔也會自動產生 placeholder

---

## 🚀 快速開始

### 方法 1：直接用 Python 啟動

```bash
cd galgame-engine
python3 -m http.server 8000
```

然後瀏覽 <http://localhost:8000>

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

在瀏覽器打開 `editor.html` 即可使用（**僅支援 Chrome、Edge、Opera**，因為使用 File System Access API）。

### 功能

- **直接讀寫本機 Markdown 檔案**：點「開啟專案」選擇你的故事資料夾，所有變更按 Ctrl+S 存回原本的 `.md` 檔
- **場景清單編輯器**：每種指令有專屬的視覺化卡片，不用記語法
- **流程圖視圖**：看到整個故事的分支結構，不同線段代表 next / goto / 選項
- **即時 Linter**：自動抓出拼錯的 flag、無效的 goto、未定義的角色、不可達的場景等
- **Flag 檢視器**：列出所有 flag 與它們在哪裡被設定/讀取，點擊可跳到位置，支援全域改名
- **故事設定對話框**：管理標題、起始場景、角色清單（含多表情立繪對應）、結局清單
- **Undo/Redo**：Ctrl+Z / Ctrl+Shift+Z
- **自動補完**：選擇背景、BGM、角色、場景時從現有資源下拉選單挑
- **智慧改名**：改場景 ID 會自動更新所有 goto/next 的引用；改 flag 名也會同步更新所有條件表達式
- **雙向相容**：編輯器輸出的 Markdown 與手寫完全相容，可以兩邊切換使用

### 快速開始

1. 啟動靜態伺服器：`python3 -m http.server 8000`
2. 打開 `http://localhost:8000/editor.html`（用 Chrome 或 Edge）
3. 點「開啟專案」選擇 `public/stories/demo_story/` 或你自己的故事資料夾
4. 編輯、儲存（Ctrl+S）

### 不支援 Chrome/Edge 怎麼辦

目前沒做 fallback，Firefox/Safari 使用者只能手寫 Markdown。這是可接受的妥協：劇本格式本身就是為手寫設計的，編輯器只是加分項。

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

| 指令 | 用途 | 範例 |
|------|------|------|
| `@bg <file> fade=<ms>` | 切換背景 | `@bg cafe.svg fade=800` |
| `@show <角色> <位置> <表情>` | 顯示立繪 | `@show 小鈴 center smile` |
| `@hide <角色>` | 隱藏單一角色 | `@hide 小鈴` |
| `@hide all` | 隱藏所有立繪 | `@hide all` |
| `@move <角色> <起>→<終>` | 移動立繪位置 | `@move 小鈴 center→left` |
| `@bgm <file>` | 播放背景音樂（同檔不會重播） | `@bgm happy.mp3` |
| `@bgm-stop` | 停止 BGM | `@bgm-stop fade=500` |
| `@se <file>` | 一次性音效 | `@se door_open.mp3` |
| `@wait <ms>` | 靜默等待 | `@wait 1500` |
| `@set <flag> = <值>` | 設定旗標 | `@set met_alice = true` |
| `@set <flag> += <n>` | 旗標遞增 | `@set charm += 1` |
| `@goto <target>` | 跳到標籤或場景 | `@goto 03_結局` |
| `@ending id="..." title="..." desc="..."` | 結局標記 | 看下方 |

**立繪位置**：`left`、`center`、`right`

**表情**：需在 `story.json` 的 `characters[名字].emotions` 中定義。

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
├── index.html              # 入口
├── src/
│   ├── main.js             # 裝配：把引擎與 UI 串起來
│   ├── engine/
│   │   ├── StoryEngine.js       # 核心引擎
│   │   ├── SceneParser.js       # Markdown 劇本解析
│   │   ├── ConditionEvaluator.js # 條件判斷器
│   │   └── SaveManager.js       # 存讀檔
│   ├── ui/
│   │   ├── TextBox.js           # 文字框 + 打字機效果
│   │   ├── ChoiceMenu.js        # 選項
│   │   ├── CharacterLayer.js    # 立繪與背景
│   │   └── AudioManager.js      # 音效/BGM
│   └── styles/
│       └── main.css             # 經典 GalGame 風格樣式
└── public/stories/
    └── demo_story/              # 範例：雨後的書店
        ├── story.json
        ├── scenes/
        │   ├── 01_prologue.md
        │   ├── 02_bookstore.md
        │   ├── 03_conversation.md
        │   ├── 04a_shared_umbrella.md
        │   ├── 04b_left_umbrella.md
        │   ├── 04c_solitude.md
        │   └── 04d_books.md
        ├── characters/          # 立繪（SVG 或 PNG）
        ├── backgrounds/         # 背景
        ├── bgm/                 # 背景音樂（選用）
        └── se/                  # 音效（選用）
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
