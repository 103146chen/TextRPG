# 《燭之武退秦師》素材需求與 AI 生成提示詞 (Prompt) 總表

本文件統整《燭之武退秦師》故事所需的所有背景、立繪、音樂 (BGM)、音效 (SE) 與特效鏡頭 (VFX) 等素材設計準則與提示詞。

> **本劇的美術基調**：全劇沒有一場戰鬥。所有的壓力來自「圍」而不是「攻」——空的市集、見底的井、整齊到令人不安的敵營、燒短的燈。請所有素材避開兵刃相接的畫面，把張力放在**空間的靜與人的算計**上。

## 🎨 圖片風格設定
- **整體風格**: 寫實水墨歷史畫 (Realistic Chinese ink-wash painting with muted colors)、傳統媒材質感。與《鴻門宴》同一畫風，但**色調更冷**（青灰、墨藍為主），因為全劇集中在一夜之間。
- **背景圖比例**: 16:9 寬幅 (使用 `16:9 aspect ratio, wide landscape`)。絕對不能有文字、印章。
- **立繪圖比例**: 1:2 (需在生成後透過影像處理裁切為 512x1024)。
- **立繪背景**: 必須是純白背景 (`pure solid white background`)，且強制排除文字與印章 (`NO text, NO stamps, NO watermarks, NO signatures`) 方便去背。
- **立繪一致性**: 採用「基準圖 + 差分編輯」工作流。
- **時代**: 春秋中期（西元前 630 年），比《鴻門宴》早四百年。服飾應為**春秋深衣**而非秦漢制式，甲冑較簡樸，冠式較低。

---

## 🏞️ 背景圖 (Backgrounds) — 共 23 張

