using AiCourse;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;

namespace AiCourse.Workflows;

public static class WorkflowLessons
{
    public static Workflow Basic()
    {
        var normalize = new TextStep("normalize", text => text.Trim().ToUpperInvariant());
        var answer = new TextStep("answer", text => text == "RAG" ? "先检索，再生成。" : "暂未收录。");
        return new WorkflowBuilder(normalize).AddEdge(normalize, answer).WithOutputFrom(answer).Build();
    }

    public static async Task Run(string name)
    {
        switch (name)
        {
            case "branch": await Observe(Branch(), "RAG"); await Observe(Branch(), "未知主题"); break;
            case "switch": foreach (var input in new[] { "RAG", "MCP", "未知主题" }) await Observe(Switch(), input); break;
            case "fanout": await Observe(FanOut(), "RAG"); break;
            case "loop": await Observe(Loop(), 0); break;
            case "human": await Human(false); break;
            case "resume-human": await Human(true); break;
            case "checkpoint": await Checkpoints(false); break;
            case "rollback": await Checkpoints(true); break;
            case "diagram": Console.WriteLine(Basic().ToMermaidString()); Console.WriteLine(Basic().ToDotString()); break;
            case "composition": await Observe(Composition(), " rag "); break;
            default: await Agents(name); break;
        }
    }

    public static Workflow Branch()
    {
        var input = new TextStep("input", value => value.Trim().ToUpperInvariant());
        var known = new TextStep("known", _ => "RAG：先查资料再回答。");
        var unknown = new TextStep("unknown", _ => "请补充一个已收录主题。");
        return new WorkflowBuilder(input)
            .AddEdge<string>(input, known, condition: value => value is string text && text == "RAG")
            .AddEdge<string>(input, unknown, condition: value => value is not string text || text != "RAG")
            .WithOutputFrom(known, unknown).Build();
    }

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

    public static Workflow FanOut()
    {
        var input = new TextStep("input", value => value);
        var explain = new TextStep("explain", topic => $"解释{topic}：先找资料，再回答。");
        var exercise = new TextStep("exercise", topic => $"练习{topic}：删除相关资料，观察是否拒答。");
        return new WorkflowBuilder(input).AddFanOutEdge(input, [explain, exercise])
            .WithOutputFrom(explain, exercise).Build();
    }

    public static Workflow Loop()
    {
        var increment = new CounterStep();
        var done = new NumberOutput();
        return new WorkflowBuilder(increment)
            .AddEdge<int>(increment, increment, condition: value => value is int number && number < 3)
            .AddEdge<int>(increment, done, condition: value => value is int number && number >= 3)
            .WithOutputFrom(done).Build();
    }

    public static Workflow Composition()
    {
        var before = new TextStep("before", value => value);
        var child = Basic().BindAsExecutor("concept-lookup");
        var after = new TextStep("after", value => "课程结果：" + value);
        return new WorkflowBuilder(before).AddEdge(before, child).AddEdge(child, after).WithOutputFrom(after).Build();
    }

