---
title: "分支、并行、循环：工作流里的三个老问题"
date: "2026-11-20"
summary: "用 if、switch、fan-out 和有上限的循环组织 Agent 任务，重点处理默认分支、部分失败和停止条件。"
series: "工作流实践"
order: 2
tags: ["条件分支","Fan-out","循环"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["workflows-nodes-streaming"]
goals: ["用 if、switch、fan-out 和有上限的循环组织 Agent 任务，重点处理默认分支、部分失败和停止条件。"]
---

工作流的名词看起来新，很多问题其实很熟悉：根据条件走不同路径，同时处理几个独立任务，或者重复执行直到满足要求。

加了模型以后，区别在于中间结果不一定稳定。以前可以相信的布尔值，现在可能来自一段需要解析和验证的模型输出。

## 分支前，先得到一个可信的判定值

模型可以帮助识别意图，但不适合直接生成后续节点名称，任由流程跳转。更稳妥的是让它从有限类别中选择，再由普通代码映射到合法路径。

```python
def choose_route(intent):
    routes = {
        "refund": "refund_review",
        "invoice": "invoice_help",
        "account": "account_help",
    }
    return routes.get(intent, "ask_for_clarification")

assert choose_route("refund") == "refund_review"
assert choose_route("unknown") == "ask_for_clarification"
```

这段 Python 3 代码可以独立运行，只演示路由原则，不是 Agent Framework 的 API。框架里的条件边或多分支节点，同样需要处理不认识的值和缺字段。

`if` 适合简单判断；`switch` 适合有限类别。不要忘记默认分支，否则一次格式变化就可能让任务停在无人处理的状态。

## 并行前，确认任务真的独立

同时查询订单信息和退款政策通常可行，因为两者互不依赖。先退款再写记录则不是并行优化问题，它们有业务上的先后关系。

Fan-out 把任务分发到多个分支，fan-in 在后面汇总。汇总规则要明确：必须全部成功、部分成功也能回答，还是任何失败都停止。

比如订单查到了、政策服务超时，助手可以返回“订单当前状态”，但不应该编出政策结论。结果中应保留每个分支的成功或失败状态。

## 一个有超时的并行小实验

下面的代码使用 Python 3 标准库，两个任务都返回演示数据，不访问真实业务系统：

```python
import asyncio

async def demo_lookup(name):
    await asyncio.sleep(0.01)
    return {"source": name, "status": "ok"}

async def main():
    results = await asyncio.gather(
        asyncio.wait_for(demo_lookup("order"), timeout=1),
        asyncio.wait_for(demo_lookup("policy"), timeout=1),
        return_exceptions=True,
    )
    for name, result in zip(["order", "policy"], results):
        if isinstance(result, Exception):
            print(name, "查询失败")
        else:
            print(name, result)

asyncio.run(main())
```

实际代码还需要并发上限。一次处理几百份文档时，不要为每一份都立刻创建无约束的模型请求；配额、连接数和费用会一起受到影响。

## 循环一定要有多个停止条件

“让模型反复修改，直到满意”为何危险？因为“满意”可能一直变化，模型也可能在几个版本之间来回打转。

给循环至少设置轮数上限、总时限和明确验收标准。每轮保存候选结果与评价原因，持续没有改善时退出，把剩余问题交给人判断。

还要区分重试和改进。网络错误重试通常不改变任务；根据评估意见重写内容则会产生新的候选。两者的计数、预算和日志最好分开。

## 画图时看不出的几个坑

同一个节点被多个分支触发时，会运行一次还是多次？汇总按到达顺序，还是按分支标识？循环回去后，上一轮的临时状态是否清理？

这些都需要按框架的实际执行语义验证，不能只凭流程图推断。可以让每个节点输出运行 ID、分支名和轮次，跑一组故意失败的样例，观察事件顺序。

一个可维护的工作流，应该能回答“这次为什么走这条路”，也应该能回答“它什么时候会停下来”。

## 按最小实验逐步运行

从[条件分支](/articles/workflow-branch/)开始，再试[Switch](/articles/workflow-switch/)、[扇出](/articles/workflow-fanout/)和[循环](/articles/workflow-loop/)。这些示例不调用模型，输出是确定的。结构跑明白后，再看[Agent 节点](/articles/workflow-agent-node/)与[混合节点](/articles/workflow-mixed/)，更容易定位类型和数据流问题。

## 参考资料

- [Agent Framework：图式工作流与边](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [并发、顺序与交接编排](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/)
- [Anthropic：路由、并行和评估改进模式](https://www.anthropic.com/engineering/building-effective-agents)
