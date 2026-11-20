---
title: "Semantic Kernel 到底帮我们省了什么代码？"
date: "2026-11-20"
summary: "用一个最小的 C# 控制台程序，认识 Kernel、模型连接器、提示词与插件，顺便聊聊和 Agent Framework 的关系。"
series: "Semantic Kernel 专题"
order: 1
tags: ["Semantic Kernel","C#",".NET"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-model-call"]
goals: ["用一个最小的 C# 控制台程序，认识 Kernel、模型连接器、提示词与插件，顺便聊聊和 Agent Framework 的关系。"]
---

直接调模型 API，也能做聊天。那为什么还要引入 Semantic Kernel？

当功能开始包含提示词模板、业务函数、多个模型连接和运行时拦截时，你会反复写一层胶水代码。Semantic Kernel，也就是常说的 SK，主要是在这一层提供组织方式。

## 先认识四个对象

Kernel 可以理解为协调这些能力的入口：它能找到注册的服务、函数和插件，并把调用组织起来。它本身不是模型，也不自带业务知识。

| 名称 | 在应用里负责什么 |
| --- | --- |
| 模型连接器 | 对接 OpenAI、Azure OpenAI 等推理服务 |
| Prompt / KernelFunction | 表达一段提示词能力或可调用函数 |
| Plugin | 把相关函数组织在一起 |
| Filter | 在提示词或函数调用前后加入处理逻辑 |

另外经常看到 token、embedding、context 这些词。token 是模型处理文本的单位，embedding 是内容的向量表示，context 是这次调用能看到的信息。它们不是 SK 独有的概念，换框架仍然会遇到。

## 跑一个最小的 C# 程序

准备 .NET 10 SDK，以及一个可用的 OpenAI API 模型和凭证。下面演示直接使用 OpenAI 服务；Azure 使用相应连接器和部署配置，终结点不能混用。

```bash
dotnet new console -n KernelNotes --framework net10.0
cd KernelNotes
dotnet add package Microsoft.SemanticKernel --version 1.82.0
```

在自己的终端设置 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 环境变量，不要把真实密钥写入源代码。然后将 `Program.cs` 替换为：

```csharp
using Microsoft.SemanticKernel;

var key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")
    ?? throw new InvalidOperationException("缺少 OPENAI_API_KEY");
var model = Environment.GetEnvironmentVariable("OPENAI_MODEL")
    ?? throw new InvalidOperationException("缺少 OPENAI_MODEL");

var builder = Kernel.CreateBuilder();
builder.AddOpenAIChatCompletion(modelId: model, apiKey: key);
var kernel = builder.Build();

var result = await kernel.InvokePromptAsync(
    "把下面的问题整理成一句工单标题，不增加事实：{{$question}}",
    new KernelArguments
    {
        ["question"] = "我昨天买的东西还没发货，订单里也没有物流号。"
    });

Console.WriteLine(result);
```

运行 `dotnet run` 后，应当得到一行围绕“订单未发货、无物流信息”的标题。具体措辞会变化，不应该拿某一句固定文案作为唯一正确答案。

示例锁定 `Microsoft.SemanticKernel 1.82.0`，并以 `net10.0` 为目标完成了编译检查；实际项目提交 `.csproj`，需要严格复现时再启用锁文件。云端响应仍需使用自己的凭证验证，本文不包含真实工单查询。

## 模板变量解决的是组织问题

`{{$question}}` 把模板和输入分开，让模板更容易维护与测试。但这不是数据库的参数化查询，也不意味着输入里的恶意指令自动失效。

如果后面要接工具，仍然需要在工具执行层检查权限、参数和输出。模型决定“我想调用哪个函数”，业务系统决定“这个调用是否允许”。

## Kernel 不是所有状态的容器

对话历史、用户身份和业务事务都需要明确管理。不要因为 Kernel 能注册很多能力，就把一个带着所有用户状态的全局对象传遍整个应用。

无状态服务可以复用；用户会话应隔离；数据库连接和请求作用域按正常 .NET 生命周期管理。框架让接入模型容易一些，不会替你重新定义这些工程规则。

## 和 Agent Framework 怎么选

已有 SK 项目不必为了换名字而全部重写。提示词、插件与模型集成的经验仍然有价值。新项目若重点是 Agent 生命周期、会话、工具循环和工作流，可以直接评估 Microsoft Agent Framework。

不要把旧版 `Semantic Kernel Agent Framework` 的名称，与独立的 Microsoft Agent Framework 包和 API 当作同一个版本系列。看教程时先核对 NuGet 包、命名空间和发布日期，再复制代码。

## 学完亲手试一次

画出 Kernel、模型连接器、插件和业务服务的关系。用同一个“查询课程时长”需求，对照 Agent Framework 的函数工具章节，指出相同职责和不同 API，不要把两套类型混在同一段示例里。

## 参考资料

- [Semantic Kernel 概览](https://learn.microsoft.com/en-us/semantic-kernel/overview/)
- [Semantic Kernel 快速入门](https://learn.microsoft.com/en-us/semantic-kernel/get-started/quick-start-guide)
- [Microsoft Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
