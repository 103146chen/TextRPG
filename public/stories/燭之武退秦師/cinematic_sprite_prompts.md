# 《燭之武退秦師》角色立繪提示詞與設定彙整 (Sprite Prompts & Behaviors)

本文件專門彙整《燭之武退秦師》劇本中所需的所有人物立繪提示詞，適用於 **Google Flow**。
為了讓 Google Flow 能生成符合歷史背景與性格特徵的人物形象，本文件特別為每位角色加入了**「角色行為方式、舉止姿態、與服飾細節」**的敘述，並結合 **「基礎立繪 (Base) + 差分微調 (Edit)」** 的工作流來確保角色形象的一致性。

---

## 🎨 Google Flow 立繪生成通則
1. **背景控制**: 必須使用 `pure solid white background` 以方便去背，並強制加入 `NO text, NO stamps, NO watermarks, NO signatures` 來排除印章、簽名與浮水印。
2. **全身構圖**: 必須包含 `full body portrait`，保證服飾與站姿的完整性。比例大約為 1:2，生成後會手動裁切為 512x1024。
3. **歷史考究**: 時代設定為**春秋中期**（西元前 630 年），人物身著「春秋深衣」，冠式較低，且服飾與甲冑比秦漢時期更為古樸、不奢華。
4. **工作流**: 
   - **第一步**：使用 **基礎立繪提示詞 (Base Prompt - Normal)** 生成角色的預設表情作為基準圖。
   - **第二步**：在 Google Flow 中，將基準圖作為**參考圖 (Image Input)** 或是使用 Inpainting 功能，並用 **微調提示詞 (Edit Prompt)** 僅重繪面部表情。

---

## 🧍 角色名單與提示詞設定

### 1. 燭之武 (Zhu Zhiwu)
* **角色背景**: 鄭國圉正（負責養馬的低階官吏），已是七十歲垂暮之年，長年懷才不遇。
* **行為舉止與姿態**: 
  - 身體因幾十年的粗活而有些微駝（slightly stooped），身形消瘦而堅韌。
  - 雙手長滿老繭，站立時習慣將雙手交疊收在袖中，或者雙手自然下垂，顯得卑微卻不失骨氣。
  - 神態內斂、沉靜，說話緩慢而有分量，透露出歲月磨練出的通透與隱忍。
* **服飾特徵**: 穿著極其樸素的深色粗麻布深衣（coarse hemp robes），沒有任何多餘的華麗刺繡，腰間僅以布帶束緊。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`zhuzhiwu_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a seventy-year-old Chinese man of the Spring and Autumn period, thin and slightly stooped, deeply lined weathered face, sparse white beard, calloused working hands, plain coarse hemp robes of a lowly official, quiet composed and unremarkable expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **bitter (悲憤/不甘)** （劇本中命名：`zhuzhiwu_bitter.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a restrained bitterness, lips pressed thin, eyes lowered with decades of swallowed grievance.`
  - **calm (沉著/卑謙)** （劇本中命名：`zhuzhiwu_calm.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a perfectly composed, humble and unreadable expression, slightly bowed head.`
  - **sharp (犀利/洞察)** （劇本中命名：`zhuzhiwu_sharp.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to intensely alert and piercing eyes, the sudden clarity of an old man who sees exactly what to say.`

---

### 2. 鄭伯 (Zheng Bo - 鄭文公)
* **角色背景**: 五十餘歲的小國之君，面臨強敵圍城、進退兩難。
* **行為舉止與姿態**: 
  - 雖然身為一國之君，但因局勢壓迫，站姿或坐姿顯得有些疲倦與沉重（weary bearing）。
  - 常有踱步、扶額或雙手微微顫抖等焦慮的肢體語言，眼神游移不穩，試圖維持尊嚴但難掩驚慌。
* **服飾特徵**: 身穿深色的刺繡絲綢華服（embroidered silk robes），頭戴象徵諸侯身分的低矮冠冕（low ceremonial cap），腰繫玉珮，但服飾細節略顯陳舊，反映國力衰落。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`zhengbo_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a Chinese feudal lord in his fifties, Spring and Autumn period, dark embroidered silk robes and a low ceremonial cap, well-fed but tired features, guarded neutral expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **arrogant (傲慢)** （劇本中命名：`zhengbo_arrogant.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a dismissive, faintly contemptuous look, chin slightly raised.`
  - **humble (卑下/致歉)** （劇本中命名：`zhengbo_humble.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a genuinely apologetic and lowered expression, the face of a ruler forced to admit fault.`
  - **anxious (焦慮)** （劇本中命名：`zhengbo_anxious.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to deep anxiety, furrowed brow, eyes darting, sheen of worry.`

---

### 3. 佚之狐 (Yi Zhihu)
* **角色背景**: 四十餘歲的鄭國大夫，有識人之明，是全劇唯一看透並舉薦主角的人。
* **行為舉止與姿態**: 
  - 身姿挺拔而微微前傾，眼神敏銳專注，顯示出隨時在觀察局勢的知識分子氣質（observant intelligence）。
  - 舉手投足間帶著文臣的知禮與理智，舉薦時神色堅定、懇切。
* **服飾特參**: 穿著整齊乾淨的深色官員服飾（modest dark robes），頭戴規整的學者冠帽（scholar's cap）。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`yizhihu_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a Chinese court official in his forties, Spring and Autumn period, modest dark robes and scholar's cap, lean attentive face, observant intelligent eyes, calm normal expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **urgent (急切/力薦)** （劇本中命名：`yizhihu_urgent.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to urgent conviction, leaning intensity, brows drawn together, someone staking his judgment on another man.`

