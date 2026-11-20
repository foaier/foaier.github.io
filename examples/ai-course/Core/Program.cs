using AiCourse;

var lessons = new Dictionary<string, Func<Task>>(StringComparer.OrdinalIgnoreCase)
{
    ["chat"] = Lessons.Chat, ["agent"] = Lessons.Agent, ["stream"] = Lessons.Stream,
    ["session"] = Lessons.Session, ["save"] = Lessons.SaveSession, ["tools"] = Lessons.Tools,
    ["approval"] = Lessons.Approval, ["structured"] = Lessons.Structured,
    ["file-memory"] = Lessons.FileMemory, ["reduce"] = Lessons.Reduce,
    ["skill-inline"] = Lessons.InlineSkill, ["skill-file"] = Lessons.FileSkill,
    ["skill-class"] = Lessons.ClassSkill, ["skill-combine"] = Lessons.CombinedSkills,
    ["di"] = Lessons.DependencyInjection, ["middleware"] = Lessons.Middleware,
    ["vision"] = Lessons.Vision, ["project"] = Lessons.KnowledgeAssistant,
    ["check"] = Lessons.Check,
    ["nested-agent"] = Lessons.NestedAgent, ["skill-di"] = Lessons.SkillDi,
    ["plugin"] = Lessons.Plugin, ["telemetry"] = Lessons.Telemetry, ["plan"] = Lessons.Plan,
};
if (args.Length == 0 || !lessons.TryGetValue(args[0], out var run))
{
    Console.WriteLine("选择练习：" + string.Join(", ", lessons.Keys));
    return;
}
try { await run(); }
catch (Exception exception)
{
    Console.Error.WriteLine($"练习未完成：{exception.Message}");
    Environment.ExitCode = 1;
}