### 一、鄭國（城內）

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **zheng_stable.png** | **鄭國馬廄（日）**<br>主角三十年的所在。草料堆、馬槽、鍘刀、土牆。全劇的起點與終點。 | `realistic Chinese ink-wash painting, muted colors, interior of an ancient Chinese stable in the Spring and Autumn period, wooden feeding troughs, piles of straw and fodder, a hay cutter, rammed earth walls, dusty sunlight through gaps, humble and worn, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_stable_night.png** | **鄭國馬廄（夜）**<br>同上，夜間。一盞油燈，光照範圍很小，四周是黑的。鄭伯夜訪之處。 | `realistic Chinese ink-wash painting, muted colors, interior of an ancient Chinese stable at night, a single small oil lamp casting a narrow pool of light, wooden troughs and straw in deep shadow, cold darkness beyond the lamp, quiet and solemn, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_gate.png** | **新鄭城門內側**<br>前傳，重耳過鄭。城門洞、迴廊、石階，冬日蕭索。 | `realistic Chinese ink-wash painting, muted colors, inner side of an ancient Chinese city gate in winter, Spring and Autumn period, stone steps and a covered wooden corridor, bare trees, cold overcast light, desolate, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_court_inner.png** | **鄭國宮室內殿**<br>議事之處。低矮的席位、青銅燈、木柱，莊重而略顯陳舊。 | `realistic Chinese ink-wash painting, muted colors, interior of an ancient Chinese ducal hall, Spring and Autumn period, low seating mats, bronze lamps, thick wooden pillars, dim solemn atmosphere, slightly worn and austere, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_corridor.png** | **宮室迴廊**<br>主角與叔詹對話處。木柱長廊，一側通向庭院。 | `realistic Chinese ink-wash painting, muted colors, long wooden covered corridor of an ancient Chinese palace, rows of pillars receding into distance, courtyard visible on one side, cold winter light, quiet, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_market.png** | **新鄭市集（平時）**<br>圍城之前的市集，攤位、粟袋、布匹，有生活感但無人物特寫。 | `realistic Chinese ink-wash painting, muted colors, ancient Chinese market street in the Spring and Autumn period, wooden stalls, sacks of grain, rolls of cloth, low buildings, warm ordinary daily atmosphere, distant tiny figures only, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_street_siege.png** | **圍城下的街巷**<br>**全劇最重要的一張「壓力圖」**。市集關閉、門板釘死、空的水甕、地上散落的草繩。**不要有屍體或血跡**——恐懼要靠「空」表現。 | `realistic Chinese ink-wash painting, muted colors, deserted ancient Chinese city street under siege, market stalls closed and boarded up, empty water jars, scattered straw ropes on the ground, shuttered doors, oppressive silence, pale grey daylight, NO people, completely empty scene, devoid of characters, no blood, no violence, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_street_night.png** | **圍城下的街巷（夜）**<br>同上，夜間。零星燈火，更漏聲的空間感。 | `realistic Chinese ink-wash painting, muted colors, deserted ancient Chinese city street at night under siege, a few scattered dim lamps in windows, empty road, deep blue darkness, tense quiet, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_city_peace.png** | **解圍後的鄭國城景**<br>結局用。晨光中的城市屋瓦，炊煙升起，平靜。 | `realistic Chinese ink-wash painting, muted colors, panoramic view of an ancient Chinese walled city at peaceful morning, tiled rooftops, thin smoke from cooking fires rising, soft golden light, calm and ordinary, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |

### 二、城牆（本劇的核心舞台）

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **zheng_wall_day.png** | **鄭國城牆（日）**<br>從牆上向外看。遠方兩片營區分處南北——**這張圖必須畫出「兩軍分駐」的視覺資訊**，是全劇機關所在。 | `realistic Chinese ink-wash painting, muted colors, view from atop an ancient Chinese city wall looking outward, two separate distant military encampments visible far apart on the plain, one to the north among trees, one to the south beyond a river, rammed earth battlements in foreground, overcast autumn daylight, NO people, empty wall walk, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_wall_night.png** | **鄭國城牆（夜）**<br>夜縋出發處。垛口、絞盤、垂下的粗繩，遠方點點營火。 | `realistic Chinese ink-wash painting, muted colors, atop an ancient Chinese city wall at night, crenellations, a wooden winch with a thick rope descending over the edge, scattered distant campfires like stars on the dark plain, cold misty air, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **wall_descend.png** | **縋城途中**<br>**特殊視角**：從半空看城牆表面，磚石逼近，下方一片黑暗，上方是夜空。營造暈眩感。 | `realistic Chinese ink-wash painting, muted colors, dramatic vertical view along the surface of a massive ancient rammed earth city wall at night, seen from mid-air halfway down, wall texture close to viewer, darkness below, night sky above, vertiginous perspective, NO people, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_wall_dawn.png** | **鄭國城牆（拂曉）**<br>歸城時。晨霧、微光，牆體輪廓柔和。 | `realistic Chinese ink-wash painting, muted colors, ancient Chinese city wall at dawn seen from outside, morning mist, soft pale light on rammed earth, quiet and vast, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **zheng_wall_top.png** | **城牆頂面（日）**<br>歸城後與佚之狐、鄭伯對話處。牆道、垛口、遠景是空了的原野。 | `realistic Chinese ink-wash painting, muted colors, the walkway atop an ancient Chinese city wall in daylight, crenellations on one side, empty plain stretching to the horizon beyond, abandoned campsite traces far away, calm relieved atmosphere, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |

