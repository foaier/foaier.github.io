export const series = [
  { name: "AI 基础", id: "ai-basics", description: "把名词讲明白，再动手做一个小实验。" },
  { name: "提示词与知识库", id: "knowledge", description: "从写好提示词，到让模型用上自己的数据。" },
  { name: "Agent 开发", id: "agents", description: "让模型接入工具、记住上下文，完成实际任务。" },
  { name: "工作流实践", id: "workflows", description: "把多个步骤串起来，也把失败和恢复考虑进去。" },
] as const;

export function seriesId(name: string) {
  return series.find((item) => item.name === name)?.id ?? "engineering";
}
