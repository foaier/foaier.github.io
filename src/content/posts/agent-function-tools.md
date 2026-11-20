---
title: "函数工具：让 Agent 真正查询一次课程信息"
date: "2026-11-20"
summary: "用 AIFunctionFactory 注册一个带说明的 C# 函数"
series: "Agent Framework 入门"
order: 5
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent","csharp-ai-essentials"]
goals: ["用 AIFunctionFactory 注册一个带说明的 C# 函数","从执行日志判断工具有没有被调用"]
---

模型可以把回答写得很自然，但它不知道你的课程目录。我们现在给它一个真正能执行的查询函数：询问课程时长时，必须到程序里的演示数据中查。先用只读数据，便于理解调用过程。

## 工具调用经过哪几步

程序向模型描述可用工具及参数。模型根据问题提出调用请求，框架执行对应函数，再把结果交回模型，由模型生成最终回答。实际运行函数的是你的程序，因此参数检查、权限和业务规则仍然由程序负责。

函数上的Description用于说明它能做什么、参数是什么意思。说明越模糊，模型越容易选错工具或传错参数。不要让一个名叫DoEverything的函数承担所有业务，再期待模型自己猜出每种调用方式。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- tools
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 先看这个普通函数

Core/Lessons/Tools.cs里的FindLesson接受课程名称，返回固定的演示时长。它还会打印一行“工具被调用”日志，因此你能区分真实执行和模型自己生成的一句话。

支持的数据是AI入门30分钟、C#起步45分钟，未知名称返回没有找到。这里使用演示数据，不访问数据库，也不代表真实课程价格或安排。你可以先直接调用FindLesson确认结果，再让Agent调用它。

```csharp
public static async Task Tools()
{
    var agent = CourseClient.Agent("课程时长必须调用工具查询，不要猜。", AIFunctionFactory.Create(FindLesson));
    Console.WriteLine(await agent.RunAsync("AI入门和C#起步各需要多久？"));
}
```


AIFunctionFactory.Create读取方法信息，把普通函数包装为模型可理解的工具。CourseClient.Agent把工具列表传给Agent。这两步缺一不可：只定义函数但没有注册，模型不会自动发现项目中的所有方法。

## 运行之后核对三个结果

首先应出现工具调用日志，其次参数应与查询的课程对应，最后回答的时长应与返回值一致。如果回答看起来正确但没有任何执行日志，不能认为工具链已经验证通过。尝试更明确的问题，检查模型是否支持函数调用以及注册是否生效。

同时问两门课程时，模型可能发起多次调用，也可能在同一次响应中提出多个请求。应用应该能处理实际返回的调用集合，不能永远假设只有一个。后面人工审批示例会循环处理所有待确认请求。

## 从演示函数换成业务函数时

查询函数可以访问数据库或HTTP服务，但需要保留超时、参数校验和权限判断。模型传来的课程名或订单号是一份输入，不是授权凭证。需要当前用户身份时，应从应用的认证上下文取得。

写操作更要区分“模型建议执行”和“业务已经执行成功”。函数抛出异常时，应明确报告失败；不要为了让模型继续聊而把失败包装成成功文本。金额计算、库存扣减等规则应由确定性的业务代码实现。

## 小练习

先问不存在的“量子魔法课需要多久”，预期得到未找到，而不是随意编出时长。再增加一门测试课程，观察只修改函数数据后Agent是否能查询到新值。

如果服务返回不支持tools，换一个官方明确支持函数调用的模型；如果参数匹配不上，改进说明并增加输入校验。下一篇 [人工审批](/articles/agent-tool-approval/) 会为修改计划的动作增加一次真实确认。

## 参考资料

- [函数工具](https://learn.microsoft.com/en-us/agent-framework/agents/tools/function-tools)
- [Microsoft.Extensions.AI 函数调用](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai)