### 三、野外與秦營

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **wild_field_night.png** | **城外荒野（夜）**<br>落地之後。秋草、露水、遠處的河堤，一條看不清的路。 | `realistic Chinese ink-wash painting, muted colors, desolate autumn field at night outside a city wall, tall dry grass heavy with dew, a faint path leading away, a distant river embankment, deep blue darkness, lonely atmosphere, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **wild_field_dawn.png** | **城外荒野（拂曉）**<br>失敗結局回程用。同一條路，天亮了，更顯漫長。 | `realistic Chinese ink-wash painting, muted colors, desolate autumn field at early dawn, long empty path stretching toward a distant city wall, pale cold morning light, dry grass, weary and quiet atmosphere, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **qin_camp_night.png** | **氾南秦營外圍（夜）**<br>轅門、火把、柵欄。整齊、克制，不張揚。 | `realistic Chinese ink-wash painting, muted colors, outer gate of an ancient Chinese military camp at night, wooden palisade and camp gate, torches burning on posts, orderly and disciplined, cold mist, distant rows of tents, NO people or only tiny distant silhouettes, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **qin_camp_inner_night.png** | **秦營甬道（夜）**<br>主角一路數營帳的視角。**糧車的車轅一律朝西**——這是重要伏筆，請務必畫出停放的輜重車。 | `realistic Chinese ink-wash painting, muted colors, inner avenue of a highly organized ancient Chinese military camp at night, precise rows of tents on both sides, supply carts parked with shafts all pointing the same direction, torches at intervals, disciplined and eerily quiet, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **qin_tent_night.png** | **秦伯中軍大帳（夜）**<br>**全劇重心，四場戲都在這裡**。四盞青銅燈、低案、席位、地圖、帷幕。要有「談判桌」的壓迫感，但不能有兵器陳列（那會變成威嚇場面）。 | `realistic Chinese ink-wash painting, muted colors, interior of an ancient Chinese ruler's command tent at night, Spring and Autumn period, four bronze oil lamps on a low lacquered table, seating mats, a rolled map, heavy drapery, warm lamplight against deep shadow, austere and tense negotiation atmosphere, NO weapons displayed, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **qin_camp_dawn.png** | **秦營拔營（拂曉）**<br>帳篷收起一半、車隊列成西向、晨霧。撤退，而非潰散。 | `realistic Chinese ink-wash painting, muted colors, ancient Chinese military camp breaking up at dawn, half the tents already struck and folded, supply carts forming an orderly column heading west, morning mist, calm disciplined withdrawal, distant tiny figures only, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |

### 四、晉營

