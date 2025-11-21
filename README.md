# 问题模版平台：产品与架构设计说明

本文档说明如何在本地用纯 Node 项目搭建并运行一个“问题模版平台”。所有模版以静态 JSON 写死，Node 负责读取、展示、AI 完形填空与一键复制。仓库已包含最小可运行示例：两条模版、API 与简易前端。

## 1. JSON 设计：如何把模版写死

### 1.1 顶层结构（TemplateLibrary）
```jsonc
{
  "version": "0.1",
  "categories": [
    {
      "id": "text2text",
      "name": "文生文",
      "description": "文本到文本的模版集合",
      "templates": []
    }
  ]
}
```
* `version`：模版集版本号。
* `categories`：五个垂类分别为 `text2text | text2image | text2video | text2doc | text2artifact`。

### 1.2 Category
* `id`：垂类 ID。
* `name`：垂类名称。
* `description`：该类用途说明。
* `templates`：该类下的模版数组。

### 1.3 Template
* `id`：全局唯一（如 `T1_explain_to_target`）。
* `name`：模版名（用户可见）。
* `short_description`：一句话说明用途。
* `category_id`：所属垂类。
* `prompt_template`：主 Prompt，使用 `{{placeholder}}` 占位符。
* `placeholders`：占位符定义数组。
* `controls`：可调节的输出控制字段（可与 placeholders 复用）。
* `evaluation_rules`：输出检查规则。
* `tags`：标签。
* `example_inputs`（可选）：few-shot 示例。
* `notes_for_author`、`model_hint`（可选）：维护/模型提示。

### 1.4 Placeholder
* `key`：与 `prompt_template` 中的占位符一致。
* `label`：UI 字段名。
* `type`：`string | textarea | number | enum | boolean`。
* `required`：是否必填。
* `hint`：填写提示。
* `default`（可选）：默认值。
* `ai_fill`：是否允许 AI 填写。
* `enum_options`（当 type=enum）。
* `constraints`：长度/范围等限制。

### 1.5 Control
* 结构可与 Placeholder 复用，附加 `control_type`：`length | style | audience | structure | safety | other`，用于 UI 高亮“可调参”项。

### 1.6 EvaluationRules
* `auto_checks`：未来可自动检查的规则描述（当前仅展示）。
* `manual_checklist`：人工自查清单。

### 1.7 ExampleInput
* `name`：示例名。
* `placeholder_values`：示例填充值对象。
* `notes`（可选）：补充说明。

### 1.8 五个垂类的差异化字段建议
* 文生文：受众、长度、风格、语言、结构；可展示预期输出结构示例。
* 文生图：画风、构图、角色一致性、分辨率；规则区可提示多图变体说明。
* 文生视频：平台、时长、节奏、分镜粒度；预览可标记时间段（如【0–3s】）。
* 文生文档：文档结构、目标读者、时间尺度；右侧显示大纲作为只读说明。
* 文生产物：语言/格式、严谨性（合法 JSON/代码）、测试要求；可提示“复制为代码块”。

---

## 2. Node 架构：纯后端/静态前端的分层

### 2.1 目录示意
* `/data`：`templates.json`（所有模版写死其内）。
* `/src`
  * `server.ts`：启动 HTTP 服务、注册路由、托管静态文件（TypeScript 编译到 `dist/` 运行）。
  * `templateLoader.ts`：读取/校验/缓存 `templates.json`（校验占位符一致性、ID 唯一等）。
  * `promptRenderer.ts`：用用户输入或 AI 建议替换占位符生成最终 Prompt。
  * `aiFiller.ts`：封装 LLM 调用，产出填空 JSON。
  * `/routes/templates.ts`：REST API（列表、详情、渲染、AI 填空）。
* `/public`：极简静态前端（HTML/CSS/JS），由 Node 静态托管。

