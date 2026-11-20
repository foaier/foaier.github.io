---
title: "Agent 到底有没有变好？别只看它说得像不像"
date: "2026-11-20"
summary: "建立小而稳定的评估集，分别测答案、工具行为、成本与恢复能力，再考虑让模型自我改进。"
series: "综合实战"
order: 2
tags: ["Agent 评估","自我改进","测试"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["knowledge-assistant-project"]
goals: ["建立小而稳定的评估集，分别测答案、工具行为、成本与恢复能力，再考虑让模型自我改进。"]
---

改了提示词，跑两次感觉更聪明了，这种迭代很容易产生错觉。模型本来就会有输出变化，你可能只是碰巧看到了两个好结果。

要判断 Agent 有没有变好，需要固定任务和评价方式，再比较变化。这个过程不用一开始就很复杂，但不能完全靠印象。

## 先分开看答案和动作

一个退款助手的最终回复很礼貌，不代表它查了正确订单。它说“已转人工”，也不代表系统真的创建了人工处理任务。

可以把评估分成四层：

| 层次 | 示例检查 |
| --- | --- |
| 答案质量 | 事实、引用、条件、缺信息时是否澄清 |
| 工具行为 | 调用了哪个工具，参数是否正确，是否越权 |
| 运行质量 | 延迟、token、轮数、重试与费用 |
| 业务结果 | 任务有没有完成，副作用是否正确 |

有确定答案的部分，优先用普通代码检查。JSON 能否解析、是否调用了退款工具、订单号是否一致，都没必要先请另一个模型来猜。

## 一条评估用例应该长什么样

下面是应用自定义的测试数据示例，不是某个评估 SDK 的固定 Schema：

```json
{
  "id": "missing-order-id",
  "input": "帮我查一下退款到哪了",
  "expected": {
    "mustAskFor": "订单号",
    "forbiddenTools": ["execute_refund"],
    "maxToolCalls": 1
  }
}
```

记录输入、必要上下文、工具桩返回值、预期行为与失败条件。这样测试不会因为外部业务数据变化而失去可比性。

对于检索任务，还应保留预期证据；对于多步骤任务，保留允许的轨迹或关键里程碑，而不是强求每次都走完全相同的措辞。

## 先用低成本检查筛掉明显错误

下面的 C# 可以放在 .NET 10 控制台项目的 Program.cs 中运行。它只检查一个工具轨迹约束，不是在模拟完整评估平台：

~~~csharp
using System.Text.Json;

(string Tool, string Status)[] trace =
[
    ("get_order", "ok"),
    ("read_policy", "ok"),
];
bool forbidden = trace.Any(call => call.Tool == "execute_refund");
bool hasOrder = trace.Any(call => call.Tool == "get_order" && call.Status == "ok");
Console.WriteLine(JsonSerializer.Serialize(new
{
    Passed = hasOrder && !forbidden,
    HasOrder = hasOrder,
    Forbidden = forbidden,
}));
~~~

对语言质量、完整性等难以用规则表达的部分，可以使用模型评审，再辅以人工抽查。评审模型也会受提示词、偏好和样本顺序影响，不是客观真理的来源。

## 自我改进循环，需要外部标准

常见模式是“生成草稿、评审、根据反馈改写”。它适合有明确质量标准的任务，比如检查答复是否覆盖用户的三个问题。

不适合让同一个模型无限地问自己“是否满意”，然后拿自己的肯定当证明。更稳妥的是结合代码检查、实际工具结果、固定评分规则和人工评审样本。

给改进设置最大轮数、成本预算和停止条件。连续没有进步时，保留最好的候选和未解决问题，交给用户决定，而不是持续自转。

## 避免把测试集调成训练集

开发时使用一批样本改提示词，验收时用另一批。长期反复盯着同一批题调参，会越来越擅长这批题，却未必更擅长真实任务。

版本对比时记录模型、提示词、工具定义、知识库与评估器版本。对波动较大的任务可重复运行，报告失败率和变化范围，不只展示最好的一次。

所谓“提升 20%”必须说清是哪个指标、多少样本、什么条件。没有实际测量，就不要把目标写成结果。

## CI 里放什么

快速、确定性的解析和轨迹检查适合每次提交运行。需要联网和付费模型的评估，可以单独安排受控运行，避免把波动很大的外部响应变成所有代码提交的随机阻塞。

失败样本比一张总分图更有价值。留下输入、脱敏后的轨迹和违反了哪条规则，下一次改动才知道该修什么。

## 对课程项目做一次真实验收

下载[完整示例](/downloads/ai-course.zip)，在 ai-course 目录执行以下离线检查。它验证六个检索用例、会话序列化与技能构造，不会替你证明在线回答质量。

~~~powershell
dotnet run --project Core -- check
~~~

再按[综合实战](/articles/knowledge-assistant-project/)中的五类问题调用模型，把“关键词命中但证据不足”单独记录。比较提示词变化前后的事实、引用和拒答，固定模型配置，并保留几道未参与调参的验收题。想试草稿评审再修订，进入[改进流程](/articles/workflow-improvement/)。

## 参考资料

- [Agent Framework：本地与云端评估](https://learn.microsoft.com/en-us/agent-framework/agents/evaluation)
- [Agent Framework：运行可观察性](https://learn.microsoft.com/en-us/agent-framework/agents/observability)
- [Anthropic：Evaluator-optimizer 模式](https://www.anthropic.com/engineering/building-effective-agents)