| 檔案名稱 | 場景描述 | AI 生圖提示詞 (Prompt) |
| :--- | :--- | :--- |
| **jin_camp_dawn.png** | **函陵晉營（拂曉）**<br>視角切換用。比秦營更大、更氣派，帳幕層疊。 | `realistic Chinese ink-wash painting, muted colors, large imposing ancient Chinese military camp at dawn, layered rows of great tents and banners, more grand than a common camp, cold morning light, hills behind, NO people or only tiny distant silhouettes, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |
| **jin_camp_empty.png** | **空了的營地（正午）**<br>**全劇最後一張，也是主題圖**：三百多個灶坑、幾道車轍、沒帶走的木柵。空地即結論——沒有打起來的仗，不會留下遺址。 | `realistic Chinese ink-wash painting, muted colors, an abandoned military campsite at noon, hundreds of circular cooking-fire pits in the earth, wheel ruts, a few leftover wooden stakes and fence sections, dry autumn grass beginning to stand again, vast emptiness, quiet and strangely peaceful, NO people, completely empty scene, devoid of characters, highly detailed, 16:9 aspect ratio, wide landscape, NO text, NO watermarks, NO signatures` |

---

## 🧍 立繪 (Sprites) - 基準圖與差分編輯工作流

為確保同角色的臉部與服裝在不同表情下保持 100% 一致，請採用 **「基準圖 + 局部修改 (Image-to-Image / Inpainting)」** 工作流：
1. 先使用 **基礎立繪提示詞 (Base Prompt)** 生成該角色的 `normal` (普通/預設) 表情。
2. 基準圖確認無誤後，將其作為參考圖 (Image Input) 餵給 AI，並使用對應的 **差分表情修改提示詞 (Edit Prompts)** 僅針對臉部進行表情替換。

| 角色 | 角色描述 | 基礎立繪提示詞 (Base Prompt - Normal) | 差分表情修改提示詞 (Edit Prompts) |
| :--- | :--- | :--- | :--- |
| **燭之武** | 七十歲的鄭國圉正。**關鍵**：他必須看起來像個真正做粗活的老人——手粗、背微駝、衣服是麻布而非絲帛。臉上要有「等太久了」的東西。 | `realistic Chinese ink-wash painting, pure solid white background, a seventy-year-old Chinese man of the Spring and Autumn period, thin and slightly stooped, deeply lined weathered face, sparse white beard, calloused working hands, plain coarse hemp robes of a lowly official, quiet composed and unremarkable expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **bitter**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a restrained bitterness, lips pressed thin, eyes lowered with decades of swallowed grievance.`<br>**calm**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a perfectly composed, humble and unreadable expression, slightly bowed head.`<br>**sharp**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to intensely alert and piercing eyes, the sudden clarity of an old man who sees exactly what to say.` |
| **鄭伯**（鄭文公） | 五十餘歲的小國之君。**設計重點**：不是昏君，是一個「一直在選邊、選得很累」的人。 | `realistic Chinese ink-wash painting, pure solid white background, a Chinese feudal lord in his fifties, Spring and Autumn period, dark embroidered silk robes and a low ceremonial cap, well-fed but tired features, guarded neutral expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **arrogant**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a dismissive, faintly contemptuous look, chin slightly raised.`<br>**humble**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a genuinely apologetic and lowered expression, the face of a ruler forced to admit fault.`<br>**anxious**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to deep anxiety, furrowed brow, eyes darting, sheen of worry.` |
| **佚之狐** | 四十餘歲的鄭國大夫。**唯一相信主角的人**。眼神要有「一直在觀察」的質地。 | `realistic Chinese ink-wash painting, pure solid white background, a Chinese court official in his forties, Spring and Autumn period, modest dark robes and scholar's cap, lean attentive face, observant intelligent eyes, calm normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **urgent**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to urgent conviction, leaning intensity, brows drawn together, someone staking his judgment on another man.` |
| **秦伯**（秦穆公） | 六十餘歲，在位三十年。**設計重點**：他是全劇真正的對手——不是暴君，是一個**極其精明的生意人**。眼神應該像在秤東西。 | `realistic Chinese ink-wash painting, pure solid white background, a Chinese sovereign in his sixties, Spring and Autumn period, greying beard and hair, heavy dark robes with jade ornaments, shrewd calculating eyes, thirty years of rule in his bearing, composed and evaluating normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **wary**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to guarded suspicion, narrowed appraising eyes, weighing the speaker.`<br>**thinking**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to deep inward calculation, gaze fixed on something far off, a man running numbers in his head.`<br>**pleased**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to genuine appreciative pleasure, a slight satisfied smile, the look of a man who has just been shown a better deal.` |
| **晉侯**（晉文公重耳） | 六十餘歲。流亡十九年才即位的霸主。**設計重點**：臉上要同時有「忍過十九年」與「終於得到一切」兩種東西。 | `realistic Chinese ink-wash painting, pure solid white background, a Chinese hegemon-lord in his sixties, Spring and Autumn period, imposing bearing, weathered face marked by nineteen years of exile, greying beard, dark ceremonial armor over robes, commanding and self-possessed normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **weary**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a deep, restrained weariness, the look of a man choosing to let something go.` |
| **子犯**（狐偃） | 晉侯的舅父，跟著他流亡十九年的老臣。急躁、忠誠、主戰。 | `realistic Chinese ink-wash painting, pure solid white background, a Chinese general in his sixties, Spring and Autumn period, grizzled beard, weather-beaten soldier's face, practical dark armor, blunt and forthright normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | **angry**: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to indignant urgency, eyes wide with frustration, mouth open in mid-protest.` |
| **杞子** | 秦國將領，後來奉命戍鄭。年輕、恭謹，是一枚**伏筆**（兩年後的殽之戰）。 | `realistic Chinese ink-wash painting, pure solid white background, a young Chinese military officer in his thirties, Spring and Autumn period, simple functional armor, disciplined upright posture, respectful attentive normal expression, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | *(無其他差分，僅需要 normal 表情)* |
| **秦軍哨官** | 轅門值夜的中年軍官。**不是惡人**——他只是在做他該做的事。 | `realistic Chinese ink-wash painting, pure solid white background, a middle-aged Chinese sentry officer, Spring and Autumn period, plain leather armor, holding a torch, alert professional expression, neither hostile nor friendly, full body portrait, NO text, NO stamps, NO watermarks, NO signatures` | *(無其他差分，僅需要 normal 表情)* |

---

## 🎵 音樂素材需求 (BGM) — 共 15 首

| 檔案名稱 | 使用場景 | 氛圍描述 |
| :--- | :--- | :--- |
| **bgm_unused.mp3** | 01、02 馬廄；堅辭時 | **本劇主題曲**。單一樂器（塤或簫），旋律不完整、一再中斷——「一生沒有被說完的話」 |
| **bgm_cold_court.mp3** | 01 城門、02 朝堂 | 疏離的編鐘與磬，冷、有距離感，權力的無情 |
| **bgm_thinking.mp3** | 01、02、04、08 尾、11 | 低音撥弦，緩慢，像在數數——「有人在算帳」 |
| **bgm_night_quiet.mp3** | 01 送糧、02 夜 | 極安靜的琴，幾乎只有餘韻 |
| **bgm_siege.mp3** | 03 圍城 | 低頻持續音，不成旋律，像遠處的壓力。**不要戰鼓** |
| **bgm_planning.mp3** | 04 佚之狐薦、08 開場 | 懸疑深沉的謀畫音樂，暗流 |
| **bgm_tension.mp3** | 05、09、12 | 低沉弦樂，繃緊但不爆發 |
| **bgm_doubt.mp3** | 05、09 尾、10、12 | 猜忌與心理博弈，兩個聲部互相試探 |
| **bgm_hurry.mp3** | 05 結尾、06 縋城 | 節奏快、危機感，但音量克制（夜行不能吵） |
| **bgm_night_tense.mp3** | 06 尾、07 至秦營 | 心跳般的低頻脈動，陌生環境的警戒感 |
| **bgm_resolve.mp3** | 11 成功、13 鄭伯親迎 | 豁然開朗的一段旋律，克制的釋然而非勝利號角 |
| **bgm_dawn.mp3** | 11 送別、13 歸城 | 拂曉的笛聲，清冷、乾淨、有距離 |
| **bgm_ending_full.mp3** | 結局：夜縋而出 | 完整版主題曲——**bgm_unused 的旋律終於被完整奏完一次**（全劇最重要的音樂設計） |
| **bgm_ending_quiet.mp3** | 結局：盟而未固、見拒、不出 | 留白的琴音，未解決和弦收尾 |
| **bgm_ending_bitter.mp3** | 結局：名不傳 | 主題曲的旋律，但由一件更小的樂器獨奏，最後一個音提早收掉 |

> **音樂總設計**：`bgm_unused`（不遇）與 `bgm_ending_full`（完整）是同一段旋律的兩個版本。玩家在第一章聽見的殘缺主題，只有在最好的結局才會被完整地演奏一次。這是整套 BGM 的核心構想，請務必由同一位作曲者統一處理。

---

## 🔊 音效素材需求 (SE) — 共 16 種

| 檔案名稱 | 發生情境 | AI 生成提示詞 / 聲音描述 |
| :--- | :--- | :--- |
| **se_rope_creak.mp3** | **夜縋而出**（全劇最重要的音效） | `Thick hemp rope creaking and straining under weight, wooden winch turning slowly, tense and fibrous sound.` |
| **se_wind_high.mp3** | 城牆頂、縋城途中 | `High cold wind at great height, hollow and lonely, whistling past stone.` |
| **se_wind_banner.mp3** | 城牆上遠望 | `Steady wind snapping a heavy cloth banner, distant and open outdoor space.` |
| **se_land_soft.mp3** | 落地 | `Soft thud of feet landing on damp earth and dry grass, small stones shifting.` |
| **se_torch_flare.mp3** | 哨兵舉火把 | `A torch suddenly flaring up close, whoosh of flame catching in cold night air.` |
| **se_tent_flap.mp3** | 掀開帳簾 | `Heavy canvas tent flap being pulled open, thick fabric rustling.` |
| **se_cup_down.mp3** | **秦伯放下杯子**（心理轉折的標記音） | `A bronze cup being set down on a lacquered wooden table, single clear resonant tap.` |
| **se_heavy_thud.mp3** | 秦伯按案 | `Heavy palm striking a thick wooden table once, deep dull impact.` |
| **se_scroll_open.mp3** | 寫盟書 | `Wooden writing slips being unrolled and laid flat, dry clacking of bamboo strips.` |
| **se_door_close.mp3** | 前傳，殿門關上 | `A heavy ancient wooden door closing slowly, low groan and final soft thud.` |
| **se_horse_snort.mp3** | 馬廄 | `A horse snorting and shifting in a stable, hooves on packed earth, straw rustling.` |
| **se_murmur.mp3** | 殿上議論 | `A small group of men murmuring in a large hall, indistinct voices, slight echo.` |
| **se_footsteps_many.mp3** | 火把隊伍進出馬廄 | `Multiple pairs of feet walking on packed earth, several people approaching then departing.` |
| **se_footsteps_single.mp3** | 鄭伯獨自走進馬廄 | `Single set of measured footsteps on packed earth, unhurried, entering a quiet space.` |
| **se_footsteps_fast.mp3** | 子犯急入晉帳 | `Fast urgent footsteps approaching on hard ground, armor rustling, someone bringing news.` |
| **se_camp_move.mp3** | **拔營**（兩次：秦、晉） | `A large military camp breaking up, canvas being folded, wooden stakes pulled from earth, cart wheels beginning to roll, many low voices, no shouting.` |

---

## 🎬 特效鏡頭 (VFX) - 劇本編排說明

本劇沒有戰鬥場面，所有特效都用於**心理張力**而非動作：

- **鏡頭推近 (Camera Zoom)**: `@camera zoom=1.2 duration=800`
  - *使用時機*：說出關鍵辭令的瞬間（「鄭既知亡矣」「鄰之厚，君之薄也」「既東封鄭，又欲肆其西封」）。**這是本劇最常用的特效**——談判的張力靠鏡頭距離表現。
- **暗角 (Vignette)**: `@camera vignette=0.5 duration=1500`
  - *使用時機*：縋城途中、各結局。收攏視野，製造「只剩下這件事」的專注感。
- **輕微震動 (Shake)**: `@shake 5 duration=350`
  - *使用時機*：**全劇只用一次**——秦伯拍案（10 場「逼問」路線）。因為只用一次，所以那一下特別重。
- **閃光 (Flash)**: `@flash #ffddaa duration=300`
  - *使用時機*：**全劇只用一次**——哨兵在黑暗中突然舉起火把。暖色而非白色，是火光不是刀光。
