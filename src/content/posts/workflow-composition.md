---
title: "子工作流：把已经跑通的小流程接到更大的流程里"
date: "2026-11-20"
summary: "运行 composition 练习并观察节点事件"
series: "工作流实践"
order: 7
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflows-nodes-streaming"]
goals: ["运行 composition 练习并观察节点事件","把已经跑通的小流程接到更大的流程里"]
---

你已经有一个“整理主题，再解释概念”的流程。另一个功能还需要给输入加上来源、给输出加上标题。如果复制整段节点代码，后面改一处就可能漏另一处。子工作流让这段局部能力可以作为一个单元复用。

## 先理解这一步的职责

Basic构建内部流程，BindAsExecutor把它绑定为外层可连接的执行器。before向子流程发送字符串，after接收子流程声明的输出。子流程必须明确输出节点，否则外层不能靠猜测知道哪个中间事件才是结果。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- composition
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow Composition()
    {
        var before = new TextStep("before", value => value);
        var child = Basic().BindAsExecutor("concept-lookup");
        var after = new TextStep("after", value => "课程结果：" + value);
        return new WorkflowBuilder(before).AddEdge(before, child).AddEdge(child, after).WithOutputFrom(after).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

输入带空格的小写rag，预期外层输出课程结果：先检索，再生成。日志中还会看到normalize和answer等内部步骤。内部执行器事件不是外层最终答案，应用需要按事件类型区分。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

把内部流程最后的回答改成更详细的文字，外层应自动收到变化。再给外层增加一个长度检查节点，观察它不需要知道子流程内部有几个步骤。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

子流程仍然有输入输出类型、状态和版本。不要把一个已经被运行器占用的Workflow对象同时塞进另一个运行器。示例每次构建新实例，并保持稳定的执行器ID，方便后续检查点恢复时重新构造相同拓扑。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
