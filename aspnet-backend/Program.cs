using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QuizNest.Api.Data;
using QuizNest.Api.Models;
using QuizNest.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.Configure<OllamaOptions>(builder.Configuration.GetSection("Ollama"));
builder.Services.AddSingleton(resolver =>
    resolver.GetRequiredService<Microsoft.Extensions.Options.IOptions<OllamaOptions>>().Value);
builder.Services.AddHttpClient<OllamaService>();
builder.Services.AddDbContext<QuizNestContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("QuizNestDatabase")));
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<QuizNestContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.MapControllers();
app.Run();
