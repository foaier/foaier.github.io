---
title: "Switch 多分支：给未知输入留一个出口"
date: "2026-11-20"
summary: "运行 switch 练习并观察节点事件"
series: "工作流实践"
order: 4
tags: ["工作流实践","循序渐进"]
level: "工作流实战 · 可离线运行"
prerequisites: ["workflow-branch"]
goals: ["运行 switch 练习并观察节点事件","给未知输入留一个出口"]
---

上一课只有认识和不认识两条路。这一次把RAG送到知识库课程，把MCP送到工具协议课程，其他输入统一进入补充信息分支。读者可以直接从输出理解每种输入会去哪里。

## 先理解这一步的职责

AddSwitch把多个条件集中在一个路由位置，AddCase定义匹配项，WithDefault处理没有匹配的情况。示例的两个条件精确匹配不同文字，避免重叠规则造成难以判断的优先级。不要把默认分支省略后假设系统会自动理解未知输入。

## 准备并运行

完成[环境准备](/articles/dotnet-ai-setup/)，下载[课程示例](/downloads/ai-course.zip)，在解压后的ai-course目录运行下面的命令。本项目使用.NET 10与Microsoft.Agents.AI.Workflows 1.28.0，依赖已经写入Workflows.csproj。本篇的实验不需要在线模型密钥。

~~~powershell
dotnet run --project Workflows -- switch
~~~

实现位于Workflows/WorkflowLessons.cs。Program.cs选择对应命令，TextStep等公共执行器放在同一文件中。下载包包含整个项目，下面重点展示本篇需要阅读的方法；不需要从其他文章猜缺失的类。

## 对照实现，跟踪输入与输出

```csharp
public static Workflow Switch()
    {
        var input = new TextStep("input", value => value.Trim().ToUpperInvariant());
        var rag = new TextStep("rag", _ => "进入知识库课程。");
        var mcp = new TextStep("mcp", _ => "进入工具协议课程。");
        var other = new TextStep("other", _ => "没有匹配课程，请补充信息。");
        return new WorkflowBuilder(input).AddSwitch(input, cases => cases
            .AddCase<string>(value => value is string text && text == "RAG", rag)
            .AddCase<string>(value => value is string text && text == "MCP", mcp)
            .WithDefault(other)).WithOutputFrom(rag, mcp, other).Build();
    }
```


先找到创建节点的位置，再看边的连接与WithOutputFrom。最后沿着输入走一遍，写下每个节点接收的类型和输出的类型。观察事件的方法会打印执行器完成与最终输出，出现WorkflowErrorEvent时会明确抛出错误。

## 预期结果怎样核对

命令依次输入RAG、MCP和未知主题。预期出现rag、mcp、other三个节点的各自输出，而不是每个输入都执行所有节点。默认分支应明确告诉用户补充信息。

不要只看到进程退出码为零就认为流程正确。有时类型不匹配会导致目标没有收到预期消息，所以还要检查节点日志和最终结果是否出现。修改了项目后重新运行时会重新编译，排错时保留完整命令和输出。

## 换一个输入，再做一次

增加一个Embedding分支，并测试空字符串、小写mcp和带空格的输入。先写出预期路由，再运行核对。若新增条件过于宽泛，可能抢走其他输入，应缩小匹配范围。

练习时每次只改一个条件或一个节点。把原始输出与修改后的输出放在一起比较，能更容易判断变化由哪里产生。完成实验后，用自己的话解释这一种结构适合什么任务，再决定是否放进实际应用。

## 放进真实项目之前

业务类别会变化，路由规则应该和输入Schema一起版本管理。不能只改模型提示词的标签名称，却忘了修改程序里的分支。日志至少记录原始类别、解析结果和实际目标，才能解释为什么这次走了另一条路。

这一步最有价值的成果不是一张更复杂的流程图，而是你能说清楚：输入在哪里进入、节点为什么被触发、结果从哪里出来、失败后怎样被发现。后续教程会在这条清楚的路径上逐步加入模型能力。

## 参考资料

- [Agent Framework 工作流](https://learn.microsoft.com/en-us/agent-framework/concepts/workflows/)
- [检查点与恢复](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
