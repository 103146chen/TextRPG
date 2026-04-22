# 圖片素材需求與 AI 生圖提示詞 (Prompt) 總表

本文件統整了《秦得參》故事中所需要的所有背景與立繪圖片素材。
為符合您要求的**寫實風格水彩** (Realistic Watercolor)，提示詞中已加入 `realistic watercolor painting`, `traditional media` 等關鍵字，並移除了原先的動漫風格設定。

## 🎨 圖片風格設定
- **整體風格**: 寫實水彩畫 (Realistic watercolor painting)、傳統媒材 (Traditional media)。
- **背景圖比例**: 建議設定為 16:9 (`--ar 16:9`)。
- **立繪圖比例**: 建議設定為 1:2 (`--ar 1:2`)，並指定白色背景 (`white background`) 方便後續去背處理。

---

## 🏞️ 背景圖 (Backgrounds)

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **village_dawn.svg** | **清晨村莊**<br>日治時期的台灣農村，清晨微霧，有著老舊的土角厝與泥土路，氛圍寧靜略帶清苦。 | `realistic watercolor painting, traditional media, Taiwanese rural village during Japanese colonial period, dawn, misty, old mud-brick farmhouses, dirt road, highly detailed, atmospheric lighting, masterpiece --ar 16:9` |
| **home_interior.svg** | **住家內部**<br>貧苦農家的土角厝內部，光線昏暗，只有簡陋的老舊木製家具，雖然窮困但收拾得乾淨。 | `realistic watercolor painting, traditional media, interior of an impoverished Taiwanese farmhouse during Japanese colonial period, mud walls, dim lighting, old wooden furniture, poor but tidy, expressive brushstrokes, masterpiece --ar 16:9` |
| **market_morning.svg**| **早市**<br>日治時期的台灣傳統早市，人潮擁擠，有老舊的攤販，晨光灑落，帶有生活氣息。 | `realistic watercolor painting, traditional media, Taiwanese traditional morning market during Japanese colonial period, crowded, old stalls, sunlight, lively atmosphere, highly detailed --ar 16:9` |
| **night_path.svg** | **夜晚小路**<br>夜晚的農村泥土小徑，只有微弱的月光，周圍昏暗，氛圍壓抑且帶有不安感。 | `realistic watercolor painting, traditional media, dark rural dirt path at night, Taiwanese village, dim moonlight, ominous and spooky atmosphere, highly detailed --ar 16:9` |

---

## 🧍 立繪 (Sprites)

*註：請將提示詞中的 `[...]` 替換為該次生圖需要的具體表情。*

| 角色 | 需要的表情 | 角色描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- | :--- |
| **母親**<br>(Mother) | 1. `normal` (平常)<br>2. `worried` (擔憂) | 台灣中年婦女，穿著日治時期傳統樸素、略顯破舊的農婦服裝，消瘦且面容疲憊，梳著傳統髮髻。 | `realistic watercolor painting, character design, white background, middle-aged Taiwanese woman, traditional simple worn-out clothing from Japanese colonial era, thin, tired face, bun hair, [normal expression / worried and anxious expression] --ar 1:2` |
| **妻子**<br>(Wife) | 1. `normal` (平常)<br>2. `worried` (擔憂) | 年輕的台灣農婦，穿著傳統樸素服裝，氣質溫婉認命，綁著辮子或簡單盤髮。 | `realistic watercolor painting, character design, white background, young Taiwanese woman, traditional simple clothes from Japanese colonial era, modest, gentle face, braided hair, [gentle normal expression / deeply worried expression] --ar 1:2` |
| **巡查**<br>(Police) | 1. `cold` (冷酷)<br>2. `angry` (憤怒) | 日治時期的日本警察，穿著歷史考究的警察制服，腰間配有武士刀，威嚴且具壓迫感。 | `realistic watercolor painting, character design, white background, Japanese police officer from colonial era Taiwan, historical police uniform, saber at waist, stern face, authoritarian, [cold and arrogant expression / angry and yelling expression] --ar 1:2` |
| **得參**<br>(De-can) | 1. `despair` (絕望) | 年輕的台灣農夫，穿著粗布衣，短髮，皮膚黝黑，因長期勞動而結實，表情徹底崩潰絕望。 | `realistic watercolor painting, character design, white background, young Taiwanese male farmer, Japanese colonial era, rough clothes, short hair, tanned skin, [absolute despair and crying expression, broken] --ar 1:2` |
