// ============================================
// Linter.js
// 靜態分析劇本，找出錯誤與警告
// ============================================

export class Linter {
  /**
   * @param {StoryProject} project
   * @returns {Array<{level, sceneId, index, message}>}
   *   level: "error" | "warning" | "info"
   */
  static analyze(project) {
    const issues = [];
    if (!project.storyMeta) return issues;

    const sceneIds = new Set(project.getAllSceneIds());
    const startId = project.storyMeta.start;
    const characters = new Set(Object.keys(project.storyMeta.characters || {}));
    const resources = {
      bg: new Set(project.resources.backgrounds),
      char: new Set(project.resources.characters),
      bgm: new Set(project.resources.bgm),
      se: new Set(project.resources.se),
    };

    // ========== 全域檢查 ==========

    if (!startId) {
      issues.push({ level: "error", sceneId: null, index: null, message: "story.json 未指定 start 場景" });
    } else if (!sceneIds.has(startId)) {
      issues.push({ level: "error", sceneId: null, index: null, message: `start 指向不存在的場景: ${startId}` });
    }

    // ========== 蒐集所有 flag 使用 ==========

    const flagSet = new Map();  // flag -> [{sceneId, index}]
    const flagRead = new Map(); // flag -> [{sceneId, index}]

    for (const sceneId of sceneIds) {
      const scene = project.getScene(sceneId);
      scene.instructions.forEach((ins, idx) => {
        if (ins.type === "set") {
          if (!flagSet.has(ins.key)) flagSet.set(ins.key, []);
          flagSet.get(ins.key).push({ sceneId, index: idx });
        }
        if (ins.type === "if" || ins.type === "elif") {
          this.#extractFlagsFromCondition(ins.condition).forEach(f => {
            if (!flagRead.has(f)) flagRead.set(f, []);
            flagRead.get(f).push({ sceneId, index: idx });
          });
        }
        if (ins.type === "choice") {
          for (const opt of ins.options) {
            for (const k of Object.keys(opt.set || {})) {
              if (!flagSet.has(k)) flagSet.set(k, []);
              flagSet.get(k).push({ sceneId, index: idx });
            }
          }
        }
      });
    }

    // ========== 每個場景的檢查 ==========

    for (const sceneId of sceneIds) {
      const scene = project.getScene(sceneId);
      const sceneIssues = this.#lintScene(scene, {
        sceneIds, characters, resources, flagSet, flagRead,
      });
      issues.push(...sceneIssues);
    }

    // ========== 可達性分析 ==========

    if (startId && sceneIds.has(startId)) {
      const reachable = this.#findReachableScenes(project, startId);
      for (const id of sceneIds) {
        if (!reachable.has(id)) {
          issues.push({
            level: "warning",
            sceneId: id,
            index: null,
            message: "這個場景從 start 無法到達（沒有 goto/next/choice 指向它）",
          });
        }
      }
    }

    // ========== Flag 使用警告 ==========

    // 被讀取但從未設定的 flag（可能是 typo）
    for (const [flag, reads] of flagRead) {
      if (!flagSet.has(flag)) {
        for (const loc of reads) {
          issues.push({
            level: "warning",
            sceneId: loc.sceneId,
            index: loc.index,
            message: `條件引用了從未被設定的 flag: "${flag}"（拼字錯誤？）`,
          });
        }
      }
    }

    // 被設定但從未讀取（不算錯，但標為 info）
    for (const [flag, sets] of flagSet) {
      if (!flagRead.has(flag)) {
        // 只報第一個
        const loc = sets[0];
        issues.push({
          level: "info",
          sceneId: loc.sceneId,
          index: loc.index,
          message: `flag "${flag}" 被設定但從未在條件中使用`,
        });
      }
    }

    return issues;
  }

  static #lintScene(scene, ctx) {
    const issues = [];
    const { sceneIds, characters, resources } = ctx;
    const sceneId = scene.meta.id;

    // 檢查 meta.next
    if (scene.meta.next && !sceneIds.has(scene.meta.next)) {
      issues.push({
        level: "error",
        sceneId,
        index: null,
        message: `meta.next 指向不存在的場景: ${scene.meta.next}`,
      });
    }

    // 檢查 meta.background
    if (scene.meta.background && !resources.bg.has(scene.meta.background)) {
      issues.push({
        level: "warning",
        sceneId,
        index: null,
        message: `背景檔案不存在: ${scene.meta.background}`,
      });
    }

    // 收集場景內所有 label
    const labels = new Set();
    scene.instructions.forEach(ins => {
      if (ins.type === "label") labels.add(ins.name);
    });

    // if/endif 平衡檢查
    let ifDepth = 0;
    let choiceDepth = 0;
    scene.instructions.forEach((ins, idx) => {
      // 控制流程平衡
      if (ins.type === "if") ifDepth++;
      if (ins.type === "endif") {
        ifDepth--;
        if (ifDepth < 0) {
          issues.push({
            level: "error", sceneId, index: idx,
            message: "多餘的 endif（沒有對應的 if）",
          });
        }
      }
      if (ins.type === "elif" || ins.type === "else") {
        if (ifDepth <= 0) {
          issues.push({
            level: "error", sceneId, index: idx,
            message: `${ins.type} 不在任何 if 區塊內`,
          });
        }
      }

      // 個別指令檢查
      switch (ins.type) {
        case "if":
        case "elif":
          if (!ins.condition || !ins.condition.trim()) {
            issues.push({ level: "error", sceneId, index: idx, message: `${ins.type} 缺少條件` });
          }
          break;

        case "label":
          if (!ins.name) {
            issues.push({ level: "error", sceneId, index: idx, message: "label 缺少名稱" });
          }
          break;

        case "goto": {
          if (!ins.target) {
            issues.push({ level: "error", sceneId, index: idx, message: "goto 缺少目標" });
          } else if (!labels.has(ins.target) && !sceneIds.has(ins.target)) {
            issues.push({
              level: "error", sceneId, index: idx,
              message: `goto 目標「${ins.target}」既不是本場景的 label，也不是已存在的場景`,
            });
          }
          break;
        }

        case "set":
          if (!ins.key) {
            issues.push({ level: "error", sceneId, index: idx, message: "set 缺少 flag 名稱" });
          } else if (!/^[a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*$/.test(ins.key)) {
            issues.push({ level: "error", sceneId, index: idx, message: `flag 名稱不合法: "${ins.key}"` });
          }
          break;

        case "ending":
          if (!ins.id) {
            issues.push({ level: "warning", sceneId, index: idx, message: "結局缺少 id（圖鑑無法記錄）" });
          }
          if (!ins.title) {
            issues.push({ level: "warning", sceneId, index: idx, message: "結局缺少標題" });
          }
          break;

        case "text":
          if (ins.speaker && characters.size > 0 && !characters.has(ins.speaker)
              && !["主角", "旁白"].includes(ins.speaker)
              && !ins.speaker.match(/^(主角|旁白)/)) {
            issues.push({
              level: "info", sceneId, index: idx,
              message: `角色「${ins.speaker}」未在 story.json 中定義`,
            });
          }
          break;

        case "choice": {
          if (choiceDepth > 0) {
            issues.push({ level: "warning", sceneId, index: idx, message: "選項內的巢狀選項可能運作異常" });
          }
          if (!ins.options || ins.options.length === 0) {
            issues.push({ level: "error", sceneId, index: idx, message: "選項區塊為空" });
          } else if (ins.options.length < 2) {
            issues.push({ level: "warning", sceneId, index: idx, message: "選項只有一個（失去選擇的意義）" });
          }
          (ins.options || []).forEach((opt, oi) => {
            if (!opt.text) {
              issues.push({ level: "error", sceneId, index: idx, message: `第 ${oi + 1} 個選項缺少文字` });
            }
            if (opt.goto && !labels.has(opt.goto) && !sceneIds.has(opt.goto)) {
              issues.push({
                level: "error", sceneId, index: idx,
                message: `選項「${opt.text}」的 goto 目標「${opt.goto}」不存在`,
              });
            }
          });
          break;
        }

        case "directive": {
          const name = ins.name;
          const pos = ins.args?.positional || [];
          if (name === "bg" && pos[0] && !resources.bg.has(pos[0])) {
            issues.push({
              level: "warning", sceneId, index: idx,
              message: `背景檔案不存在: ${pos[0]}`,
            });
          }
          if (name === "show" || name === "hide" || name === "move") {
            const charName = pos[0];
            if (charName && charName !== "all" && characters.size > 0 && !characters.has(charName)) {
              issues.push({
                level: "warning", sceneId, index: idx,
                message: `角色「${charName}」未在 story.json 中定義`,
              });
            }
            if (name === "show") {
              const emotion = pos[2];
              const charData = ctx.charactersData?.[charName];
              if (emotion && charData?.emotions && !charData.emotions[emotion]) {
                issues.push({
                  level: "info", sceneId, index: idx,
                  message: `角色「${charName}」沒有定義「${emotion}」表情`,
                });
              }
              const slot = pos[1];
              if (slot && !["left", "center", "right"].includes(slot)) {
                issues.push({
                  level: "error", sceneId, index: idx,
                  message: `立繪位置必須是 left/center/right，不能是「${slot}」`,
                });
              }
            }
          }
          if (name === "bgm" && pos[0] && !resources.bgm.has(pos[0])) {
            issues.push({
              level: "info", sceneId, index: idx,
              message: `BGM 檔案不存在: ${pos[0]}（目錄中找不到）`,
            });
          }
          if (name === "se" && pos[0] && !resources.se.has(pos[0])) {
            issues.push({
              level: "info", sceneId, index: idx,
              message: `音效檔案不存在: ${pos[0]}`,
            });
          }
          break;
        }
      }
    });

    if (ifDepth > 0) {
      issues.push({
        level: "error", sceneId, index: null,
        message: `有 ${ifDepth} 個 if 沒有對應的 endif`,
      });
    }

    return issues;
  }

  static #extractFlagsFromCondition(expr) {
    if (!expr) return [];
    // 先去除字串字面量（"..." 或 '...'），避免把字串內容當成 flag
    const withoutStrings = expr
      .replace(/"([^"\\]|\\.)*"/g, "")
      .replace(/'([^'\\]|\\.)*'/g, "");
    const flags = [];
    const regex = /([a-zA-Z_\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff][\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]*)/g;
    const reserved = new Set(["true", "false", "null"]);
    let m;
    while ((m = regex.exec(withoutStrings)) !== null) {
      if (!reserved.has(m[1])) flags.push(m[1]);
    }
    return [...new Set(flags)];
  }

  static #findReachableScenes(project, startId) {
    const reachable = new Set();
    const queue = [startId];
    while (queue.length > 0) {
      const id = queue.shift();
      if (reachable.has(id)) continue;
      reachable.add(id);
      const scene = project.getScene(id);
      if (!scene) continue;
      // 從 meta.next 以及所有 goto / choice.goto 找出下一步
      if (scene.meta.next) queue.push(scene.meta.next);
      for (const ins of scene.instructions) {
        if (ins.type === "goto" && ins.target) {
          if (project.getScene(ins.target)) queue.push(ins.target);
        }
        if (ins.type === "choice") {
          for (const opt of ins.options) {
            if (opt.goto && project.getScene(opt.goto)) queue.push(opt.goto);
          }
        }
      }
    }
    return reachable;
  }
}
