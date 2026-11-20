---
title: "多模型工作流：一个负责写，一个负责检查"
date: "2026-11-20"
summary: "为不同角色配置不同模型，并记录可比较的运行条件。"
series: "工作流实践"
order: 14
tags: ["工作流实践","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming","agent-function-tools"]
goals: ["为不同角色配置不同模型，并记录可比较的运行条件。"]
---

两个角色使用同一个模型，容易带着类似的偏好。换一个模型检查可能提供不同视角，但也会引入新的延迟、费用和服务差异。先用相同任务对比，再判断是否值得增加这层复杂度。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。先下载完整示例并配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。模型需要支持工具调用。公共运行器传入 ChatMessage，再发送 TurnToken，并以两分钟为上限观察事件；相关代码在 Workflows/WorkflowLessons.cs。

~~~powershell
dotnet run --project Workflows -- multi-model
~~~

## 代码是怎样工作的

multi-model 分支为 reviewer 建立第二个客户端。另设 SECOND_AI_ENDPOINT、SECOND_AI_MODEL、SECOND_AI_API_KEY；writer 仍使用第一套配置。两者通过统一 IChatClient 接口进入顺序工作流，不要求底层服务完全相同。

下面是完整程序中负责组装流程的关键表达式；相关角色创建和事件循环已包含在下载项目中。

~~~csharp
AgentWorkflowBuilder.BuildSequential([writer, reviewer]);
~~~



## 怎样判断成功

应先产生草稿，再由第二套配置给出检查意见。需要记录两个模型的名称和版本，避免以后只知道“模型B觉得更好”，却无法复现。第二个模型的肯定并不是事实校验。

## 自己改一次

用十个固定问题比较同模型与双模型的评审质量、耗时和费用。保留失败样本，尤其是两个模型共同忽略的条件。只凭一个漂亮案例无法判断整体收益。

## 遇到问题先看这里

第二个端点也要支持所需协议。相同参数可能在两家服务中含义不同，先验证基础调用。不要在配置切换时把一家服务的密钥发到另一家地址。

## 参考资料

- [编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [工作流概览](https://learn.microsoft.com/en-us/agent-framework/workflows/overview)
