using Npgsql;

if (args.Contains("--healthcheck", StringComparer.Ordinal))
{
    try
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        using var response = await client.GetAsync("http://127.0.0.1:8080/health/live");
        Environment.ExitCode = (int)response.StatusCode is >= 200 and < 300 ? 0 : 1;
    }
    catch (HttpRequestException)
    {
        Environment.ExitCode = 1;
    }
    catch (OperationCanceledException)
    {
        Environment.ExitCode = 1;
    }
    return;
}

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Host=localhost;Port=5432;Database=course;Username=course;Password=course-local-only";
var app = builder.Build();

app.MapGet("/", () => Results.Ok(new
{
    message = "容器课程 API 正在运行。",
    host = Environment.MachineName,
    version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "unknown",
}));

app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));

app.MapGet("/health/ready", async (CancellationToken cancellationToken) =>
{
    try
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT 1", connection);
        await command.ExecuteScalarAsync(cancellationToken);
        return Results.Ok(new { status = "ready", database = "connected" });
    }
    catch (NpgsqlException)
    {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapGet("/visits", async (CancellationToken cancellationToken) =>
{
    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await EnsureTable(connection, cancellationToken);
    await using var command = new NpgsqlCommand(
        "SELECT id, note, created_at FROM visits ORDER BY id DESC LIMIT 20", connection);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    var visits = new List<Visit>();
    while (await reader.ReadAsync(cancellationToken))
        visits.Add(new Visit(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2)));
    return Results.Ok(visits);
});

app.MapPost("/visits", async (CreateVisit request, CancellationToken cancellationToken) =>
{
    var note = request.Note?.Trim();
    if (string.IsNullOrWhiteSpace(note) || note.Length > 200)
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Note)] = ["请输入1到200个字符。"],
        });

    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await EnsureTable(connection, cancellationToken);
    await using var command = new NpgsqlCommand(
        "INSERT INTO visits (note) VALUES (@note) RETURNING id, note, created_at", connection);
    command.Parameters.AddWithValue("note", note);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    await reader.ReadAsync(cancellationToken);
    return Results.Created("/visits", new Visit(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2)));
});

app.Run();

static async Task EnsureTable(NpgsqlConnection connection, CancellationToken cancellationToken)
{
    // 教学环境按需建表，并串行化多个 API 副本的首次初始化；生产应用应使用版本化迁移。
    await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
    await using var schemaLock = new NpgsqlCommand("SELECT pg_advisory_xact_lock(84261001)", connection, transaction);
    await schemaLock.ExecuteNonQueryAsync(cancellationToken);
    await using var command = new NpgsqlCommand("""
        CREATE TABLE IF NOT EXISTS visits (
            id BIGSERIAL PRIMARY KEY,
            note VARCHAR(200) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """, connection, transaction);
    await command.ExecuteNonQueryAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
}

public sealed record CreateVisit(string? Note);
public sealed record Visit(long Id, string Note, DateTime CreatedAt);