### 2.2 核心 API 流程
1. **启动加载模版**：`templateLoader` 读取并缓存 `templates.json`。
2. **列出模版**：`GET /templates?category=text2doc` → 返回 id/name/description/tags。
3. **获取详情**：`GET /templates/:id` → 返回完整模板定义。
4. **渲染 Prompt**：`POST /templates/:id/render`，传入 `placeholderValues`，由 `promptRenderer` 替换占位符，返回 `rendered_prompt`。
5. **AI 完形填空**：`POST /templates/:id/ai-fill`，传入已填字段与目标描述，`aiFiller` 调用 LLM 返回 `suggested_values` 供前端应用或对比。

---

## 3. AI 完形填空协议：平台级约束

### 3.1 通用规则
1. AI **只能填占位符**，不得改 `prompt_template`。
2. 严格遵守 `constraints` 和 `type/enum` 取值。
3. 优先参考 `example_inputs`，保持风格一致。

### 3.2 全局填空请求要素
* `template_meta`：id、name、short_description。
* `placeholders_definition`：字段定义（含 type/hint/constraints/ai_fill）。
* `user_filled_values`：用户当前输入。
* `example_inputs`：若存在，提供 few-shot。
* 固定 `instruction`：约定输出 JSON、不得新增 key、不得改模版文本。

**LLM 响应格式**：
```jsonc
{
  "suggested_values": { "placeholder_key": "value" },
  "reasoning": "可选，用于调试"
}
```
平台默认以“补全空白”为主，必要时提供“应用 AI 建议”按钮让用户选择覆盖。

### 3.3 字段级填空
* 仅指定一个目标 `key`，其他字段作为上下文。
* LLM 只能返回 `{ key: value }`。

---

## 4. 前端交互：展示、填空、复制

### 4.1 模版列表页
* 分类 Tab：全部/五个垂类。
* 搜索：按名称、短描述、标签过滤。
* 模版卡片：展示名称、短描述、标签；“查看/使用”按钮进入详情。

### 4.2 模版详情页（三栏）
1. **左侧填空/控制区**
   * 根据 `placeholders` 动态生成表单，必填标记。
   * `ai_fill=true` 的字段显示“魔法棒”按钮；顶部有“一键 AI 补全”全局按钮。
   * 属于 `controls` 的 key 高亮，提示“建议调参”。
2. **中间 Prompt 预览**
   * 实时渲染 `prompt_template`，未填字段用占位提示。
   * 提供“可读视图”和“原始视图”。
   * 显示“复制 Prompt”主按钮；可选下拉项“复制 Prompt + 当前 JSON 配置”。
3. **右侧规则/说明**
   * 展示 `evaluation_rules.manual_checklist` 作为生成后自查清单。
   * `auto_checks` 作为未来自动化检查的占位说明。
   * 展示标签与推荐场景，避免用户误用。

---

## 5. 模版作者/使用者规则

### 5.1 模版作者
1. 每个模版必须写清：使用场景、输出结构、至少 2–3 个可调节控制维度。
2. 占位符命名：小写+下划线，与 `prompt_template` 一致，如 `target_audience`。
3. 每个占位符必须有 `hint`，避免裸字段。
4. 优先提供 1–2 个 `example_inputs` 以便 AI few-shot。

### 5.2 模版使用者（UI 顶部简述）
1. 选模版。
2. 填关键字段或用 AI 补全。
3. 查看预览是否符合需求。
4. 一键复制，粘贴到模型/工具。

---

## 6. 本仓库示例运行方式

### 6.1 使用 npm / Node
1. 安装依赖：`npm install`
2. 构建后端：`npm run build`
3. 启动服务：`npm start`，默认运行在 `http://localhost:3000`
4. 打开浏览器访问：加载 React 前端 → 左侧选择模版 → 填空或 AI 补全 → 中间预览 → 右侧 checklist 自查。
5. 可通过 API 调试：
   * `GET /api/templates`：列出模版
   * `GET /api/templates/:id`：获取详情
   * `POST /api/templates/:id/render`：传入 `placeholderValues` 渲染 prompt
   * `POST /api/templates/:id/ai-fill`：基于示例/默认值的规则型补全（可替换为真实 LLM 调用）。