---

### 4. 秦伯 (Qin Bo - 秦穆公)
* **角色背景**: 六十餘歲的秦國國君，春秋五霸之一，是個極度理性、權衡利弊的精明博弈者。
* **行為舉止與姿態**: 
  - 氣場強大，站立時雙手負於身後，或者端坐於席上，神態沉穩且具有壓迫感。
  - 眼神銳利而冷靜，注視說客時彷彿在衡量一件貨品的價值；思考時會輕撫下巴的灰色鬍鬚。
* **服飾特徵**: 穿著厚重的墨色華貴長袍（heavy dark robes），裝飾有精緻的古玉配飾（jade ornaments），蓄著灰白相間的鬍鬚，低冠。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`qinbo_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a Chinese sovereign in his sixties, Spring and Autumn period, greying beard and hair, heavy dark robes with jade ornaments, shrewd calculating eyes, thirty years of rule in his bearing, composed and evaluating normal expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **wary (警惕)** （劇本中命名：`qinbo_wary.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to guarded suspicion, narrowed appraising eyes, weighing the speaker.`
  - **thinking (盤算)** （劇本中命名：`qinbo_thinking.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to deep inward calculation, gaze fixed on something far off, a man running numbers in his head.`
  - **pleased (悅服/滿意)** （劇本中命名：`qinbo_pleased.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to genuine appreciative pleasure, a slight satisfied smile, the look of a man who has just been shown a better deal.`

---

### 5. 晉侯 (Jin Hou - 晉文公重耳)
* **角色背景**: 六十餘歲，流亡十九年後即位的霸主，威嚴、多疑、果決。
* **行為舉止與姿態**: 
  - 肩膀寬闊，站姿沉穩如松，雙手放在佩劍的劍柄上（不拔劍），給人隨時能發動戰爭的威脅感。
  - 臉部線條硬朗，帶有十九年野外流亡的風霜痕跡，眼神威嚴而冷漠，喜怒不形於色。
* **服飾特徵**: 穿著暗色的春秋制式青銅甲冑（dark ceremonial armor），內襯深色錦袍，頭戴低平的武將冠。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`jinhou_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a Chinese hegemon-lord in his sixties, Spring and Autumn period, imposing bearing, weathered face marked by nineteen years of exile, greying beard, dark ceremonial armor over robes, commanding and self-possessed normal expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **weary (隱忍/疲倦)** （劇本中命名：`jinhou_weary.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to a deep, restrained weariness, the look of a man choosing to let something go.`

---

### 6. 子犯 (Zi Fan - 狐偃)
* **角色背景**: 晉侯的舅父，同甘共苦的功臣，性格急躁火爆、主張以武力解決問題。
* **行為舉止與姿態**: 
  - 站姿張揚，常有單手按劍、或者揮手抗議等大幅度動作。
  - 粗眉圓眼，憤怒時目眥盡裂，嘴角緊繃，透露出軍人直白、不願退讓的急躁脾氣。
* **服飾特徵**: 身穿實用的戰鬥青銅皮甲（practical dark armor），衣著因長年征戰而略帶磨損。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`zifan_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a Chinese general in his sixties, Spring and Autumn period, grizzled beard, weather-beaten soldier's face, practical dark armor, blunt and forthright normal expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* **【表情微調提示詞】(Edit Prompts)**:
  - **angry (震怒/抗議)** （劇本中命名：`zifan_angry.png`）: `Keep the exact same character, body, clothing, pose, and background. Only change the facial expression to indignant urgency, eyes wide with frustration, mouth open in mid-protest.`

---

### 7. 杞子 (Qi Zi)
* **角色背景**: 三十餘歲的秦國年輕將領，奉命留戍鄭國。
* **行為舉止與姿態**: 
  - 站姿筆挺，雙手抱拳（拱手禮），身型勻稱。
  - 神色恭敬而嚴肅，眼神清澈、守禮，是一位高度服從命令的職業軍人。
* **服飾特徵**: 身穿秦軍制式的皮甲與簡單的青銅護面，頭戴低平的秦將小冠。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`qizi_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a young Chinese military officer in his thirties, Spring and Autumn period, simple functional armor, disciplined upright posture, respectful attentive normal expression, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* *(無其他差分，僅需要 normal 表情)*

---

### 8. 秦軍哨官 (Qin Sentry)
* **角色背景**: 秦營轅門值夜的中年軍官，克盡職守。
* **行為舉止與姿態**: 
  - 單手持火把，另一手按在腰間短兵上，身體微側，警惕地看著走近的來人。
  - 神色沉著、冰冷，沒有敵意但極為警覺，展現大國軍隊守衛的專業素養。
* **服飾特徵**: 身穿普通皮革與青銅甲片混合的防具（plain leather armor），外罩防寒的暗色斗篷。
* **【基礎立繪提示詞】(Base Prompt - Normal)** （劇本中命名：`qinsentry_normal.png`）:
  `cinematic style, realistic film still, character concept art, pure solid white background, a middle-aged Chinese sentry officer, Spring and Autumn period, plain leather armor, holding a torch, alert professional expression, neither hostile nor friendly, full body portrait, detailed textures, soft lighting, NO text, NO stamps, NO watermarks, NO signatures`
* *(無其他差分，僅需要 normal 表情)*
