---
title: "Agent 类型怎么选：先看谁管理模型、会话和运行环境"
date: "2026-11-20"
summary: "区分本地 ChatClientAgent、云端 Agent 和远程协议代理。"
series: "Agent Framework 进阶"
order: 2
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["区分本地 ChatClientAgent、云端 Agent 和远程协议代理。"]
---

第一次看到一串 Agent 类型，很容易以为要把每一种都学完才能开始。其实可以先问三个问题：模型在哪里调用，状态由谁保存，程序最终运行在哪里？大多数选型都能沿着这三个问题展开。

## 用已经跑通的程序当坐标

课程的第一个 Agent 使用 IChatClient.AsAIAgent，得到基于聊天客户端的 Agent。应用负责配置指令、工具和 Session，模型请求由所选服务处理。你能直接调试工具和数据流，适合作为学习起点。

换成 DeepSeek 或 Ollama，通常是在替换底层客户端的服务配置，并没有因此学会了一种完全不同的 Agent 思想。兼容接口只统一部分调用方式，具体能力仍要逐项验证。

## 三类常见接入方式

| 方式 | 主要管理位置 | 学习入口 |
| --- | --- | --- |
| ChatClientAgent | 应用管理指令、工具和会话组合 | [第一个 Agent](/articles/first-agent/) |
| Foundry 具名 Agent | 云端保存定义与版本，应用调用 | [创建持久化 Agent](/articles/agent-foundry-persistent/) |
| A2A 远程代理 | 远程系统管理 Agent，协议连接 | [A2A 客户端](/articles/agent-a2a-client/) |

Copilot 集成还有自己的客户端和认证方式，见[Copilot 专题](/articles/agent-copilot/)。Harness 更像常用运行能力的装配层，见[Harness](/articles/harness-agent/)，不要把它当成另一家模型。

## 统一接口统一了什么

RunAsync 和 RunStreamingAsync 让应用更容易组织不同 Agent，但不意味着每个实现都支持所有工具、后台响应和持久化选项。编程接口像通用插座，插上后能用哪些能力仍取决于设备。

所以更换实现之前，列出你依赖的行为：会话恢复、工具批准、结构化输出、流式事件、取消、计费。逐条验证，不要只运行一句“你好”就宣布迁移完成。

## 做一张自己的选择表

如果只是本机学习，优先继续使用课程的 ChatClientAgent。需要团队管理云端定义时，再评估 Foundry；需要连接另一团队的远程 Agent 时，再看 A2A。普通函数或 HTTP 查询已经够用的任务，不必为了名字高级再包一个 Agent。

练习：选择一个“课程问答”的需求，写出模型、会话、工具、部署分别由谁管理。然后把同一需求改成多人系统，看看哪些责任发生变化。能解释这张表，比背一串类型名称更有用。

## 遇到示例不兼容怎么办

先确认文章使用的包版本与目标框架，再查看当前官方接口。预览包中的名称和默认行为可能变化。下载项目中的版本是本文编译依据；线上服务的可用能力还要查看自己的区域和账号，不能从类型存在推断资源已开通。

## 参考资料

- [Agent 概览](https://learn.microsoft.com/en-us/agent-framework/agents/overview)
- [提供方集成](https://learn.microsoft.com/en-us/agent-framework/integrations/overview)
