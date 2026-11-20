---
title: 让模型调用业务函数，关键不在那个调用按钮
date: 2026-11-20
summary: 从 Semantic Kernel 插件入手，讲清 Function Calling、过滤器和 Planning 的边界，让工具调用可控。
series: 提示词与知识库
order: 3
tags: [Semantic Kernel, Function Calling, 插件]
---

“查一下工单进度。”如果聊天助手只会生成文字，它最多给你一段解释。要读到实时状态，就必须调用业务系统。

Function Calling 做的事情并不神秘：把可调用函数的说明告诉模型，模型提出函数名和参数，应用执行后把结果再交回去。

## 谁提议，谁执行

模型返回的工具调用是一份提议，不是已经执行成功的证明。完整路径通常是：用户问题、模型提出调用、应用校验并执行、返回结果、模型组织答复。

任何一段都可能失败。函数名可能不匹配，参数可能缺失，业务系统可能返回无权限。不能因为模型最后说“处理好了”，就跳过检查真正的工具结果。

## 用一个只读插件开始

下面是一个演示用的 SK 插件类，可以添加到安装了 `Microsoft.SemanticKernel` 的项目。数据完全是本地样例，不是实际工单接口。

```csharp
using System.ComponentModel;
using Microsoft.SemanticKernel;

public sealed class TicketPlugin
{
    [KernelFunction("get_ticket_status")]
    [Description("查询演示工单状态。仅查询，不修改。工单不存在时返回未找到。")]
    public string GetStatus(
        [Description("工单编号，例如 DEMO-001")] string ticketId)
    {
        return ticketId == "DEMO-001"
            ? "状态：处理中；这是一条演示数据。"
            : "未找到对应的演示工单。";
    }
}
```

在创建 Kernel 时注册插件：

```csharp
builder.Plugins.AddFromType<TicketPlugin>("tickets");
```

函数描述应说清用途、输入和限制。不要只写“获取数据”，也不要让一个函数包揽查询、修改、删除三件事，最后靠一个字符串参数决定行为。

自动调用还需要配置当前连接器支持的函数选择行为，例如 SK OpenAI 连接器里的 `FunctionChoiceBehavior.Auto()`。注册插件只表示能力可用，不意味着所有调用路径都会自动选择并执行它。

## 过滤器是拦截点，不是万能防护

SK 提供不同阶段的过滤器：函数调用过滤、提示词渲染过滤，以及自动函数调用过滤。它们适合做计时、校验、审计和流程控制。

下面是函数调用耗时记录的代码片段，加入项目后可通过 `kernel.FunctionInvocationFilters.Add(new TimingFilter())` 注册：

```csharp
using System.Diagnostics;
using Microsoft.SemanticKernel;

public sealed class TimingFilter : IFunctionInvocationFilter
{
    public async Task OnFunctionInvocationAsync(
        FunctionInvocationContext context,
        Func<FunctionInvocationContext, Task> next)
    {
        var timer = Stopwatch.StartNew();
        try
        {
            await next(context);
        }
        finally
        {
            Console.WriteLine(
                $"{context.Function.Name}: {timer.ElapsedMilliseconds} ms");
        }
    }
}
```

`next` 决定是否继续调用，忘记调用就会截断流程。真实日志不要默认输出整个参数对象，它可能带着订单、用户信息或密钥。

鉴权仍然应该在业务服务里做。这样即使有人绕开 Kernel 直接调用接口，也不会绕过保护。

## Planning 不一定要一个专门的 Planner

旧教程经常把规划写成“先生成一份完整计划，再逐项执行”。另一种方式是模型看一轮工具结果，再决定下一步，也就是常见的自动函数调用循环。

两种方式各有用途。步骤非常明确时，比如“验证参数、查订单、返回状态”，普通代码或固定工作流就足够。步骤需要临时决定时，再使用模型规划，并限制轮数、时间和工具范围。

不要把旧版 Planner 类名直接搬进新项目。SK 的规划相关 API 曾经调整过，先查当前包版本支持的方式，再选择示例。

## 第一版怎么验收

用三个问题就能发现不少问题：正常工单能不能查到，不存在的工单会不会被编造，越权工单是否真的在服务端拒绝。

再加一次超时和重复请求，看应用是否返回可理解的状态。只有工具的真实执行结果可检查，后面的自然语言回复才有依据。

## 参考资料

- [Semantic Kernel：插件](https://learn.microsoft.com/en-us/semantic-kernel/concepts/plugins/)
- [Semantic Kernel：过滤器](https://learn.microsoft.com/en-us/semantic-kernel/concepts/enterprise-readiness/filters)
- [Anthropic：工作流与自主规划的选择](https://www.anthropic.com/engineering/building-effective-agents)