6. 按右侧 checklist 自查输出质量。

> 前端依赖 React / ReactDOM / Babel / modern-normalize，会在 `npm install`（或 `npm run build`）阶段通过 `scripts/prepare-assets.js` 从 npm 包复制到 `public/vendor` 下，目录已加入 `.gitignore`，不会污染仓库；如需自定义来源，可修改该脚本或调整 `public/index.html`。

### 6.2 使用 Bun 运行 TypeScript 后端
1. 安装依赖：`bun install`
2. 构建后端：`bun run build`
3. 直接运行 TypeScript（无需提前编译）：`PORT=3000 bun run start:bun:ts`。
4. 或使用已编译产物：`bun run start:bun`（同样默认端口为 `3000`，可通过 `PORT` 环境变量覆盖）。

### 6.3 Docker + Bun 部署
1. 构建镜像：`docker build -t prompt-template-platform .`
2. 运行容器：`docker run -p 3000:3000 prompt-template-platform`
3. 如果需要自定义端口：`docker run -e PORT=4000 -p 4000:4000 prompt-template-platform`

### 6.4 一键部署脚本（自动判定 Docker/Bun）
* 运行：`npm run deploy`
* 行为：
  * 若检测到 Docker：构建镜像并以 `CONTAINER_NAME`（默认 `prompt-template-platform`）运行，使用 `PORT` 环境变量（默认 `3000`）。
  * 若未检测到 Docker：回退到 Bun，本地安装依赖、构建并直接以 TypeScript 源码启动；同样可通过 `PORT` 覆盖端口。
* 自定义：
  * `IMAGE_NAME`、`CONTAINER_NAME`、`PORT` 环境变量可在调用前配置。
  * 如需仅构建不启动，可直接使用 `docker build ...` 或修改 `scripts/deploy.sh`。

### 6.5 端到端（E2E）测试
1. 安装 Playwright 浏览器（首次执行）：`npx playwright install --with-deps`
2. 启动并测试（包含自动构建与本地服务器）：`npm run test:e2e`
   * 会启动本地服务（端口 `4173`），加载 React 前端，填写字段、触发 AI 补全、复制 Prompt，并验证预览。

### 6.6 预置示例模版
* 文生文：
  * `T1_explain_to_target` —— 知识解释 + 受众适配
  * `T2_nano_banana_launch_copy` —— nano banana pro 上市全渠道文案
* 文生产物：
  * `P1_code_with_tests` —— 代码实现 + 最小自测
* 文生图：
  * `I1_nano_banana_hero_poster` —— nano banana pro 视觉海报提示
* 文生视频：
  * `V1_nano_banana_15s_script` —— nano banana pro 15 秒短视频脚本
* 文生文档：
  * `D1_nano_banana_launch_brief` —— nano banana pro 上市作战简报

---

## 7. 两个结构示意（无具体文案）

### 6.1 文生文 · “知识解释 + 受众适配”
* `id`: `T1_explain_to_target`
* 关键占位符：`topic`、`target_audience`、`style`、`max_length`
* 控制项：受众、风格、长度、结构（如“结论先行”）
* 检查点示例：是否先给结论/直觉？是否包含例子？是否符合字数上限？

### 6.2 文生产物 · “代码 + 最小自测”
* `id`: `P1_code_with_tests`
* 关键占位符：`task_description`、`language`、`constraints`
* 控制项：语言、约束（是否允许三方库、测试数量等）
* 检查点示例：主代码与测试代码分离？是否至少包含若干测试用例？是否覆盖边界场景？

---

## 8. 端到端用户旅程（总结）
1. Node 启动时加载并校验 `templates.json`，缓存到内存。
2. 列表页选择模版 → 详情页三栏展示。
3. 左侧填空或 AI 补全 → 中部预览实时刷新。
4. 满意后点击复制（文本或文本+配置）。
5. 按右侧 checklist 自查，必要时调整控制项再复制。

这样，你就拥有一个“本地跑、纯 JSON 配置、可 AI 完形填空”的问题模版平台设计方案。