- **粒子 (Particles)**: `@particles rain density=20`
  - *使用時機*：縋城前的夜露／細雨，密度要低（20），是濕冷不是暴雨。
- **等待 (Wait)**: `@wait 900` ~ `@wait 1200`
  - *使用時機*：**本劇最重要的「特效」**。秦伯沉默的每一次、燈燒短的每一次，都靠 `@wait` 撐出來。談判戲的節奏就是沉默的長度，請勿在後續修改時刪減這些等待。

---

## 🎯 教學設計附錄：Flag 與分支地圖

### Flag 一覽

| Flag | 意義 | 範圍 | 主要來源場景 |
| :--- | :--- | :--- | :--- |
| `懷才不遇` | 三十年不被用的怨氣濃度 | 0–5 | 01、02、04、05、11 |
| `曾諫鄭伯` | 前傳是否留下「敢言」的名聲 | 0–2 | 01（影響 04 佚之狐的舉薦說詞） |
| `鄭伯之信` | 與鄭伯的君臣關係 | -1–4 | 05、06、11、13 |
| `秦伯戒心` | **越高越糟**，壓低是前置任務 | -3–7 | 05、07、08、09、10 |
| `姿態分寸` | 「鄭既知亡矣」的示弱是否到位 | -1–4 | 06、08 |
| `秦國之利` | 「舍鄭以為東道主」的利益論證力 | 0–4 | 04、09 |
| `秦晉之隙` | 焦瑕背信＋東封西封的離間力 | 0–7 | 06、07、09、10 |
| `說理次序` | 是否遵循「示弱→言利→離間」 | -1–2 | 06、09 |
| `留戍杞子` | 是否促成秦將戍鄭（殽之戰伏筆） | 0–1 | 09、11 |
| `晉文之量` | 晉文公「不仁／不知／不武」的自持程度 | 1–3 | 12（由 `秦晉之隙` 決定） |
| `說服總分` | 結算用（於 11 場計算） | — | 11 |

