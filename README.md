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

## 2. Node 架构：前后端一体化 (Vite + Express)

### 2.1 目录示意
* `/data`：`templates.json`（所有模版写死其内）。
* `/src`
  * `server.ts`：后端服务，集成 Vite 中间件（开发模式）或托管静态文件（生产模式）。
  * `aiFiller.ts`：封装 OpenAI SDK 调用 LLM。
* `/frontend`：现代 React 前端项目。
  * `src/`：React 组件、Hooks、Tailwind 样式。
  * `vite.config.ts`：Vite 配置。
* `/public`：生产环境构建产物目录。

### 2.2 核心特性
* **单命令启动**：`bun dev` 同时启动后端 API 和前端开发服务器（HMR）。
* **现代化前端**：React 18 + TypeScript + Tailwind CSS + Vite。
* **无缝集成**：开发模式下 Express 使用 Vite 中间件代理前端请求。

---

## 3. AI 完形填空协议：平台级约束
(保持不变...)

---

## 6. 本仓库示例运行方式

### 6.1 开发模式 (推荐)
1. 安装依赖：`bun install` (根目录) 和 `cd frontend && bun install`
2. **一键启动**：`bun dev`
   - 启动后端服务 (localhost:3001)
   - 启动 Vite 中间件 (HMR 支持)
   - 访问 `http://localhost:3001` 即可

### 6.2 生产构建与运行
1. 构建前端：`npm run build` (自动调用 `cd frontend && bun run build`)
   - 构建产物输出到 `/public` 目录
2. 启动生产服务：`npm start`
   - 运行 `NODE_ENV=production bun src/server.ts`
   - 后端直接托管 `/public` 下的静态文件

### 6.3 Docker + Bun 部署
1. 构建镜像：`docker build -t prompt-template-platform .`
2. 运行容器：`docker run -p 3000:3000 prompt-template-platform`

### 6.4 一键部署脚本
* 运行：`npm run deploy`
* 行为：自动检测 Docker，若无则回退到 Bun 本地运行（自动处理依赖安装和前端构建）。

### 6.5 端到端（E2E）测试
1. 安装 Playwright：`npx playwright install --with-deps`
2. 测试：`npm run test:e2e`

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
