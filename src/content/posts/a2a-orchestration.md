---
title: "多个 Agent 怎么合作？先把分工和交接说清楚"
date: "2026-11-20"
summary: "用工单处理比较顺序、并发、交接和群聊，再区分 Agent-as-tool、MCP 与 A2A。"
series: "Agent Framework 进阶"
order: 33
tags: ["多 Agent","A2A","编排"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-composition"]
goals: ["用工单处理比较顺序、并发、交接和群聊，再区分 Agent-as-tool、MCP 与 A2A。"]
---

把一个 Agent 改成五个，答案不会自动变好。你只是多了几次模型调用，也多了几种沟通出错的机会。

多 Agent 真正值得用的地方，通常是任务可以明确拆分，而且不同角色拥有不同资料、工具或评估方式。先把这些边界写出来，再决定用哪种编排。

## 四种常见合作方式

| 模式 | 工单例子 | 需要控制什么 |
| --- | --- | --- |
| Sequential | 归类 → 查资料 → 写答复 | 前一步输出是否满足后一步输入 |
| Concurrent | 同时查订单与政策 | 超时、结果合并、部分失败 |
| Handoff | 售前助手转交退款助手 | 谁继续负责，转交哪些上下文 |
| Group Chat | 多个角色讨论复杂投诉 | 发言顺序、停止条件与最终责任人 |

顺序模式直观，但延迟会叠加。并发适合互不依赖的子任务，不能为了看起来快，就并行执行本来需要等待审批的步骤。

交接意味着控制权变化；群聊意味着共享讨论上下文。它们不是简单把多个模型输出拼成一段文字。

## Agent-as-tool 是一种明确的主从关系

主 Agent 把某个子 Agent 当工具调用，拿到结果后继续决策。这适合“请财务助手核对这份费用”的局部委派。

子 Agent 的输入输出最好有边界：核对哪些字段、能调用哪些工具、什么时候算完成。如果只给它一句“随便看看”，最后主 Agent 很难判断结果是否可用。

子 Agent 出错或返回不完整结果时，主 Agent 需要一个明确状态，不能把异常转换成一段看似正常的解释，然后继续执行。

## A2A 解决的是跨系统协作

A2A 面向 Agent 之间的能力发现、消息与任务协作。它可以让不同实现的 Agent 沟通，而不要求对方暴露内部模型或完整运行逻辑。

Agent Card 用于描述能力和访问方式；请求可能立即返回消息，也可能进入一个需要后续跟踪的任务。调用者需要理解任务状态、产物、取消和额外输入请求。

MCP 更多用于接入工具和上下文；A2A 更多用于与一个能管理任务的 Agent 协作。它们可以同时存在。例如内部 Agent 通过 MCP 查业务数据，再通过 A2A 把任务交给外部专业助手。

把远端 A2A Agent 包装为本地函数也可以，但适配层不能丢掉“仍在处理”“需要输入”等状态，假装每次调用都立即返回最终文本。

## 交接时别复制整个聊天记录

给退款助手的上下文，应当包含用户授权范围、已验证的订单信息、任务目标和待处理问题。没有必要把无关的历史聊天一并传过去。

下面是一份应用侧交接数据示意，不是 A2A 协议的固定请求体：

```json
{
  "taskId": "demo-task-42",
  "goal": "核对退款申请缺少哪些信息",
  "verifiedFacts": {"orderId": "DEMO-001"},
  "allowedActions": ["read_order", "read_policy"],
  "deadlineSeconds": 30
}
```

`allowedActions` 只能表达约束意图，远端服务仍必须根据认证身份独立鉴权。不能相信调用者随手写进 JSON 的权限列表。

## 多模型合作，先统一结果契约

一个模型负责提取，一个负责审查，可以发挥不同能力。但如果提取结果是自由文本，审查模型又自行改写字段，就很难稳定串起来。

明确字段、状态、来源和错误格式，再比较多模型方案是否真的提升任务完成率。也要统计总 token、延迟和调用次数；质量提升很小，成本却翻倍时，未必值得。

## 停止条件必须有人负责

群聊可以一直互相补充，交接也可能在两个 Agent 之间来回循环。设置最大轮数、交接次数、总时限和最终输出责任人。

当复杂度开始遮住问题本身时，回到最简单的流程：一个 Agent 加几个明确工具。只有评估结果证明拆分有价值，再继续增加角色。

## 先选通信方式，再选编排方式

同一程序内组合能力可以先用[Agent 作为工具](/articles/agent-composition/)。跨系统再看[A2A 客户端](/articles/agent-a2a-client/)及[远程 Agent 作为工具](/articles/agent-a2a-tool/)。需要固定执行顺序则进入[顺序工作流](/articles/workflow-sequential/)，并发、交接和群聊各有独立实验，不能只凭模式名称判断适合与否。

## 参考资料

- [Agent Framework：编排模式](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [A2A：概念、任务生命周期与 MCP 的关系](https://a2a-protocol.org/latest/topics/what-is-a2a/)
- [Agent Framework：A2A 集成](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/a2a)
- [Anthropic：多步工作流与 Agent 的设计选择](https://www.anthropic.com/engineering/building-effective-agents)
