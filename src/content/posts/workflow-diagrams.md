---
title: "把工作流画出来：导出 Mermaid 和 Graphviz"
date: "2026-11-20"
summary: "运行 diagram 练习并观察节点事件"
series: "工作流实践"
order: 20
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflows-nodes-streaming"]
goals: ["运行 diagram 练习并观察节点事件","导出 Mermaid 和 Graphviz"]
---

节点少时，代码还能一眼看明白；分支和子流程变多后，图更适合检查连接关系。本篇把同一个Workflow导出为Mermaid和DOT文本，先学会读图，再把图用到评审和排错。

## 先理解这一步的职责

ToMermaidString与ToDotString从工作流结构生成文本。Mermaid可以在支持它的Markdown工具中渲染，DOT可交给Graphviz。导出不要求调用模型，也不会自动生成某次运行的耗时或错误轨迹。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- diagram
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow Basic()
    {
        var normalize = new TextStep("normalize", text => text.Trim().ToUpperInvariant());
        var answer = new TextStep("answer", text => text == "RAG" ? "先检索，再生成。" : "暂未收录。");
        return new WorkflowBuilder(normalize).AddEdge(normalize, answer).WithOutputFrom(answer).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

运行命令后应看见flowchart TD和digraph Workflow两段文本，以及normalize到answer的边。把Mermaid文本粘贴到支持Mermaid的编辑器，应该出现两个节点和一条连接线。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

在Basic里增加一个检查节点，再重新导出，确认图也跟着变化。不要只手工修改旧图却没有修改代码，那样文档与实现会逐渐不一致。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

静态图回答“可能怎样走”，运行事件回答“这一次怎样走”。想定位为什么没有进入某个分支，需要同时看输入、条件结果和事件日志。图中显示一个箭头，也不证明数据类型兼容或节点已成功执行；这些仍要靠实际运行与测试确认。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
