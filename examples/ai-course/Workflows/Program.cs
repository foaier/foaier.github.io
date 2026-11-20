using Microsoft.Agents.AI.Workflows;
using AiCourse.Workflows;

if (args.Length > 0 && args[0] is "branch" or "switch" or "fanout" or "loop" or "human" or "checkpoint" or "rollback" or "resume-human" or "diagram" or "composition" or "sequential" or "concurrent" or "handoff" or "group" or "mixed" or "agent-node" or "multi-model" or "improve")
{
    await WorkflowLessons.Run(args[0]);
    return;
}

var normalize = new NormalizeExecutor();
var explain = new ExplainExecutor();
var workflow = new WorkflowBuilder(normalize).AddEdge(normalize, explain).WithOutputFrom(explain).Build();
await using StreamingRun run = await InProcessExecution.RunStreamingAsync(workflow, input: args.FirstOrDefault() ?? "  rag  ");
await foreach (WorkflowEvent evt in run.WatchStreamAsync())
{
    if (evt is ExecutorCompletedEvent completed) Console.WriteLine($"{completed.ExecutorId}: {completed.Data}");
    if (evt is WorkflowOutputEvent output) Console.WriteLine($"最终结果: {output.Data}");
    if (evt is WorkflowErrorEvent error) throw error.Exception ?? new InvalidOperationException("工作流失败。");
}

sealed class NormalizeExecutor() : Executor<string, string>("normalize")
{
    public override ValueTask<string> HandleAsync(string message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(message.Trim().ToUpperInvariant());
}

sealed class ExplainExecutor() : Executor<string, string>("explain")
{
    public override ValueTask<string> HandleAsync(string message, IWorkflowContext context, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(message == "RAG" ? "先检索资料，再结合资料生成答案。" : "这个练习只认识 RAG。 ");
}