    public static async Task Observe<T>(Workflow workflow, T input) where T : notnull
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        await using var run = await InProcessExecution.RunStreamingAsync(workflow, input);
        await foreach (var evt in run.WatchStreamAsync().WithCancellation(timeout.Token)) Print(evt);
    }

    public static void Print(WorkflowEvent evt)
    {
        if (evt is ExecutorCompletedEvent completed) Console.WriteLine($"{completed.ExecutorId}: {completed.Data}");
        if (evt is WorkflowOutputEvent output) Console.WriteLine($"最终结果：{output.Data}");
        if (evt is WorkflowErrorEvent error) throw error.Exception ?? new InvalidOperationException("工作流失败。");
    }

    public static async Task Human(bool restore)
    {
        static Workflow Build()
        {
            var request = RequestPort.Create<string, string>("choose-topic");
            var answer = new TextStep("answer", topic => $"已选择：{topic}。现在只记录选择，没有调用模型。");
            return new WorkflowBuilder(request).AddEdge(request, answer).WithOutputFrom(answer).Build();
        }
        var workflow = Build();
        var manager = CheckpointManager.Default;
        await using var run = await InProcessExecution.RunStreamingAsync(workflow, "你想学哪个主题？", manager);
        CheckpointInfo? waiting = null;
        await foreach (var evt in run.WatchStreamAsync(blockOnPendingRequest: !restore))
        {
            if (evt is SuperStepCompletedEvent step && step.CompletionInfo?.Checkpoint is { } checkpoint) waiting = checkpoint;
            if (evt is RequestInfoEvent info)
            {
                Console.WriteLine("工作流正在等待你选择学习主题。");
                if (!restore)
                {
                    Console.Write("输入主题：");
                    await run.SendResponseAsync(info.Request.CreateResponse(Console.ReadLine() ?? "AI入门"));
                }
            }
            Print(evt);
        }
        if (restore && waiting is not null)
        {
            Console.WriteLine("恢复等待输入的检查点。这里只演示同一进程中的恢复。");
            await using var resumed = await InProcessExecution.ResumeStreamingAsync(Build(), waiting, manager);
            await foreach (var evt in resumed.WatchStreamAsync())
            {
                if (evt is RequestInfoEvent info) await resumed.SendResponseAsync(info.Request.CreateResponse("改为学习MCP"));
                Print(evt);
            }
        }
    }

    public static async Task Checkpoints(bool rollback)
    {
        var manager = CheckpointManager.Default;
        var saved = new List<CheckpointInfo>();
        await using var first = await InProcessExecution.RunStreamingAsync(Basic(), " rag ", manager);
        await foreach (var evt in first.WatchStreamAsync())
        {
            if (evt is SuperStepCompletedEvent step && step.CompletionInfo?.Checkpoint is { } checkpoint) saved.Add(checkpoint);
            Print(evt);
        }
        if (saved.Count == 0) throw new InvalidOperationException("没有产生检查点。");
        Console.WriteLine($"保存 {saved.Count} 个检查点，恢复第一个。");
        if (rollback)
        {
            await first.RestoreCheckpointAsync(saved[0], CancellationToken.None);
            await foreach (var evt in first.WatchStreamAsync()) Print(evt);
        }
        else
        {
            await using var resumed = await InProcessExecution.ResumeStreamingAsync(Basic(), saved[0], manager);
            await foreach (var evt in resumed.WatchStreamAsync()) Print(evt);
        }
    }

    public static async Task Agents(string mode)
    {
        using var client = CourseClient.Create();
        AIAgent writer = client.AsAIAgent(instructions: "用中文给初学者解释问题，只写三句话。", name: "writer");
        AIAgent reviewer = client.AsAIAgent(instructions: "检查解释是否适合新手，输出一条改进建议。", name: "reviewer");
        if (mode == "concurrent") reviewer = client.AsAIAgent(
            instructions: "根据问题独立列出一个常见误区，不等待其他人的草稿。", name: "misconception_guide");
        if (mode == "handoff") writer = client.AsAIAgent(
            instructions: "先用三句话解释问题，然后把准确性审核交给reviewer。", name: "writer");
        if (mode == "mixed")
        {
            var normalize = new TextStep("normalize", value => value.Trim());
            var model = new AgentTextStep(writer);
            var label = new TextStep("label", value => "学习笔记：" + value);
            await Observe(new WorkflowBuilder(normalize).AddEdge(normalize, model).AddEdge(model, label).WithOutputFrom(label).Build(), "  解释RAG  ");
            return;
        }
        if (mode == "multi-model")
        {
            using var second = new OpenAI.OpenAIClient(new System.ClientModel.ApiKeyCredential(CourseClient.Required("SECOND_AI_API_KEY")),
                new OpenAI.OpenAIClientOptions { Endpoint = new Uri(CourseClient.Required("SECOND_AI_ENDPOINT")) })
                .GetChatClient(CourseClient.Required("SECOND_AI_MODEL")).AsIChatClient();
            reviewer = second.AsAIAgent(instructions: "检查前一份解释，指出一个不准确或需要补充的地方。", name: "second-model-reviewer");
            await RunAgents(AgentWorkflowBuilder.BuildSequential([writer, reviewer]));
            return;
        }
        Workflow workflow = mode switch
        {
            "agent-node" => new WorkflowBuilder(writer).WithOutputFrom(writer).Build(),
            "concurrent" => AgentWorkflowBuilder.BuildConcurrent([writer, reviewer]),
            "group" => AgentWorkflowBuilder.CreateGroupChatBuilderWith(agents => new RoundRobinGroupChatManager(agents) { MaximumIterationCount = 3 }).AddParticipants([writer, reviewer]).Build(),
            "improve" => AgentWorkflowBuilder.BuildSequential([writer, reviewer,
                client.AsAIAgent(instructions: "根据前面的评审意见修订解释，不添加没有根据的结论。只修订一次。", name: "reviser")]),
            "handoff" => AgentWorkflowBuilder.CreateHandoffBuilderWith(writer).WithHandoffs(writer, [reviewer]).Build(),
            _ => AgentWorkflowBuilder.BuildSequential([writer, reviewer]),
        };
        await RunAgents(workflow);
    }

    public static async Task RunAgents(Workflow workflow)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        await using var run = await InProcessExecution.RunStreamingAsync(workflow, new ChatMessage(ChatRole.User, "向AI新手解释RAG。"));
        await run.TrySendMessageAsync(new TurnToken(emitEvents: true));
        await foreach (var evt in run.WatchStreamAsync().WithCancellation(timeout.Token))
        {
            if (evt is AgentResponseUpdateEvent update) Console.Write(update.Data);
            Print(evt);
        }
    }
}

public sealed class AgentTextStep(AIAgent agent) : Executor<string, string>("agent-explain")
{
    public override async ValueTask<string> HandleAsync(string message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => (await agent.RunAsync(message, cancellationToken: cancellationToken)).ToString();
}

public sealed class TextStep(string id, Func<string, string> transform) : Executor<string, string>(id)
{
    public override ValueTask<string> HandleAsync(string message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(transform(message));
}
public sealed class CounterStep() : Executor<int, int>("increment")
{
    public override ValueTask<int> HandleAsync(int message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(message + 1);
}
public sealed class NumberOutput() : Executor<int, string>("done")
{
    public override ValueTask<string> HandleAsync(int message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => ValueTask.FromResult($"到达上限：{message}");
}
