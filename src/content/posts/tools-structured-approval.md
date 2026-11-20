---
title: 工具调用、JSON 输出、人工审批，应该怎样接在一起？
date: 2026-11-20
summary: 用退款建议区分“查到数据”“生成结构化结果”和“真正执行动作”，避免模型一句话直接改变业务状态。
series: Agent 开发
order: 4
tags: [工具调用, 结构化输出, 人工审批]
---

模型返回 `{"approved": true}`，是不是就能执行退款？当然不能。

结构化输出解决的是“程序怎样接住结果”，工具调用解决的是“怎样访问能力”，审批解决的是“这个动作是否被允许”。三者相关，但谁也不能替代谁。

## 先给 Agent 一个小而明确的工具

在 Agent Framework 的 .NET 接口中，可以用 `AIFunctionFactory.Create` 把普通方法转成工具。下面是演示函数，加入使用 `Microsoft.Extensions.AI` 的项目即可定义：

```csharp
using System.ComponentModel;

[Description("查询演示退款规则，只提供说明，不执行退款。")]
static string GetDemoRefundRule(
    [Description("商品类型：digital 或 physical")] string productType)
{
    return productType switch
    {
        "digital" => "演示规则：需要人工核对使用情况。",
        "physical" => "演示规则：需要核对退货状态。",
        _ => "不支持的商品类型，请补充信息。"
    };
}
```

创建 Agent 时，将 `AIFunctionFactory.Create(GetDemoRefundRule)` 放进 `tools` 集合。只暴露当前任务需要的能力，模型选择会更清楚，也更容易测试。

真实工具应调用业务服务，而服务仍负责权限和参数校验。工具描述是给模型看的说明书，不是运行时的授权策略。

## 让结果有结构，但别把结构当正确性

假设应用需要一个退款建议对象，可以先定义类型，再使用支持结构化输出的模型与 Agent：

```csharp
public sealed class RefundSuggestion
{
    public string Summary { get; set; } = "";
    public bool NeedsHumanReview { get; set; }
    public string[] MissingInformation { get; set; } = [];
}
```

接着已有的 `agent` 调用，以下为使用片段：

```csharp
var response = await agent.RunAsync<RefundSuggestion>(
    "用户说想退款，但没有提供订单号。整理摘要和缺少的信息，不作审批。");
RefundSuggestion suggestion = response.Result;
```

当前文档提供 `RunAsync<T>` 和响应格式配置等方式，实际支持取决于 Agent 与模型。还要处理拒绝、截断、解析失败和超时，不要假设每次调用都会得到完整对象。

即使字段全部存在，内容也可能不对。订单存在性、金额上限、枚举值和业务状态，仍需要程序验证。

## 审批的是动作和参数

一个合格的审批页面应告诉人：将对哪个订单、执行什么动作、涉及多少金额、有什么影响。

审批通过后，保存审批人、对象、参数摘要、有效期和版本。执行前重新验证这些条件，而不是只读取一个容易被误用的 `approved=true`。

Agent Framework 的审批机制可以把需要确认的工具调用呈现为请求，再接收人工响应继续执行。但审批组件与业务鉴权仍然是两层：模型不能替代审批人决定，审批人也不能批准自己没有权限执行的操作。

## 业务执行要能抵抗重复请求

如果网络超时发生在退款已经提交、但结果还没返回的时候，直接重试可能产生重复操作。

可以为这个具体业务动作生成稳定的幂等键，在执行服务里记录结果。重复请求返回已有状态，而不是再做一遍。

```text
收到动作请求
  → 校验身份、订单状态与审批版本
  → 检查幂等键是否已处理
  → 执行动作并记录结果
  → 返回明确的成功、失败或处理中状态
```

这是业务执行顺序示意。数据库事务、外部支付调用和事件发送之间，还要根据实际系统设计一致性与补偿策略。

## 一次完整验收，看真实动作记录

至少覆盖：没有订单号、越权订单、参数被修改、审批拒绝、审批过期、重复提交以及工具超时。

检查模型输出之外，还要查业务日志。合格的 Agent 不只是会说“需要人工确认”，它必须真的在确认之前停在正确位置。

## 参考资料

- [Agent Framework：函数工具](https://learn.microsoft.com/en-us/agent-framework/agents/tools/function-tools)
- [结构化输出与泛型结果](https://learn.microsoft.com/en-us/agent-framework/agents/structured-outputs)
- [工具审批机制](https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval)
