using AiCourse.Integrations;

var lessons = new Dictionary<string, Func<Task>>
{
    ["history-memory"] = MemoryLessons.History, ["valkey"] = MemoryLessons.Valkey,
    ["foundry-memory"] = FoundryLessons.Memory, ["foundry"] = FoundryLessons.Chat,
    ["foundry-create"] = FoundryLessons.Create, ["foundry-existing"] = FoundryLessons.Existing,
    ["declarative"] = ServiceLessons.Declarative, ["copilot"] = ServiceLessons.Copilot,
    ["mcp-http"] = ServiceLessons.McpHttp, ["mcp-stdio"] = ServiceLessons.McpStdio,
    ["responses"] = AdvancedLessons.Responses, ["background"] = AdvancedLessons.Background,
    ["a2a"] = () => AdvancedLessons.A2a(false), ["a2a-tool"] = () => AdvancedLessons.A2a(true),
    ["harness"] = AdvancedLessons.Harness,
    ["web-search"] = () => AdvancedLessons.HostedTool("web-search"),
    ["file-search"] = () => AdvancedLessons.HostedTool("file-search"),
    ["code-interpreter"] = () => AdvancedLessons.HostedTool("code-interpreter"),
    ["openapi"] = () => AdvancedLessons.HostedTool("openapi"),
    ["mem0-add"] = () => AdvancedLessons.Mem0(true), ["mem0-search"] = () => AdvancedLessons.Mem0(false),
    ["embedding"] = EmbeddingLesson.Run,
    ["check-mcp"] = ServiceLessons.CheckMcp,
};
if (args.Length == 0 || !lessons.TryGetValue(args[0], out var run))
{
    Console.WriteLine("选择集成练习：" + string.Join(", ", lessons.Keys));
    return;
}
try { await run(); }
catch (Exception exception) { Console.Error.WriteLine(exception.Message); Environment.ExitCode = 1; }
