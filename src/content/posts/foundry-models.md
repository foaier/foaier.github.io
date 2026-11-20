---
title: 接入 Foundry，先分清模型、部署和 Agent
date: 2026-11-20
summary: 把云端 AI 应用拆成资源、模型部署、Agent 定义和会话，顺带处理常见的 Content Filter 错误。
series: 提示词与知识库
order: 7
tags: [Microsoft Foundry, 部署, 内容过滤]
---

接入云端模型时，最常见的困惑是：“我明明创建了资源，为什么 SDK 还是找不到？”很多时候不是凭证坏了，而是把模型、部署、项目和 Agent 混在了一起。

先把这几层分清，后面无论用 C#、Python 还是平台界面，思路都一样。

## 模型和部署不是同一个名字

模型表示基础能力，比如一个特定版本的语言模型。部署表示你在某个资源和区域中提供这项能力的配置，涉及名字、容量、计费方式和可用性。

应用调用时，有些 SDK 要的是部署名。你在控制台把部署取名为 `support-chat`，程序里继续填原始模型名，就可能查不到目标。

项目终结点、模型推理终结点和 Agent 终结点也不能随便互换。先确认 SDK 客户端对应哪类资源，再使用该资源页面给出的地址。

## 应用自管，还是让服务管理 Agent

| 方式 | 谁管理指令与工具 | 适合关注什么 |
| --- | --- | --- |
| 直接调用模型 | 应用代码 | 请求、上下文、工具循环与会话 |
| 应用中的 Agent Framework | 应用及框架 | 统一 Agent 接口、工具与工作流 |
| Foundry 中的 Agent 定义 | 云端定义与版本 | 服务支持的工具、会话和部署行为 |

当前 Foundry 的 Prompt Agent 有具名、版本化的定义；Hosted Agent 则是部署后的 Agent 应用。客户端连接服务端定义时，不能假设随手传一份本地配置就覆盖了服务端的模型与工具。

“持久化 Agent”也不是一句话能概括的：保存的是定义、会话、文件、工具状态，还是业务任务？每个对象的生命周期都要单独确认。

## 选模型先拿自己的问题测

模型选择至少看四项：任务质量、响应时间、成本和功能支持。需要工具调用、结构化输出或视觉输入时，先确认目标模型与部署方式真的支持。

可以准备一小组业务问题，让候选模型在相同提示词和相同资料下运行。记录正确性、引用、输出格式、工具调用成功率和耗时。不要拿一个模型的最好演示，去对比另一个模型的随机结果。

选定以后记录配置，别让模型升级悄悄改变生产行为：

```json
{
  "deployment": "support-chat",
  "promptVersion": "ticket-v3",
  "knowledgeVersion": "policy-2026-11",
  "agentDefinitionVersion": "3",
  "evaluationSet": "support-cases-v2"
}
```

这是应用侧记录方案，不是 Foundry 的导入配置。资源的真实名称和版本由你自己的部署决定。

## RAG 用自己的数据，权限也得跟着走

把资料接入 Foundry 或其他知识库工具时，先确认文档由谁解析、保存在哪里、怎样更新删除，以及检索时如何应用用户权限。

“模型不训练这些数据”和“每个用户只能看到自己的数据”是两个不同的问题。后者仍然需要身份与授权设计，不能靠一条系统提示词解决。

## Content Filter 错误怎么处理

Azure 的内容过滤可能在输入阶段拒绝请求，也可能在生成过程中中止输出。某些输入过滤表现为 HTTP 400；Chat Completions 的部分输出可能带有 `finish_reason: content_filter`。其他 API 要检查各自的错误和状态字段。

第一步是读取具体错误码，区分参数错误、输入过滤、输出截断和服务异常。不能只看状态码就下结论。

对于正常业务内容被误判的情况，保存脱敏后的最小复现、请求 ID、模型和过滤配置，通过官方支持或配置流程排查。对同一请求无限重试，或把“如何绕过过滤”塞进提示词，都解决不了根因。

前端要把这种情况显示成清楚的状态，不能把半段输出当作完整答案继续执行业务动作。内容过滤是其中一层保护，也不能替代你的权限检查和数据校验。

## 参考资料

- [Microsoft Foundry Agent Service 集成与版本管理](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
- [模型提供方与功能支持](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/model-providers/)
- [Azure 内容过滤的错误与响应行为](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/content-filter)
