---
title: "循环工作流：怎样继续，什么时候停下来"
date: "2026-11-20"
summary: "运行 loop 练习并观察节点事件"
series: "工作流实践"
order: 6
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflow-branch"]
goals: ["运行 loop 练习并观察节点事件","怎样继续，什么时候停下来"]
---

让Agent不断改进答案听起来很诱人，但没有退出条件的循环可能一直消耗请求。这一课先做一个确定性的计数流程，从0开始，每轮加1，到3结束。它把循环的结构与模型的不确定性分开。

## 先理解这一步的职责

increment的输出小于3时沿边回到自己，达到3时进入done。状态通过消息传递，不依赖一个所有运行共享的静态变量。这样的结构便于说明每一轮收到什么、为什么继续、最后由谁输出。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- loop
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow Loop()
    {
        var increment = new CounterStep();
        var done = new NumberOutput();
        return new WorkflowBuilder(increment)
            .AddEdge<int>(increment, increment, condition: value => value is int number && number < 3)
            .AddEdge<int>(increment, done, condition: value => value is int number && number >= 3)
            .WithOutputFrom(done).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

预期日志依次出现increment的1、2、3，随后done输出到达上限3。出现4或无限增长都说明停止条件有问题。程序还给事件观察设置了时间上限，用来避免错误示例一直占用终端。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

把上限改成5，先调整条件，再运行观察。如果把两个条件都写成小于上限，会发生什么？恢复后用不同起始值测试，确认边界值也能结束。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

接入模型后，轮数上限之外还需要总时限、预算和质量验收。网络重试与内容修订应分别计数；一次请求失败不等于一次有效改进。遇到连续没有提升的答案可以停止并保留问题，不要把模型自己说“满意”作为唯一标准。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
