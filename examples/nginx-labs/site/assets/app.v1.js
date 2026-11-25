document.getElementById("route").textContent = location.pathname;
document.getElementById("load").addEventListener("click", async () => {
  const result = document.getElementById("result");
  try {
    const response = await fetch("/api/whoami");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    result.textContent = JSON.stringify(await response.json(), null, 2);
  } catch (error) { result.textContent = `请求失败：${error.message}。检查当前是否加载第 4 课或之后的代理配置。`; }
});