### 結算公式（`11_秦伯之決` 開頭）

```
說服總分 = 秦國之利階梯 + 秦晉之隙階梯 + 說理次序階梯 - 秦伯戒心階梯
若 姿態分寸 < 1  → 說服總分 -= 3
若 姿態分寸 >= 3 → 說服總分 += 1
```

### 結局觸發條件

| 結局 ID | 觸發條件 |
| :--- | :--- |
| `ending_退秦師` | 說服總分 ≥ 7 且 姿態分寸 ≥ 2 且 懷才不遇 < 3 |
| `ending_名不傳` | 說服總分 ≥ 7 且 姿態分寸 ≥ 2 且 懷才不遇 ≥ 3 |
| `ending_盟而未固` | 說服總分 4–6 |
| `ending_見拒` | 說服總分 ≤ 3 |
| `ending_不出` | 於 `05_夜辭` 選擇堅辭到底（不受總分影響） |

### 分支地圖

```
01 圉人
  └─ 面對「無禮於晉」（附和/進言/記下/送糧）   ← 功能A+B，埋伏筆「曾諫鄭伯」

02 貳於楚
  └─ 面對譏笑（認了/寫了燒掉/自嘲/去換蹄鐵）  ← 功能B，決定「懷才不遇」濃度

03 函陵氾南（無選項）                          ← 關鍵情報：兩軍分駐

04 狐薦
  └─ 夜裡想的是什麼（怨/秦營/井/佚之狐）      ← 功能A+B

05 夜辭
  └─ 如何推辭（原文/身分/怨氣/直接答應）      ← 功能A+B
  └─ 【第一分流】許之 / 堅辭 ─────────────→ ending_不出

06 縋城
  └─ 下城時想起什麼（門/師必退/井/過一遍話）  ← 功能B，各給一分不同的 flag

07 至秦營
  └─ 自報身分（使者/亡臣/投奔/獻策）          ← 功能A+B，決定初始戒心

08 開場姿態
  └─ 【核心】示弱/持平/逞強/哀求               ← 功能C，決定後兩段是否打折

09 論利害
  └─ 【核心】地理/鄰厚/東道主/搶快             ← 功能C

10 論舊怨
  └─ 【核心】含蓄/背信/東封/逼問               ← 功能C

11 秦伯之決（結算）
  └─ 送別問答（圉正/自嘲/為臣）                ← 功能A
  └─ 失敗 ──────────────────────────────→ ending_見拒

12 晉營（無選項，視角切換）                     ← 晉文公三句「不仁不知不武」

13 歸城
  └─ 依 說服總分 × 懷才不遇 分流 ────────→ ending_退秦師 / 名不傳 / 盟而未固
```

### 給教師的三個提問設計

1. **為什麼「鄭既知亡矣」要放在第一句？**（對應 08 場四個選項的不同下場——逞強與哀求都會失敗，但失敗的方式不同）
2. **為什麼「焦、瑕」不能一開口就講？**（對應 09 場「搶快」路線——同樣的內容，次序錯了就從「替你著想」變成「挑撥離間」）
3. **燭之武成功了嗎？**（對應 `ending_退秦師` 與 `ending_名不傳` 的差異——同樣的結果，兩種人生）
